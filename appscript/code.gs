const sheetId = '1ZAFWV5aIVcA66qJEMPGGsg3azPY415_Clwe--JinQ7w'; // https://docs.google.com/spreadsheets/d/1ZAFWV5aIVcA66qJEMPGGsg3azPY415_Clwe--JinQ7w/edit#gid=0

const doGet = (event = {}) => {
  appendLog([event]);
  const { parameter } = event;
  const { action } = parameter;
  if (!isAccessAllowed(action, parameter, null)) return accessDeniedOut();
  
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
    case 'verifyAccess':
      return verifyAccess(parameter || {});
    case 'getLastExpense':
      return getLastExpense(parameter.tag, parameter.title);
    case 'processCommitments':
      return processCommitments();
    case 'listObligations':
      return listObligations();
    case 'processDueObligations':
      return processDueObligations();
    case 'getNearbyLocations':
      return getNearbyLocations(parseFloat(parameter.latitude), parseFloat(parameter.longitude), parseFloat(parameter.radius || 1));
    case 'listLandmarkRegions':
      return listLandmarkRegions();
    case 'getParkedLocation':
      return getParkedLocation(parameter.carPlate);
    case 'getParkedLocations':
      return getParkedLocations();
    case 'getBootstrap':
      return getBootstrap();
    case 'getExpenseSummary':
      return getExpenseSummary(parameter || {});
    case 'runDailyJobs':
      return runDailyJobs();
    case 'saveLocation':
      return saveLocation(data);
    case 'trackCalendar':
    case 'check_current':
      return handleCalendarTrack(parameter || {});
    default:
      // 兼容旧版本
      const { name, country } = parameter;
      return ContentService.createTextOutput(JSON.stringify({ name, country })).setMimeType(ContentService.MimeType.JSON);
  }
};
const doPost = (request = {}) => {
  try {
    const { parameter, postData: { contents, type } = {} } = request;
    
    var queryParams = parameter || {};
    var typeStr = (type || '').toString();

    if (!contents) {
      if (queryParams.action === 'trackCalendar' || queryParams.action === 'check_current') {
        return handleCalendarTrack(queryParams);
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: '请求体为空'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    appendLog(['doPost called', 'type: ' + type, 'contents length: ' + contents.length]);

    if (typeStr.indexOf('application/x-www-form-urlencoded') !== -1) {
      if (queryParams.action === 'trackCalendar' || queryParams.action === 'check_current') {
        return handleCalendarTrack(queryParams);
      }
    }

    let data;
    try {
      data = JSON.parse(contents);
    } catch (parseError) {
      if (queryParams.action === 'trackCalendar' || queryParams.action === 'check_current') {
        return handleCalendarTrack(queryParams);
      }
      appendLog(['JSON parse error:', parseError.toString()]);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'JSON 解析失败: ' + parseError.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    appendLog(['Parsed data:', 'action: ' + (data.action || 'N/A')]);
    if (!isAccessAllowed(data.action, queryParams, data)) return accessDeniedOut();
    
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
      case 'verifyAccess':
        return verifyAccess(data || {});
      case 'saveLocation':
        return saveLocation(data);
      case 'listLandmarkRegions':
        return listLandmarkRegions();
      case 'upsertLandmarkRegion':
        return upsertLandmarkRegion(data);
      case 'deleteLandmarkRegion':
        return deleteLandmarkRegion(data);
      case 'listObligations':
        return listObligations();
      case 'upsertObligation':
        return upsertObligation(data);
      case 'deleteObligation':
        return deleteObligation(data);
      case 'upsertObligationInstallment':
        return upsertObligationInstallment(data);
      case 'processDueObligations':
        return processDueObligations();
      case 'getExpenseSummary':
        return getExpenseSummary(data || {});
      case 'runDailyJobs':
        return runDailyJobs();
      case 'trackCalendar':
      case 'check_current':
        return handleCalendarTrack(data);
      case 'parkLocation':
      case 'save_parking':
        return handleParkLocation(data);
      case 'analyzeReceipt':
        return handleAnalyzeReceipt(data);
      case 'upsertExpense':
        return handleUpsertExpense(data);
      default:
        // 默认：费用 Replace Into / Insert
        return handleUpsertExpense(data);
    }
  } catch (error) {
    appendLog(['Error in doPost:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '服务器错误: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
};

function appendLog(row, output_to_logger) {
  if (output_to_logger) { Logger.log(JSON.stringify(row)); }
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('Log');
  if (!sheet) return;
  if (!(row instanceof Array)) row = [row];
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

/**
 * Replace Into：以毫秒 id（或 timestamp_ms）為 Primary Key。
 * 優先找 header「id」欄；若無則使用第 1 欄。
 */
function upsertRowById(obj, sheetName) {
  sheetName = sheetName || 'Records';
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) {
    sheet = doc.insertSheet(sheetName);
  }

  var id = obj.id !== undefined && obj.id !== null && obj.id !== ''
    ? String(obj.id)
    : (obj.timestamp_ms !== undefined ? String(obj.timestamp_ms) : '');
  if (!id) {
    id = String(new Date().getTime());
    obj.id = id;
  } else {
    obj.id = id;
  }

  var headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1));
  var headers = headerRange.getValues()[0];
  var idCol = -1;
  for (var h = 0; h < headers.length; h++) {
    if (headers[h] && headers[h].toString().toLowerCase() === 'id') {
      idCol = h;
      break;
    }
  }
  if (idCol === -1) {
    // 確保第一欄為 id
    if (!headers[0] || headers[0].toString().trim() === '') {
      sheet.getRange(1, 1).setValue('id');
      headers[0] = 'id';
    } else if (headers[0].toString().toLowerCase() !== 'id') {
      sheet.insertColumnBefore(1);
      sheet.getRange(1, 1).setValue('id');
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    idCol = 0;
  }

  var lastRow = sheet.getLastRow();
  var existingRow = -1;
  if (lastRow >= 2) {
    var idValues = sheet.getRange(2, idCol + 1, lastRow, idCol + 1).getValues();
    for (var r = 0; r < idValues.length; r++) {
      if (String(idValues[r][0]) === id) {
        existingRow = r + 2;
        break;
      }
    }
  }

  // 確保 headers 含所有 keys
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var found = false;
    for (var j = 0; j < headers.length; j++) {
      if (headers[j] && headers[j].toString() === k) {
        found = true;
        break;
      }
    }
    if (!found) {
      var newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(k);
      headers[newCol - 1] = k;
    }
  }
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var targetRow = existingRow > 0 ? existingRow : sheet.getLastRow() + 1;
  if (targetRow === 1) targetRow = 2;

  for (var c = 0; c < headers.length; c++) {
    var headerName = headers[c] ? headers[c].toString() : '';
    if (!headerName) continue;
    if (obj[headerName] !== undefined && obj[headerName] !== null) {
      var val = obj[headerName];
      if (typeof val === 'object') val = JSON.stringify(val);
      sheet.getRange(targetRow, c + 1).setValue(val);
    }
  }

  return { row: targetRow, updated: existingRow > 0, id: id };
}

/**
 * 費用寫入：Replace Into + 附帶 Location / Mileage / Photo 副作用
 */
function handleUpsertExpense(data) {
  try {
    const recordsData = {...data};
    delete recordsData.action;
    delete recordsData.carPlate;
    delete recordsData.mileage;
    delete recordsData.tripInfo;
    delete recordsData.fuelPrice;
    delete recordsData.fuelType;
    delete recordsData.day;
    delete recordsData.photos; // 大字段另處理
    delete recordsData.photo;
    if (!recordsData.description && recordsData.simpleDescription) {
      recordsData.description = recordsData.simpleDescription;
    }
    delete recordsData.simpleDescription;

    var upsert = upsertRowById(recordsData, 'Records');

    // 地理
    if (data.geolocation) {
      try {
        const geoMatch = data.geolocation.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (geoMatch) {
          const latitude = parseFloat(geoMatch[1]);
          const longitude = parseFloat(geoMatch[2]);
          if (!isNaN(latitude) && !isNaN(longitude)) {
            let locationName = '';
            const nameMatch = data.geolocation.match(/[&?]name=([^&]+)/);
            if (nameMatch) locationName = decodeURIComponent(nameMatch[1]).trim();
            saveLocation({ latitude: latitude, longitude: longitude, name: locationName });
          }
        }
      } catch (e) {
        appendLog(['upsertExpense location side-effect', e.toString()]);
      }
    } else if (data.latitude && data.longitude) {
      try {
        saveLocation({
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          name: ''
        });
      } catch (e2) {}
    }

    // 里程
    if (data.carPlate && data.mileage && parseFloat(data.mileage) > 0) {
      try {
        updateMileageToSheet({
          carPlate: data.carPlate,
          mileage: parseFloat(data.mileage),
          tag: data.tag || '',
          title: data.title || '',
          expenseType: data.tag === '交通出行' ? (data.title || '打油') : data.tag,
          remark: data.remark || '',
          amount: data.amount || 0,
          tripInfo: data.tripInfo || '',
          fuelPrice: data.fuelPrice || '',
          fuelType: data.fuelType || ''
        });
      } catch (e3) {
        appendLog(['upsertExpense mileage', e3.toString()]);
      }
    }

    // 照片
    var uploadedPhotoUrls = [];
    var generatePhotoFileName = function (index, total) {
      var yearmonth = data.yearmonth || '';
      var day = data.day || '';
      var tag = (data.tag || '').replace(/[\/\\?%*:|"<>]/g, '_');
      var title = (data.title || '').replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 50);
      var timestamp = (data.timestamp || data.id || '').toString().replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s/g, '_');
      var runningNo = total > 1 ? '_' + (index + 1) + '_of_' + total : '';
      return yearmonth + '_' + day + '_' + tag + '_' + title + '_' + timestamp + runningNo + '.jpg';
    };
    if (data.photos && Array.isArray(data.photos)) {
      var valid = data.photos.filter(function (p) { return p; });
      for (var i = 0; i < data.photos.length; i++) {
        var photo = data.photos[i];
        if (!photo || typeof photo !== 'string') continue;
        if (photo.length > 100 && photo.indexOf('http') !== 0) {
          var result = uploadFileToDrive(photo, generatePhotoFileName(i, valid.length), 'ExpensePhotos');
          if (result && result.success) uploadedPhotoUrls.push(result.previewUrl || result.fileUrl);
        } else if (photo.indexOf('http') === 0) {
          uploadedPhotoUrls.push(photo);
        }
      }
    }

    if (uploadedPhotoUrls.length > 0) {
      try {
        var doc = SpreadsheetApp.openById(sheetId);
        var sheet = doc.getSheetByName('Records');
        var headerRow = sheet.getRange('1:1').getValues()[0];
        var photoUrlsIndex = headerRow.indexOf('photo_urls');
        if (photoUrlsIndex > -1) {
          sheet.getRange(upsert.row, photoUrlsIndex + 1).setValue(uploadedPhotoUrls.join(', '));
        }
      } catch (e4) {}
    }

    var calendarEventId = '';
    try {
      calendarEventId = syncExpenseCalendarEvent(data, upsert) || '';
    } catch (calErr) {
      appendLog(['upsertExpense calendar', calErr.toString()]);
    }
    try {
      invalidateExpenseSummary(data.yearmonth);
    } catch (invErr) {}

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      status: 'success',
      id: upsert.id,
      updated: upsert.updated,
      row: upsert.row,
      timestamp: data.timestamp,
      calendarEventId: calendarEventId
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    appendLog(['Error in handleUpsertExpense:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 收據 AI 辨識 stub：請在 Script Properties 設定 GEMINI_API_KEY 後擴充。
 * 目前先存圖並回傳空欄位，保持 thin-client 契約。
 */
function handleAnalyzeReceipt(data) {
  try {
    var uploaded = null;
    if (data.photo) {
      var fileName = 'receipt_' + (data.id || new Date().getTime()) + '.jpg';
      uploaded = uploadFileToDrive(data.photo, fileName, 'ExpensePhotos');
    }
    // TODO: UrlFetchApp → Gemini；回填 amount/title/merchant
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      action: 'analyzeReceipt',
      photoUrl: uploaded && uploaded.success ? (uploaded.previewUrl || uploaded.fileUrl) : null,
      extracted: {
        amount: null,
        title: null,
        currency: null,
        remark: null
      },
      note: 'Set GEMINI_API_KEY in Script Properties to enable AI extraction'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
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
function getPaymentOptionsMap() {
  return {
    'Cash': { key: 'Cash', card_num: 'Cash', bank: 'Cash' },
    'TnG_eWallet': { key: 'eWallet', card_num: 'TnG', bank: 'TnG' },
    'GrabPay_eWallet': { key: 'eWallet', card_num: 'GrabPay', bank: 'GrabPay' },
    'Setel_eWallet': { key: 'eWallet', card_num: 'Setel', bank: 'Setel' },
    'ShopeePay_eWallet': { key: 'eWallet', card_num: 'ShopeePay', bank: 'ShopeePay' }
  };
}

function getPaymentOptions() {
  try {
    return jsonOut(getPaymentOptionsMap());
  } catch (error) {
    appendLog(['Error in getPaymentOptions:', error.toString()]);
    return jsonOut({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * One GET for small, slowly-changing caches. Skips expense rows / mileage / nearby.
 */
function getBootstrap() {
  var out = {
    success: true,
    fetchedAt: new Date().getTime(),
    paymentOptions: null,
    parked: { byCar: {} },
    landmarks: []
  };
  try {
    out.paymentOptions = getPaymentOptionsMap();
  } catch (e) {
    out.paymentOptionsError = e.toString();
  }
  try {
    out.parked = { byCar: collectParkedLocationsByCar() };
  } catch (e) {
    out.parkedError = e.toString();
  }
  try {
    out.landmarks = collectLandmarkRegions();
  } catch (e) {
    out.landmarksError = e.toString();
  }
  try {
    ensureAccessHashRow();
  } catch (e) {}
  return jsonOut(out);
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
var ACCESS_HASH_KEY = 'APP_ACCESS_HASH';
var ACCESS_HASH_DEFAULT = 'change-me-selfmanage';

function ensureAccessHashRow() {
  var sheet = getKeyValueSheet();
  var data = sheet.getDataRange().getValues();
  var searchKey = ACCESS_HASH_KEY.toUpperCase();
  for (var i = 1; i < data.length; i++) {
    var groupStr = data[i][0] ? String(data[i][0]).trim() : '';
    var keyStr = data[i][1] ? String(data[i][1]).trim().toUpperCase() : '';
    if (groupStr === 'KeyValue' && keyStr === searchKey) {
      return data[i][2] != null ? String(data[i][2]) : '';
    }
  }
  sheet.appendRow([
    'KeyValue',
    ACCESS_HASH_KEY,
    ACCESS_HASH_DEFAULT,
    datetimetoYMDHIS(),
    'app gate hash; change Value'
  ]);
  return ACCESS_HASH_DEFAULT;
}

function verifyAccess(parameter) {
  parameter = parameter || {};
  var submitted = String(parameter.hash || parameter.access || parameter.value || parameter.k || '').trim();
  var expected = String(ensureAccessHashRow() || '').trim();
  var ok = submitted !== '' && expected !== '' && submitted === expected;
  return jsonOut({ success: true, ok: ok });
}

var ACCESS_OPEN_ACTIONS = {
  verifyAccess: true,
  trackCalendar: true
};

function submittedAccess(parameter, data) {
  parameter = parameter || {};
  data = data || {};
  return String(parameter.access || parameter.k || data.access || data.k || '').trim();
}

function accessDeniedOut() {
  return jsonOut({ success: false, ok: false, error: 'Forbidden', access: false });
}

/** HTTP requests (except verify / calendar shortcut) must carry the sheet hash. */
function isAccessAllowed(action, parameter, data) {
  if (ACCESS_OPEN_ACTIONS[String(action || '')]) return true;
  var expected = String(ensureAccessHashRow() || '').trim();
  if (!expected) return true;
  var submitted = submittedAccess(parameter, data);
  return submitted !== '' && submitted === expected;
}

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
    if (key.toString().trim().toUpperCase() === ACCESS_HASH_KEY) {
      return jsonOut({ success: false, error: 'Forbidden' });
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
    if (key.toString().trim().toUpperCase() === ACCESS_HASH_KEY) {
      return jsonOut({ success: false, error: 'Forbidden' });
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
          usageCount: usageCount || 0,
          // Compat: treat legacy single points as ~100m hit radius
          radiusM: 100
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
 * LandmarkRegion sheet helpers
 * Columns: ID, NAME, LATITUDE, LONGITUDE, RADIUS_M, VERTICES_JSON, UPDATED_AT
 */
function ensureLandmarkRegionSheet() {
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('LandmarkRegion');
  var headers = ['ID', 'NAME', 'LATITUDE', 'LONGITUDE', 'RADIUS_M', 'VERTICES_JSON', 'UPDATED_AT'];
  if (!sheet) {
    sheet = doc.insertSheet('LandmarkRegion');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function collectLandmarkRegions() {
  var sheet = ensureLandmarkRegionSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = Math.max(sheet.getLastColumn(), 7);
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var regions = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = (row[0] || '').toString().trim();
    var name = (row[1] || '').toString().trim();
    var lat = parseFloat(row[2]);
    var lng = parseFloat(row[3]);
    if (!id || !name || isNaN(lat) || isNaN(lng)) continue;
    var radiusM = parseFloat(row[4]);
    if (isNaN(radiusM) || radiusM < 10) radiusM = 150;
    var vertices = [];
    var shape = 'circle';
    try {
      if (row[5]) {
        var parsedVerts = JSON.parse(row[5].toString());
        if (Array.isArray(parsedVerts)) {
          vertices = parsedVerts;
          shape = parsedVerts.length >= 3 ? 'polygon' : 'circle';
        } else if (parsedVerts && typeof parsedVerts === 'object') {
          vertices = Array.isArray(parsedVerts.vertices) ? parsedVerts.vertices : [];
          shape = (parsedVerts.shape || '').toString().trim();
          if (shape !== 'rect' && shape !== 'polygon' && shape !== 'circle' && shape !== 'point') {
            shape = vertices.length >= 3 ? 'polygon' : 'circle';
          }
        }
      }
    } catch (e) {
      vertices = [];
      shape = 'circle';
    }
    var updatedAt = 0;
    if (row[6] instanceof Date) updatedAt = row[6].getTime();
    else if (row[6]) {
      var parsed = Date.parse(String(row[6]).replace(' ', 'T'));
      if (!isNaN(parsed)) updatedAt = parsed;
    }
    regions.push({
      id: id,
      name: name,
      latitude: lat,
      longitude: lng,
      lat: lat,
      lng: lng,
      radiusM: radiusM,
      vertices: Array.isArray(vertices) ? vertices : [],
      shape: shape || 'circle',
      updatedAt: updatedAt || Date.now()
    });
  }
  var namedPoints = collectNamedLocationPoints();
  for (var p = 0; p < namedPoints.length; p++) {
    var pt = namedPoints[p];
    var dup = false;
    for (var r = 0; r < regions.length; r++) {
      if (
        String(regions[r].name || '').toLowerCase() === String(pt.name || '').toLowerCase() &&
        calculateDistance(regions[r].lat, regions[r].lng, pt.lat, pt.lng) <= 0.12
      ) {
        dup = true;
        break;
      }
    }
    if (!dup) regions.push(pt);
  }
  return regions;
}

function collectNamedLocationPoints() {
  try {
    var doc = SpreadsheetApp.openById(sheetId);
    var sheet = doc.getSheetByName('Location');
    if (!sheet || sheet.getLastRow() < 2) return [];
    var values = sheet.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < values.length; i++) {
      var lat = parseFloat(values[i][0]);
      var lng = parseFloat(values[i][1]);
      var name = (values[i][2] || '').toString().trim();
      if (!name || isNaN(lat) || isNaN(lng)) continue;
      var updatedAt = 0;
      if (values[i][3] instanceof Date) updatedAt = values[i][3].getTime();
      else if (values[i][3]) {
        var parsedT = Date.parse(String(values[i][3]).replace(' ', 'T'));
        if (!isNaN(parsedT)) updatedAt = parsedT;
      }
      out.push({
        id: 'loc_' + lat.toFixed(5) + '_' + lng.toFixed(5),
        name: name,
        latitude: lat,
        longitude: lng,
        lat: lat,
        lng: lng,
        radiusM: 100,
        vertices: [],
        shape: 'point',
        updatedAt: updatedAt || 1
      });
    }
    return out;
  } catch (e) {
    appendLog(['collectNamedLocationPoints', e.toString()]);
    return [];
  }
}

function listLandmarkRegions() {
  try {
    return jsonOut({
      success: true,
      regions: collectLandmarkRegions()
    });
  } catch (error) {
    appendLog(['Error in listLandmarkRegions:', error.toString(), error.stack]);
    return jsonOut({
      success: false,
      error: error.toString(),
      regions: []
    });
  }
}

function upsertLandmarkRegion(data) {
  try {
    appendLog(['upsertLandmarkRegion called', JSON.stringify(data)]);
    var name = (data.name || '').toString().trim();
    var lat = parseFloat(data.latitude != null ? data.latitude : data.lat);
    var lng = parseFloat(data.longitude != null ? data.longitude : data.lng);
    var radiusM = parseFloat(data.radiusM != null ? data.radiusM : data.radius_m);
    if (!name || isNaN(lat) || isNaN(lng)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid name or coordinates'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (isNaN(radiusM) || radiusM < 10) radiusM = 150;
    var id = (data.id || '').toString().trim();
    if (!id) id = 'lr_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    var vertices = Array.isArray(data.vertices) ? data.vertices : [];
    var shape = (data.shape || '').toString().trim();
    if (shape !== 'rect' && shape !== 'polygon' && shape !== 'circle' && shape !== 'point') {
      shape = vertices.length >= 3 ? 'polygon' : 'circle';
    }
    if (shape === 'point' && (isNaN(parseFloat(data.radiusM)) || parseFloat(data.radiusM) < 10)) {
      radiusM = 100;
    }
    var verticesJson = JSON.stringify({ shape: shape, vertices: vertices });
    var updatedAt = datetimetoYMDHIS();

    var sheet = ensureLandmarkRegionSheet();
    var lastRow = sheet.getLastRow();
    var rowIndex = -1;
    if (lastRow >= 2) {
      var ids = sheet.getRange(2, 1, lastRow, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0] || '').trim() === id) {
          rowIndex = i + 2;
          break;
        }
      }
    }

    var row = [id, name, lat, lng, radiusM, verticesJson, updatedAt];
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 7).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      region: {
        id: id,
        name: name,
        latitude: lat,
        longitude: lng,
        radiusM: radiusM,
        vertices: vertices,
        shape: shape,
        updatedAt: Date.now()
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    appendLog(['Error in upsertLandmarkRegion:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteLandmarkRegion(data) {
  try {
    var id = (data && data.id ? data.id : '').toString().trim();
    if (!id) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing id'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var sheet = ensureLandmarkRegionSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        deleted: false
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var ids = sheet.getRange(2, 1, lastRow, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim() === id) {
        sheet.deleteRow(i + 2);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          deleted: true,
          id: id
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      deleted: false,
      id: id
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    appendLog(['Error in deleteLandmarkRegion:', error.toString(), error.stack]);
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

/**
 * ========== Calendar 智慧狀態追蹤 + 車位 ==========
 * 請依實際座標調整 GEOFENCES（radiusM 為公尺）
 */
var GEOFENCES = [
  // 範例：請改成你的實際座標
  // { name: '家', lat: 3.1390, lng: 101.6869, radiusM: 200 },
  // { name: '公司', lat: 3.1500, lng: 101.7000, radiusM: 150 },
  // { name: '某停車場', lat: 3.1450, lng: 101.6900, radiusM: 120 },
];

var CALENDAR_START_MARKER = '**start**';
var CALENDAR_END_MARKER = '**end**';
var CALENDAR_HOME_MARKER = '**home**';
var CALENDAR_DEFAULT_DURATION_MS = 60 * 60 * 1000; // 新建事件預設 1 小時
var CALENDAR_EXTEND_MS = 20 * 60 * 1000; // 追加時至少延長到 timestamp+20 分鐘
var CALENDAR_LOOKBACK_DAYS_DEFAULT = 3;
var CALENDAR_LOOKBACK_DAYS_MIN = 1;
var CALENDAR_LOOKBACK_DAYS_MAX = 14;
var CALENDAR_LOOKAHEAD_MS = 60 * 60 * 1000;

function calendarLookbackDaysRaw(data) {
  if (!data) return null;
  if (data.days != null && String(data.days).trim() !== '') return data.days;
  if (data.lookbackDays != null && String(data.lookbackDays).trim() !== '') return data.lookbackDays;
  return null;
}

function calendarLookbackDaysParsed(data) {
  var raw = calendarLookbackDaysRaw(data);
  if (raw == null) return null;
  var days = Number(raw);
  if (isNaN(days)) return null;
  days = Math.floor(days);
  if (days < CALENDAR_LOOKBACK_DAYS_MIN || days > CALENDAR_LOOKBACK_DAYS_MAX) return null;
  return days;
}

function calendarLookbackMs(data) {
  var parsed = calendarLookbackDaysParsed(data);
  if (parsed != null) return parsed * 24 * 60 * 60 * 1000;
  var days = CALENDAR_LOOKBACK_DAYS_DEFAULT;
  try {
    var prop = PropertiesService.getScriptProperties().getProperty('CALENDAR_LOOKBACK_DAYS');
    if (prop != null && String(prop).trim() !== '') days = Number(prop);
  } catch (e) {}
  if (isNaN(days) || days < CALENDAR_LOOKBACK_DAYS_MIN) days = CALENDAR_LOOKBACK_DAYS_DEFAULT;
  if (days > CALENDAR_LOOKBACK_DAYS_MAX) days = CALENDAR_LOOKBACK_DAYS_MAX;
  return days * 24 * 60 * 60 * 1000;
}

/**
 * 地理圍欄反查：落在預設範圍內則回傳地名，否則空字串
 */
function resolvePlaceName(lat, lng) {
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
    return '';
  }
  for (var i = 0; i < GEOFENCES.length; i++) {
    var g = GEOFENCES[i];
    if (!g || g.lat === undefined || g.lng === undefined) continue;
    var distanceKm = calculateDistance(lat, lng, g.lat, g.lng);
    var radiusKm = (g.radiusM || 100) / 1000;
    if (distanceKm <= radiusKm) {
      return g.name || '';
    }
  }
  return '';
}

function calendarJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function calendarFlag(value, defaultVal) {
  if (value === undefined || value === null || value === '') return defaultVal;
  var s = String(value).trim().toLowerCase();
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  return defaultVal;
}

function parseCalendarTimestamp(raw, ms) {
  if (ms !== undefined && ms !== null && String(ms).trim() !== '') {
    var epoch = Number(ms);
    if (!isNaN(epoch) && isFinite(epoch) && epoch > 0) {
      return new Date(epoch < 1e12 ? epoch * 1000 : epoch);
    }
  }
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return new Date();
  }
  var s = String(raw).trim();
  if (/^\d{10,13}$/.test(s)) {
    var n = Number(s);
    return new Date(s.length <= 10 ? n * 1000 : n);
  }
  // ISO with Z / ±offset is an instant. Do not treat the digits as local wall time
  // (toISOString() is UTC; naive parse would shift by the script timezone, e.g. -8h).
  var hasOffset = /[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s.replace(/\.\d+/, ''));
  if (hasOffset) {
    var instant = new Date(s);
    if (!isNaN(instant.getTime())) return instant;
  }
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    var naive = m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + m[6];
    try {
      return Utilities.parseDate(naive, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    } catch (parseErr) {
      return new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6])
      );
    }
  }
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return new Date();
}

function formatCalendarStamp(when) {
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(when, tz, 'yyyy-MM-dd HH:mm:ss');
}

function parseCalendarCoords(data) {
  data = data || {};
  var lat = parseFloat(data.latitude != null && data.latitude !== '' ? data.latitude : data.lat);
  var lng = parseFloat(data.longitude != null && data.longitude !== '' ? data.longitude : data.lng);
  if (!isNaN(lat) && !isNaN(lng)) return { lat: lat, lng: lng };
  var ll = data.latlong != null ? data.latlong : data.latlng;
  if (ll) {
    var parts = String(ll).split(',');
    if (parts.length >= 2) {
      lat = parseFloat(parts[0]);
      lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat: lat, lng: lng };
    }
  }
  return { lat: NaN, lng: NaN };
}

function trailPrefix(raw, fallback) {
  var s = raw == null ? '' : String(raw).trim();
  if (!s) return fallback || '-no input-';
  return s;
}

function resolveCalendarOp(data) {
  data = data || {};
  var action = String(data.action || '').trim();
  var op = String(data.op || '').trim().toLowerCase();
  if (action === 'check_current' || op === 'check' || op === 'check_current') return 'check';
  if (op === 'start' || op === 'append' || op === 'end' || op === 'home') return op;
  var prefix = String(data.prefix || '').trim().toLowerCase();
  if (prefix === 'start' || prefix === 'end') return prefix;
  return 'append';
}

/**
 * Compact relative gap: (47m), (1h47m), (1d2h47m33s).
 * Largest unit first; skip zeros.
 */
function formatTrailGap(ms) {
  if (!(ms >= 1000)) return '';
  var totalSec = Math.floor(ms / 1000);
  var d = Math.floor(totalSec / 86400);
  var h = Math.floor((totalSec % 86400) / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;
  var parts = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  if (m) parts.push(m + 'm');
  if (s) parts.push(s + 's');
  if (!parts.length) return '';
  return ' - (' + parts.join('') + ')';
}

function lastTrailTimestamp(desc) {
  var lines = (desc || '').toString().split('\n');
  for (var i = lines.length - 1; i >= 0; i--) {
    var line = (lines[i] || '').trim();
    var match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
    if (!match) continue;
    var parsed = parseCalendarTimestamp(match[1]);
    if (parsed && !isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * 格式：[YYYY-MM-DD HH:mm:ss][prefix]place@http://maps.google.com/maps?q=lat,lng - (1h47m)
 */
function buildCalendarLogLine(prefix, placeName, lat, lng, when, prevWhen) {
  var timeStr = formatCalendarStamp(when || new Date());
  var prefixPart = trailPrefix(prefix, '-no input-');
  var placePart = placeName || '';
  var mapsUrl = '';
  if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
    mapsUrl = 'http://maps.google.com/maps?q=' + lat + ',' + lng;
  }
  var line = '[' + timeStr + '][' + prefixPart + ']' + placePart + (mapsUrl ? '@' + mapsUrl : '');
  if (prevWhen && when) {
    line += formatTrailGap(when.getTime() - prevWhen.getTime());
  }
  return line;
}

function descriptionFirstLine(desc) {
  var text = (desc || '').toString().replace(/^\uFEFF/, '');
  var nl = text.indexOf('\n');
  var first = (nl === -1 ? text : text.substring(0, nl)).trim();
  return first;
}

function setFirstLineMarker(desc, marker) {
  var text = (desc || '').toString();
  if (!text.trim()) return marker;
  var lines = text.split('\n');
  var first = (lines[0] || '').trim();
  if (
    first === CALENDAR_START_MARKER ||
    first === CALENDAR_END_MARKER ||
    first === CALENDAR_HOME_MARKER
  ) {
    lines[0] = marker;
    return lines.join('\n');
  }
  return marker + '\n' + text.replace(/^\s+/, '');
}

function descriptionHasTrail(desc, timestampStr, prefix) {
  var needle = '[' + timestampStr + '][' + prefix + ']';
  return (desc || '').indexOf(needle) !== -1;
}

function appendDescriptionLine(desc, line) {
  var text = (desc || '').replace(/\s+$/, '');
  if (!text) return line;
  if (text.indexOf(line) !== -1) return text;
  return text + '\n' + line;
}

function findEventsByFirstLine(calendar, marker, when, lookbackMs) {
  var back = lookbackMs || CALENDAR_LOOKBACK_DAYS_DEFAULT * 24 * 60 * 60 * 1000;
  var from = new Date(when.getTime() - back);
  var to = new Date(when.getTime() + CALENDAR_LOOKAHEAD_MS);
  var events = calendar.getEvents(from, to);
  var out = [];
  for (var i = 0; i < events.length; i++) {
    if (descriptionFirstLine(events[i].getDescription()) === marker) {
      out.push(events[i]);
    }
  }
  return out;
}

function eventIdKey(event) {
  try {
    return String(event.getId());
  } catch (e) {
    return '';
  }
}

function mergeCalendarEvents(primary, extra) {
  var seen = {};
  var out = [];
  function add(list) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var key = eventIdKey(list[i]);
      if (key && seen[key]) continue;
      if (key) seen[key] = true;
      out.push(list[i]);
    }
  }
  add(primary);
  add(extra);
  return out;
}

/**
 * Timed events happening at `when` (start <= when <= end).
 * Includes pre-planned meetings that were never marked **start**.
 * Skips all-day, already **end** / **home**.
 */
function findLiveTimedEvents(calendar, when, lookbackMs) {
  var back = lookbackMs || CALENDAR_LOOKBACK_DAYS_DEFAULT * 24 * 60 * 60 * 1000;
  var from = new Date(when.getTime() - back);
  var to = new Date(when.getTime() + CALENDAR_LOOKAHEAD_MS);
  var events = calendar.getEvents(from, to);
  var t = when.getTime();
  var out = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (ev.isAllDayEvent && ev.isAllDayEvent()) continue;
    var first = descriptionFirstLine(ev.getDescription());
    if (first === CALENDAR_END_MARKER || first === CALENDAR_HOME_MARKER) continue;
    if (ev.getStartTime().getTime() <= t && ev.getEndTime().getTime() >= t) {
      out.push(ev);
    }
  }
  return out;
}

function pickPrimaryEvent(events, when, title) {
  if (!events || !events.length) return null;
  var pool = events;
  var want = title ? String(title).trim() : '';
  if (want) {
    var named = [];
    for (var i = 0; i < events.length; i++) {
      if (events[i].getTitle() === want) named.push(events[i]);
    }
    if (named.length) pool = named;
  }
  var overlapping = [];
  for (var j = 0; j < pool.length; j++) {
    var ev = pool[j];
    if (ev.getStartTime().getTime() <= when.getTime() && ev.getEndTime().getTime() >= when.getTime()) {
      overlapping.push(ev);
    }
  }
  var ranked = overlapping.length ? overlapping : pool.slice();
  ranked.sort(function (a, b) {
    return b.getStartTime().getTime() - a.getStartTime().getTime();
  });
  return ranked[0];
}

function anyEventHasTrail(events, timestampStr, prefix) {
  for (var i = 0; i < events.length; i++) {
    if (descriptionHasTrail(events[i].getDescription(), timestampStr, prefix)) return true;
  }
  return false;
}

function applyEventLocation(event, placeName, lat, lng) {
  if (isNaN(lat) || isNaN(lng)) return;
  try {
    event.setLocation(placeName || (lat + ',' + lng));
  } catch (locErr) {
    appendLog(['setLocation failed:', locErr.toString()]);
  }
}

function extendEventEnd(event, when) {
  var start = event.getStartTime();
  var currentEnd = event.getEndTime();
  var minEnd = new Date(when.getTime() + CALENDAR_EXTEND_MS);
  var newEnd = currentEnd.getTime() > minEnd.getTime() ? currentEnd : minEnd;
  if (when.getTime() > currentEnd.getTime()) {
    newEnd = minEnd;
  }
  if (newEnd.getTime() <= start.getTime()) {
    newEnd = new Date(start.getTime() + CALENDAR_EXTEND_MS);
  }
  event.setTime(start, newEnd);
}

function closeCalendarEvent(event, when, trailPfx, placeName, lat, lng) {
  var prefix = trailPrefix(trailPfx, 'end');
  var ts = formatCalendarStamp(when);
  var desc = event.getDescription() || '';
  var skipped = descriptionHasTrail(desc, ts, prefix);
  var prevWhen = lastTrailTimestamp(desc);
  desc = setFirstLineMarker(desc, CALENDAR_END_MARKER);
  if (!skipped) {
    desc = appendDescriptionLine(desc, buildCalendarLogLine(prefix, placeName, lat, lng, when, prevWhen));
  }
  event.setDescription(desc);
  var start = event.getStartTime();
  var end = when.getTime() > start.getTime() ? when : new Date(start.getTime() + 60 * 1000);
  event.setTime(start, end);
  applyEventLocation(event, placeName, lat, lng);
  return { eventId: event.getId(), title: event.getTitle(), skipped: skipped };
}

function createMarkedEvent(calendar, title, marker, trailPfx, when, placeName, lat, lng) {
  var logLine = buildCalendarLogLine(trailPfx, placeName, lat, lng, when);
  var endTime = new Date(when.getTime() + CALENDAR_DEFAULT_DURATION_MS);
  var event = calendar.createEvent(title, when, endTime, {
    description: marker + '\n' + logLine
  });
  applyEventLocation(event, placeName, lat, lng);
  return { event: event, logLine: logLine };
}

function closeEvents(events, when, trailPfx, placeName, lat, lng) {
  var closed = [];
  for (var i = 0; i < events.length; i++) {
    closed.push(closeCalendarEvent(events[i], when, trailPfx, placeName, lat, lng));
  }
  return closed;
}

function eventSummaries(events) {
  var out = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    out.push({
      eventId: ev.getId(),
      title: ev.getTitle(),
      start: ev.getStartTime().toISOString(),
      end: ev.getEndTime().toISOString(),
      marker: descriptionFirstLine(ev.getDescription()),
      lastTrailAt: (function () {
        var t = lastTrailTimestamp(ev.getDescription());
        return t ? t.toISOString() : '';
      })()
    });
  }
  return out;
}

/**
 * URL / JSON:
 * { action: 'trackCalendar', op, title, prefix, timestamp, lat, lng, endExisting, startHome, all, endAny, silent, days }
 */
function handleCalendarTrack(data) {
  try {
    data = data || {};
    appendLog(['handleCalendarTrack called', JSON.stringify(data)]);

    var op = resolveCalendarOp(data);
    var when = parseCalendarTimestamp(
      data.timestamp,
      data.timestampMs != null ? data.timestampMs : data.timestamp_ms
    );
    var title = (data.title || '').toString().trim();
    var coords = parseCalendarCoords(data);
    var lat = coords.lat;
    var lng = coords.lng;
    var hasCoords = !isNaN(lat) && !isNaN(lng);
    var placeName = hasCoords ? resolvePlaceName(lat, lng) : '';
    var endExisting = calendarFlag(data.endExisting, true);
    var startHome = calendarFlag(data.startHome, false);
    var all = calendarFlag(data.all, false);
    var endAny = calendarFlag(data.endAny, false);
    var lookbackMs = calendarLookbackMs(data);
    var ts = formatCalendarStamp(when);
    var calendar = openTrackingCalendar();
    var starts = findEventsByFirstLine(calendar, CALENDAR_START_MARKER, when, lookbackMs);
    var homes = findEventsByFirstLine(calendar, CALENDAR_HOME_MARKER, when, lookbackMs);
    var liveEvents = findLiveTimedEvents(calendar, when, lookbackMs);
    var appendable = mergeCalendarEvents(starts, liveEvents);
    var windowEvents = calendar.getEvents(
      new Date(when.getTime() - lookbackMs),
      new Date(when.getTime() + CALENDAR_LOOKAHEAD_MS)
    );

    if (op === 'check') {
      var resultCheck = {
        success: true,
        mode: 'check',
        starts: eventSummaries(appendable),
        homes: eventSummaries(homes)
      };
      return calendarJson(resultCheck);
    }

    var result;

    if (op === 'start') {
      if (anyEventHasTrail(windowEvents, ts, 'start')) {
        result = { success: true, mode: 'skipped', reason: 'duplicate', op: op, timestamp: ts };
        appendLog(['Calendar start skipped (duplicate):', ts]);
        return calendarJson(result);
      }
      closeEvents(homes, when, 'end', placeName, lat, lng);
      if (endAny) {
        closeEvents(mergeCalendarEvents(starts, liveEvents), when, 'end', placeName, lat, lng);
      } else if (endExisting) {
        closeEvents(starts, when, 'end', placeName, lat, lng);
      }
      var createdStart = createMarkedEvent(
        calendar,
        title || 'Trip',
        CALENDAR_START_MARKER,
        'start',
        when,
        placeName,
        lat,
        lng
      );
      result = {
        success: true,
        mode: 'created',
        op: op,
        eventId: createdStart.event.getId(),
        title: createdStart.event.getTitle(),
        start: createdStart.event.getStartTime().toISOString(),
        end: createdStart.event.getEndTime().toISOString(),
        placeName: placeName,
        logLine: createdStart.logLine
      };
      appendLog(['Calendar event created:', JSON.stringify(result)]);
      return calendarJson(result);
    }

    if (op === 'append') {
      var prefix = trailPrefix(data.prefix, '-no input-');
      if (anyEventHasTrail(windowEvents, ts, prefix)) {
        result = { success: true, mode: 'skipped', reason: 'duplicate', op: op, timestamp: ts };
        appendLog(['Calendar append skipped (duplicate):', ts, prefix]);
        return calendarJson(result);
      }
      var targets = appendable;
      if (!all) {
        var primary = pickPrimaryEvent(appendable, when, title);
        targets = primary ? [primary] : [];
      }
      if (!targets.length) {
        closeEvents(homes, when, 'end', placeName, lat, lng);
        var createdFromAppend = createMarkedEvent(
          calendar,
          title || 'Trip',
          CALENDAR_START_MARKER,
          prefix,
          when,
          placeName,
          lat,
          lng
        );
        result = {
          success: true,
          mode: 'created',
          op: op,
          eventId: createdFromAppend.event.getId(),
          title: createdFromAppend.event.getTitle(),
          start: createdFromAppend.event.getStartTime().toISOString(),
          end: createdFromAppend.event.getEndTime().toISOString(),
          placeName: placeName,
          logLine: createdFromAppend.logLine
        };
        appendLog(['Calendar event created from append:', JSON.stringify(result)]);
        return calendarJson(result);
      }
      var appended = [];
      var logLine = '';
      for (var a = 0; a < targets.length; a++) {
        var ev = targets[a];
        var nextDesc = ev.getDescription() || '';
        var firstLine = descriptionFirstLine(nextDesc);
        if (
          firstLine !== CALENDAR_START_MARKER &&
          firstLine !== CALENDAR_END_MARKER &&
          firstLine !== CALENDAR_HOME_MARKER
        ) {
          nextDesc = setFirstLineMarker(nextDesc, CALENDAR_START_MARKER);
        }
        var prevWhen = lastTrailTimestamp(nextDesc);
        logLine = buildCalendarLogLine(prefix, placeName, lat, lng, when, prevWhen);
        nextDesc = appendDescriptionLine(nextDesc, logLine);
        ev.setDescription(nextDesc);
        extendEventEnd(ev, when);
        applyEventLocation(ev, placeName, lat, lng);
        appended.push({
          eventId: ev.getId(),
          title: ev.getTitle(),
          start: ev.getStartTime().toISOString(),
          end: ev.getEndTime().toISOString()
        });
      }
      result = {
        success: true,
        mode: 'appended',
        op: op,
        placeName: placeName,
        logLine: logLine,
        events: appended
      };
      appendLog(['Calendar event appended:', JSON.stringify(result)]);
      return calendarJson(result);
    }

    if (op === 'end') {
      var endPrefix = 'end';
      // Same pool as check「進行中」: **start** + live unmarked timed events.
      var endPool = mergeCalendarEvents(starts, liveEvents);
      var closeAll = all || endAny;
      if (closeAll) {
        endPool = mergeCalendarEvents(endPool, homes);
      }
      var endTargets = endPool;
      if (!closeAll) {
        if (title) {
          endTargets = [];
          for (var e = 0; e < endPool.length; e++) {
            if (endPool[e].getTitle() === title) endTargets.push(endPool[e]);
          }
        }
        if (!endTargets.length) {
          var endPrimary = pickPrimaryEvent(endPool, when, title);
          endTargets = endPrimary ? [endPrimary] : [];
        }
      }
      if (anyEventHasTrail(endTargets, ts, endPrefix) && endTargets.length) {
        var stillOpen = [];
        for (var d = 0; d < endTargets.length; d++) {
          if (!descriptionHasTrail(endTargets[d].getDescription(), ts, endPrefix)) {
            stillOpen.push(endTargets[d]);
          }
        }
        if (!stillOpen.length) {
          result = { success: true, mode: 'skipped', reason: 'duplicate', op: op, timestamp: ts };
          return calendarJson(result);
        }
        endTargets = stillOpen;
      }
      var closedEnd = closeEvents(endTargets, when, endPrefix, placeName, lat, lng);
      result = {
        success: true,
        mode: 'ended',
        op: op,
        closed: closedEnd,
        placeName: placeName
      };
      appendLog(['Calendar events ended:', JSON.stringify(result)]);
      return calendarJson(result);
    }

    if (op === 'home') {
      var closedHomeTrips = closeEvents(starts, when, 'home', placeName, lat, lng);
      var homeEvent = null;
      var homeLogLine = '';
      if (startHome) {
        var existingHomes = findEventsByFirstLine(calendar, CALENDAR_HOME_MARKER, when, lookbackMs);
        if (anyEventHasTrail(existingHomes, ts, 'home')) {
          result = {
            success: true,
            mode: 'skipped',
            reason: 'duplicate',
            op: op,
            timestamp: ts,
            closed: closedHomeTrips
          };
          return calendarJson(result);
        }
        var createdHome = createMarkedEvent(
          calendar,
          'Home',
          CALENDAR_HOME_MARKER,
          'home',
          when,
          placeName,
          lat,
          lng
        );
        homeEvent = {
          eventId: createdHome.event.getId(),
          title: createdHome.event.getTitle(),
          start: createdHome.event.getStartTime().toISOString(),
          end: createdHome.event.getEndTime().toISOString()
        };
        homeLogLine = createdHome.logLine;
      }
      result = {
        success: true,
        mode: startHome ? 'home_started' : 'home',
        op: op,
        closed: closedHomeTrips,
        home: homeEvent,
        placeName: placeName,
        logLine: homeLogLine
      };
      appendLog(['Calendar home:', JSON.stringify(result)]);
      return calendarJson(result);
    }

    return calendarJson({ success: false, error: 'Unknown op: ' + op });
  } catch (error) {
    appendLog(['Error in handleCalendarTrack:', error.toString(), error.stack]);
    return calendarJson({
      success: false,
      error: calendarAuthHint(error)
    });
  }
}

function openTrackingCalendar() {
  try {
    return CalendarApp.getDefaultCalendar();
  } catch (err) {
    throw new Error(calendarAuthHint(err));
  }
}

function calendarAuthHint(error) {
  var msg = error ? error.toString() : '';
  if (/does not have permission|auth\/calendar/i.test(msg)) {
    return (
      'Calendar not authorized. In the Apps Script editor: run authorizeCalendar(), ' +
      'grant Google Calendar access, then Deploy → Manage deployments → pencil → Version: New. ' +
      'Original: ' + msg
    );
  }
  return msg;
}

/**
 * Run once in the Apps Script editor (not via URL).
 * Accept Calendar permission, then create a new Web App version.
 */
function authorizeCalendar() {
  var cal = CalendarApp.getDefaultCalendar();
  Logger.log('Calendar authorized: ' + cal.getName() + ' / ' + cal.getId());
  return cal.getName();
}

/**
 * Parse ParkedLocation sheet header → column index map (uppercase keys).
 * @returns {{ sheet: GoogleAppsScript.Spreadsheet.Sheet|null, col: Object, lastRow: number, lastCol: number }}
 */
function openParkedLocationSheet() {
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('ParkedLocation');
  if (!sheet) {
    return { sheet: null, col: {}, lastRow: 0, lastCol: 0 };
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return { sheet: sheet, col: {}, lastRow: lastRow, lastCol: 0 };
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var col = {};
  for (var i = 0; i < headers.length; i++) {
    var key = (headers[i] || '').toString().trim().toUpperCase();
    if (key) col[key] = i;
  }
  return { sheet: sheet, col: col, lastRow: lastRow, lastCol: lastCol };
}

/** @returns {number} epoch ms or 0 */
function parkedTimestampToMs(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.getTime();
  if (typeof value === 'number' && isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  var s = (value || '').toString().trim();
  if (!s) return 0;
  var parsed = Date.parse(s.replace(' ', 'T'));
  if (!isNaN(parsed)) return parsed;
  return 0;
}

/**
 * Build parked DTO from a sheet row.
 */
function rowToParkedDto(row, col) {
  var latIdx = col.LATITUDE;
  var lngIdx = col.LONGITUDE;
  if (latIdx == null || lngIdx == null) return null;
  var lat = parseFloat(row[latIdx]);
  var lng = parseFloat(row[lngIdx]);
  if (isNaN(lat) || isNaN(lng)) return null;
  var plate = col.CAR_PLATE != null ? String(row[col.CAR_PLATE] || '').trim().toUpperCase() : '';
  var name = col.NAME != null ? String(row[col.NAME] || '').trim() : '';
  var accuracy = col.ACCURACY != null ? row[col.ACCURACY] : '';
  var mapsUrl = col.MAPS_URL != null ? String(row[col.MAPS_URL] || '') : '';
  var tsRaw = col.TIMESTAMP != null ? row[col.TIMESTAMP] : '';
  var timestampMs = parkedTimestampToMs(tsRaw);
  return {
    lat: lat,
    lng: lng,
    carPlate: plate,
    name: name,
    label: name,
    accuracy: accuracy === '' || accuracy == null ? null : accuracy,
    mapsUrl: mapsUrl || ('https://maps.google.com/maps?q=' + lat + ',' + lng),
    timestamp: tsRaw instanceof Date ? datetimetoYMDHIS(tsRaw) : String(tsRaw || ''),
    timestampMs: timestampMs || null
  };
}

/**
 * GET ?action=getParkedLocation&carPlate=PPQ8777
 * Returns the latest parked row for that plate (or overall latest if carPlate empty).
 */
function getParkedLocation(carPlate) {
  try {
    var meta = openParkedLocationSheet();
    if (!meta.sheet || meta.lastRow < 2 || meta.lastCol < 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        parked: null
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var values = meta.sheet.getRange(2, 1, meta.lastRow, meta.lastCol).getValues();
    var want = (carPlate || '').toString().trim().toUpperCase();
    for (var r = values.length - 1; r >= 0; r--) {
      var dto = rowToParkedDto(values[r], meta.col);
      if (!dto) continue;
      if (want && dto.carPlate !== want) continue;
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        parked: dto
      })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      parked: null
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    appendLog(['Error in getParkedLocation:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      parked: null
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET ?action=getParkedLocations
 * Latest parked location per car plate.
 */
function collectParkedLocationsByCar() {
  var meta = openParkedLocationSheet();
  if (!meta.sheet || meta.lastRow < 2 || meta.lastCol < 1) return {};
  var values = meta.sheet.getRange(2, 1, meta.lastRow, meta.lastCol).getValues();
  var byCar = {};
  for (var r = 0; r < values.length; r++) {
    var dto = rowToParkedDto(values[r], meta.col);
    if (!dto || !dto.carPlate) continue;
    byCar[dto.carPlate] = dto;
  }
  return byCar;
}

function getParkedLocations() {
  try {
    return jsonOut({
      success: true,
      byCar: collectParkedLocationsByCar()
    });
  } catch (error) {
    appendLog(['Error in getParkedLocations:', error.toString(), error.stack]);
    return jsonOut({
      success: false,
      error: error.toString(),
      byCar: {}
    });
  }
}

/**
 * 記車位：寫入 ParkedLocation sheet
 * POST body: { action: 'parkLocation', latitude, longitude, label, accuracy }
 */
function handleParkLocation(data) {
  try {
    appendLog(['handleParkLocation called', JSON.stringify(data)]);

    var lat = parseFloat(data.latitude);
    var lng = parseFloat(data.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid latitude or longitude'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var placeName = resolvePlaceName(lat, lng) || (data.label || '');
    var carPlate = (data.carPlate || '').toString().trim().toUpperCase();
    var mapsUrl = 'https://maps.google.com/maps?q=' + lat + ',' + lng;
    var timestamp = datetimetoYMDHIS();

    var parkHeaders = [
      'TIMESTAMP', 'CAR_PLATE', 'LATITUDE', 'LONGITUDE', 'NAME', 'ACCURACY', 'MAPS_URL'
    ];
    var doc = SpreadsheetApp.openById(sheetId);
    var sheet = doc.getSheetByName('ParkedLocation');
    if (!sheet) {
      sheet = doc.insertSheet('ParkedLocation');
      sheet.getRange(1, 1, 1, parkHeaders.length).setValues([parkHeaders]);
      sheet.getRange(1, 1, 1, parkHeaders.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      var lastCol = sheet.getLastColumn();
      // Empty sheet (no cells used) → getLastColumn() === 0; getRange(..., 0) throws
      if (lastCol < 1) {
        sheet.getRange(1, 1, 1, parkHeaders.length).setValues([parkHeaders]);
        sheet.getRange(1, 1, 1, parkHeaders.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      } else {
        // 舊表若缺少 CAR_PLATE 欄，嘗試補上（第 2 欄）
        var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
          .map(function (h) { return (h || '').toString().trim().toUpperCase(); });
        if (header.indexOf('CAR_PLATE') === -1) {
          sheet.insertColumnAfter(1);
          sheet.getRange(1, 2).setValue('CAR_PLATE').setFontWeight('bold');
        }
      }
    }

    sheet.appendRow([
      timestamp,
      carPlate,
      lat,
      lng,
      placeName,
      data.accuracy !== undefined && data.accuracy !== null ? data.accuracy : '',
      mapsUrl
    ]);

    // 同步寫入 Location sheet（可選，方便附近地點）
    try {
      saveLocation({ latitude: lat, longitude: lng, name: placeName });
    } catch (e) {
      appendLog(['parkLocation: saveLocation side-effect failed', e.toString()]);
    }

    var result = {
      success: true,
      latitude: lat,
      longitude: lng,
      name: placeName,
      mapsUrl: mapsUrl,
      timestamp: timestamp
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    appendLog(['Error in handleParkLocation:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Obligation (承諾／應收應付) sheets
 * Obligation: ID KIND DIRECTION NAME TAG TITLE PRINCIPAL REMAINING RATE METHOD TERM PMT START END DUE_DAY CURRENCY PAYMENT_METHOD NOTE STATUS UPDATED_AT JSON
 * ObligationSchedule: ID OBLIGATION_ID SEQ DUE_DATE AMOUNT PRINCIPAL INTEREST STATUS RECORD_ID NOTE KIND UPDATED_AT
 */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ensureObligationSheet() {
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('Obligation');
  var headers = [
    'ID', 'KIND', 'DIRECTION', 'NAME', 'TAG', 'TITLE', 'PRINCIPAL', 'REMAINING',
    'RATE', 'METHOD', 'TERM', 'PMT', 'START', 'END', 'DUE_DAY', 'CURRENCY',
    'PAYMENT_METHOD', 'NOTE', 'STATUS', 'UPDATED_AT', 'JSON'
  ];
  if (!sheet) {
    sheet = doc.insertSheet('Obligation');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  if (sheet.getLastColumn() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureObligationScheduleSheet() {
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('ObligationSchedule');
  var headers = [
    'ID', 'OBLIGATION_ID', 'SEQ', 'DUE_DATE', 'AMOUNT', 'PRINCIPAL', 'INTEREST',
    'STATUS', 'RECORD_ID', 'NOTE', 'KIND', 'UPDATED_AT'
  ];
  if (!sheet) {
    sheet = doc.insertSheet('ObligationSchedule');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  if (sheet.getLastColumn() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function parseSheetDate(value) {
  if (!value && value !== 0) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return s.slice(0, 10);
}

function readObligationRows() {
  var sheet = ensureObligationSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = Math.max(sheet.getLastColumn(), 21);
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[0] || '').trim();
    var name = String(row[3] || '').trim();
    if (!id || !name) continue;
    var extra = {};
    try {
      if (row[20]) extra = JSON.parse(String(row[20]));
    } catch (e) {
      extra = {};
    }
    list.push({
      id: id,
      kind: String(row[1] || 'loan'),
      direction: String(row[2] || 'payable'),
      name: name,
      tag: String(row[4] || ''),
      title: String(row[5] || name),
      principal: Number(row[6]) || 0,
      remainingPrincipal: Number(row[7]) || 0,
      annualRate: Number(row[8]) || 0,
      interestMethod: String(row[9] || 'none'),
      termMonths: Number(row[10]) || 1,
      installmentAmount: Number(row[11]) || 0,
      startDate: parseSheetDate(row[12]),
      endDate: parseSheetDate(row[13]),
      dueDay: Number(row[14]) || 1,
      currency: String(row[15] || 'MYR'),
      paymentMethod: String(row[16] || ''),
      note: String(row[17] || ''),
      status: String(row[18] || 'active'),
      updatedAt: Number(row[19]) || Date.now(),
      extra: extra
    });
  }
  return list;
}

function readScheduleRows(obligationId) {
  var sheet = ensureObligationScheduleSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = Math.max(sheet.getLastColumn(), 12);
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[0] || '').trim();
    var oid = String(row[1] || '').trim();
    if (!id || !oid) continue;
    if (obligationId && oid !== obligationId) continue;
    list.push({
      id: id,
      obligationId: oid,
      seq: Number(row[2]) || 0,
      dueDate: parseSheetDate(row[3]),
      amount: Number(row[4]) || 0,
      principalPortion: Number(row[5]) || 0,
      interestPortion: Number(row[6]) || 0,
      status: String(row[7] || 'pending'),
      postedRecordId: String(row[8] || ''),
      note: String(row[9] || ''),
      kind: String(row[10] || 'regular'),
      updatedAt: Number(row[11]) || Date.now()
    });
  }
  return list;
}

function listObligations() {
  try {
    var obligations = readObligationRows();
    var allSched = readScheduleRows();
    var byOb = {};
    for (var i = 0; i < allSched.length; i++) {
      var s = allSched[i];
      if (!byOb[s.obligationId]) byOb[s.obligationId] = [];
      byOb[s.obligationId].push(s);
    }
    for (var j = 0; j < obligations.length; j++) {
      obligations[j].schedule = byOb[obligations[j].id] || [];
    }
    return jsonOut({ success: true, obligations: obligations });
  } catch (error) {
    appendLog(['Error in listObligations:', error.toString(), error.stack]);
    return jsonOut({ success: false, error: error.toString(), obligations: [] });
  }
}

function findRowIndexById(sheet, id, idCol) {
  idCol = idCol || 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === String(id)) return i + 2;
  }
  return -1;
}

function upsertObligation(data) {
  try {
    appendLog(['upsertObligation called', JSON.stringify({ id: data && data.id, name: data && data.name })]);
    var name = String((data && data.name) || '').trim();
    if (!name) return jsonOut({ success: false, error: 'Missing name' });
    var id = String((data && data.id) || '').trim();
    if (!id) id = 'ob_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    var updatedAt = Number(data.updatedAt) || Date.now();
    var sheet = ensureObligationSheet();
    var row = [
      id,
      String(data.kind || 'loan'),
      String(data.direction || 'payable'),
      name,
      String(data.tag || ''),
      String(data.title || name),
      Number(data.principal) || 0,
      Number(data.remainingPrincipal != null ? data.remainingPrincipal : data.principal) || 0,
      Number(data.annualRate) || 0,
      String(data.interestMethod || 'none'),
      Number(data.termMonths) || 1,
      Number(data.installmentAmount) || 0,
      String(data.startDate || ''),
      String(data.endDate || ''),
      Number(data.dueDay) || 1,
      String(data.currency || 'MYR'),
      String(data.paymentMethod || ''),
      String(data.note || ''),
      String(data.status || 'active'),
      updatedAt,
      JSON.stringify(data.json || {})
    ];
    var rowIndex = findRowIndexById(sheet, id, 1);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    if (Array.isArray(data.schedule)) {
      replacePendingSchedule(id, data.schedule);
    }

    return jsonOut({ success: true, id: id, updatedAt: updatedAt });
  } catch (error) {
    appendLog(['Error in upsertObligation:', error.toString(), error.stack]);
    return jsonOut({ success: false, error: error.toString() });
  }
}

function replacePendingSchedule(obligationId, schedule) {
  var sheet = ensureObligationScheduleSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      var oid = String(values[i][1] || '').trim();
      var status = String(values[i][7] || '').trim();
      if (oid === obligationId && status !== 'posted') {
        sheet.deleteRow(i + 2);
      }
    }
  }
  for (var j = 0; j < schedule.length; j++) {
    var inst = schedule[j];
    if (!inst || String(inst.status || '') === 'posted') continue;
    writeScheduleRow(sheet, inst, obligationId);
  }
}

function writeScheduleRow(sheet, inst, obligationId) {
  var id = String(inst.id || '').trim();
  if (!id) id = 'oi_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  var row = [
    id,
    String(inst.obligationId || obligationId || ''),
    Number(inst.seq) || 0,
    String(inst.dueDate || '').slice(0, 10),
    Number(inst.amount) || 0,
    Number(inst.principalPortion != null ? inst.principalPortion : inst.principal) || 0,
    Number(inst.interestPortion != null ? inst.interestPortion : inst.interest) || 0,
    String(inst.status || 'pending'),
    String(inst.postedRecordId || inst.record_id || ''),
    String(inst.note || ''),
    String(inst.kind || 'regular'),
    Number(inst.updatedAt) || Date.now()
  ];
  var rowIndex = findRowIndexById(sheet, id, 1);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function deleteObligation(data) {
  try {
    var id = String((data && data.id) || '').trim();
    if (!id) return jsonOut({ success: false, error: 'Missing id' });
    var sheet = ensureObligationSheet();
    var rowIndex = findRowIndexById(sheet, id, 1);
    if (rowIndex > 0) sheet.deleteRow(rowIndex);

    var sched = ensureObligationScheduleSheet();
    var lastRow = sched.getLastRow();
    if (lastRow >= 2) {
      var values = sched.getRange(2, 1, lastRow - 1, 8).getValues();
      for (var i = values.length - 1; i >= 0; i--) {
        var oid = String(values[i][1] || '').trim();
        var status = String(values[i][7] || '').trim();
        if (oid === id && status !== 'posted') {
          sched.deleteRow(i + 2);
        }
      }
    }
    return jsonOut({ success: true, deleted: true, id: id });
  } catch (error) {
    appendLog(['Error in deleteObligation:', error.toString(), error.stack]);
    return jsonOut({ success: false, error: error.toString() });
  }
}

function upsertObligationInstallment(data) {
  try {
    if (!data || !data.id) return jsonOut({ success: false, error: 'Missing installment id' });
    var sheet = ensureObligationScheduleSheet();
    writeScheduleRow(sheet, data, data.obligationId);
    return jsonOut({ success: true, id: data.id });
  } catch (error) {
    appendLog(['Error in upsertObligationInstallment:', error.toString(), error.stack]);
    return jsonOut({ success: false, error: error.toString() });
  }
}

function postObligationInstallmentToRecords(ob, inst) {
  var now = new Date();
  var sign = String(ob.direction) === 'receivable' ? -1 : 1;
  var amount = sign * Math.abs(Number(inst.amount) || 0);
  var totalLabel = ob.termMonths ? String(ob.termMonths) : '?';
  var seqLabel = inst.kind === 'extra' ? '提前還' : ('第' + inst.seq + '/' + totalLabel + '期');
  var remark = '[應→已] ' + (ob.name || ob.title || '') + ' ' + seqLabel;
  if (Number(inst.principalPortion)) remark += ' 本金 ' + inst.principalPortion;
  if (Number(inst.interestPortion)) remark += ' 利息 ' + inst.interestPortion;
  if (inst.note) remark += ' ' + inst.note;
  if (ob.note) remark += ' | ' + ob.note;
  var recordId = 'obrec_' + inst.id;
  var expenseData = {
    id: recordId,
    timestamp_ms: now.getTime(),
    timestamp: datetimetoYMDHIS(now),
    yearmonth: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMM'),
    title: ob.title || ob.name,
    amount: amount.toFixed(2),
    remark: remark,
    tag: ob.tag || '其他',
    currency: ob.currency || 'MYR',
    payment_method: ob.paymentMethod || 'Auto',
    obligation_id: ob.id,
    installment_id: inst.id,
    installment_seq: inst.seq
  };
  var upsert = upsertRowById(expenseData, 'Records');
  return upsert.id;
}

function processDueObligations() {
  try {
    appendLog(['processDueObligations called']);
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var obligations = readObligationRows();
    var byId = {};
    for (var i = 0; i < obligations.length; i++) byId[obligations[i].id] = obligations[i];
    var sheet = ensureObligationScheduleSheet();
    var lastRow = sheet.getLastRow();
    var posted = [];
    if (lastRow < 2) {
      return jsonOut({ success: true, posted: 0, records: posted });
    }
    var values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      var instId = String(row[0] || '').trim();
      var oid = String(row[1] || '').trim();
      var dueDate = parseSheetDate(row[3]);
      var status = String(row[7] || '').trim();
      if (!instId || !oid || status !== 'pending' || !dueDate || dueDate > today) continue;
      var ob = byId[oid];
      if (!ob || ob.status === 'paused' || ob.status === 'closed') continue;
      var inst = {
        id: instId,
        obligationId: oid,
        seq: Number(row[2]) || 0,
        dueDate: dueDate,
        amount: Number(row[4]) || 0,
        principalPortion: Number(row[5]) || 0,
        interestPortion: Number(row[6]) || 0,
        note: String(row[9] || ''),
        kind: String(row[10] || 'regular')
      };
      var recordId = postObligationInstallmentToRecords(ob, inst);
      sheet.getRange(r + 2, 8).setValue('posted');
      sheet.getRange(r + 2, 9).setValue(recordId);
      sheet.getRange(r + 2, 12).setValue(Date.now());
      posted.push({ installmentId: instId, obligationId: oid, recordId: recordId, amount: inst.amount });

      if (ob.kind === 'loan' && inst.kind !== 'extra') {
        var remain = Math.max(0, (Number(ob.remainingPrincipal) || 0) - (Number(inst.principalPortion) || 0));
        ob.remainingPrincipal = remain;
        var obSheet = ensureObligationSheet();
        var obRow = findRowIndexById(obSheet, oid, 1);
        if (obRow > 0) {
          obSheet.getRange(obRow, 8).setValue(remain);
          if (remain <= 0.005) obSheet.getRange(obRow, 19).setValue('closed');
        }
      }
    }
    appendLog(['processDueObligations completed', 'Posted:', posted.length]);
    return jsonOut({ success: true, posted: posted.length, records: posted });
  } catch (error) {
    appendLog(['Error in processDueObligations:', error.toString(), error.stack]);
    return jsonOut({ success: false, error: error.toString() });
  }
}

var APP_PUBLIC_BASE = 'https://mike-sam.github.io/react-gh-pages';
var EXPENSE_SUMMARY_PREFIX = 'expenseSummary_';
var EXPENSE_SUMMARY_BOOTSTRAP = 'expenseSummaryBootstrapped';
var EXPENSE_SUMMARY_MONTHS = 24;

/** PHP date('r') / RFC 2822, English names, offset like +0800. */
function formatRfc2822(when) {
  when = when || new Date();
  var tz = Session.getScriptTimeZone();
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var y = Utilities.formatDate(when, tz, 'yyyy');
  var m = Number(Utilities.formatDate(when, tz, 'MM'));
  var d = Utilities.formatDate(when, tz, 'dd');
  var hms = Utilities.formatDate(when, tz, 'HH:mm:ss');
  var z = Utilities.formatDate(when, tz, 'Z');
  var u = Number(Utilities.formatDate(when, tz, 'u'));
  var day = days[u > 0 ? u - 1 : 0];
  return day + ', ' + d + ' ' + months[m - 1] + ' ' + y + ' ' + hms + ' ' + z;
}

function expenseDescShort(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  return s.substring(0, 3);
}

function expenseCalendarTitle(data) {
  var subcat = String((data && data.title) || '').trim() || '支出';
  var shortDesc = expenseDescShort(
    (data && (data.description || data.simpleDescription || data.remark)) || ''
  );
  return shortDesc ? '[' + subcat + '] - ' + shortDesc : '[' + subcat + ']';
}

function expenseCalendarBody(data, recordId) {
  var amount = data && data.amount != null ? data.amount : '';
  var curr = (data && data.currency) || 'MYR';
  var desc = String((data && (data.description || data.simpleDescription || data.remark)) || '').trim();
  var lines = [
    'auto populated by 記賬',
    '金額: ' + curr + ' ' + amount,
    '分類: ' + ((data && data.tag) || ''),
    '項目: ' + ((data && data.title) || '')
  ];
  if (desc) lines.push('說明: ' + desc);
  var ym = (data && data.yearmonth) || '';
  var qs = 'tab=summary&id=' + encodeURIComponent(recordId || '');
  if (ym) qs += '&ym=' + encodeURIComponent(ym);
  lines.push('查看: ' + APP_PUBLIC_BASE + '/#/expense?' + qs);
  return lines.join('\n');
}

function parseExpenseWhen(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw.getTime())) return raw;
  var s = String(raw).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] || 0)
    );
  }
  var d = new Date(s);
  return d && !isNaN(d.getTime()) ? d : null;
}

function ensureSheetHeader(sheet, name) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === name) return i;
  }
  var col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(name);
  return col - 1;
}

function readSheetCell(sheet, row, headerName) {
  var idx = ensureSheetHeader(sheet, headerName);
  return sheet.getRange(row, idx + 1).getValue();
}

function writeSheetCell(sheet, row, headerName, value) {
  var idx = ensureSheetHeader(sheet, headerName);
  sheet.getRange(row, idx + 1).setValue(value);
}

/** Timed calendar event for an expense with event_start + event_end. Not trail tracking. */
function syncExpenseCalendarEvent(data, upsert) {
  data = data || {};
  upsert = upsert || {};
  var start = parseExpenseWhen(data.event_start);
  var end = parseExpenseWhen(data.event_end);
  if (!start || !end) return '';
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 60 * 60 * 1000);
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Records');
  var existingId = '';
  if (upsert.row > 1 && sheet) {
    existingId = String(readSheetCell(sheet, upsert.row, 'calendar_event_id') || '').trim();
  }
  var calendar = openTrackingCalendar();
  var title = expenseCalendarTitle(data);
  var body = expenseCalendarBody(data, upsert.id);
  var loc = '';
  if (data.geolocation) loc = String(data.geolocation);
  else if (data.latitude && data.longitude) loc = data.latitude + ',' + data.longitude;
  var ev = null;
  if (existingId) {
    try {
      ev = calendar.getEventById(existingId);
    } catch (e) {
      ev = null;
    }
  }
  if (ev) {
    ev.setTitle(title);
    ev.setTime(start, end);
    ev.setDescription(body);
    if (loc) ev.setLocation(loc);
  } else {
    ev = calendar.createEvent(title, start, end, { description: body, location: loc || undefined });
  }
  var eventId = ev && ev.getId ? String(ev.getId()) : '';
  if (eventId && upsert.row > 1 && sheet) {
    writeSheetCell(sheet, upsert.row, 'calendar_event_id', eventId);
  }
  return eventId;
}

function invalidateExpenseSummary(yearmonth) {
  var ym = String(yearmonth || '').trim();
  if (!ym) {
    ym = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  }
  PropertiesService.getScriptProperties().deleteProperty(EXPENSE_SUMMARY_PREFIX + ym);
}

function sheetText(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return String(v);
}

function rowYearMonth(row, col) {
  var tz = Session.getScriptTimeZone();
  var ymCell = col.yearmonth != null ? row[col.yearmonth] : '';
  var yearmonth = '';
  if (Object.prototype.toString.call(ymCell) === '[object Date]' && !isNaN(ymCell.getTime())) {
    yearmonth = Utilities.formatDate(ymCell, tz, 'yyyy-MM');
  } else {
    yearmonth = String(ymCell != null ? ymCell : '').trim();
  }
  if (!yearmonth && col.timestamp != null && row[col.timestamp]) {
    try {
      yearmonth = Utilities.formatDate(new Date(row[col.timestamp]), tz, 'yyyy-MM');
    } catch (e) {}
  }
  return yearmonth;
}

function recordFromSheetRow(row, col, yearmonth) {
  return {
    id: sheetText(col.id != null ? row[col.id] : ''),
    tag: String(col.tag != null && row[col.tag] != null ? row[col.tag] : '').trim() || '其他',
    title: String(col.title != null && row[col.title] != null ? row[col.title] : '').trim(),
    amount: Number(col.amount != null ? row[col.amount] : 0) || 0,
    currency: String(col.currency != null && row[col.currency] != null ? row[col.currency] : 'MYR') || 'MYR',
    remark: sheetText(col.remark != null ? row[col.remark] : ''),
    description: sheetText(col.description != null ? row[col.description] : ''),
    timestamp: sheetText(col.timestamp != null ? row[col.timestamp] : ''),
    event_start: sheetText(col.event_start != null ? row[col.event_start] : ''),
    event_end: sheetText(col.event_end != null ? row[col.event_end] : ''),
    calendar_event_id: sheetText(
      col.calendar_event_id != null ? row[col.calendar_event_id] : ''
    ),
    yearmonth: yearmonth
  };
}

/** One pass. allowYm: object set of yyyy-MM, or null for all months. */
function recordsGroupedByMonth(allowYm) {
  var grouped = {};
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Records');
  if (!sheet || sheet.getLastRow() < 2) return grouped;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = {};
  for (var i = 0; i < headers.length; i++) col[String(headers[i])] = i;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (var r = 0; r < values.length; r++) {
    var yearmonth = rowYearMonth(values[r], col);
    if (!yearmonth) continue;
    if (allowYm && !allowYm[yearmonth]) continue;
    if (!grouped[yearmonth]) grouped[yearmonth] = [];
    grouped[yearmonth].push(recordFromSheetRow(values[r], col, yearmonth));
  }
  return grouped;
}

function recordsForYearMonth(ym) {
  var allow = {};
  if (ym) allow[ym] = true;
  var grouped = recordsGroupedByMonth(ym ? allow : null);
  return ym ? grouped[ym] || [] : [].concat.apply([], Object.keys(grouped).map(function (k) {
    return grouped[k];
  }));
}

function listRecentYearMonths(count) {
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var out = [];
  for (var i = 0; i < count; i++) {
    out.push(Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() - i, 1), tz, 'yyyy-MM'));
  }
  return out;
}

/** Fingerprint: 筆數 + 加總（分）。沒變就不用重算. */
function expenseSummaryFingerprint(rows) {
  rows = rows || [];
  var total = 0;
  for (var i = 0; i < rows.length; i++) total += Number(rows[i].amount) || 0;
  return rows.length + '|' + Math.round(total * 100);
}

function buildExpenseSummaryFromRows(ym, rows) {
  rows = rows ? rows.slice() : [];
  var total = 0;
  var byTagMap = {};
  for (var i = 0; i < rows.length; i++) {
    var rec = rows[i];
    total += rec.amount;
    if (!byTagMap[rec.tag]) byTagMap[rec.tag] = { tag: rec.tag, amount: 0, count: 0 };
    byTagMap[rec.tag].amount += rec.amount;
    byTagMap[rec.tag].count += 1;
  }
  var byTag = [];
  for (var t in byTagMap) {
    if (byTagMap.hasOwnProperty(t)) byTag.push(byTagMap[t]);
  }
  byTag.sort(function (a, b) {
    return b.amount - a.amount;
  });
  for (var b = 0; b < byTag.length; b++) {
    byTag[b].amount = Math.round(byTag[b].amount * 100) / 100;
  }
  rows.sort(function (a, c) {
    return String(c.id).localeCompare(String(a.id));
  });
  var recent = rows.slice(0, 24).map(function (r) {
    return {
      id: r.id,
      tag: r.tag,
      title: r.title,
      amount: r.amount,
      currency: r.currency,
      timestamp: r.timestamp,
      description: r.description || r.remark
    };
  });
  return {
    yearmonth: ym,
    fingerprint: expenseSummaryFingerprint(rows),
    total: Math.round(total * 100) / 100,
    count: rows.length,
    byTag: byTag,
    recent: recent
  };
}

function computeExpenseSummary(ym) {
  return buildExpenseSummaryFromRows(ym, recordsForYearMonth(ym));
}

function getExpenseSummary(parameter) {
  try {
    parameter = parameter || {};
    var ym = String(parameter.yearmonth || '').trim();
    if (!ym) ym = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
    var force = /^(1|true|yes)$/i.test(String(parameter.force || ''));
    var props = PropertiesService.getScriptProperties();
    var cacheKey = EXPENSE_SUMMARY_PREFIX + ym;
    var live = null;
    var fromCache = false;
    if (!force) {
      var cachedRaw = props.getProperty(cacheKey);
      if (cachedRaw) {
        try {
          var cached = JSON.parse(cachedRaw);
          if (cached && Array.isArray(cached.byTag)) {
            live = cached;
            fromCache = true;
          }
        } catch (parseErr) {
          live = null;
        }
      }
    }
    if (!live) {
      live = computeExpenseSummary(ym);
      live.updatedAt = formatRfc2822(new Date());
      try {
        props.setProperty(cacheKey, JSON.stringify(live));
      } catch (writeErr) {
        appendLog(['getExpenseSummary cache write', ym, writeErr.toString()]);
      }
    }
    live.yearmonth = live.yearmonth || ym;
    live.cached = fromCache;
    live.source = fromCache ? 'cache' : 'live';
    var wantId = String(parameter.id || '').trim();
    if (wantId) {
      var hit = null;
      for (var i = 0; i < (live.recent || []).length; i++) {
        if (String(live.recent[i].id) === wantId) {
          hit = live.recent[i];
          break;
        }
      }
      if (!hit) {
        var all = recordsForYearMonth(ym);
        for (var j = 0; j < all.length; j++) {
          if (String(all[j].id) === wantId) {
            hit = all[j];
            break;
          }
        }
      }
      live.record = hit;
    }
    live.success = true;
    return jsonOut(live);
  } catch (error) {
    appendLog(['getExpenseSummary', error.toString()]);
    return jsonOut({ success: false, error: error.toString() });
  }
}

function refreshExpenseSummaryCache() {
  var props = PropertiesService.getScriptProperties();
  var bootstrapped = props.getProperty(EXPENSE_SUMMARY_BOOTSTRAP) === '1';
  var now = new Date();
  var allowYm = null;
  var monthList;
  if (bootstrapped) {
    monthList = listRecentYearMonths(EXPENSE_SUMMARY_MONTHS);
    allowYm = {};
    for (var i = 0; i < monthList.length; i++) allowYm[monthList[i]] = true;
  }
  var grouped = recordsGroupedByMonth(allowYm);
  if (!bootstrapped) {
    monthList = Object.keys(grouped).sort();
  }
  var rebuilt = [];
  var skipped = 0;
  for (var m = 0; m < monthList.length; m++) {
    var ym = monthList[m];
    var rows = grouped[ym] || [];
    if (!rows.length && bootstrapped) {
      if (!props.getProperty(EXPENSE_SUMMARY_PREFIX + ym)) {
        skipped++;
        continue;
      }
    }
    var live = buildExpenseSummaryFromRows(ym, rows);
    var cachedRaw = props.getProperty(EXPENSE_SUMMARY_PREFIX + ym);
    if (cachedRaw) {
      try {
        var cached = JSON.parse(cachedRaw);
        if (cached && cached.fingerprint === live.fingerprint) {
          skipped++;
          continue;
        }
      } catch (parseErr) {}
    }
    live.updatedAt = formatRfc2822(now);
    props.setProperty(EXPENSE_SUMMARY_PREFIX + ym, JSON.stringify(live));
    rebuilt.push({ yearmonth: ym, count: live.count, total: live.total });
  }
  if (!bootstrapped) props.setProperty(EXPENSE_SUMMARY_BOOTSTRAP, '1');
  return {
    success: true,
    bootstrap: !bootstrapped,
    window: bootstrapped ? EXPENSE_SUMMARY_MONTHS : 'all',
    rebuilt: rebuilt,
    skipped: skipped
  };
}

function backfillExpenseCalendarEvents() {
  var tz = Session.getScriptTimeZone();
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);
  var ymNow = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  var prev = new Date();
  prev.setMonth(prev.getMonth() - 1);
  var months = [ymNow, Utilities.formatDate(prev, tz, 'yyyy-MM')];
  var synced = 0;
  var errors = 0;
  for (var m = 0; m < months.length; m++) {
    var rows = recordsForYearMonth(months[m]);
    for (var i = 0; i < rows.length && synced < 40; i++) {
      var rec = rows[i];
      if (!rec.event_start || !rec.event_end || rec.calendar_event_id) continue;
      var start = parseExpenseWhen(rec.event_start);
      if (start && start < cutoff) continue;
      try {
        var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Records');
        var rowNum = -1;
        if (sheet && sheet.getLastRow() >= 2) {
          var idCol = ensureSheetHeader(sheet, 'id');
          var ids = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues();
          for (var r = 0; r < ids.length; r++) {
            if (String(ids[r][0]) === rec.id) {
              rowNum = r + 2;
              break;
            }
          }
        }
        syncExpenseCalendarEvent(rec, { id: rec.id, row: rowNum });
        synced++;
      } catch (e) {
        errors++;
        appendLog(['backfillExpenseCalendarEvents', rec.id, e.toString()]);
      }
    }
  }
  return { success: true, synced: synced, errors: errors };
}

function runDailyJobs() {
  var results = {};
  try {
    var c = processCommitments();
    results.commitments = c && c.getContent ? JSON.parse(c.getContent()) : c;
  } catch (e1) {
    results.commitments = { success: false, error: e1.toString() };
  }
  try {
    var o = processDueObligations();
    results.obligations = o && o.getContent ? JSON.parse(o.getContent()) : o;
  } catch (e2) {
    results.obligations = { success: false, error: e2.toString() };
  }
  try {
    results.summary = refreshExpenseSummaryCache();
  } catch (e3) {
    results.summary = { success: false, error: e3.toString() };
  }
  try {
    results.calendar = backfillExpenseCalendarEvents();
  } catch (e4) {
    results.calendar = { success: false, error: e4.toString() };
  }
  appendLog(['runDailyJobs', JSON.stringify(results)]);
  return jsonOut({ success: true, results: results });
}

/** Run once in the Apps Script editor to install daily 00:00 jobs. */
function setupDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var hasDaily = false;
  for (var i = 0; i < triggers.length; i++) {
    var name = triggers[i].getHandlerFunction();
    if (name === 'processDueObligations' || name === 'processCommitments') {
      ScriptApp.deleteTrigger(triggers[i]);
    } else if (name === 'runDailyJobs') {
      hasDaily = true;
    }
  }
  if (!hasDaily) {
    ScriptApp.newTrigger('runDailyJobs').timeBased().atHour(0).everyDays(1).create();
  }
  var summary = refreshExpenseSummaryCache();
  return (
    'installed runDailyJobs daily at 00:00; ' +
    (summary.bootstrap ? 'bootstrapped ' + summary.rebuilt.length + ' months' : 'refreshed')
  );
}

function setupObligationTrigger() {
  return setupDailyTrigger();
}