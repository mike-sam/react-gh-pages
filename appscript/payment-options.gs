/**
 * 支付方式管理
 */

/**
 * 获取支付选项
 */
function handleGetPaymentOptions() {
  try {
    // 这里可以从Google Sheets读取支付选项
    // 或者返回预定义的选项
    
    const paymentOptions = {
      'Cash': { key: 'Cash', card_num: 'Cash', bank: 'Cash' },
      'TnG_eWallet': { key: 'eWallet', card_num: 'TnG', bank: 'TnG' },
      'GrabPay_eWallet': { key: 'eWallet', card_num: 'GrabPay', bank: 'GrabPay' },
      'Setel_eWallet': { key: 'eWallet', card_num: 'Setel', bank: 'Setel' },
      'ShopeePay_eWallet': { key: 'eWallet', card_num: 'ShopeePay', bank: 'ShopeePay' },
      
      // 可以从Google Sheets动态加载更多选项
      // 例如信用卡、借记卡等
    };
    
    // 可选：从Google Sheets读取额外的支付方式
    const additionalOptions = getPaymentOptionsFromSheet();
    Object.assign(paymentOptions, additionalOptions);
    
    return ContentService.createTextOutput(JSON.stringify(paymentOptions))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in handleGetPaymentOptions: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 从Google Sheets读取支付选项（可选）
 */
function getPaymentOptionsFromSheet() {
  try {
    // 如果你想从Google Sheets管理支付选项，可以在这里实现
    const PAYMENT_SHEET_ID = 'YOUR_PAYMENT_OPTIONS_SHEET_ID'; // 可选
    
    // 示例代码（需要创建对应的Sheet）
    /*
    const sheet = SpreadsheetApp.openById(PAYMENT_SHEET_ID).getSheetByName('PaymentOptions');
    const data = sheet.getDataRange().getValues();
    const options = {};
    
    for (let i = 1; i < data.length; i++) { // 跳过标题行
      const [id, key, cardNum, bank, active] = data[i];
      if (active) {
        options[id] = {
          key: key,
          card_num: cardNum,
          bank: bank
        };
      }
    }
    
    return options;
    */
    
    return {};
  } catch (error) {
    Logger.log('Error in getPaymentOptionsFromSheet: ' + error.toString());
    return {};
  }
}

/**
 * 更新支付选项（管理功能）
 */
function updatePaymentOption(optionData) {
  try {
    // 实现支付选项的添加/更新逻辑
    // 可以写入到Google Sheets进行管理
    
    return {
      success: true,
      message: 'Payment option updated successfully'
    };
  } catch (error) {
    Logger.log('Error in updatePaymentOption: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}
