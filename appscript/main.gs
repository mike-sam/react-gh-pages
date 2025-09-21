/**
 * 记账应用主要处理函数
 * 处理来自React应用的POST请求
 */

function doPost(e) {
  try {
    // 解析请求数据
    const data = JSON.parse(e.postData.contents);
    
    // 根据action类型分发处理
    switch(data.action) {
      case 'submitExpense':
        return handleExpenseSubmission(data);
      case 'uploadPhoto':
        return handlePhotoUpload(data);
      case 'getPaymentOptions':
        return handleGetPaymentOptions();
      case 'updateMerchant':
        return handleMerchantUpdate(data);
      case 'getMileageData':
        return handleGetMileageData(data);
      case 'updateMileage':
        return handleMileageUpdate(data);
      default:
        // 兼容旧版本，默认处理为expense submission
        return handleExpenseSubmission(data);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // 处理GET请求，主要用于获取支付选项
  try {
    const action = e.parameter.action || 'getPaymentOptions';
    
    switch(action) {
      case 'getPaymentOptions':
        return handleGetPaymentOptions();
      case 'getMerchants':
        return handleGetMerchants();
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Unknown action'
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 处理费用提交
 */
function handleExpenseSubmission(data) {
  try {
    // 获取目标表格
    const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // 请替换为你的Google Sheets ID
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    
    // 准备数据行
    const row = [
      data.timestamp || new Date().toLocaleString(),
      data.yearmonth || '',
      data.title || '',
      data.amount || '',
      data.remark || '',
      data.geolocation || '',
      data.tag || '',
      data.currency || 'MYR',
      data.payment_method || '',
      data.photo_url || ''
    ];
    
    // 写入数据
    sheet.appendRow(row);
    
    // 如果有照片base64数据，保存到Drive
    if (data.photo && !data.photo_url) {
      const photoUrl = savePhotoToDrive(data.photo, data.timestamp);
      if (photoUrl) {
        // 更新刚插入行的照片URL
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow, 10).setValue(photoUrl);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Expense recorded successfully',
      timestamp: data.timestamp
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in handleExpenseSubmission: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
