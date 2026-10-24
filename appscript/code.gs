// REPLACE the existing .gs file (Select all → paste). Do not add a second file — sheetId/doGet are globals.
const sheetId = '1ZAFWV5aIVcA66qJEMPGGsg3azPY415_Clwe--JinQ7w'; // https://docs.google.com/spreadsheets/d/1ZAFWV5aIVcA66qJEMPGGsg3azPY415_Clwe--JinQ7w/edit#gid=0

const doGet = (event) => {
  try {
    event = event || {};
    var parameter = normalizeCalendarShortcut_(event.parameter || {});
    appendLog([
      'doGet',
      event.queryString || flattenParams_(parameter),
      'action=' + (parameter.action || '')
    ]);
    var action = parameter.action;
    if (!isAccessAllowed(action, parameter, null)) {
      appendLog(['doGet forbidden', action || '(empty)']);
      return accessDeniedOut();
    }

    if (action === 'calendarPing' || parameter.op === 'ping') {
      return calendarJson({
        success: true,
        ping: true,
        received: parameter,
        queryString: event.queryString || '',
        at: new Date().toISOString()
      });
    }

    switch(action) {
    case 'getPaymentOptions':
      return getPaymentOptions();
    case 'getMerchants':
      return getMerchants();
    case 'getMileageData':
      return getMileageData(parameter.carPlate, parameter.group);
    case 'getKeyValue':
      return getKeyValue(parameter.key, parameter.group);
    case 'getKeyValueGroup':
      return getKeyValueGroup(parameter.group);
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
    case 'listLocations':
      return listLocations();
    case 'deleteLocation':
      return deleteLocation(parameter);
    case 'listLandmarkRegions':
      return listLandmarkRegions();
    case 'deleteLandmarkRegion':
      return deleteLandmarkRegion(parameter);
    case 'getParkedLocation':
      return getParkedLocation(parameter.carPlate);
    case 'getParkedLocations':
      return getParkedLocations();
    case 'getBootstrap':
      return getBootstrap();
    case 'getExpenseSummary':
      return getExpenseSummary(parameter || {});
    case 'getEatPlaces':
      return getEatPlaces();
    case 'getAiPrompt':
      return handleGetAiPrompt();
    case 'runDailyJobs':
      return runDailyJobs();
    case 'saveLocation':
      return saveLocation(parameter);
    case 'trackCalendar':
    case 'check_current':
      return handleCalendarTrack(parameter || {});
    default:
      appendLog(['doGet unknown action', action || '(empty)', flattenParams_(parameter)]);
      const { name, country } = parameter;
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Unknown action: ' + (action || '(empty)'),
        name: name,
        country: country
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    appendLog(['Error in doGet:', error.toString(), error.stack]);
    return calendarJson({
      success: false,
      error: calendarAuthHint(error)
    });
  }
};
const doPost = (request = {}) => {
  try {
    const { parameter, postData: { contents, type } = {} } = request;
    
    var queryParams = parameter || {};
    var typeStr = (type || '').toString();

    queryParams = normalizeCalendarShortcut_(queryParams);

    if (!contents) {
      if (queryParams.action === 'trackCalendar' || queryParams.action === 'check_current' || queryParams.action === 'calendarPing') {
        if (queryParams.action === 'calendarPing' || queryParams.op === 'ping') {
          return calendarJson({ success: true, ping: true, received: queryParams, at: new Date().toISOString() });
        }
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
      var phraseData = calendarPhraseToData_(contents);
      if (phraseData) {
        appendLog(['doPost phrase', contents]);
        return handleCalendarTrack(phraseData);
      }
      if (queryParams.action === 'trackCalendar' || queryParams.action === 'check_current') {
        return handleCalendarTrack(queryParams);
      }
      appendLog(['JSON parse error:', parseError.toString()]);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'JSON 解析失败: ' + parseError.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    data = normalizeCalendarShortcut_(data);
    appendLog(['Parsed data:', 'action: ' + (data.action || 'N/A'), 'op: ' + (data.op || 'N/A')]);
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
      case 'listLocations':
        return listLocations();
      case 'deleteLocation':
        return deleteLocation(data);
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
      case 'getAiPrompt':
        return handleGetAiPrompt();
      case 'setAiPrompt':
        return handleSetAiPrompt(data);
      case 'recordAiSuggestion':
        return handleRecordAiSuggestion(data);
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

function logCell_(v) {
  if (v == null) return '';
  var t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return v;
  try {
    return JSON.stringify(v);
  } catch (e) {
    return String(v);
  }
}

function flattenParams_(parameter) {
  parameter = parameter || {};
  var keys = Object.keys(parameter);
  var parts = [];
  var i;
  for (i = 0; i < keys.length; i++) {
    parts.push(keys[i] + '=' + parameter[keys[i]]);
  }
  return parts.join('&');
}

function appendLog(row, output_to_logger) {
  if (!(row instanceof Array)) row = [row];
  var cells = row.map(logCell_);
  cells.unshift(datetimetoYMDHIS(new Date()));
  try {
    Logger.log(cells.join(' | '));
  } catch (eLog) {}
  if (output_to_logger) return;
  try {
    var doc = SpreadsheetApp.openById(sheetId);
    var sheet = doc.getSheetByName('Log');
    if (!sheet) sheet = doc.getSheetByName('log');
    if (!sheet) {
      sheet = doc.insertSheet('Log');
      sheet.appendRow(['timestamp', 'message']);
    }
    sheet.appendRow(cells);
  } catch (eSheet) {
    try {
      Logger.log('appendLog sheet failed: ' + eSheet);
    } catch (e2) {}
  }
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

function normalizeHeaderName(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (/^column\s*\d+$/i.test(s)) return '';
  return s;
}

/** First matching header wins. Later duplicate columns (upsert leftovers) are ignored. */
function findHeaderIndex(headers, key) {
  var want = String(key == null ? '' : key).trim().toLowerCase();
  if (!want) return -1;
  for (var i = 0; i < headers.length; i++) {
    var name = normalizeHeaderName(headers[i]);
    if (name && name.toLowerCase() === want) return i;
  }
  return -1;
}

function headerIndexMap(headers) {
  var col = {};
  for (var i = 0; i < headers.length; i++) {
    var name = normalizeHeaderName(headers[i]);
    if (!name) continue;
    if (col[name] == null) col[name] = i;
    var lower = name.toLowerCase();
    if (col[lower] == null) col[lower] = i;
  }
  return col;
}

/** Records: row 1 = day filter, row 2 = headers, row 3+ = values. */
var RECORDS_HEADER_ROW = 2;
var RECORDS_DATA_START = 3;

function sheetLayout(sheetOrName) {
  var name =
    typeof sheetOrName === 'string'
      ? sheetOrName
      : sheetOrName && sheetOrName.getName
        ? sheetOrName.getName()
        : '';
  if (String(name) === 'Records') {
    return { headerRow: RECORDS_HEADER_ROW, dataStart: RECORDS_DATA_START };
  }
  return { headerRow: 1, dataStart: 2 };
}

function readSheetHeaders(sheet) {
  var layout = sheetLayout(sheet);
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(layout.headerRow, 1, 1, lastCol).getValues()[0];
}

/**
 * Replace Into：以毫秒 id（或 timestamp_ms）為 Primary Key。
 * 優先找 header「id」欄；若無則使用第 1 欄。
 * 同名欄只寫第一次出現的那格。Records：表頭第 2 列，資料第 3 列起。
 */
function upsertRowById(obj, sheetName) {
  sheetName = sheetName || 'Records';
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) {
    sheet = doc.insertSheet(sheetName);
  }
  var layout = sheetLayout(sheet);

  var id = obj.id !== undefined && obj.id !== null && obj.id !== ''
    ? String(obj.id)
    : (obj.timestamp_ms !== undefined ? String(obj.timestamp_ms) : '');
  if (!id) {
    id = String(new Date().getTime());
    obj.id = id;
  } else {
    obj.id = id;
  }

  var headers = readSheetHeaders(sheet);
  var idCol = findHeaderIndex(headers, 'id');
  if (idCol === -1) {
    // Never insert/shift column A (Records row 2 starts with timestamp, not id).
    var newIdCol = sheet.getLastColumn() + 1;
    sheet.getRange(layout.headerRow, newIdCol).setValue('id');
    headers = readSheetHeaders(sheet);
    idCol = findHeaderIndex(headers, 'id');
    if (idCol < 0) idCol = newIdCol - 1;
  }

  var lastRow = sheet.getLastRow();
  var existingRow = -1;
  if (lastRow >= layout.dataStart) {
    var nData = lastRow - layout.dataStart + 1;
    var idValues = sheet.getRange(layout.dataStart, idCol + 1, nData, 1).getValues();
    for (var r = 0; r < idValues.length; r++) {
      if (String(idValues[r][0]) === id) {
        existingRow = r + layout.dataStart;
        break;
      }
    }
  }

  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (findHeaderIndex(headers, k) >= 0) continue;
    var newCol = sheet.getLastColumn() + 1;
    sheet.getRange(layout.headerRow, newCol).setValue(k);
    headers[newCol - 1] = k;
  }
  headers = readSheetHeaders(sheet);

  var targetRow = existingRow > 0 ? existingRow : Math.max(sheet.getLastRow() + 1, layout.dataStart);
  if (targetRow < layout.dataStart) targetRow = layout.dataStart;

  var written = {};
  for (var ki = 0; ki < keys.length; ki++) {
    var key = keys[ki];
    if (obj[key] === undefined || obj[key] === null) continue;
    var lower = String(key).toLowerCase();
    if (written[lower]) continue;
    var idx = findHeaderIndex(headers, key);
    if (idx < 0) continue;
    var val = obj[key];
    if (typeof val === 'object') val = JSON.stringify(val);
    sheet.getRange(targetRow, idx + 1).setValue(val);
    written[lower] = true;
  }

  return { row: targetRow, updated: existingRow > 0, id: id };
}

var FX_CODES = ['USD', 'SGD', 'TWD', 'CNY', 'EUR'];
var FX_HEADERS = ['DATE', 'MYR', 'USD', 'SGD', 'TWD', 'CNY', 'EUR', 'SOURCE', 'UPDATED_AT'];
var FX_DEFAULT_KEY = 'DEFAULT';

function isFxDefaultDate(ymd) {
  return String(ymd || '').trim().toUpperCase() === FX_DEFAULT_KEY;
}

function fxCellYmd(cell) {
  if (cell instanceof Date && !isNaN(cell.getTime())) return ymdFromDate(cell);
  return String(cell == null ? '' : cell).trim();
}

function ensureFxRateSheet() {
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('FxRate');
  if (!sheet) {
    sheet = doc.insertSheet('FxRate');
    sheet.getRange(1, 1, 1, FX_HEADERS.length).setValues([FX_HEADERS]);
    sheet.getRange(1, 1, 1, FX_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < 1) {
    sheet.getRange(1, 1, 1, FX_HEADERS.length).setValues([FX_HEADERS]);
    sheet.getRange(1, 1, 1, FX_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var lastRow = sheet.getLastRow();
  var hasDefault = false;
  if (lastRow >= 2) {
    var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < dates.length; i++) {
      if (isFxDefaultDate(fxCellYmd(dates[i][0]))) {
        hasDefault = true;
        break;
      }
    }
  }
  if (!hasDefault) {
    sheet.appendRow([FX_DEFAULT_KEY, 1, '', '', '', '', '', 'sheet-default', '']);
  }
  return sheet;
}

function ymdFromDate(d) {
  if (!d || isNaN(d.getTime())) d = new Date();
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function ymdFromExpense(obj) {
  obj = obj || {};
  var d =
    parseExpenseWhen(obj.timestamp) ||
    parseExpenseWhen(obj.event_start) ||
    (obj.timestamp_ms ? new Date(Number(obj.timestamp_ms)) : null);
  return ymdFromDate(d);
}

function invertMyrRates(myrPerForeign) {
  var out = { MYR: 1 };
  var src = myrPerForeign || {};
  for (var i = 0; i < FX_CODES.length; i++) {
    var code = FX_CODES[i];
    var perMyr = Number(src[code] != null ? src[code] : src[code.toLowerCase()]);
    if (perMyr > 0) out[code] = Math.round((1 / perMyr) * 1000000) / 1000000;
  }
  return out;
}

function fetchLiveFxRates() {
  var tries = [
    'https://open.er-api.com/v6/latest/MYR',
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/myr.json'
  ];
  for (var t = 0; t < tries.length; t++) {
    try {
      var res = UrlFetchApp.fetch(tries[t], { muteHttpExceptions: true, followRedirects: true });
      if (res.getResponseCode() >= 400) continue;
      var body = JSON.parse(res.getContentText());
      var raw = body.rates || body.myr || {};
      var rates = invertMyrRates(raw);
      rates.MYR = 1;
      if (Object.keys(rates).length < 2) continue;
      return {
        date: ymdFromDate(new Date()),
        rates: rates,
        source: tries[t]
      };
    } catch (e) {
      appendLog(['fetchLiveFxRates', tries[t], e.toString()]);
    }
  }
  return null;
}

function parseFxRateCell(v) {
  if (v === '' || v == null) return 0;
  var n = Number(v);
  return n > 0 ? n : 0;
}

function ratesFromFxRow(row) {
  row = row || [];
  return {
    MYR: 1,
    USD: parseFxRateCell(row[2]),
    SGD: parseFxRateCell(row[3]),
    TWD: parseFxRateCell(row[4]),
    CNY: parseFxRateCell(row[5]),
    EUR: parseFxRateCell(row[6])
  };
}

function pickFxRate(existing, fallback, live) {
  if (existing > 0) return existing;
  if (fallback > 0) return fallback;
  if (live > 0) return live;
  return '';
}

function findFxRowIndex(sheet, dateKey) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var want = String(dateKey || '').trim().toUpperCase();
  for (var i = 0; i < dates.length; i++) {
    var ymd = fxCellYmd(dates[i][0]);
    if (String(ymd).trim().toUpperCase() === want) return i + 2;
  }
  return -1;
}

function readFxRowValues(sheet, rowIndex) {
  if (!(rowIndex > 0)) return [];
  return sheet.getRange(rowIndex, 1, 1, FX_HEADERS.length).getValues()[0] || [];
}

function writeFxRateRow(pack) {
  if (!pack || !pack.rates) return null;
  var sheet = ensureFxRateSheet();
  var date = pack.date || ymdFromDate(new Date());
  var live = pack.rates || {};
  var defaultIndex = findFxRowIndex(sheet, FX_DEFAULT_KEY);
  var defaultRow = readFxRowValues(sheet, defaultIndex);
  var defaultRates = ratesFromFxRow(defaultRow);

  var filledDefault = false;
  var defaultOut = [
    FX_DEFAULT_KEY,
    1,
    pickFxRate(defaultRates.USD, 0, live.USD),
    pickFxRate(defaultRates.SGD, 0, live.SGD),
    pickFxRate(defaultRates.TWD, 0, live.TWD),
    pickFxRate(defaultRates.CNY, 0, live.CNY),
    pickFxRate(defaultRates.EUR, 0, live.EUR),
    defaultRow[7] || 'sheet-default',
    defaultRow[8] || ''
  ];
  if (defaultIndex > 0) {
    var changedDefault = false;
    for (var d = 2; d <= 6; d++) {
      if (parseFxRateCell(defaultRow[d]) <= 0 && parseFxRateCell(defaultOut[d]) > 0) {
        changedDefault = true;
        break;
      }
    }
    if (changedDefault) {
      defaultOut[8] = formatRfc2822(new Date());
      sheet.getRange(defaultIndex, 1, 1, FX_HEADERS.length).setValues([defaultOut]);
      filledDefault = true;
    }
  } else {
    defaultOut[8] = formatRfc2822(new Date());
    sheet.appendRow(defaultOut);
    filledDefault = true;
    defaultIndex = sheet.getLastRow();
  }
  if (filledDefault) defaultRates = ratesFromFxRow(defaultOut);

  var rowIndex = findFxRowIndex(sheet, date);
  var existing = ratesFromFxRow(readFxRowValues(sheet, rowIndex));
  var merged = {
    MYR: 1,
    USD: pickFxRate(existing.USD, defaultRates.USD, live.USD),
    SGD: pickFxRate(existing.SGD, defaultRates.SGD, live.SGD),
    TWD: pickFxRate(existing.TWD, defaultRates.TWD, live.TWD),
    CNY: pickFxRate(existing.CNY, defaultRates.CNY, live.CNY),
    EUR: pickFxRate(existing.EUR, defaultRates.EUR, live.EUR)
  };
  var row = [
    date,
    1,
    merged.USD || '',
    merged.SGD || '',
    merged.TWD || '',
    merged.CNY || '',
    merged.EUR || '',
    pack.source || '',
    formatRfc2822(new Date())
  ];
  if (rowIndex > 0) {
    var prev = readFxRowValues(sheet, rowIndex);
    row[7] = prev[7] || pack.source || '';
    sheet.getRange(rowIndex, 1, 1, FX_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  loadFxTable._cache = null;
  return { date: date, rates: merged, source: pack.source || '' };
}

function refreshFxRates() {
  var live = fetchLiveFxRates();
  if (!live) return { success: false, error: 'fx fetch failed' };
  var stored = writeFxRateRow(live);
  return { success: true, date: stored.date, rates: stored.rates, source: stored.source };
}

function loadFxTable() {
  if (loadFxTable._cache) return loadFxTable._cache;
  var out = [];
  var defaults = { MYR: 1 };
  try {
    var sheet = ensureFxRateSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var values = sheet.getRange(2, 1, lastRow - 1, FX_HEADERS.length).getValues();
      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        var ymd = fxCellYmd(row[0]);
        if (!ymd) continue;
        var rates = ratesFromFxRow(row);
        if (isFxDefaultDate(ymd)) {
          defaults = rates;
          continue;
        }
        out.push({
          date: String(ymd).slice(0, 10),
          rates: rates,
          source: String(row[7] || '')
        });
      }
    }
  } catch (e) {
    appendLog(['loadFxTable', e.toString()]);
  }
  out.sort(function (a, b) {
    return String(a.date).localeCompare(String(b.date));
  });
  loadFxTable._cache = out;
  loadFxTable._defaults = defaults;
  return out;
}

function fxDefaultRates() {
  loadFxTable();
  return loadFxTable._defaults || { MYR: 1 };
}

function withFxDefaults(rates) {
  var base = fxDefaultRates();
  var src = rates || {};
  var out = { MYR: 1 };
  for (var i = 0; i < FX_CODES.length; i++) {
    var code = FX_CODES[i];
    var n = Number(src[code]);
    var d = Number(base[code]);
    out[code] = n > 0 ? n : d > 0 ? d : 0;
  }
  return out;
}

function fxRatesOnOrBefore(ymd) {
  var rows = loadFxTable();
  var hit = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].date <= ymd) hit = rows[i];
    else break;
  }
  if (hit) {
    return { date: hit.date, rates: withFxDefaults(hit.rates), source: hit.source };
  }
  var fallback = withFxDefaults({});
  var hasDefault = false;
  for (var j = 0; j < FX_CODES.length; j++) {
    if (fallback[FX_CODES[j]] > 0) {
      hasDefault = true;
      break;
    }
  }
  if (hasDefault) return { date: FX_DEFAULT_KEY, rates: fallback, source: 'sheet-default' };
  var live = fetchLiveFxRates();
  if (live) {
    var stored = writeFxRateRow(live);
    return stored || live;
  }
  return { date: ymd, rates: { MYR: 1 }, source: '' };
}

function fxMyrPerUnit(code, ymd) {
  var cur = String(code || 'MYR').trim().toUpperCase();
  if (!cur || cur === 'MYR') return 1;
  var pack = fxRatesOnOrBefore(ymd || ymdFromDate(new Date()));
  var rate = pack && pack.rates ? Number(pack.rates[cur]) : 0;
  return rate > 0 ? rate : 0;
}

function latestFxPayload() {
  var rows = loadFxTable();
  if (!rows.length) {
    var live = refreshFxRates();
    if (live && live.success) return { date: live.date, rates: live.rates, source: live.source };
    return { date: ymdFromDate(new Date()), rates: withFxDefaults({}), source: 'sheet-default' };
  }
  var last = rows[rows.length - 1];
  return { date: last.date, rates: withFxDefaults(last.rates), source: last.source };
}

function settlementAmountMyr(rec) {
  rec = rec || {};
  var cur = String(rec.currency || 'MYR').trim().toUpperCase();
  var amt = Number(rec.amount) || 0;
  var orig = rec.amount_original;
  var hasOrig = orig !== '' && orig != null && !isNaN(Number(orig));
  if (hasOrig) return Math.round(amt * 100) / 100;
  if (cur && cur !== 'MYR') {
    var rate = fxMyrPerUnit(cur, ymdFromExpense(rec));
    if (rate > 0) return Math.round(amt * rate * 100) / 100;
  }
  return Math.round(amt * 100) / 100;
}

function normalizeExpenseAmountToMyr(obj) {
  obj = obj || {};
  var cur = String(obj.currency || 'MYR').trim().toUpperCase() || 'MYR';
  var orig = parseFloat(obj.amount);
  if (isNaN(orig)) orig = 0;
  obj.currency = cur;
  obj.amount_original = orig;
  if (cur === 'MYR') {
    obj.fx_rate = 1;
    obj.fx_date = ymdFromExpense(obj);
    obj.amount = Math.round(orig * 100) / 100;
    return obj;
  }
  var ymd = ymdFromExpense(obj);
  var rate = fxMyrPerUnit(cur, ymd);
  if (!(rate > 0)) {
    loadFxTable._cache = null;
    rate = fxMyrPerUnit(cur, ymd);
  }
  obj.fx_date = ymd;
  obj.fx_rate = rate > 0 ? rate : '';
  obj.amount = rate > 0 ? Math.round(orig * rate * 100) / 100 : orig;
  return obj;
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
    normalizeExpenseAmountToMyr(recordsData);

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
        var photoUrlsIndex = findHeaderIndex(readSheetHeaders(sheet), 'photo_urls');
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

function lookupKeyValue_(key, group) {
  var searchGroup = String(group || 'KeyValue').trim().toUpperCase();
  var searchKey = String(key || '').trim().toUpperCase();
  if (!searchKey) return null;
  var sheet = getKeyValueSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var groupStr = data[i][0] ? String(data[i][0]).trim().toUpperCase() : '';
    var keyStr = data[i][1] ? String(data[i][1]).trim().toUpperCase() : '';
    if (groupStr === searchGroup && keyStr === searchKey) return data[i][2];
  }
  return null;
}

function lookupGroupMap_(group) {
  var searchGroup = String(group || '').trim().toUpperCase();
  var sheet = getKeyValueSheet();
  var data = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < data.length; i++) {
    var groupStr = data[i][0] ? String(data[i][0]).trim().toUpperCase() : '';
    if (groupStr !== searchGroup) continue;
    var keyStr = data[i][1] ? String(data[i][1]).trim().toUpperCase() : '';
    if (keyStr) out[keyStr] = data[i][2];
  }
  return out;
}

function stripBase64_(s) {
  s = String(s || '');
  var i = s.indexOf(',');
  if (s.indexOf('data:') === 0 && i > -1) return s.slice(i + 1);
  return s.replace(/\s+/g, '');
}

function photoHash_(b64) {
  try {
    var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b64);
    var hex = '';
    for (var i = 0; i < raw.length && i < 8; i++) {
      var b = raw[i];
      if (b < 0) b += 256;
      hex += ('0' + b.toString(16)).slice(-2);
    }
    return hex;
  } catch (e) {
    return '';
  }
}

function sanitizeGeminiError_(text) {
  return String(text || '')
    .replace(/key=[^&\s"']+/gi, 'key=REDACTED')
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, 'REDACTED')
    .slice(0, 480);
}

function canonicalizeGeminiModel_(slug) {
  var m = String(slug || '').trim().replace(/^models\//i, '');
  if (m === 'gemini-2.5-flash-lite' || m === 'gemini-2.0-flash-lite') return 'gemini-3.5-flash-lite';
  if (m === 'gemini-2.5-flash' || m === 'gemini-2.0-flash') return 'gemini-3.8-flash';
  return m;
}

function resolveGeminiModel_(name) {
  var n = String(name || '').trim().replace(/[\r\n]/g, '');
  n = n.replace(/^models\//i, '');
  var slug = n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
  // gemini-3-8-flash (hyphen) is not a model; id is gemini-3.8-flash (dot).
  slug = slug.replace(/^(gemini)-(\d+)-(\d+)/, '$1-$2.$3');
  slug = canonicalizeGeminiModel_(slug);
  if (/^gemini-[\w.-]+$/.test(slug)) return slug;
  return 'gemini-3.8-flash';
}

function splitGeminiModels_(raw) {
  return String(raw || '').split(/[,;\s]+/).map(function (s) {
    return canonicalizeGeminiModel_(String(s || '').trim().replace(/^models\//i, ''));
  }).filter(Boolean);
}

function geminiFallbackModels_(preferred, extra) {
  // lite first: 3.8-flash often hangs 60s on 503; UrlFetch cannot abort.
  var chain = ['gemini-3.5-flash-lite', preferred]
    .concat(splitGeminiModels_(extra))
    .concat(['gemini-3.8-flash']);
  var out = [];
  var i;
  for (i = 0; i < chain.length; i++) {
    var m = canonicalizeGeminiModel_(String(chain[i] || '').trim());
    if (!m || out.indexOf(m) !== -1) continue;
    out.push(m);
  }
  return out;
}

function geminiShouldTryNext_(code) {
  if (code === 401 || code === 402 || code === 403) return false;
  if (code === 400 || code === 404) return true;
  if (code === 408 || code === 429) return true;
  return code >= 500;
}

function geminiHttpError_(code, text) {
  var msg = '';
  try {
    var j = JSON.parse(text);
    msg = String(((j && j.error) || {}).message || '').trim();
  } catch (e) {}
  if (!msg) msg = String(text || '').replace(/^\s*\{[\s\S]*$/, '').trim();
  return 'Gemini HTTP ' + code + (msg ? ': ' + msg : '');
}

function defaultReceiptPromptTemplate_() {
  return [
    '你是記帳助理。根據收據／發票照片填欄位。',
    '目前分類: {{tag}}',
    '目前子分類: {{title}}',
    '允許分類: {{cats}}',
    '允許子分類:',
    '{{subcats}}',
    '需要欄位:',
    '{{fields}}',
    '{{hints}}',
    '規則:',
    '1. 回傳 JSON：{"suggestions":[{...}]}，1～4 筆。金額有含稅/未稅/折扣時可給多筆。',
    '2. 每筆含短 label（如「含稅總額」）。數字用 number。未知欄位省略。',
    '3. currency 用 ISO（MYR/SGD/USD/CNY/TWD/HKD）。fuelType 僅 ron95 或 ron97。',
    '4. tag/title 必須是允許清單內的值；已選分類優先沿用，除非收據明顯不符。',
    '5. 只根據照片，不要編造商家名以外的長文。',
    '6. 收據有品項列時 suggestions[].items 必填；沒有列才省略。數字欄位用 number。',
    '7. 回傳只能是 JSON，格式：',
    '{"suggestions":[{"label":"含稅總額","tag":"餐饮美食","title":"午餐","amount":25.5,"currency":"MYR","merchant":"店名","items":[{"name":"Nasi Lemak","unitPrice":8.5,"quantity":2,"amount":17}],"receipt_time":"2026-10-24 12:30","time_role":"printed"}]}'
  ].join('\n');
}

function mealTitleForHour_(hour) {
  var h = Number(hour);
  if (isNaN(h)) return '';
  if (h >= 5 && h <= 10) return '早餐';
  if (h >= 11 && h <= 15) return '午餐';
  return '晚餐';
}

function receiptHints_(data) {
  data = data || {};
  var whenStr = String(data.when || '').trim();
  var hm = whenStr.match(/\b(\d{1,2}):(\d{2})\b/);
  var meal = hm ? mealTitleForHour_(Number(hm[1])) : '';
  var lines = [];
  if (whenStr) lines.push('記帳時間: ' + whenStr);
  lines.push('有品項列則填 items:[{name,unitPrice,quantity,amount}]：name 字串，unitPrice/quantity/amount 用 number。quantity 看得到才填否則 1。amount 是該列小計。不要把整張總額當單一 item。沒有列就省略 items。');
  lines.push('時間：receipt_time 一律填印出時間（yyyy-MM-dd HH:mm）。入場/IN/開台/停車入場 → time_role=start 且 event_start=該時間，不要填 event_end。一般收據開立時間 → time_role=printed。照片同時有開始+結束才填 event_start 與 event_end。看不清就省略，不要猜。');
  lines.push('商家名填 merchant；有分店/地址才填 merchant_address。不要填經緯度。');
  if (!data.tag || data.tag === '餐饮美食') {
    var foodSubs = '早餐、午餐、晚餐、零食、饮料、外卖、聚餐';
    var suggest = meal ? ('依時間建議 ' + meal) : '依時間選早/午/晚餐';
    lines.push('餐饮美食 title 只能是：' + foodSubs + '。' + suggest + '（05–10 早餐、11–15 午餐、16–04 晚餐）；外帶/外送用外卖，明顯多人用聚餐。');
  }
  return lines.join('\n');
}

function receiptPromptVars_(data) {
  data = data || {};
  var fields = Array.isArray(data.fields) ? data.fields : [];
  var fieldLines = fields.map(function (f) {
    if (!f) return '';
    var key = f.key || '';
    var label = f.label || key;
    var hint = f.hint ? ' — ' + f.hint : '';
    return '- ' + key + ' (' + label + ')' + hint;
  }).filter(Boolean);
  if (!fieldLines.length) {
    fieldLines = [
      '- amount (金額) — 數字，不含幣符',
      '- currency (幣別) — ISO，如 MYR/SGD/USD',
      '- merchant (商家)',
      '- description (說明)',
      '- tag (分類)',
      '- title (子分類)'
    ];
  }
  var cats = Array.isArray(data.allowedTags) ? data.allowedTags.join('、') : '';
  var subMap = data.allowedSubcats && typeof data.allowedSubcats === 'object' ? data.allowedSubcats : {};
  var subLines = Object.keys(subMap).map(function (k) {
    var arr = Array.isArray(subMap[k]) ? subMap[k] : [];
    return k + ': ' + arr.join('、');
  });
  return {
    tag: data.tag || '未選',
    title: data.title || '未選',
    cats: cats,
    subcats: subLines.join('\n'),
    fields: fieldLines.join('\n'),
    when: String(data.when || '').trim(),
    hints: receiptHints_(data)
  };
}

function fillReceiptPrompt_(tpl, data) {
  var vars = receiptPromptVars_(data);
  var src = String(tpl || '').trim();
  if (!src) src = defaultReceiptPromptTemplate_();
  if (src.length > 8000) src = src.slice(0, 8000);
  var hasPh = /\{\{\s*[a-z]+\s*\}\}/i.test(src);
  var hadHints = /\{\{\s*hints\s*\}\}/i.test(src);
  var out = src
    .replace(/\{\{\s*tag\s*\}\}/gi, vars.tag)
    .replace(/\{\{\s*title\s*\}\}/gi, vars.title)
    .replace(/\{\{\s*cats\s*\}\}/gi, vars.cats)
    .replace(/\{\{\s*subcats\s*\}\}/gi, vars.subcats)
    .replace(/\{\{\s*fields\s*\}\}/gi, vars.fields)
    .replace(/\{\{\s*when\s*\}\}/gi, vars.when)
    .replace(/\{\{\s*hints\s*\}\}/gi, vars.hints);
  if (!hasPh) {
    out += '\n\n目前分類: ' + vars.tag +
      '\n目前子分類: ' + vars.title +
      (vars.cats ? '\n允許分類: ' + vars.cats : '') +
      (vars.subcats ? '\n允許子分類:\n' + vars.subcats : '') +
      '\n需要欄位:\n' + vars.fields;
  }
  if (!hadHints && vars.hints) out += '\n' + vars.hints;
  return out;
}

function looksLikeSuggestion_(s) {
  return !!(s && (s.tag || s.title || s.label || s.merchant || s.currency || s.receipt_time));
}

function parseGeminiSuggestions_(text) {
  var raw = String(text || '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  var obj = JSON.parse(raw);
  var list = [];
  if (Array.isArray(obj)) list = obj;
  else if (obj && Array.isArray(obj.suggestions)) list = obj.suggestions;
  else if (obj && Array.isArray(obj.items) && obj.items.some(looksLikeSuggestion_)) list = obj.items;
  else if (obj && typeof obj === 'object') list = [obj];
  return list.filter(function (s) { return s && typeof s === 'object'; }).slice(0, 8);
}

function extractGeminiText_(httpBody) {
  var parsed = JSON.parse(httpBody);
  var parts = ((((parsed || {}).candidates || [])[0] || {}).content || {}).parts || [];
  var out = '';
  var i;
  for (i = 0; i < parts.length; i++) {
    if (parts[i] && parts[i].text) out += parts[i].text;
  }
  if (!out) {
    var block = parsed && parsed.promptFeedback && parsed.promptFeedback.blockReason;
    throw new Error(block ? ('Gemini blocked: ' + block) : 'Gemini 無內容');
  }
  return out;
}

function callGeminiVision_(apiKey, model, mimeType, base64, prompt, extraFallbacks) {
  var models = geminiFallbackModels_(model, extraFallbacks);
  var tried = [];
  var lastErr = '';
  var i;
  var t0 = Date.now();
  for (i = 0; i < models.length; i++) {
    if (i > 0 && Date.now() - t0 > 22000) break;
    var m = models[i];
    tried.push(m);
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      m + ':generateContent?key=' + encodeURIComponent(apiKey);
    var body = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    };
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var text = res.getContentText() || '';
    if (code >= 200 && code < 300) {
      return { text: extractGeminiText_(text), model: m, tried: tried };
    }
    lastErr = geminiHttpError_(code, text);
    if (!geminiShouldTryNext_(code)) break;
    if (i < models.length - 1 && (code === 429 || code >= 500)) {
      Utilities.sleep(400);
    }
  }
  var e = new Error(sanitizeGeminiError_(lastErr || 'Gemini 失敗') + ' · tried ' + tried.join(', '));
  e.tried = tried;
  throw e;
}

function ensureAiSuggestSheet() {
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('AiSuggest');
  var headers = ['Timestamp', 'Tag', 'Title', 'Chosen', 'Count', 'Model', 'PhotoHash', 'Info'];
  if (!sheet) {
    sheet = doc.insertSheet('AiSuggest');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 收據 AI：KeyValueConfig group=AI 的 APIKey / Name。
 * 不把圖存進 Drive（提交記帳時才上傳）。
 */
function handleAnalyzeReceipt(data) {
  data = data || {};
  var model = '';
  var prompt = '';
  try {
    var ai = lookupGroupMap_('AI');
    model = resolveGeminiModel_(ai.NAME || lookupKeyValue_('Name', 'AI'));
    var fromClient = String(data.promptTemplate || '').trim();
    if (fromClient.length > 8000) fromClient = fromClient.slice(0, 8000);
    var stored = String(ai.PROMPT || lookupKeyValue_('Prompt', 'AI') || '').trim();
    prompt = fillReceiptPrompt_(fromClient || stored, data);
    var b64 = stripBase64_(data.photo || data.base64 || '');
    if (!b64) {
      return jsonOut({ success: false, error: '沒有圖片', model: model, prompt: prompt });
    }
    if (b64.length > 900000) {
      return jsonOut({ success: false, error: '圖片仍太大，請再壓縮', model: model, prompt: prompt });
    }
    var apiKey = String(ai.APIKEY || lookupKeyValue_('APIKey', 'AI') || '').trim();
    if (!apiKey) {
      return jsonOut({ success: false, error: 'KeyValueConfig group AI 未設定 APIKey', model: model, prompt: prompt });
    }
    var mime = data.mimeType || data.type || 'image/jpeg';
    if (String(mime).indexOf('image/') !== 0) mime = 'image/jpeg';
    var vision = callGeminiVision_(
      apiKey,
      model,
      mime,
      b64,
      prompt,
      ai.FALLBACK || ai.FALLBACKS || lookupKeyValue_('Fallback', 'AI')
    );
    var suggestions = parseGeminiSuggestions_(vision.text);
    var usedModel = vision.model || model;
    var hash = photoHash_(b64);
    appendLog(['analyzeReceipt', data.tag || '', data.title || '', suggestions.length, usedModel, hash]);
    return jsonOut({
      success: true,
      action: 'analyzeReceipt',
      model: usedModel,
      tried: vision.tried || [usedModel],
      prompt: prompt,
      photoHash: hash,
      suggestions: suggestions
    });
  } catch (error) {
    appendLog(['analyzeReceipt error', sanitizeGeminiError_(error.toString())]);
    return jsonOut({
      success: false,
      error: sanitizeGeminiError_(error.toString()),
      model: model,
      tried: error.tried || [],
      prompt: prompt
    });
  }
}

function ensureAiOpenApiKeyRow_() {
  var sheet = getKeyValueSheet();
  var data = sheet.getDataRange().getValues();
  var i;
  for (i = 1; i < data.length; i++) {
    var groupStr = data[i][0] ? String(data[i][0]).trim().toUpperCase() : '';
    var keyStr = data[i][1] ? String(data[i][1]).trim().toUpperCase() : '';
    if (groupStr === 'AI' && (keyStr === 'OPENAPIKEY' || keyStr === 'OPENAIKEY')) return;
  }
  sheet.appendRow(['AI', 'OPENAPIKey', '', datetimetoYMDHIS(), 'ChatGPT/OpenAI; Gemini 慢時瀏覽器直打']);
}

function handleGetAiPrompt() {
  try {
    ensureAiOpenApiKeyRow_();
    var ai = lookupGroupMap_('AI');
    var stored = String(ai.PROMPT || lookupKeyValue_('Prompt', 'AI') || '').trim();
    var openaiModel = String(ai.OPENAIMODEL || lookupKeyValue_('OPENAIModel', 'AI') || 'gpt-4o-mini').trim();
    if (!openaiModel) openaiModel = 'gpt-4o-mini';
    return jsonOut({
      success: true,
      action: 'getAiPrompt',
      template: stored,
      defaultTemplate: defaultReceiptPromptTemplate_(),
      model: resolveGeminiModel_(ai.NAME || lookupKeyValue_('Name', 'AI')),
      openaiModel: openaiModel,
      geminiKey: String(ai.APIKEY || lookupKeyValue_('APIKey', 'AI') || '').trim(),
      openaiKey: String(
        ai.OPENAPIKEY || ai.OPENAIKEY || lookupKeyValue_('OPENAPIKey', 'AI') || lookupKeyValue_('OPENAIKey', 'AI') || ''
      ).trim()
    });
  } catch (error) {
    return jsonOut({ success: false, error: error.toString() });
  }
}

function handleSetAiPrompt(data) {
  try {
    data = data || {};
    var text = String(data.template || data.value || data.prompt || '').trim();
    if (text.length > 8000) text = text.slice(0, 8000);
    if (!text) text = defaultReceiptPromptTemplate_();
    return setKeyValue({
      key: 'Prompt',
      value: text,
      group: 'AI'
    });
  } catch (error) {
    return jsonOut({ success: false, error: error.toString() });
  }
}

function handleRecordAiSuggestion(data) {
  try {
    data = data || {};
    var sheet = ensureAiSuggestSheet();
    var chosen = data.chosen;
    var chosenStr = typeof chosen === 'string' ? chosen : JSON.stringify(chosen || {});
    if (chosenStr.length > 4000) chosenStr = chosenStr.slice(0, 4000);
    sheet.appendRow([
      datetimetoYMDHIS(new Date()),
      data.tag || '',
      data.title || '',
      chosenStr,
      data.count != null ? data.count : '',
      data.model || '',
      data.photoHash || '',
      data.info || data.label || ''
    ]);
    appendLog(['recordAiSuggestion', data.tag || '', data.title || '', data.label || '']);
    return jsonOut({ success: true, action: 'recordAiSuggestion' });
  } catch (error) {
    return jsonOut({ success: false, error: error.toString() });
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
    var layout = sheetLayout(sheet);
    var first_row_data = readSheetHeaders(sheet);
    var last_row_num = Math.max(sheet.getLastRow() + 1, layout.dataStart);
    var obj_key = Object.keys(obj);
    if (debug){ appendLog([obj_key]); appendLog(['first_row_data',first_row_data]); appendLog(['last_row_num',last_row_num]); }
    var first_row_last_column = 1;
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
      
      // key exists at header row
      if(_columnInFirstRow > -1 && last_row_num >= layout.dataStart){
        _columnInFirstRow++;
        _tmp = last_row_num +','+_columnInFirstRow;
        coorWrite[_tmp] = _v;
        if (debug){  appendLog(['keys exists in first_row: '+ _tmp+'='+_k]);}
      } else {
        // append key in header row
        _tmp = layout.headerRow +','+first_row_last_column;
        coorWrite[_tmp] = _k;
        if (debug){ appendLog(['keys need to insert to first_row: '+ _tmp+'='+_k]);}

        /* for value */
        if(last_row_num < layout.dataStart){
          last_row_num = layout.dataStart;
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
function defaultPaymentOptionsMap_() {
  return {
    Cash: { key: 'Cash', card_num: 'Cash', bank: 'Cash' },
    TnG_eWallet: { key: 'eWallet', card_num: 'TnG', bank: 'TnG' },
    GrabPay_eWallet: { key: 'eWallet', card_num: 'GrabPay', bank: 'GrabPay' },
    Setel_eWallet: { key: 'eWallet', card_num: 'Setel', bank: 'Setel' },
    ShopeePay_eWallet: { key: 'eWallet', card_num: 'ShopeePay', bank: 'ShopeePay' }
  };
}

function isWalletOrCashName_(s) {
  var n = String(s || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!n) return true;
  if (n === 'cash' || n === 'auto') return true;
  return /^(tng|tngewallet|grabpay|setel|shopeepay|paylah|paynow)/.test(n);
}

function addPaymentOption_(out, opt) {
  if (!out || !opt) return;
  var num = String(opt.card_num || '').trim();
  if (!num) return;
  var keys = Object.keys(out);
  var i;
  for (i = 0; i < keys.length; i++) {
    if (String(out[keys[i]].card_num) === num) return;
  }
  var cat = String(opt.key || 'Card');
  var id = cat + '_' + num;
  out[id] = {
    key: cat,
    card_num: num,
    bank: opt.bank || opt.shortname || '',
    shortname: opt.shortname || opt.bank || ''
  };
}

function mergeKvPaymentGroup_(out, groupName, defaultKey) {
  var map = lookupGroupMap_(groupName);
  var keys = Object.keys(map);
  var i;
  for (i = 0; i < keys.length; i++) {
    var k = keys[i];
    var raw = map[k];
    var s = String(raw == null ? '' : raw).trim();
    var cardNum = k;
    var bank = '';
    var shortname = '';
    if (s.charAt(0) === '{') {
      try {
        var j = JSON.parse(s);
        cardNum = String(j.card_num || j.CARD_NUM || k);
        bank = String(j.bank || j.BANK || j.shortname || '');
        shortname = String(j.shortname || j.SHORTNAME || j.bank || '');
      } catch (e) {
        bank = s;
        shortname = s;
      }
    } else if (s) {
      bank = s;
      shortname = s;
    }
    if (defaultKey !== 'eWallet' && isWalletOrCashName_(cardNum)) continue;
    addPaymentOption_(out, {
      key: defaultKey,
      card_num: cardNum,
      bank: bank,
      shortname: shortname
    });
  }
}

function paymentSheetHeaderRow_(data) {
  var max = Math.min(2, data.length);
  var i;
  for (i = 0; i < max; i++) {
    var joined = data[i].map(function (c) { return String(c || '').toLowerCase(); }).join(' ');
    if (/card_num|\bcard\b|\bkey\b|\bbank\b|shortname|payment/.test(joined)) return i;
  }
  return 0;
}

function mergePaymentOptionsSheet_(out) {
  var doc = SpreadsheetApp.openById(sheetId);
  var names = ['PaymentOptions', 'Payment', 'Payments', 'Cards', '信用卡', '银行卡'];
  var si;
  for (si = 0; si < names.length; si++) {
    var sheet = doc.getSheetByName(names[si]);
    if (!sheet) continue;
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) continue;
    var headerRow = paymentSheetHeaderRow_(data);
    var headers = data[headerRow];
    var keyCol = findHeaderIndex(headers, 'key');
    var numCol = findHeaderIndex(headers, 'card_num');
    if (numCol < 0) numCol = findHeaderIndex(headers, 'card');
    if (numCol < 0) numCol = 1;
    var bankCol = findHeaderIndex(headers, 'bank');
    var shortCol = findHeaderIndex(headers, 'shortname');
    if (shortCol < 0) shortCol = findHeaderIndex(headers, 'name');
    var r;
    for (r = headerRow + 1; r < data.length; r++) {
      var row = data[r];
      var num = String(row[numCol] || '').trim();
      var cat = keyCol >= 0 ? String(row[keyCol] || '').trim() : '';
      if (!num) continue;
      if (!cat) cat = isWalletOrCashName_(num) ? (num.toLowerCase() === 'cash' ? 'Cash' : 'eWallet') : 'Card';
      addPaymentOption_(out, {
        key: cat,
        card_num: num,
        bank: bankCol >= 0 ? String(row[bankCol] || '') : '',
        shortname: shortCol >= 0 ? String(row[shortCol] || '') : ''
      });
    }
  }
}

function mergeCardsFromKeyValue_(out) {
  var sheet = getKeyValueSheet();
  var data = sheet.getDataRange().getValues();
  var skip = {
    AI: 1, CAR: 1, CARS: 1, CARPLATE: 1, PLATE: 1, LOCATION: 1,
    LANDMARK: 1, FX: 1, OBLIGATION: 1, CALENDAR: 1, PROMPT: 1,
    PARKED: 1, ACCESS: 1, PARKEDLOCATION: 1
  };
  var i;
  for (i = 1; i < data.length; i++) {
    var group = String(data[i][0] || '').trim();
    var key = String(data[i][1] || '').trim();
    var val = String(data[i][2] == null ? '' : data[i][2]).trim();
    var gUp = group.toUpperCase();
    if (skip[gUp]) continue;
    var cardNum = '';
    var bank = '';
    var shortname = '';
    var cat = 'Card';
    if (val.charAt(0) === '{') {
      try {
        var j = JSON.parse(val);
        if (j.card_num || j.CARD_NUM) {
          cardNum = String(j.card_num || j.CARD_NUM);
          bank = String(j.bank || j.BANK || '');
          shortname = String(j.shortname || j.SHORTNAME || '');
          cat = String(j.key || 'Card');
        }
      } catch (eJson) {}
    }
    if (!cardNum && /card|payment|bank|信用卡|银行卡/i.test(group + ' ' + key)) {
      cardNum = key;
      bank = val;
    }
    if (!cardNum && /^\d{4,19}$/.test(key.replace(/[\s-]/g, ''))) {
      cardNum = key;
      bank = val || group;
    }
    if (!cardNum || isWalletOrCashName_(cardNum)) continue;
    if (cat !== 'eWallet' && cat !== 'Cash') cat = 'Card';
    addPaymentOption_(out, { key: cat, card_num: cardNum, bank: bank, shortname: shortname });
  }
}

function mergeCardsFromRecords_(out) {
  var doc = SpreadsheetApp.openById(sheetId);
  var sheet = doc.getSheetByName('Records');
  if (!sheet) return;
  var headers = readSheetHeaders(sheet);
  var col = findHeaderIndex(headers, 'payment_method');
  if (col < 0) col = findHeaderIndex(headers, 'payment');
  if (col < 0) return;
  var layout = sheetLayout(sheet);
  var last = sheet.getLastRow();
  if (last < layout.dataStart) return;
  var start = Math.max(layout.dataStart, last - 7999);
  var n = last - start + 1;
  var vals = sheet.getRange(start, col + 1, n, 1).getValues();
  var i;
  for (i = 0; i < vals.length; i++) {
    var num = String(vals[i][0] || '').trim();
    if (!num || isWalletOrCashName_(num)) continue;
    if (!/\d{4}/.test(num.replace(/\s/g, ''))) continue;
    addPaymentOption_(out, { key: 'Card', card_num: num, bank: '', shortname: '' });
  }
}

function getPaymentOptionsMap() {
  var out = defaultPaymentOptionsMap_();
  try {
    mergeKvPaymentGroup_(out, 'Card', 'Card');
    mergeKvPaymentGroup_(out, 'Cards', 'Card');
    mergeKvPaymentGroup_(out, 'Payment', 'Card');
    mergeKvPaymentGroup_(out, 'CreditCard', 'Card');
    mergeKvPaymentGroup_(out, '信用卡', 'Card');
    mergeKvPaymentGroup_(out, '银行卡', 'Card');
  } catch (e1) {}
  try {
    mergeCardsFromKeyValue_(out);
  } catch (e1b) {}
  try {
    mergePaymentOptionsSheet_(out);
  } catch (e2) {}
  try {
    mergeCardsFromRecords_(out);
  } catch (e3) {}
  return out;
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
    out.fx = latestFxPayload();
  } catch (e) {
    out.fxError = e.toString();
    out.fx = { date: '', rates: { MYR: 1 }, source: '' };
  }
  try {
    out.expenseTags = collectKeyValueGroup('Expense');
  } catch (e) {
    out.expenseTagsError = e.toString();
    out.expenseTags = {};
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
  var foundAny = '';
  for (var i = 1; i < data.length; i++) {
    var groupStr = data[i][0] ? String(data[i][0]).trim() : '';
    var keyStr = data[i][1] ? String(data[i][1]).trim().toUpperCase() : '';
    if (keyStr !== searchKey) continue;
    var val = data[i][2] != null ? String(data[i][2]).trim() : '';
    if (!val) continue;
    if (groupStr.toLowerCase() === 'keyvalue') return val;
    if (!foundAny) foundAny = val;
  }
  if (foundAny) return foundAny;
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
  trackCalendar: true,
  calendarPing: true,
  check_current: true
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
function collectKeyValueGroup(group) {
  var searchGroup = String(group || '').trim().toUpperCase();
  var out = {};
  if (!searchGroup) return out;
  var sheet = getKeyValueSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var groupStr = data[i][0] ? String(data[i][0]).trim().toUpperCase() : '';
    if (groupStr !== searchGroup) continue;
    var keyStr = data[i][1] ? String(data[i][1]).trim() : '';
    if (!keyStr) continue;
    if (keyStr.toUpperCase() === ACCESS_HASH_KEY) continue;
    out[keyStr] = data[i][2];
  }
  return out;
}

function getKeyValueGroup(group) {
  try {
    var searchGroup = String(group || 'Expense').trim() || 'Expense';
    return jsonOut({
      success: true,
      group: searchGroup,
      values: collectKeyValueGroup(searchGroup)
    });
  } catch (error) {
    appendLog(['Error in getKeyValueGroup:', error.toString(), error.stack]);
    return jsonOut({
      success: false,
      error: error.toString(),
      values: {}
    });
  }
}

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
      if (groupStr.toUpperCase() === String(searchGroup).toUpperCase() && keyStr === searchKey) {
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
      
      if (groupStr.toUpperCase() === String(searchGroup).toUpperCase() && keyStr === searchKey) {
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
    const nameTol = 0.0011; // ~120m：同名附近視為同一地標，避免 GPS 抖動重複列
    
    for (let i = 1; i < existingData.length; i++) {
      const [lat, lon] = existingData[i];
      if (Math.abs(parseFloat(lat) - latitude) < tolerance && 
          Math.abs(parseFloat(lon) - longitude) < tolerance) {
        rowIndex = i + 1; // Sheet的行索引从1开始
        break;
      }
    }

    if (rowIndex < 0 && name && String(name).trim()) {
      const want = String(name).trim().toLowerCase();
      for (let i = 1; i < existingData.length; i++) {
        const [lat, lon, existingName] = existingData[i];
        if (String(existingName || '').trim().toLowerCase() !== want) continue;
        if (Math.abs(parseFloat(lat) - latitude) < nameTol &&
            Math.abs(parseFloat(lon) - longitude) < nameTol) {
          rowIndex = i + 1;
          break;
        }
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

function listLocations() {
  try {
    const doc = SpreadsheetApp.openById(sheetId);
    const sheet = doc.getSheetByName('Location');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        locations: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const data = sheet.getDataRange().getValues();
    const locations = [];
    for (let i = 1; i < data.length; i++) {
      const [lat, lon, name, createdTime, usageCount] = data[i];
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) continue;
      const n = String(name || '').trim();
      if (!n) continue;
      locations.push({
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        name: n,
        createdTime: createdTime || '',
        usageCount: usageCount || 0,
        radiusM: 100
      });
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      locations: locations
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    appendLog(['Error in listLocations:', error.toString(), error.stack]);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/** Delete one Location-sheet pin. Match lat/lng (and name if given). */
function deleteLocation(data) {
  try {
    const latitude = parseFloat(data.latitude);
    const longitude = parseFloat(data.longitude);
    const wantName = String(data.name || '').trim().toLowerCase();
    if (isNaN(latitude) || isNaN(longitude)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid latitude or longitude'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const doc = SpreadsheetApp.openById(sheetId);
    const sheet = doc.getSheetByName('Location');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        deleted: 0
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const rows = sheet.getDataRange().getValues();
    const tolerance = 0.00015;
    let deleted = 0;
    for (let i = rows.length - 1; i >= 1; i--) {
      const [lat, lon, name] = rows[i];
      if (Math.abs(parseFloat(lat) - latitude) > tolerance) continue;
      if (Math.abs(parseFloat(lon) - longitude) > tolerance) continue;
      if (wantName && String(name || '').trim().toLowerCase() !== wantName) continue;
      sheet.deleteRow(i + 1);
      deleted++;
    }
    appendLog(['deleteLocation', latitude, longitude, wantName, 'deleted', deleted]);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      deleted: deleted
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    appendLog(['Error in deleteLocation:', error.toString(), error.stack]);
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
    var icon = '';
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
          icon = (parsedVerts.icon || '').toString().trim();
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
      icon: icon || 'place',
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
    var icon = (data.icon || '').toString().trim();
    if (icon !== 'food' && icon !== 'fuel' && icon !== 'shop' && icon !== 'med') icon = 'place';
    var verticesJson = JSON.stringify({ shape: shape, vertices: vertices, icon: icon });
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
        icon: icon,
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

var CALENDAR_TITLE_ALIASES_ = {
  driving: 'Driving',
  work: 'Work',
  commute: 'Commute',
  trip: 'Trip',
  sleep: 'Sleep'
};

function calendarPhraseKey_(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[_+]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Map Shortcut phrase / action / op → trackCalendar fields. Null if unrelated. */
function calendarPhraseToData_(raw) {
  var key = calendarPhraseKey_(raw);
  if (!key) return null;
  if (key === 'ping' || key === 'calendaping' || key === 'calendar ping') {
    return { action: 'calendarPing', op: 'ping' };
  }
  if (key === 'end all' || key === 'endall' || key === 'end + all' || key === 'end+all') {
    return { action: 'trackCalendar', op: 'end', all: '1', endAny: '1' };
  }
  if (key === 'end') {
    return { action: 'trackCalendar', op: 'end' };
  }
  if (key === 'start' || key === 'append' || key === 'home' || key === 'check') {
    return { action: 'trackCalendar', op: key };
  }
  if (CALENDAR_TITLE_ALIASES_[key]) {
    return {
      action: 'trackCalendar',
      op: 'start',
      title: CALENDAR_TITLE_ALIASES_[key],
      endExisting: '1'
    };
  }
  var m = key.match(/^(start|end)\s+(.+)$/);
  if (m && CALENDAR_TITLE_ALIASES_[m[2]]) {
    if (m[1] === 'end') {
      return { action: 'trackCalendar', op: 'end', title: CALENDAR_TITLE_ALIASES_[m[2]] };
    }
    return {
      action: 'trackCalendar',
      op: 'start',
      title: CALENDAR_TITLE_ALIASES_[m[2]],
      endExisting: '1'
    };
  }
  return null;
}

function applyCalendarPhrase_(out, phrase) {
  if (!out || !phrase) return out;
  if (phrase.action) out.action = phrase.action;
  if (phrase.op) out.op = phrase.op;
  if (phrase.title && !out.title) out.title = phrase.title;
  if (phrase.all) out.all = phrase.all;
  if (phrase.endAny) out.endAny = phrase.endAny;
  if (phrase.endExisting != null && (out.endExisting === undefined || out.endExisting === '')) {
    out.endExisting = phrase.endExisting;
  }
  return out;
}

function normalizeCalendarShortcut_(data) {
  data = data || {};
  var out = {};
  var keys = Object.keys(data);
  var i;
  for (i = 0; i < keys.length; i++) out[keys[i]] = data[keys[i]];
  var actionKey = calendarPhraseKey_(out.action);
  if (actionKey && actionKey !== 'trackcalendar' && actionKey !== 'check_current' && actionKey !== 'calendaping') {
    applyCalendarPhrase_(out, calendarPhraseToData_(out.action));
  }
  applyCalendarPhrase_(out, calendarPhraseToData_(out.op));
  if (!out.op) {
    applyCalendarPhrase_(out, calendarPhraseToData_(out.title));
    applyCalendarPhrase_(out, calendarPhraseToData_(out.text || out.txt || out.input || out.phrase));
  }
  return out;
}

function resolveCalendarOp(data) {
  data = data || {};
  var action = String(data.action || '').trim();
  var op = calendarPhraseKey_(data.op);
  if (action === 'check_current' || op === 'check' || op === 'check_current') return 'check';
  if (op === 'end all' || op === 'endall' || op === 'end + all' || op === 'end+all') return 'end';
  if (op === 'start' || op === 'append' || op === 'end' || op === 'home' || op === 'block' || op === 'range') {
    return op === 'range' ? 'block' : op;
  }
  if (CALENDAR_TITLE_ALIASES_[op]) return 'start';
  var prefix = calendarPhraseKey_(data.prefix);
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

function calendarSearchBounds_(when, lookbackMs) {
  var back = lookbackMs || CALENDAR_LOOKBACK_DAYS_DEFAULT * 24 * 60 * 60 * 1000;
  var pad = Math.max(CALENDAR_LOOKAHEAD_MS, back);
  return {
    from: new Date(when.getTime() - back),
    to: new Date(when.getTime() + pad)
  };
}

function findEventsByFirstLine(calendar, marker, when, lookbackMs) {
  var bounds = calendarSearchBounds_(when, lookbackMs);
  var from = bounds.from;
  var to = bounds.to;
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
  var bounds = calendarSearchBounds_(when, lookbackMs);
  var from = bounds.from;
  var to = bounds.to;
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
    data = normalizeCalendarShortcut_(data || {});
    appendLog(['handleCalendarTrack called', JSON.stringify(data)]);

    var op = resolveCalendarOp(data);
    var when = parseCalendarTimestamp(
      data.timestamp,
      data.timestampMs != null ? data.timestampMs : data.timestamp_ms
    );
    var title = (data.title || '').toString().trim();
    var rawOp = calendarPhraseKey_(data.op);
    if (!title && CALENDAR_TITLE_ALIASES_[rawOp]) title = CALENDAR_TITLE_ALIASES_[rawOp];
    var coords = parseCalendarCoords(data);
    var lat = coords.lat;
    var lng = coords.lng;
    var hasCoords = !isNaN(lat) && !isNaN(lng);
    var placeName = hasCoords ? resolvePlaceName(lat, lng) : '';
    var endExisting = calendarFlag(data.endExisting, true);
    var startHome = calendarFlag(data.startHome, false);
    var all = calendarFlag(data.all, false);
    var endAny = calendarFlag(data.endAny, false);
    if (rawOp === 'end all' || rawOp === 'endall' || rawOp === 'end + all' || rawOp === 'end+all') {
      all = true;
      endAny = true;
    }
    var lookbackMs = calendarLookbackMs(data);
    appendLog(['handleCalendarTrack resolved', op, 'title=' + title, 'all=' + all, 'endAny=' + endAny]);
    var ts = formatCalendarStamp(when);
    var calendar = openTrackingCalendar();
    var starts = findEventsByFirstLine(calendar, CALENDAR_START_MARKER, when, lookbackMs);
    var homes = findEventsByFirstLine(calendar, CALENDAR_HOME_MARKER, when, lookbackMs);
    var liveEvents = findLiveTimedEvents(calendar, when, lookbackMs);
    var appendable = mergeCalendarEvents(starts, liveEvents);
    var searchBounds = calendarSearchBounds_(when, lookbackMs);
    var windowEvents = calendar.getEvents(searchBounds.from, searchBounds.to);

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

    if (op === 'block') {
      var endWhen = parseCalendarTimestamp(
        data.timestampEnd || data.event_end || data.end,
        data.timestampEndMs != null ? data.timestampEndMs : data.timestamp_end_ms
      );
      if (!endWhen || isNaN(endWhen.getTime())) endWhen = new Date();
      if (endWhen.getTime() <= when.getTime()) endWhen = new Date(when.getTime() + 60 * 1000);
      var loc = '';
      if (placeName) loc = placeName;
      else if (hasCoords) loc = lat + ',' + lng;
      var blockDesc = String(data.description || data.body || '').trim() || 'auto populated by 記賬 / AI';
      var blockEv = calendar.createEvent(title || 'Trip', when, endWhen, {
        description: blockDesc,
        location: loc || undefined
      });
      result = {
        success: true,
        mode: 'created',
        op: 'block',
        eventId: blockEv.getId(),
        title: blockEv.getTitle(),
        start: blockEv.getStartTime().toISOString(),
        end: blockEv.getEndTime().toISOString(),
        placeName: placeName
      };
      appendLog(['Calendar block created:', JSON.stringify(result)]);
      return calendarJson(result);
    }

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
      var titleFallback = false;
      if (!closeAll) {
        if (title) {
          endTargets = [];
          for (var e = 0; e < endPool.length; e++) {
            if (endPool[e].getTitle() === title) endTargets.push(endPool[e]);
          }
        }
        if (!endTargets.length) {
          titleFallback = Boolean(title);
          var endPrimary = pickPrimaryEvent(endPool, when, '');
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
        mode: closedEnd.length ? 'ended' : 'noop',
        op: closeAll ? 'end all' : 'end',
        all: closeAll,
        closed: closedEnd,
        placeName: placeName,
        searched: {
          starts: starts.length,
          live: liveEvents.length,
          homes: homes.length,
          pool: endPool.length
        },
        warning: closedEnd.length
          ? (titleFallback ? 'ended primary event; title had no match' : '')
          : ('no matching open events in lookback window (starts=' +
            starts.length +
            ' live=' +
            liveEvents.length +
            ' homes=' +
            homes.length +
            ')')
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
    yearmonth: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM'),
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
var EXPENSE_SUMMARY_PREFIX = 'expenseSummary_v3_';
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

function expenseLocationName_(data) {
  data = data || {};
  var label = String(data.location_label || data.place || data.locationName || '').trim();
  if (label) return label;
  var geo = String(data.geolocation || '');
  var m = geo.match(/[?&]name=([^&]+)/i);
  if (m) {
    try {
      return decodeURIComponent(String(m[1]).replace(/\+/g, ' ')).trim();
    } catch (e) {
      return String(m[1] || '').trim();
    }
  }
  return '';
}

function expenseCalendarTitle(data) {
  var subcat = String((data && data.title) || '').trim() || '支出';
  var shortDesc = expenseDescShort(
    (data && (data.description || data.simpleDescription || data.remark)) || ''
  );
  var locName = expenseLocationName_(data);
  var title = shortDesc ? '[' + subcat + '] - ' + shortDesc : '[' + subcat + ']';
  if (locName && title.indexOf(locName) === -1) title += ' · ' + locName;
  return title;
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
  var layout = sheetLayout(sheet);
  var headers = readSheetHeaders(sheet);
  var idx = findHeaderIndex(headers, name);
  if (idx >= 0) return idx;
  var col = sheet.getLastColumn() + 1;
  sheet.getRange(layout.headerRow, col).setValue(name);
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
    var existingId = String(data.calendar_event_id || data.calendarEventId || '').trim();
  if (!existingId && upsert.row >= RECORDS_DATA_START && sheet) {
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
  if (eventId && upsert.row >= RECORDS_DATA_START && sheet) {
    writeSheetCell(sheet, upsert.row, 'calendar_event_id', eventId);
  }
  return eventId;
}

/** Records 存 202610、2026-10，或 Sheets 日期。一律收成 yyyy-MM。 */
function normalizeYearMonth(raw) {
  if (raw == null || raw === '') return '';
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw.getTime())) {
    var y = raw.getFullYear();
    if (y >= 1990 && y <= 2100) {
      return Utilities.formatDate(raw, Session.getScriptTimeZone(), 'yyyy-MM');
    }
    return '';
  }
  var s = String(raw).trim();
  if (!s || s === '0') return '';
  var compact = s.match(/^(\d{4})(\d{2})$/);
  if (compact) {
    var cm = Number(compact[2]);
    if (cm >= 1 && cm <= 12) return compact[1] + '-' + compact[2];
  }
  var dashed = s.match(/^(\d{4})[-\/](\d{1,2})/);
  if (dashed) {
    var month = ('0' + dashed[2]).slice(-2);
    if (Number(month) >= 1 && Number(month) <= 12) return dashed[1] + '-' + month;
  }
  var n = Number(s);
  if (n >= 199001 && n <= 210012 && String(Math.floor(n)).length === 6) {
    return normalizeYearMonth(String(Math.floor(n)));
  }
  return '';
}

function invalidateExpenseSummary(yearmonth) {
  var ym = normalizeYearMonth(yearmonth);
  if (!ym) {
    ym = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  }
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(EXPENSE_SUMMARY_PREFIX + ym);
  props.deleteProperty(EXPENSE_SUMMARY_PREFIX + ym.replace('-', ''));
}

function sheetText(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return String(v);
}

function rowYearMonth(row, col, displayRow) {
  var ymIdx = col.yearmonth != null ? col.yearmonth : col.YearMonth;
  var tsIdx = col.timestamp != null ? col.timestamp : col.Timestamp;
  var yearmonth = '';
  if (ymIdx != null) {
    yearmonth =
      normalizeYearMonth(displayRow ? displayRow[ymIdx] : '') ||
      normalizeYearMonth(row[ymIdx]);
  }
  if (!yearmonth && tsIdx != null) {
    yearmonth =
      normalizeYearMonth(displayRow ? displayRow[tsIdx] : '') ||
      normalizeYearMonth(row[tsIdx]);
  }
  return yearmonth;
}

function recordFromSheetRow(row, col, yearmonth) {
  return {
    id: sheetText(col.id != null ? row[col.id] : ''),
    tag: String(col.tag != null && row[col.tag] != null ? row[col.tag] : '').trim() || '其他',
    title: String(col.title != null && row[col.title] != null ? row[col.title] : '').trim(),
    amount: Number(col.amount != null ? row[col.amount] : 0) || 0,
    amount_original:
      col.amount_original != null && row[col.amount_original] !== ''
        ? Number(row[col.amount_original])
        : '',
    fx_rate: col.fx_rate != null && row[col.fx_rate] !== '' ? Number(row[col.fx_rate]) : '',
    fx_date: sheetText(col.fx_date != null ? row[col.fx_date] : ''),
    currency: String(col.currency != null && row[col.currency] != null ? row[col.currency] : 'MYR') || 'MYR',
    remark: sheetText(col.remark != null ? row[col.remark] : ''),
    description: sheetText(col.description != null ? row[col.description] : ''),
    timestamp: sheetText(col.timestamp != null ? row[col.timestamp] : ''),
    event_start: sheetText(col.event_start != null ? row[col.event_start] : ''),
    event_end: sheetText(col.event_end != null ? row[col.event_end] : ''),
    calendar_event_id: sheetText(
      col.calendar_event_id != null ? row[col.calendar_event_id] : ''
    ),
    geolocation: sheetText(col.geolocation != null ? row[col.geolocation] : ''),
    latitude: col.latitude != null ? row[col.latitude] : '',
    longitude: col.longitude != null ? row[col.longitude] : '',
    yearmonth: yearmonth
  };
}

function coordsFromExpenseRow(rec) {
  rec = rec || {};
  var lat = Number(rec.latitude);
  var lng = Number(rec.longitude);
  if (!(lat && lng) || isNaN(lat) || isNaN(lng)) {
    var geo = String(rec.geolocation || '');
    var m = geo.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/) || geo.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (m) {
      lat = Number(m[1]);
      lng = Number(m[2]);
    }
  }
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat: lat, lng: lng };
}

/** Records: header row 2, data from row 3. Duplicate headers on the right are ignored. */
function recordsGroupedByMonth(allowYm) {
  var grouped = {};
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Records');
  if (!sheet || sheet.getLastRow() < RECORDS_DATA_START) return grouped;
  var lastCol = sheet.getLastColumn();
  var headers = readSheetHeaders(sheet);
  var col = headerIndexMap(headers);
  var nRows = sheet.getLastRow() - RECORDS_DATA_START + 1;
  var range = sheet.getRange(RECORDS_DATA_START, 1, nRows, lastCol);
  var values = range.getValues();
  var displays = range.getDisplayValues();
  for (var r = 0; r < values.length; r++) {
    var yearmonth = rowYearMonth(values[r], col, displays[r]);
    if (!yearmonth) continue;
    if (allowYm && !allowYm[yearmonth] && !allowYm[String(yearmonth).replace('-', '')]) continue;
    if (!grouped[yearmonth]) grouped[yearmonth] = [];
    grouped[yearmonth].push(recordFromSheetRow(values[r], col, yearmonth));
  }
  return grouped;
}

function recordsForYearMonth(ym) {
  var n = normalizeYearMonth(ym) || String(ym || '').trim();
  var allow = {};
  if (n) {
    allow[n] = true;
    allow[String(n).replace('-', '')] = true;
  }
  var grouped = recordsGroupedByMonth(n ? allow : null);
  if (!n) {
    return [].concat.apply([], Object.keys(grouped).map(function (k) {
      return grouped[k];
    }));
  }
  var a = grouped[n] || [];
  var compact = String(n).replace('-', '');
  var b = compact === n ? [] : grouped[compact] || [];
  if (!b.length) return a;
  if (!a.length) return b;
  var seen = {};
  var out = [];
  var mix = a.concat(b);
  for (var i = 0; i < mix.length; i++) {
    var rid = String(mix[i].id || '');
    if (rid && seen[rid]) continue;
    if (rid) seen[rid] = true;
    out.push(mix[i]);
  }
  return out;
}

var EAT_PLACES_CACHE_KEY = 'eatPlaces.v2';
var EAT_TAG_FOOD = '餐饮美食';
var EAT_PLACES_MONTHS = 24;

function collectEatPlaces() {
  var months = listRecentYearMonths(EAT_PLACES_MONTHS);
  var allow = {};
  var i;
  for (i = 0; i < months.length; i++) {
    allow[months[i]] = true;
    allow[String(months[i]).replace('-', '')] = true;
  }
  var grouped = recordsGroupedByMonth(allow);
  var byPlace = {};
  var ym;
  for (ym in grouped) {
    if (!grouped.hasOwnProperty(ym)) continue;
    var rows = grouped[ym] || [];
    var r;
    for (r = 0; r < rows.length; r++) {
      var rec = rows[r];
      if (String(rec.tag || '').trim() !== EAT_TAG_FOOD) continue;
      var xy = coordsFromExpenseRow(rec);
      if (!xy) continue;
      var key = xy.lat.toFixed(4) + ',' + xy.lng.toFixed(4);
      var ts = rec.timestamp || '';
      var desc = rec.description || rec.remark || '';
      var cur = byPlace[key];
      if (!cur) {
        byPlace[key] = {
          lat: xy.lat,
          lng: xy.lng,
          title: rec.title || '',
          description: desc,
          lastAt: ts,
          n: 1
        };
      } else {
        cur.n += 1;
        if (String(ts) > String(cur.lastAt || '')) {
          cur.lastAt = ts;
          if (rec.title) cur.title = rec.title;
          if (desc) cur.description = desc;
        }
      }
    }
  }
  var out = [];
  var k;
  for (k in byPlace) {
    if (byPlace.hasOwnProperty(k)) out.push(byPlace[k]);
  }
  return out;
}

function getEatPlaces() {
  try {
    var cache = CacheService.getScriptCache();
    var hit = cache.get(EAT_PLACES_CACHE_KEY);
    if (hit) {
      var parsed = JSON.parse(hit);
      parsed.cached = true;
      parsed.success = true;
      return jsonOut(parsed);
    }
    var places = collectEatPlaces();
    var payload = {
      success: true,
      places: places,
      count: places.length,
      updatedAt: formatRfc2822(new Date()),
      cached: false
    };
    try {
      cache.put(EAT_PLACES_CACHE_KEY, JSON.stringify(payload), 21600);
    } catch (cacheErr) {}
    return jsonOut(payload);
  } catch (error) {
    return jsonOut({ success: false, error: error.toString() });
  }
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
  for (var i = 0; i < rows.length; i++) {
    var rec = rows[i];
    total += Number(rec.amount_myr != null ? rec.amount_myr : rec.amount) || 0;
  }
  return rows.length + '|' + Math.round(total * 100);
}

function buildExpenseSummaryFromRows(ym, rows) {
  rows = rows ? rows.slice() : [];
  var total = 0;
  var byTagMap = {};
  for (var i = 0; i < rows.length; i++) {
    var rec = rows[i];
    rec.amount_myr = settlementAmountMyr(rec);
    total += rec.amount_myr;
    if (!byTagMap[rec.tag]) byTagMap[rec.tag] = { tag: rec.tag, amount: 0, count: 0 };
    byTagMap[rec.tag].amount += rec.amount_myr;
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
  var compact = rows.map(function (r) {
    var xy = coordsFromExpenseRow(r);
    return {
      id: r.id,
      tag: r.tag,
      title: r.title,
      amount: r.amount_myr != null ? r.amount_myr : r.amount,
      amount_original: r.amount_original,
      fx_rate: r.fx_rate,
      currency: r.currency,
      timestamp: r.timestamp,
      description: r.description || r.remark,
      lat: xy ? xy.lat : '',
      lng: xy ? xy.lng : ''
    };
  });
  return {
    yearmonth: ym,
    fingerprint: expenseSummaryFingerprint(rows),
    total: Math.round(total * 100) / 100,
    count: rows.length,
    byTag: byTag,
    recent: compact,
    records: compact
  };
}

function yearTotalsFromGrouped(year, grouped) {
  var out = [];
  grouped = grouped || {};
  for (var m = 1; m <= 12; m++) {
    var mm = ('0' + m).slice(-2);
    var rows = grouped[year + '-' + mm] || grouped[year + mm] || [];
    var t = 0;
    for (var i = 0; i < rows.length; i++) {
      t += Number(
        rows[i].amount_myr != null ? rows[i].amount_myr : settlementAmountMyr(rows[i])
      ) || 0;
    }
    out.push(Math.round(t * 100) / 100);
  }
  return out;
}

function computeExpenseSummary(ym) {
  return buildExpenseSummaryFromRows(ym, recordsForYearMonth(ym));
}

function getExpenseSummary(parameter) {
  try {
    parameter = parameter || {};
    var ym = normalizeYearMonth(parameter.yearmonth);
    if (!ym) ym = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
    var props = PropertiesService.getScriptProperties();
    var cacheKey = EXPENSE_SUMMARY_PREFIX + ym;
    var year = String(ym).slice(0, 4);
    var allow = {};
    var m;
    for (m = 1; m <= 12; m++) {
      var mm = ('0' + m).slice(-2);
      allow[year + '-' + mm] = true;
      allow[year + mm] = true;
    }
    var grouped = recordsGroupedByMonth(allow);
    var monthRows = grouped[ym] || grouped[String(ym).replace('-', '')] || [];
    var live = buildExpenseSummaryFromRows(ym, monthRows);
    live.yearTotals = yearTotalsFromGrouped(year, grouped);
    live.updatedAt = formatRfc2822(new Date());
    live.yearmonth = ym;
    live.cached = false;
    live.source = 'live';
    try {
      var stash = {
        yearmonth: live.yearmonth,
        fingerprint: live.fingerprint,
        total: live.total,
        count: live.count,
        byTag: live.byTag,
        recent: live.recent,
        yearTotals: live.yearTotals,
        updatedAt: live.updatedAt
      };
      props.setProperty(cacheKey, JSON.stringify(stash));
    } catch (writeErr) {
      appendLog(['getExpenseSummary cache write', ym, writeErr.toString()]);
    }
    var wantId = String(parameter.id || '').trim();
    if (wantId) {
      var hit = null;
      var pool = live.records || live.recent || [];
      for (var i = 0; i < pool.length; i++) {
        if (String(pool[i].id) === wantId) {
          hit = pool[i];
          break;
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
        if (sheet && sheet.getLastRow() >= RECORDS_DATA_START) {
          var idCol = ensureSheetHeader(sheet, 'id');
          var nIds = sheet.getLastRow() - RECORDS_DATA_START + 1;
          var ids = sheet.getRange(RECORDS_DATA_START, idCol + 1, nIds, 1).getValues();
          for (var r = 0; r < ids.length; r++) {
            if (String(ids[r][0]) === rec.id) {
              rowNum = r + RECORDS_DATA_START;
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
    results.fx = refreshFxRates();
  } catch (e0) {
    results.fx = { success: false, error: e0.toString() };
  }
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
  try {
    CacheService.getScriptCache().remove(EAT_PLACES_CACHE_KEY);
    results.eat = JSON.parse(getEatPlaces().getContent());
  } catch (e5) {
    results.eat = { success: false, error: e5.toString() };
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