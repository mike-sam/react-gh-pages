/**
 * 位置和商家管理
 */

/**
 * 获取商家列表
 */
function handleGetMerchants() {
  try {
    const merchants = getMerchantsFromSheet();
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      merchants: merchants
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in handleGetMerchants: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 更新商家信息
 */
function handleMerchantUpdate(data) {
  try {
    const result = updateMerchantInSheet(data);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Merchant updated successfully',
      merchant: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in handleMerchantUpdate: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 从Google Sheets获取商家数据
 */
function getMerchantsFromSheet() {
  try {
    const MERCHANT_SHEET_ID = 'YOUR_MERCHANT_SHEET_ID'; // 请替换为你的商家管理Sheet ID
    const sheet = SpreadsheetApp.openById(MERCHANT_SHEET_ID).getSheetByName('Merchants');
    
    if (!sheet) {
      // 如果Sheet不存在，创建一个
      return createMerchantSheet(MERCHANT_SHEET_ID);
    }
    
    const data = sheet.getDataRange().getValues();
    const merchants = [];
    
    // 假设列结构：经度 | 纬度 | 商家名称 | 地址 | 分类 | 创建时间 | 使用次数
    for (let i = 1; i < data.length; i++) { // 跳过标题行
      const [longitude, latitude, name, address, category, createdTime, usageCount] = data[i];
      merchants.push({
        longitude: longitude,
        latitude: latitude,
        name: name,
        address: address,
        category: category,
        createdTime: createdTime,
        usageCount: usageCount || 0,
        coordinates: `${latitude},${longitude}`
      });
    }
    
    return merchants;
  } catch (error) {
    Logger.log('Error in getMerchantsFromSheet: ' + error.toString());
    return [];
  }
}

/**
 * 更新商家信息到Google Sheets
 */
function updateMerchantInSheet(data) {
  try {
    const MERCHANT_SHEET_ID = 'YOUR_MERCHANT_SHEET_ID';
    const sheet = SpreadsheetApp.openById(MERCHANT_SHEET_ID).getSheetByName('Merchants');
    
    // 查找是否已存在相同位置的商家
    const existingData = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < existingData.length; i++) {
      const [longitude, latitude] = existingData[i];
      if (Math.abs(longitude - data.longitude) < 0.0001 && 
          Math.abs(latitude - data.latitude) < 0.0001) {
        rowIndex = i + 1; // Sheet的行索引从1开始
        break;
      }
    }
    
    const row = [
      data.longitude,
      data.latitude,
      data.name,
      data.address || '',
      data.category || '',
      data.createdTime || new Date().toLocaleString(),
      (data.usageCount || 0) + 1 // 增加使用次数
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
      name: data.name,
      address: data.address,
      category: data.category
    };
  } catch (error) {
    Logger.log('Error in updateMerchantInSheet: ' + error.toString());
    throw error;
  }
}

/**
 * 创建商家管理Sheet
 */
function createMerchantSheet(sheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.insertSheet('Merchants');
    
    // 设置标题行
    const headers = ['经度', '纬度', '商家名称', '地址', '分类', '创建时间', '使用次数'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 设置格式
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    return [];
  } catch (error) {
    Logger.log('Error in createMerchantSheet: ' + error.toString());
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
    Logger.log('Error in findNearestMerchant: ' + error.toString());
    return null;
  }
}
