import React, { useState, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { API_ENDPOINTS } from '../config';

const PhotoUpload = ({ onPhotoChange, initialPhoto = null }) => {
  const [photo, setPhoto] = useState(initialPhoto);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 压缩选项
  const compressionOptions = {
    maxSizeMB: 0.5, // 最大文件大小 0.5MB
    maxWidthOrHeight: 800, // 最大宽度或高度
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8
  };

  // 将文件转换为base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // 上传照片到 Google AppScript
  const uploadToGoogleApps = async (file, base64String, retryCount = 0) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000; // 1 second
    
    try {
      setUploadProgress(10);
      
      // 确保 base64 字符串格式正确
      const base64Data = base64String.includes(',') 
        ? base64String.split(',')[1] 
        : base64String;
      
      // 检查数据大小
      const dataSizeMB = (base64Data.length * 3) / 4 / 1024 / 1024;
      if (dataSizeMB > 10) {
        throw new Error(`图片太大 (${dataSizeMB.toFixed(2)}MB)，请压缩后再试`);
      }
      
      const uploadData = {
        action: 'uploadPhoto',
        filename: file.name || `photo_${Date.now()}.jpg`,
        base64: base64Data,
        timestamp: new Date().getTime()
      };

      console.log('Uploading photo:', {
        filename: uploadData.filename,
        base64Length: base64Data.length,
        dataSizeMB: dataSizeMB.toFixed(2),
        endpoint: API_ENDPOINTS.PHOTO_UPLOAD,
        retry: retryCount
      });

      setUploadProgress(50);
      
      // 使用 AbortController 设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      let response;
      try {
        // 先测试端点是否可访问（仅第一次尝试）
        if (retryCount === 0) {
          try {
            const testController = new AbortController();
            const testTimeout = setTimeout(() => testController.abort(), 5000);
            const testResponse = await fetch(API_ENDPOINTS.PHOTO_UPLOAD, {
              method: 'GET',
              signal: testController.signal
            });
            clearTimeout(testTimeout);
            console.log('Endpoint test response:', testResponse.status);
          } catch (testError) {
            console.warn('Endpoint test failed (this is OK for POST-only endpoints):', testError);
          }
        }
        
        console.log('Sending POST request to:', API_ENDPOINTS.PHOTO_UPLOAD);
        console.log('Request body size:', JSON.stringify(uploadData).length, 'bytes');
        
        response = await fetch(API_ENDPOINTS.PHOTO_UPLOAD, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(uploadData),
          signal: controller.signal,
          // 添加这些选项以帮助诊断
          cache: 'no-cache',
          credentials: 'omit'
        });
        clearTimeout(timeoutId);
        
        console.log('Fetch completed, status:', response.status, response.statusText);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        console.error('Fetch error details:', {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack,
          endpoint: API_ENDPOINTS.PHOTO_UPLOAD,
          retryCount
        });
        
        // 如果是网络错误且还有重试次数，则重试
        if (fetchError.name === 'TypeError' && retryCount < MAX_RETRIES) {
          console.log(`Retrying upload (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          setUploadProgress(30);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          return uploadToGoogleApps(file, base64String, retryCount + 1);
        }
        
        if (fetchError.name === 'AbortError') {
          throw new Error('上传超时，请检查网络连接');
        }
        
        // 提供更详细的错误信息
        if (fetchError.message && fetchError.message.includes('Failed to fetch')) {
          throw new Error(`无法连接到服务器。可能的原因：\n1. 网络连接问题\n2. Google Apps Script 未正确部署\n3. CORS 配置问题\n4. 端点 URL 错误\n\n端点: ${API_ENDPOINTS.PHOTO_UPLOAD}`);
        }
        
        throw fetchError;
      }

      setUploadProgress(90);
      
      console.log('Upload response status:', response.status, response.statusText);

      // Google Apps Script 可能返回非 200 状态码但仍然成功
      let result;
      try {
        const responseText = await response.text();
        console.log('Upload response text:', responseText.substring(0, 200));
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('服务器返回空响应');
        }
        
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        
        // 如果解析失败但还有重试次数，则重试
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying upload due to parse error (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          setUploadProgress(30);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          return uploadToGoogleApps(file, base64String, retryCount + 1);
        }
        
        throw new Error(`服务器响应格式错误: ${response.status} ${response.statusText}`);
      }
      
      if (result.success) {
        setUploadProgress(100);
        console.log('Photo uploaded successfully:', result);
        // Return the preview URL for Google Sheets (优先使用previewUrl)
        return result.previewUrl || result.fileUrl || result.thumbnailUrl || null;
      } else {
        throw new Error(result.error || '上传失败：未知错误');
      }
    } catch (error) {
      console.error('Photo upload failed:', error);
      // 提供更详细的错误信息
      if (error.message) {
        throw error;
      } else if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
        throw new Error('网络连接失败。请检查：\n1. 网络连接是否正常\n2. Google Apps Script 是否已正确部署\n3. 浏览器控制台是否有 CORS 错误');
      } else {
        throw new Error(`上传失败: ${error.toString()}`);
      }
    } finally {
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // 处理文件上传
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    // 检查文件大小 (10MB限制)
    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过10MB');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 压缩图片
      const compressedFile = await imageCompression(file, compressionOptions);
      
      // 转换为base64
      const base64String = await fileToBase64(compressedFile);
      
      // 上传到 Google AppScript
      let uploadedUrl = '';
      // 尝试上传照片，但失败不影响使用（照片会在提交费用时一起上传）
      try {
        uploadedUrl = await uploadToGoogleApps(file, base64String);
        if (uploadedUrl) {
          console.log('Photo uploaded successfully:', uploadedUrl);
        }
      } catch (uploadError) {
        // 静默失败，照片会在提交费用时一起上传到服务器
        console.warn('Photo upload to Google Apps failed, will upload with expense submission:', uploadError);
        // 不显示错误给用户，因为这不影响功能
        // setError('照片将在提交费用时一起上传');
      }
      
      // 创建预览URL
      const previewUrl = URL.createObjectURL(compressedFile);
      
      const photoData = {
        base64: base64String,
        preview: previewUrl,
        filename: file.name,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        type: compressedFile.type,
        uploadedUrl: uploadedUrl // Google Drive URL if upload was successful
      };

      setPhoto(photoData);
      
      // 回调给父组件
      if (onPhotoChange) {
        onPhotoChange(photoData);
      }

    } catch (err) {
      console.error('图片处理失败:', err);
      setError('图片处理失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [onPhotoChange]);

  // 文件选择处理
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // 拖拽处理
  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // 删除照片
  const handleRemovePhoto = () => {
    if (photo && photo.preview) {
      URL.revokeObjectURL(photo.preview);
    }
    setPhoto(null);
    setError('');
    
    if (onPhotoChange) {
      onPhotoChange(null);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="photo-upload-container">
      <div className="input-group">
        <label>照片上传 (可选)</label>
        
        {!photo ? (
          <div 
            className={`photo-upload-area ${dragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="photo-upload"
              className="photo-upload-input"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={isLoading}
            />
            
            {isLoading ? (
              <div className="photo-loading-container">
                <div className="photo-loading"></div>
                <p>正在处理图片...</p>
                {uploadProgress > 0 && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p>上传进度: {uploadProgress}%</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <label htmlFor="photo-upload" className="photo-upload-label">
                  选择照片
                </label>
                <p className="photo-upload-text">
                  或拖拽照片到此处<br/>
                  支持 JPG, PNG, GIF 格式，最大 10MB
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="photo-preview-container">
            <img 
              src={photo.preview} 
              alt="预览" 
              className="photo-preview"
            />
            <button 
              type="button"
              className="photo-remove-btn"
              onClick={handleRemovePhoto}
              title="删除照片"
            >
              ×
            </button>
            <div className="photo-compress-info">
              <p>文件名: {photo.filename}</p>
              <p>压缩前: {formatFileSize(photo.originalSize)}</p>
              <p>压缩后: {formatFileSize(photo.compressedSize)}</p>
              <p>压缩率: {Math.round((1 - photo.compressedSize / photo.originalSize) * 100)}%</p>
              {photo.uploadedUrl && (
                <p className="upload-success">✅ 已上传到 Google Drive</p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="photo-upload-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoUpload;