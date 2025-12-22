const sheetId = '1ZAFWV5aIVcA66qJEMPGGsg3azPY415_Clwe--JinQ7w'; // https://docs.google.com/spreadsheets/d/1ZAFWV5aIVcA66qJEMPGGsg3azPY415_Clwe--JinQ7w/edit#gid=0

const doGet = (event = {}) => {
  appendLog([event]);
  const { parameter } = event;
  const { action } = parameter;
  
  // 处理不同的GET请求
  switch(action) {
    case 'getPaymentOptions':
      return getPaymentOptions();
    case 'getMerchants':
      return getMerchants();
    case 'getMileageData':
      return getMileageData(parameter.carPlate, parameter.group);
    case 'getKeyValue':
      return getKeyValue(parameter.key, parameter.group);
    case 'getLastExpense':
      return getLastExpense(parameter.tag, parameter.title);
    case 'processCommitments':
      return processCommitments();
    case 'getNearbyLocations':
      return getNearbyLocations(parseFloat(parameter.latitude), parseFloat(parameter.longitude), parseFloat(parameter.radius || 1));
    case 'saveLocation':
      return saveLocation(data);
    default:
      // 兼容旧版本
      const { name, country } = parameter;
      return ContentService.createTextOutput(JSON.stringify({ name, country })).setMimeType(ContentService.MimeType.JSON);
  }
};
const doPost = (request = {}) => {
  try {
    const { parameter, postData: { contents, type } = {} } = request;
    
    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: '请求体为空'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    appendLog(['doPost called', 'type: ' + type, 'contents length: ' + contents.length]);
    
    let data;
    try {
      data = JSON.parse(contents);
    } catch (parseError) {
      appendLog(['JSON parse error:', parseError.toString()]);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'JSON 解析失败: ' + parseError.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    appendLog(['Parsed data:', 'action: ' + (data.action || 'N/A')]);
    
    // 根据action类型分发处理
    switch(data.action) {
      case 'uploadPhoto':
        return handlePhotoUpload(data);
      case 'updateMerchant':
        return updateMerchant(data);
      case 'updateMileage':
        return updateMileage(data);
      case 'setKeyValue':
        return setKeyValue(data);
      case 'saveLocation':
        return saveLocation(data);
      default:
      // 默认处理费用提交
      // 过滤掉不需要保存到Records sheet的字段（这些字段只用于KeyValueConfig）
      const recordsData = {...data};
      delete recordsData.carPlate;
      delete recordsData.mileage;
      delete recordsData.tripInfo;
      delete recordsData.fuelPrice;
      delete recordsData.fuelType;
      delete recordsData.day; // day字段也过滤掉，只用于照片文件名，不需要保存到Records
      insertRowToSheet(recordsData);
      
      // 如果有经纬度，自动保存到Location sheet
      if (data.geolocation) {
        try {
          // 从geolocation URL中提取经纬度和名称
          // 格式：q=lat,lng&name=locationName 或 q=lat,lng
          const geoMatch = data.geolocation.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
          if (geoMatch) {
            const latitude = parseFloat(geoMatch[1]);
            const longitude = parseFloat(geoMatch[2]);
            
            // 验证经纬度是否有效
            if (!isNaN(latitude) && !isNaN(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
              // 优先从URL中提取地点名称（如果存在）
              let locationName = '';
              const nameMatch = data.geolocation.match(/[&?]name=([^&]+)/);
              if (nameMatch) {
                locationName = decodeURIComponent(nameMatch[1]).trim();
              }
              
              // 如果URL中没有名称，尝试从remark中提取
              if (!locationName && data.remark) {
                locationName = data.remark.split('|')[0].trim(); // 取remark的第一部分作为地点名称
              }
              
              const locationData = {
                latitude: latitude,
                longitude: longitude,
                name: locationName
              };
              
              const saveResult = saveLocation(locationData);
              appendLog(['Location saved:', JSON.stringify(locationData), 'Result:', saveResult]);
            } else {
              appendLog(['Invalid latitude/longitude:', latitude, longitude]);
            }
          } else {
            appendLog(['Failed to parse geolocation URL:', data.geolocation]);
          }
        } catch (locationError) {
          appendLog(['Error saving location:', locationError.toString(), locationError.stack]);
          // 不阻止费用提交，静默失败
        }
      } else {
        appendLog(['No geolocation data in request']);
      }
      
      // 如果有车牌和里程数，自动保存到KeyValueConfig sheet
      if (data.carPlate && data.mileage && parseFloat(data.mileage) > 0) {
        try {
          const mileageData = {
            carPlate: data.carPlate,
            mileage: parseFloat(data.mileage),
            tag: data.tag || '',
            title: data.title || '',
            expenseType: data.tag === '交通出行' ? (data.title || '打油') : data.tag,
            remark: data.remark || '',
            amount: data.amount || 0,
            tripInfo: data.tripInfo || '', // 行程距离
            fuelPrice: data.fuelPrice || '', // 油品价格
            fuelType: data.fuelType || '' // 油品类型
          };
          updateMileageToSheet(mileageData);
          appendLog(['Mileage saved:', JSON.stringify(mileageData)]);
        } catch (mileageError) {
          appendLog(['Error saving mileage:', mileageError.toString()]);
          // 不阻止费用提交，静默失败
        }
      }
      
      // 处理照片上传（如果有）
      // 支持单个照片（旧格式）或照片数组（新格式）
      const uploadedPhotoUrls = [];
      
      // 生成照片文件名：{yearmonth}_{day}_{tag}_{title}_{timestamp}.jpg
      // day 是星期几的简写（mon, tue, wed, thu, fri, sat, sun）
      // 如果有多张照片，格式为：{yearmonth}_{day}_{tag}_{title}_{timestamp}_{no}_of_{total}.jpg
      const totalPhotos = data.photos && Array.isArray(data.photos) ? data.photos.filter(p => p).length : 1;
      const generatePhotoFileName = (index, total) => {
        const yearmonth = data.yearmonth || '';
        const day = data.day || ''; // 星期几简写：mon, tue, wed, thu, fri, sat, sun
        const tag = (data.tag || '').replace(/[\/\\?%*:|"<>]/g, '_'); // 清理特殊字符
        const title = (data.title || '').replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 50); // 限制长度并清理特殊字符
        const timestamp = (data.timestamp || '').replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s/g, '_');
        
        // 如果有多张照片（total > 1），所有照片都添加 {no}_of_{total} 格式
        const runningNo = total > 1 ? `_${index + 1}_of_${total}` : '';
        
        return `${yearmonth}_${day}_${tag}_${title}_${timestamp}${runningNo}.jpg`;
      };
      
      if (data.photos && Array.isArray(data.photos)) {
        // 处理多张照片（新格式）
        const validPhotos = data.photos.filter(p => p);
        const totalPhotos = validPhotos.length;
        
        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i];
          if (!photo) continue;
          
          try {
            // 如果是base64字符串（可能带前缀或不带前缀），需要上传
            if (typeof photo === 'string') {
              // 检查是否是 base64 数据（长度大于100且不包含 http）
              if (photo.length > 100 && !photo.startsWith('http')) {
                const fileName = generatePhotoFileName(i, totalPhotos);
                const result = uploadFileToDrive(photo, fileName, 'ExpensePhotos');
                if (result && result.success) {
                  // 使用预览URL，Google Sheets可以直接预览
                  uploadedPhotoUrls.push(result.previewUrl || result.fileUrl);
                  appendLog(['Photo uploaded successfully:', fileName, result.previewUrl || result.fileUrl]);
                } else {
                  appendLog(['Photo upload failed:', result ? result.error : 'Unknown error']);
                }
              } else if (photo.startsWith('http')) {
                // 已经是URL，直接使用
                uploadedPhotoUrls.push(photo);
              }
            }
          } catch (photoError) {
            appendLog(['Error uploading photo ' + i + ':', photoError.toString()]);
            // 继续处理其他照片
          }
        }
      } else if (data.photo && !data.photo_url) {
        // 处理单个照片（旧格式兼容）
        try {
          const fileName = generatePhotoFileName(0, 1);
          const result = uploadFileToDrive(data.photo, fileName, 'ExpensePhotos');
          if (result && result.success) {
            // 使用预览URL，Google Sheets可以直接预览
            uploadedPhotoUrls.push(result.previewUrl || result.fileUrl);
            appendLog(['Photo uploaded:', fileName, result.previewUrl || result.fileUrl]);
          } else {
            appendLog(['Photo upload failed:', result ? result.error : 'Unknown error']);
          }
        } catch (photoError) {
          appendLog(['Error uploading photo:', photoError.toString()]);
        }
      }
      
      // 将上传成功的照片URL保存到数据中
      if (uploadedPhotoUrls.length > 0) {
        appendLog(['Total photos uploaded:', uploadedPhotoUrls.length.toString()]);
        // 更新Sheet中的photo_urls字段
        try {
          const doc = SpreadsheetApp.openById(sheetId);
          const sheet = doc.getSheetByName('Records');
          if (sheet) {
            const lastRow = sheet.getLastRow();
            const headerRow = sheet.getRange('1:1').getValues()[0];
            const photoUrlsIndex = headerRow.indexOf('photo_urls');
            if (photoUrlsIndex > -1 && lastRow > 1) {
              // 使用逗号分隔多个URL
              sheet.getRange(lastRow, photoUrlsIndex + 1).setValue(uploadedPhotoUrls.join(', '));
            }
          }
        } catch (updateError) {
          appendLog(['Error updating photo_urls in sheet:', updateError.toString()]);
        }
      }
      
      var result = {
        status: "success",
        timestamp: data.timestamp
      };
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    appendLog(['Error in doPost:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '服务器错误: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
};

function appendLog(row, output_to_logger = false){
  if (output_to_logger){ Logger.log(JSON.stringify(row)); }
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('Log');
  try {
    if(arguments && arguments.callee &&arguments.callee.caller){
      row.unshift(arguments.callee.caller.name.toString());
    }
  } catch(e){
    row.unshift(JSON.stringify(arguments));
    row.unshift('Error: ' + e.toString());
    row.unshift('-');
  }
  
  row.unshift(datetimetoYMDHIS(new Date()));
  sheet.appendRow(row);
}
const makeHttpGetRequest = () => {
  const queryString = '?name=Amit+Agarwal&country=India';
  let apiUrl = ScriptApp.getService().getUrl();
  
  Logger.log({apiUrl});
  appendLog([apiUrl]);
  apiUrl = 'https://script.google.com/macros/s/AKfycbzUtULKeQZEIgYzAMtz9Vv31FzolQL-WFE1ri99RlaS_o-B6xnXaVfsb8KkvVax7YRorA/exec';
  Logger.log({apiUrl});
  const url = apiUrl + queryString;

  const options = {
    method: 'GET',
    followRedirects: true,
    muteHttpExceptions: true,
    contentType: 'application/json',
  };

  Logger.log({url,options});
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() == 200) {
    Logger.log(response);
    const { country } = JSON.parse(response);
    Logger.log('Country', country);
  }
};
const doPost2 = (request = {}) => {
  const { parameter, postData: { contents, type } = {} } = request;
  const { source } = parameter;

  if (type === 'application/json') {
    const jsonData = JSON.parse(contents);
    return ContentService.createTextOutput(JSON.stringify(jsonData));
  }

  if (type === 'application/x-www-form-urlencoded') {
    const json = {};
    contents
      .split('&')
      .map((input) => input.split('='))
      .forEach(([key, value]) => {
        json[decodeURIComponent(key)] = decodeURIComponent(value);
      });
    return ContentService.createTextOutput(JSON.stringify(json));
  }

  return ContentService.createTextOutput(contents);
};
// function include(filename) {
//   return HtmlService.createHtmlOutputFromFile(filename)
//       .getContent();
// }
function loopFolder(foldername){
  var folderNames = foldername.split('/');
}
function getFolder(foldername){
  var output = false;
  try {
    var folders = DriveApp.getFoldersByName(foldername);
    if (folders.hasNext()) {
      output = folders.next();
    } else {
      output = DriveApp.createFolder(foldername);
    }
  } catch(e){
    return 'Error: ' + e.toString();
  }
  return output;
}
function uploadFileToDrive(base64Data, fileName, foldername) {
  try {
    if (!base64Data) {
      return {
        success: false,
        error: 'base64 数据为空'
      };
    }
    
    if (!fileName) {
      return {
        success: false,
        error: '文件名为空'
      };
    }
    
    var folder = getFolder(foldername);
    if (!folder || typeof folder === 'string') {
      return {
        success: false,
        error: '无法创建或获取文件夹: ' + (folder || '未知错误')
      };
    }
    
    // Handle base64 data - it might already be split or have prefix
    var base64String = base64Data;
    var type = 'image/jpeg'; // default
    
    // Check if base64Data contains comma (has prefix like "data:image/jpeg;base64,")
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      var splitBase = base64Data.split(',');
      type = splitBase[0].split(';')[0].replace('data:', '');
      base64String = splitBase[1];
    } else {
      // Assume it's already just the base64 string, try to detect type from filename
      if (fileName.toLowerCase().endsWith('.png')) {
        type = 'image/png';
      } else if (fileName.toLowerCase().endsWith('.gif')) {
        type = 'image/gif';
      } else if (fileName.toLowerCase().endsWith('.webp')) {
        type = 'image/webp';
      }
    }

    // Decode base64
    var byteCharacters;
    try {
      byteCharacters = Utilities.base64Decode(base64String);
    } catch (decodeError) {
      return {
        success: false,
        error: 'base64 解码失败: ' + decodeError.toString()
      };
    }
    
    if (!byteCharacters || byteCharacters.length === 0) {
      return {
        success: false,
        error: '解码后的数据为空'
      };
    }
    
    var ss = Utilities.newBlob(byteCharacters, type);
    ss.setName(fileName);

    var file = folder.createFile(ss);
    
    if (!file || !file.getId()) {
      return {
        success: false,
        error: '文件创建失败'
      };
    }
    
    // Return object with file ID and URL for better handling
    // Google Sheets预览需要特定的URL格式
    const fileId = file.getId();
    return {
      success: true,
      fileId: fileId,
      fileName: file.getName(),
      fileUrl: `https://drive.google.com/file/d/${fileId}/view`,
      // Google Sheets可以预览的URL格式
      previewUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`
    };
  } catch(e){
    appendLog(['Error in uploadFileToDrive:', e.toString(), e.stack]);
    return {
      success: false,
      error: '上传失败: ' + e.toString()
    };
  }
}

function insertRowToSheet(obj, sheetName = 'Records'){
  try {
    let debug = false;
    if(!obj['timestamp']){
      obj['timestamp'] = datetimetoYMDHIS();
    }
    var coorWrite = {};
    var doc = SpreadsheetApp.openById(sheetId);
    var sheet = doc.getSheetByName(sheetName);
    // insert key to first row
    var first_row_data = sheet.getRange('1:1').getValues();
    var last_row_num = sheet.getLastRow();
    last_row_num = parseInt(last_row_num)+1;
    var obj_key = Object.keys(obj);
    if (debug){ appendLog([obj_key]); appendLog(['first_row_data',first_row_data]); appendLog(['last_row_num',last_row_num]); }
    var first_row_last_column = 1;
    first_row_data = first_row_data[0];
    for(var i = 0; i < first_row_data.length; i++){
      if(first_row_data[i].toString().trim() != ''){
        first_row_last_column++;
      }
    }
    if (debug){ appendLog(['first_row_last_column',first_row_last_column]); }
    
    
    var _tmp = '';
    for(var i = 0; i < obj_key.length; i++){
      var _k = obj_key[i].toString();
      var _v = obj[obj_key[i]].toString();
      if (debug){ appendLog([_k + ':' + _v]);}      

      // 检查是否有重复的字段（不区分大小写）
      // 如果已经有"Day"字段，就不要创建"day"字段
      var _columnInFirstRow = first_row_data.indexOf(_k);
      if (_columnInFirstRow === -1) {
        // 检查是否有大小写不同的版本
        for (var j = 0; j < first_row_data.length; j++) {
          if (first_row_data[j] && first_row_data[j].toString().toLowerCase() === _k.toLowerCase()) {
            _columnInFirstRow = j;
            _k = first_row_data[j].toString(); // 使用已存在的字段名
            break;
          }
        }
      }
      
      // key exists at first row
      if(_columnInFirstRow > -1 && last_row_num > 1){
        _columnInFirstRow++;
        _tmp = last_row_num +','+_columnInFirstRow;
        coorWrite[_tmp] = _v;
        if (debug){  appendLog(['keys exists in first_row: '+ _tmp+'='+_k]);}
      } else {
        // append key in first row
        _tmp = '1,'+first_row_last_column;
        coorWrite[_tmp] = _k;
        if (debug){ appendLog(['keys need to insert to first_row: '+ _tmp+'='+_k]);}

        /* for value */
        if(last_row_num == 1){
          last_row_num++;
        }
        _tmp = last_row_num +','+first_row_last_column;
        coorWrite[_tmp] = _v;
        if (debug){  appendLog([_tmp+'='+_v]);}
        first_row_last_column++;
      }
    }
    
    if (debug){ appendLog(['check',JSON.stringify(Object.keys(coorWrite))]);}
    var _coorWrite_keys = Object.keys(coorWrite);
    var _coorWrite_values = Object.keys(coorWrite).map(function(e) {return coorWrite[e]})
    if (debug){ appendLog(['_coorWrite_keys',JSON.stringify(_coorWrite_keys)]);}
    if (debug){ appendLog(['_coorWrite_values',JSON.stringify(_coorWrite_values)]);}
    // sheet.getRange(2, 1, 1, 1).setValues([['a']]);
    for(var i = 0; i < _coorWrite_keys.length;i++){
      var c = _coorWrite_keys[i].split(',');
      if (debug){ appendLog(['c',JSON.stringify(c),'_coorWrite_values[i]',_coorWrite_values[i]]);}
      /* row, column, count, count */
      sheet.getRange(c[0], c[1], 1, 1).setValues([[_coorWrite_values[i]]]);
    }
    return;
  } catch (e){
    return 'Error:' + e.toString(); 
  }
}

function datetimetoYMDHIS(inputDateTime = new Date()){
  let date = inputDateTime;
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let seconds = date.getSeconds();
  return year + "-" + month.toString().padStart(2,"0") + "-" + day.toString().padStart(2,"0") + " " + hours.toString().padStart(2,"0") + ":" + minutes.toString().padStart(2,"0") + ":" + seconds.toString().padStart(2,"0");
}

// ==================== 新增功能函数 ====================

/**
 * 获取支付选项
 */
function getPaymentOptions() {
  try {
    const paymentOptions = {
      'Cash': { key: 'Cash', card_num: 'Cash', bank: 'Cash' },
      'TnG_eWallet': { key: 'eWallet', card_num: 'TnG', bank: 'TnG' },
      'GrabPay_eWallet': { key: 'eWallet', card_num: 'GrabPay', bank: 'GrabPay' },
      'Setel_eWallet': { key: 'eWallet', card_num: 'Setel', bank: 'Setel' },
      'ShopeePay_eWallet': { key: 'eWallet', card_num: 'ShopeePay', bank: 'ShopeePay' }
    };
    
    
    return ContentService.createTextOutput(JSON.stringify(paymentOptions))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    appendLog(['Error in getPaymentOptions:', error.toString()]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 处理照片上传
 */
function handlePhotoUpload(data) {
  try {
    appendLog(['handlePhotoUpload called', 'filename: ' + (data.filename || 'N/A'), 'base64 length: ' + (data.base64 ? data.base64.length : 0)]);
    
    if (!data.base64) {
      throw new Error('缺少 base64 数据');
    }
    
    // 生成照片文件名：{yearmonth}_{day}_{tag}_{title}_{timestamp}.jpg
    // day 是星期几的简写（mon, tue, wed, thu, fri, sat, sun）
    let fileName;
    if (data.yearmonth && data.day && data.tag && data.title && data.timestamp) {
      const yearmonth = data.yearmonth || '';
      const day = data.day || ''; // 星期几简写：mon, tue, wed, thu, fri, sat, sun
      const tag = (data.tag || '').replace(/[\/\\?%*:|"<>]/g, '_');
      const title = (data.title || '').replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 50);
      const timestamp = (data.timestamp || '').replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s/g, '_');
      fileName = `${yearmonth}_${day}_${tag}_${title}_${timestamp}.jpg`;
    } else {
      // 如果没有完整信息，使用旧格式
      fileName = data.filename || `expense_photo_${data.timestamp || new Date().getTime()}.jpg`;
    }
    
    const result = uploadFileToDrive(data.base64, fileName, 'ExpensePhotos');
    
    appendLog(['uploadFileToDrive result:', JSON.stringify(result)]);
    
    if (result && result.success) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileId: result.fileId,
        fileName: result.fileName,
        fileUrl: result.fileUrl,
        previewUrl: result.previewUrl || result.fileUrl,
        thumbnailUrl: result.thumbnailUrl,
        timestamp: data.timestamp
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      const errorMsg = result && result.error ? result.error : '上传文件到 Drive 失败';
      appendLog(['Upload failed:', errorMsg]);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: errorMsg
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    const errorMsg = error.toString();
    appendLog(['Error in handlePhotoUpload:', errorMsg, error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: errorMsg
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 获取商家列表
 */
function getMerchants() {
  try {
    // 可以从另一个Sheet读取商家数据
    const merchants = getMerchantsFromSheet();
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      merchants: merchants
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in getMerchants:', error.toString()]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 更新商家信息
 */
function updateMerchant(data) {
  try {
    const result = updateMerchantToSheet(data);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      merchant: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in updateMerchant:', error.toString()]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 获取里程数据
 */
function getMileageData(carPlate, group) {
  try {
    const mileageData = getMileageFromSheet(carPlate, group);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      mileageData: mileageData
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in getMileageData:', error.toString()]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 更新里程数据
 */
function updateMileage(data) {
  try {
    const result = updateMileageToSheet(data);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      mileageData: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in updateMileage:', error.toString()]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== 辅助函数 ====================

/**
 * 从Sheet获取商家数据
 */
function getMerchantsFromSheet() {
  try {
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('Merchants');
    
    if (!sheet) {
      // 创建Merchants sheet
      sheet = doc.insertSheet('Merchants');
      sheet.getRange('1:1').setValues([['经度', '纬度', '商家名称', '地址', '分类', '创建时间', '使用次数']]);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
      sheet.setFrozenRows(1);
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const merchants = [];
    
    for (let i = 1; i < data.length; i++) {
      const [longitude, latitude, name, address, category, createdTime, usageCount] = data[i];
      if (longitude && latitude) {
        merchants.push({
          longitude, 
          latitude, 
          name, 
          address, 
          category, 
          createdTime, 
          usageCount: usageCount || 0,
          coordinates: `${latitude},${longitude}`
        });
      }
    }
    
    return merchants;
  } catch (error) {
    appendLog(['Error in getMerchantsFromSheet:', error.toString()]);
    return [];
  }
}

/**
 * 根据坐标查找最近的商家
 */
function findNearestMerchant(longitude, latitude, maxDistance = 0.001) {
  try {
    const merchants = getMerchantsFromSheet();
    let nearestMerchant = null;
    let minDistance = maxDistance;
    
    merchants.forEach(merchant => {
      const distance = Math.sqrt(
        Math.pow(merchant.longitude - longitude, 2) + 
        Math.pow(merchant.latitude - latitude, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestMerchant = merchant;
      }
    });
    
    return nearestMerchant;
  } catch (error) {
    appendLog(['Error in findNearestMerchant:', error.toString()]);
    return null;
  }
}

/**
 * 更新商家到Sheet
 * 智能处理：如果相同位置已存在商家，则更新使用次数；否则创建新记录
 */
function updateMerchantToSheet(data) {
  try {
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('Merchants');
    
    if (!sheet) {
      sheet = doc.insertSheet('Merchants');
      sheet.getRange('1:1').setValues([['经度', '纬度', '商家名称', '地址', '分类', '创建时间', '使用次数']]);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    // 查找是否已存在相同位置的商家（允许小误差）
    const existingData = sheet.getDataRange().getValues();
    let rowIndex = -1;
    const tolerance = 0.0001; // 位置误差容忍度
    
    for (let i = 1; i < existingData.length; i++) {
      const [longitude, latitude] = existingData[i];
      if (Math.abs(longitude - data.longitude) < tolerance && 
          Math.abs(latitude - data.latitude) < tolerance) {
        rowIndex = i + 1; // Sheet的行索引从1开始
        break;
      }
    }
    
    const currentTime = datetimetoYMDHIS();
    const row = [
      data.longitude,
      data.latitude,
      data.name || existingData[rowIndex > 0 ? rowIndex - 1 : 0]?.[2] || '',
      data.address || existingData[rowIndex > 0 ? rowIndex - 1 : 0]?.[3] || '',
      data.category || existingData[rowIndex > 0 ? rowIndex - 1 : 0]?.[4] || '',
      rowIndex > 0 ? existingData[rowIndex - 1][5] : currentTime, // 保持原始创建时间
      rowIndex > 0 ? (existingData[rowIndex - 1][6] || 0) + 1 : 1 // 增加使用次数
    ];
    
    if (rowIndex > 0) {
      // 更新现有行
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      // 添加新行
      sheet.appendRow(row);
    }
    
    return {
      longitude: data.longitude,
      latitude: data.latitude,
      name: row[2],
      address: row[3],
      category: row[4],
      coordinates: `${data.latitude},${data.longitude}`
    };
  } catch (error) {
    appendLog(['Error in updateMerchantToSheet:', error.toString()]);
    throw error;
  }
}

/**
 * 获取里程数据
 * 新列结构：Group | Key | Value | Timestamp | Info
 * 对于里程数据：Group=分类（如'打油'、'保养'、'轮胎'），Key=carPlate, Value=mileage
 * @param {string} carPlate - 车牌号
 * @param {string} group - 分类（如'打油'、'保养'、'轮胎'），默认为'打油'
 */
function getMileageFromSheet(carPlate, group) {
  try {
    // 如果没有指定group，默认为'打油'
    const searchGroup = group || '打油';
    appendLog(['getMileageFromSheet called', 'carPlate: ' + carPlate, 'group: ' + searchGroup]);
    
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('KeyValueConfig');
    
    if (!sheet) {
      appendLog(['KeyValueConfig sheet does not exist, creating new sheet']);
      sheet = doc.insertSheet('KeyValueConfig');
      sheet.getRange('1:1').setValues([['Group', 'Key', 'Value', 'Timestamp', 'Info']]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
      sheet.setFrozenRows(1);
      appendLog(['KeyValueConfig sheet created, returning empty data']);
      return { carPlate, group: searchGroup, records: [], latestMileage: 0, previousMileage: 0, calculatedTrip: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    appendLog(['KeyValueConfig sheet data rows:', data.length, 'Searching for carPlate:', carPlate, 'group:', searchGroup]);
    
    const records = [];
    const searchPlate = carPlate.toString().trim().toUpperCase(); // 转换为大写进行比较
    
    for (let i = 1; i < data.length; i++) {
      const [rowGroup, key, value, timestamp, info] = data[i];
      const groupStr = rowGroup ? rowGroup.toString().trim() : '';
      const keyStr = key ? key.toString().trim().toUpperCase() : '';
      
      // 匹配指定的 Group 和 Key
      if (groupStr === searchGroup && keyStr === searchPlate) {
        const mileageValue = parseFloat(value);
        if (!isNaN(mileageValue) && mileageValue > 0) {
          records.push({ 
            carPlate: key, 
            mileage: mileageValue, 
            recordTime: timestamp, 
            expenseType: groupStr, 
            remark: info || '' 
          });
          appendLog(['Matched record found:', JSON.stringify({ carPlate: key, mileage: mileageValue, recordTime: timestamp, group: groupStr })]);
        }
      }
    }
    
    appendLog(['Total matched records:', records.length]);
    
    // 按时间排序，最新的在前
    records.sort((a, b) => {
      const dateA = new Date(a.recordTime);
      const dateB = new Date(b.recordTime);
      return dateB - dateA;
    });
    
    const result = {
      carPlate,
      group: searchGroup,
      records,
      latestMileage: records.length > 0 ? records[0].mileage : 0,
      previousMileage: records.length > 1 ? records[1].mileage : 0,
      calculatedTrip: records.length > 1 ? records[0].mileage - records[1].mileage : 0
    };
    
    appendLog(['getMileageFromSheet result:', JSON.stringify(result)]);
    
    return result;
  } catch (error) {
    appendLog(['Error in getMileageFromSheet:', error.toString(), error.stack]);
    return { carPlate, group: group || '打油', records: [], latestMileage: 0, previousMileage: 0, calculatedTrip: 0 };
  }
}

/**
 * 更新里程数据到Sheet（Upsert操作：存在则更新，不存在则插入）
 * 新列结构：Group | Key | Value | Timestamp | Info
 * 对于里程数据：Group=tag|title（如'交通出行|打油'），Key=carPlate, Value=mileage
 * KeyValueConfig是类似redis的架构，使用upsert而不是append
 */
function updateMileageToSheet(data) {
  try {
    appendLog(['updateMileageToSheet called', JSON.stringify(data)]);
    
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('KeyValueConfig');
    
    if (!sheet) {
      appendLog(['KeyValueConfig sheet does not exist, creating new sheet']);
      sheet = doc.insertSheet('KeyValueConfig');
      sheet.getRange('1:1').setValues([['Group', 'Key', 'Value', 'Timestamp', 'Info']]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    // 根据 tag 和 title 动态生成 Group，格式为 tag|title
    let group = '';
    if (data.tag && data.title) {
      group = data.tag.toString().trim() + '|' + data.title.toString().trim();
    } else if (data.tag) {
      group = data.tag.toString().trim();
    } else if (data.title) {
      group = data.title.toString().trim();
    } else {
      // 如果没有 tag 和 title，使用 expenseType 作为后备
      group = data.expenseType || '打油';
    }
    
    // 构建 Info 字段
    let infoParts = [];
    if (data.remark) {
      infoParts.push(data.remark);
    }
    
    // 如果是打油记录，计算并添加油耗指标
    if (data.title === '打油' || data.expenseType === '打油') {
      const amount = parseFloat(data.amount) || 0;
      const tripInfo = parseFloat(data.tripInfo) || 0;
      const fuelPrice = parseFloat(data.fuelPrice) || 0;
      
      if (amount > 0 && tripInfo > 0) {
        // 每 RM1 行驶多少 km
        const kmPerRM1 = (tripInfo / amount).toFixed(2);
        // 每 km 多少 RM
        const rmPerKm = (amount / tripInfo).toFixed(4);
        
        infoParts.push(`每RM1: ${kmPerRM1}km`);
        infoParts.push(`每km: RM${rmPerKm}`);
      }
    }
    
    const info = infoParts.join(' | ');
    
    // 确保 mileage 是数字类型
    const mileageValue = parseFloat(data.mileage);
    if (isNaN(mileageValue) || mileageValue <= 0) {
      appendLog(['Invalid mileage value:', data.mileage]);
      throw new Error('Invalid mileage value: ' + data.mileage);
    }
    
    // 查找现有记录（基于 Group 和 Key）
    const dataRange = sheet.getDataRange().getValues();
    const searchGroup = group;
    const searchKey = data.carPlate.toString().trim().toUpperCase();
    let foundRowIndex = -1;
    let oldValue = null;
    
    for (let i = 1; i < dataRange.length; i++) {
      const [rowGroup, rowKey] = dataRange[i];
      const rowGroupStr = rowGroup ? rowGroup.toString().trim() : '';
      const rowKeyStr = rowKey ? rowKey.toString().trim().toUpperCase() : '';
      
      if (rowGroupStr === searchGroup && rowKeyStr === searchKey) {
        foundRowIndex = i + 1; // Sheet行号（从1开始，需要+1因为第1行是header）
        oldValue = dataRange[i][2]; // Value列（索引2）
        break;
      }
    }
    
    const currentTime = datetimetoYMDHIS();
    
    if (foundRowIndex > 0) {
      // 更新现有记录
      appendLog(['Updating existing record at row:', foundRowIndex, 'Old value:', oldValue, 'New value:', mileageValue]);
      sheet.getRange(foundRowIndex, 3).setValue(mileageValue); // 更新 Value 列
      sheet.getRange(foundRowIndex, 4).setValue(currentTime); // 更新 Timestamp 列
      sheet.getRange(foundRowIndex, 5).setValue(info); // 更新 Info 列
      
      // 记录更新日志到Log Sheet
      appendLog(['Mileage updated', `Group: ${group}`, `Key: ${data.carPlate}`, `Old ODO: ${oldValue}`, `New ODO: ${mileageValue}`, `Timestamp: ${currentTime}`]);
    } else {
      // 插入新记录
      const row = [
        group,  // Group (格式: tag|title)
        data.carPlate,  // Key
        mileageValue,  // Value (确保是数字)
        currentTime,  // Timestamp
        info  // Info (包含备注和油耗指标)
      ];
      
      appendLog(['Inserting new record to KeyValueConfig sheet:', JSON.stringify(row)]);
      sheet.appendRow(row);
      
      // 记录插入日志到Log Sheet
      appendLog(['Mileage inserted', `Group: ${group}`, `Key: ${data.carPlate}`, `ODO: ${mileageValue}`, `Timestamp: ${currentTime}`]);
    }
    
    // 验证数据是否成功写入
    const verifyData = sheet.getDataRange().getValues();
    appendLog(['KeyValueConfig sheet now has', verifyData.length - 1, 'data rows']);
    
    const result = getMileageFromSheet(data.carPlate, group);
    appendLog(['updateMileageToSheet result:', JSON.stringify(result)]);
    
    return result;
  } catch (error) {
    appendLog(['Error in updateMileageToSheet:', error.toString(), error.stack]);
    throw error;
  }
}

/**
 * 通用Key-Value存储函数
 * 使用KeyValueConfig sheet存储key-value对
 * 新列结构：Group | Key | Value | Timestamp | Info
 */
function getKeyValueSheet() {
  const doc = SpreadsheetApp.openById(sheetId);
  let sheet = doc.getSheetByName('KeyValueConfig');
  
  if (!sheet) {
    appendLog(['KeyValueConfig sheet does not exist, creating new sheet']);
    sheet = doc.insertSheet('KeyValueConfig');
    sheet.getRange('1:1').setValues([['Group', 'Key', 'Value', 'Timestamp', 'Info']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * 获取Key-Value值
 * 新列结构：Group | Key | Value | Timestamp | Info
 * 对于Key-Value配置：Group=group（默认为'KeyValue'）, Key=key, Value=value
 * @param {string} key - 要获取的key
 * @param {string} group - Group名称，默认为'KeyValue'
 */
function getKeyValue(key, group) {
  try {
    // 如果没有指定group，默认为'KeyValue'
    const searchGroup = group || 'KeyValue';
    appendLog(['getKeyValue called', 'key: ' + key, 'group: ' + searchGroup]);
    
    if (!key) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Key is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = getKeyValueSheet();
    const data = sheet.getDataRange().getValues();
    
    const searchKey = key.toString().trim().toUpperCase();
    
    for (let i = 1; i < data.length; i++) {
      const [rowGroup, keyCol, value, timestamp, info] = data[i];
      const groupStr = rowGroup ? rowGroup.toString().trim() : '';
      const keyStr = keyCol ? keyCol.toString().trim().toUpperCase() : '';
      
      // 查找匹配的 Group 和 Key
      if (groupStr === searchGroup && keyStr === searchKey) {
        appendLog(['Key-Value found:', key, value, 'group:', searchGroup]);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          key: key,
          value: value,
          group: searchGroup,
          updatedAt: timestamp
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    appendLog(['Key-Value not found:', key, 'group:', searchGroup]);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      key: key,
      group: searchGroup,
      value: null,
      updatedAt: null
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in getKeyValue:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 设置Key-Value值
 * 新列结构：Group | Key | Value | Timestamp | Info
 * 对于Key-Value配置：Group='KeyValue', Key=key, Value=value
 */
function setKeyValue(data) {
  try {
    appendLog(['setKeyValue called', JSON.stringify(data)]);
    
    const { key, value, group } = data;
    
    if (!key) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Key is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 如果没有指定group，默认为'KeyValue'
    const searchGroup = group || 'KeyValue';
    
    const sheet = getKeyValueSheet();
    const dataRange = sheet.getDataRange().getValues();
    
    const searchKey = key.toString().trim().toUpperCase();
    const currentTime = datetimetoYMDHIS();
    
    // 查找是否已存在（匹配 Group 和 Key）
    let found = false;
    for (let i = 1; i < dataRange.length; i++) {
      const [rowGroup, keyCol] = dataRange[i];
      const groupStr = rowGroup ? rowGroup.toString().trim() : '';
      const keyStr = keyCol ? keyCol.toString().trim().toUpperCase() : '';
      
      if (groupStr === searchGroup && keyStr === searchKey) {
        // 更新现有记录
        sheet.getRange(i + 1, 3).setValue(value); // 更新 Value 列
        sheet.getRange(i + 1, 4).setValue(currentTime); // 更新 Timestamp 列
        found = true;
        appendLog(['Key-Value updated:', key, value, 'group:', searchGroup]);
        break;
      }
    }
    
    if (!found) {
      // 添加新记录
      const row = [
        searchGroup,  // Group
        key,          // Key
        value,        // Value
        currentTime,  // Timestamp
        ''            // Info
      ];
      sheet.appendRow(row);
      appendLog(['Key-Value added:', key, value, 'group:', searchGroup]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      key: key,
      value: value,
      group: searchGroup,
      updatedAt: currentTime
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in setKeyValue:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 处理Commitment自动插入
 * 根据Commitment sheet中的配置，自动插入Records
 */
function processCommitments() {
  try {
    appendLog(['processCommitments called']);
    
    const doc = SpreadsheetApp.openById(sheetId);
    let commitmentSheet = doc.getSheetByName('Commitment');
    
    if (!commitmentSheet) {
      appendLog(['Commitment sheet does not exist, creating new sheet']);
      commitmentSheet = doc.insertSheet('Commitment');
      commitmentSheet.getRange('1:1').setValues([['TAG', 'TITLE', 'INTERVAL', 'INTERVAL_TYPE', 'START', 'END', 'LAST_RUN']]);
      commitmentSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
      commitmentSheet.setFrozenRows(1);
      appendLog(['Commitment sheet created, no commitments to process']);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        processed: 0,
        message: 'Commitment sheet created, no commitments to process'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = commitmentSheet.getDataRange().getValues();
    if (data.length <= 1) {
      appendLog(['No commitments found']);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        processed: 0,
        message: 'No commitments found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const now = new Date();
    let processedCount = 0;
    const records = [];
    
    // 从第2行开始处理（第1行是header）
    for (let i = 1; i < data.length; i++) {
      const [tag, title, interval, intervalType, start, end, lastRun] = data[i];
      
      if (!tag || !title || !interval || !intervalType || !start) {
        continue; // 跳过不完整的记录
      }
      
      try {
        // 解析日期
        const startDate = new Date(start);
        const endDate = end && end.toString().trim() !== '' && end.toString() !== '0000-00-00' ? new Date(end) : null;
        const lastRunDate = lastRun && lastRun.toString().trim() !== '' ? new Date(lastRun) : null;
        
        // 检查是否在有效期内
        if (now < startDate) {
          continue; // 还没开始
        }
        
        if (endDate && now > endDate) {
          continue; // 已过期
        }
        
        // 计算下次应该执行的时间
        let nextRunDate = lastRunDate || startDate;
        const intervalNum = parseInt(interval) || 1;
        
        switch (intervalType.toString().toLowerCase()) {
          case 'weekly':
            nextRunDate = new Date(nextRunDate);
            nextRunDate.setDate(nextRunDate.getDate() + (intervalNum * 7));
            break;
          case 'biweekly':
            nextRunDate = new Date(nextRunDate);
            nextRunDate.setDate(nextRunDate.getDate() + (intervalNum * 14));
            break;
          case 'monthly':
            nextRunDate = new Date(nextRunDate);
            nextRunDate.setMonth(nextRunDate.getMonth() + intervalNum);
            break;
          case 'yearly':
            nextRunDate = new Date(nextRunDate);
            nextRunDate.setFullYear(nextRunDate.getFullYear() + intervalNum);
            break;
          default:
            appendLog(['Unknown interval type:', intervalType]);
            continue;
        }
        
        // 如果当前时间已经超过下次执行时间，则插入记录
        if (now >= nextRunDate) {
          // 获取上一次的金额（如果有）
          let amount = 0;
          try {
            const lastExpenseResult = getLastExpense(tag.toString().trim(), title.toString().trim());
            if (lastExpenseResult) {
              const lastExpenseData = JSON.parse(lastExpenseResult.getContent());
              if (lastExpenseData.success && lastExpenseData.lastExpense) {
                amount = parseFloat(lastExpenseData.lastExpense.amount) || 0;
              }
            }
          } catch (e) {
            appendLog(['Error getting last expense:', e.toString()]);
          }
          
          // 插入Records
          const expenseData = {
            timestamp: datetimetoYMDHIS(now),
            yearmonth: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM'),
            day: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()],
            title: title.toString().trim(),
            amount: amount.toString(),
            remark: 'auto insert by commitment cron',
            tag: tag.toString().trim(),
            currency: 'MYR',
            payment_method: 'Auto'
          };
          
          insertRowToSheet(expenseData);
          records.push({ tag, title, amount, timestamp: expenseData.timestamp });
          processedCount++;
          
          // 更新LAST_RUN
          commitmentSheet.getRange(i + 1, 7).setValue(datetimetoYMDHIS(now));
          appendLog(['Commitment processed:', tag, title, 'Amount:', amount, 'Timestamp:', expenseData.timestamp]);
        }
      } catch (error) {
        appendLog(['Error processing commitment row ' + (i + 1) + ':', error.toString()]);
      }
    }
    
    appendLog(['processCommitments completed', 'Processed:', processedCount]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      processed: processedCount,
      records: records
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in processCommitments:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 计算两点之间的距离（使用Haversine公式，返回公里数）
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 获取附近的地点（1km范围内）
 */
function getNearbyLocations(latitude, longitude, radiusKm = 1) {
  try {
    appendLog(['getNearbyLocations called', 'latitude: ' + latitude, 'longitude: ' + longitude, 'radius: ' + radiusKm + 'km']);
    
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid latitude or longitude'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('Location');
    
    if (!sheet) {
      appendLog(['Location sheet does not exist, creating new sheet']);
      sheet = doc.insertSheet('Location');
      sheet.getRange('1:1').setValues([['LATITUDE', 'LONGITUDE', 'NAME', 'CREATED_TIME', 'USAGE_COUNT']]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
      sheet.setFrozenRows(1);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        locations: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const nearbyLocations = [];
    
    // 从第2行开始处理（第1行是header）
    for (let i = 1; i < data.length; i++) {
      const [lat, lon, name, createdTime, usageCount] = data[i];
      
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
        continue;
      }
      
      const distance = calculateDistance(latitude, longitude, parseFloat(lat), parseFloat(lon));
      
      if (distance <= radiusKm) {
        nearbyLocations.push({
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          name: name || '',
          distance: distance.toFixed(2),
          createdTime: createdTime || '',
          usageCount: usageCount || 0
        });
      }
    }
    
    // 按距离排序，最近的在前
    nearbyLocations.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    
    appendLog(['Found', nearbyLocations.length, 'nearby locations']);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      locations: nearbyLocations
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in getNearbyLocations:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 保存地点到Location sheet
 */
function saveLocation(data) {
  try {
    appendLog(['saveLocation called', JSON.stringify(data)]);
    
    const { latitude, longitude, name } = data;
    
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid latitude or longitude'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('Location');
    
    if (!sheet) {
      appendLog(['Location sheet does not exist, creating new sheet']);
      sheet = doc.insertSheet('Location');
      sheet.getRange('1:1').setValues([['LATITUDE', 'LONGITUDE', 'NAME', 'CREATED_TIME', 'USAGE_COUNT']]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    // 查找是否已存在相同位置的地点（允许小误差，约11米）
    const existingData = sheet.getDataRange().getValues();
    let rowIndex = -1;
    const tolerance = 0.0001; // 约11米的位置误差容忍度
    
    for (let i = 1; i < existingData.length; i++) {
      const [lat, lon] = existingData[i];
      if (Math.abs(parseFloat(lat) - latitude) < tolerance && 
          Math.abs(parseFloat(lon) - longitude) < tolerance) {
        rowIndex = i + 1; // Sheet的行索引从1开始
        break;
      }
    }
    
    const currentTime = datetimetoYMDHIS();
    
    if (rowIndex > 0) {
      // 更新现有记录（增加使用次数，更新名称如果有提供）
      const existingName = existingData[rowIndex - 1][2] || '';
      const newName = name && name.trim() ? name.trim() : existingName;
      const usageCount = (existingData[rowIndex - 1][4] || 0) + 1;
      
      sheet.getRange(rowIndex, 3).setValue(newName); // 更新名称
      sheet.getRange(rowIndex, 5).setValue(usageCount); // 更新使用次数
      
      appendLog(['Location updated:', latitude, longitude, 'Name:', newName, 'Usage:', usageCount]);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        latitude: latitude,
        longitude: longitude,
        name: newName,
        usageCount: usageCount,
        updated: true
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // 添加新记录
      const row = [
        latitude,
        longitude,
        name || '',
        currentTime,
        1 // 初始使用次数
      ];
      
      sheet.appendRow(row);
      appendLog(['Location added:', latitude, longitude, 'Name:', name]);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        latitude: latitude,
        longitude: longitude,
        name: name || '',
        usageCount: 1,
        updated: false
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    appendLog(['Error in saveLocation:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 计算油耗效率（用于打油记录分析）
 */
function calculateFuelEfficiency(mileageData, fuelAmount, fuelPrice) {
  try {
    const trip = mileageData.calculatedTrip || 0;
    const totalCost = parseFloat(fuelAmount) || 0;
    const pricePerLiter = parseFloat(fuelPrice) || 2.05;
    const fuelLiters = totalCost / pricePerLiter;
    
    return {
      trip: trip,
      fuelLiters: fuelLiters.toFixed(2),
      costPerKm: trip > 0 ? (totalCost / trip).toFixed(2) : 0,
      litersPer100Km: trip > 0 ? ((fuelLiters / trip) * 100).toFixed(2) : 0,
      efficiency: trip > 0 && fuelLiters > 0 ? (trip / fuelLiters).toFixed(2) : 0
    };
  } catch (error) {
    appendLog(['Error in calculateFuelEfficiency:', error.toString()]);
    return null;
  }
}