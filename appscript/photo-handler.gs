/**
 * 照片处理相关函数
 */

/**
 * 处理照片上传
 */
function handlePhotoUpload(data) {
  try {
    const photoUrl = savePhotoToDrive(data.base64, data.filename, data.timestamp);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      photoUrl: photoUrl,
      filename: data.filename
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in handlePhotoUpload: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 将照片保存到Google Drive
 */
function savePhotoToDrive(base64Data, filename, timestamp) {
  try {
    // 移除base64前缀（如果存在）
    const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // 解码base64
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64String),
      'image/jpeg',
      filename || `expense_photo_${timestamp || new Date().getTime()}.jpg`
    );
    
    // 获取或创建存储文件夹
    const folderName = 'Expense Photos';
    let folder;
    
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // 保存文件
    const file = folder.createFile(blob);
    
    // 设置文件为公开访问（可选）
    // file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // 返回文件的公共URL
    return `https://drive.google.com/file/d/${file.getId()}/view`;
    
  } catch (error) {
    Logger.log('Error in savePhotoToDrive: ' + error.toString());
    return null;
  }
}

/**
 * 压缩图片（可选功能）
 */
function compressImage(blob, quality = 0.8) {
  try {
    // 这里可以添加图片压缩逻辑
    // Google Apps Script的图片处理能力有限
    // 建议在前端进行压缩
    return blob;
  } catch (error) {
    Logger.log('Error in compressImage: ' + error.toString());
    return blob;
  }
}
