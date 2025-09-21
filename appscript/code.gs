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
      return getMileageData(parameter.carPlate);
    default:
      // 兼容旧版本
      const { name, country } = parameter;
      return ContentService.createTextOutput(JSON.stringify({ name, country })).setMimeType(ContentService.MimeType.JSON);
  }
};
const doPost = (request = {}) => {
  const { parameter, postData: { contents, type } = {} } = request;
  
  appendLog([type, contents, JSON.stringify(parameter), request]);
  const data = JSON.parse(contents);
  appendLog([data]);
  
  // 根据action类型分发处理
  switch(data.action) {
    case 'uploadPhoto':
      return handlePhotoUpload(data);
    case 'updateMerchant':
      return updateMerchant(data);
    case 'updateMileage':
      return updateMileage(data);
    default:
      // 默认处理费用提交
      insertRowToSheet(data);
      
      // 处理照片上传（如果有）
      if (data.photo && !data.photo_url) {
        const photoFileName = uploadFileToDrive(data.photo, `expense_${data.timestamp}_${Math.random().toString(36).substr(2, 9)}.jpg`, 'ExpensePhotos');
        if (photoFileName) {
          // 可以在这里更新Sheet中的照片信息
          appendLog(['Photo uploaded:', photoFileName]);
        }
      }
      
      var result = {
        status: "success",
        timestamp: data.timestamp
      };
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
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
  var folder = getFolder(foldername);
  try{
    var splitBase = base64Data.split(','),
      type = splitBase[0].split(';')[0].replace('data:','');
  

    var byteCharacters = Utilities.base64Decode(splitBase[1]);
    var ss = Utilities.newBlob(byteCharacters, type);
    ss.setName(fileName);

    
    var file = folder.createFile(ss);

    return file.getName();
  } catch(e){
    return 'Error: ' + e.toString();
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

      var _columnInFirstRow = first_row_data.indexOf(_k);
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
    const fileName = uploadFileToDrive(data.base64, data.filename, 'ExpensePhotos');
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileName: fileName,
      timestamp: data.timestamp
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    appendLog(['Error in handlePhotoUpload:', error.toString()]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
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
function getMileageData(carPlate) {
  try {
    const mileageData = getMileageFromSheet(carPlate);
    
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
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const merchants = [];
    
    for (let i = 1; i < data.length; i++) {
      const [longitude, latitude, name, address, category, createdTime, usageCount] = data[i];
      if (longitude && latitude) {
        merchants.push({
          longitude, latitude, name, address, category, createdTime, usageCount: usageCount || 0
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
 * 更新商家到Sheet
 */
function updateMerchantToSheet(data) {
  try {
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('Merchants');
    
    if (!sheet) {
      sheet = doc.insertSheet('Merchants');
      sheet.getRange('1:1').setValues([['经度', '纬度', '商家名称', '地址', '分类', '创建时间', '使用次数']]);
    }
    
    const row = [
      data.longitude,
      data.latitude,
      data.name,
      data.address || '',
      data.category || '',
      datetimetoYMDHIS(),
      1
    ];
    
    sheet.appendRow(row);
    
    return {
      longitude: data.longitude,
      latitude: data.latitude,
      name: data.name,
      address: data.address,
      category: data.category
    };
  } catch (error) {
    appendLog(['Error in updateMerchantToSheet:', error.toString()]);
    throw error;
  }
}

/**
 * 获取里程数据
 */
function getMileageFromSheet(carPlate) {
  try {
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('Mileage');
    
    if (!sheet) {
      sheet = doc.insertSheet('Mileage');
      sheet.getRange('1:1').setValues([['车牌', '里程数', '记录时间', '费用类型', '备注']]);
      return { carPlate, records: [], latestMileage: 0, previousMileage: 0, calculatedTrip: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const records = [];
    
    for (let i = 1; i < data.length; i++) {
      const [plate, mileage, recordTime, expenseType, remark] = data[i];
      if (plate === carPlate) {
        records.push({ carPlate: plate, mileage, recordTime, expenseType, remark });
      }
    }
    
    // 按时间排序
    records.sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime));
    
    return {
      carPlate,
      records,
      latestMileage: records.length > 0 ? records[0].mileage : 0,
      previousMileage: records.length > 1 ? records[1].mileage : 0,
      calculatedTrip: records.length > 1 ? records[0].mileage - records[1].mileage : 0
    };
  } catch (error) {
    appendLog(['Error in getMileageFromSheet:', error.toString()]);
    return { carPlate, records: [], latestMileage: 0, previousMileage: 0, calculatedTrip: 0 };
  }
}

/**
 * 更新里程数据到Sheet
 */
function updateMileageToSheet(data) {
  try {
    const doc = SpreadsheetApp.openById(sheetId);
    let sheet = doc.getSheetByName('Mileage');
    
    if (!sheet) {
      sheet = doc.insertSheet('Mileage');
      sheet.getRange('1:1').setValues([['车牌', '里程数', '记录时间', '费用类型', '备注']]);
    }
    
    const row = [
      data.carPlate,
      data.mileage,
      datetimetoYMDHIS(),
      data.expenseType || '打油',
      data.remark || ''
    ];
    
    sheet.appendRow(row);
    
    return getMileageFromSheet(data.carPlate);
  } catch (error) {
    appendLog(['Error in updateMileageToSheet:', error.toString()]);
    throw error;
  }
}