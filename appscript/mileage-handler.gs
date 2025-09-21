/**
 * 里程数据管理
 */

/**
 * 获取里程数据
 */
function handleGetMileageData(data) {
  try {
    const mileageData = getMileageFromSheet(data.carPlate);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      mileageData: mileageData
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in handleGetMileageData: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 更新里程数据
 */
function handleMileageUpdate(data) {
  try {
    const result = updateMileageInSheet(data);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Mileage updated successfully',
      mileageData: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in handleMileageUpdate: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 从Google Sheets获取里程数据
 */
function getMileageFromSheet(carPlate) {
  try {
    const MILEAGE_SHEET_ID = 'YOUR_MILEAGE_SHEET_ID'; // 请替换为你的里程管理Sheet ID
    const sheet = SpreadsheetApp.openById(MILEAGE_SHEET_ID).getSheetByName('Mileage');
    
    if (!sheet) {
      // 如果Sheet不存在，创建一个
      return createMileageSheet(MILEAGE_SHEET_ID);
    }
    
    const data = sheet.getDataRange().getValues();
    const mileageRecords = [];
    
    // 假设列结构：车牌 | 里程数 | 记录时间 | 费用类型 | 备注
    for (let i = 1; i < data.length; i++) { // 跳过标题行
      const [plate, mileage, recordTime, expenseType, remark] = data[i];
      if (plate === carPlate) {
        mileageRecords.push({
          carPlate: plate,
          mileage: mileage,
          recordTime: recordTime,
          expenseType: expenseType,
          remark: remark
        });
      }
    }
    
    // 按时间排序，最新的在前
    mileageRecords.sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime));
    
    return {
      carPlate: carPlate,
      records: mileageRecords,
      latestMileage: mileageRecords.length > 0 ? mileageRecords[0].mileage : 0,
      previousMileage: mileageRecords.length > 1 ? mileageRecords[1].mileage : 0,
      calculatedTrip: mileageRecords.length > 1 ? 
        mileageRecords[0].mileage - mileageRecords[1].mileage : 0
    };
  } catch (error) {
    Logger.log('Error in getMileageFromSheet: ' + error.toString());
    return {
      carPlate: carPlate,
      records: [],
      latestMileage: 0,
      previousMileage: 0,
      calculatedTrip: 0
    };
  }
}

/**
 * 更新里程数据到Google Sheets
 */
function updateMileageInSheet(data) {
  try {
    const MILEAGE_SHEET_ID = 'YOUR_MILEAGE_SHEET_ID';
    const sheet = SpreadsheetApp.openById(MILEAGE_SHEET_ID).getSheetByName('Mileage');
    
    const row = [
      data.carPlate,
      data.mileage,
      data.recordTime || new Date().toLocaleString(),
      data.expenseType || '打油',
      data.remark || ''
    ];
    
    sheet.appendRow(row);
    
    // 返回更新后的里程数据
    return getMileageFromSheet(data.carPlate);
  } catch (error) {
    Logger.log('Error in updateMileageInSheet: ' + error.toString());
    throw error;
  }
}

/**
 * 创建里程管理Sheet
 */
function createMileageSheet(sheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.insertSheet('Mileage');
    
    // 设置标题行
    const headers = ['车牌', '里程数', '记录时间', '费用类型', '备注'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 设置格式
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    return {
      carPlate: '',
      records: [],
      latestMileage: 0,
      previousMileage: 0,
      calculatedTrip: 0
    };
  } catch (error) {
    Logger.log('Error in createMileageSheet: ' + error.toString());
    return {
      carPlate: '',
      records: [],
      latestMileage: 0,
      previousMileage: 0,
      calculatedTrip: 0
    };
  }
}

/**
 * 计算油耗效率
 */
function calculateFuelEfficiency(mileageData, fuelAmount, fuelPrice) {
  try {
    const trip = mileageData.calculatedTrip;
    const totalCost = fuelAmount;
    const fuelLiters = fuelAmount / fuelPrice;
    
    return {
      trip: trip,
      fuelLiters: fuelLiters.toFixed(2),
      costPerKm: trip > 0 ? (totalCost / trip).toFixed(2) : 0,
      litersPer100Km: trip > 0 ? ((fuelLiters / trip) * 100).toFixed(2) : 0,
      efficiency: trip > 0 && fuelLiters > 0 ? (trip / fuelLiters).toFixed(2) : 0
    };
  } catch (error) {
    Logger.log('Error in calculateFuelEfficiency: ' + error.toString());
    return null;
  }
}
