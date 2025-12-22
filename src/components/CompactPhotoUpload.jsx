import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { API_ENDPOINTS } from '../config';

const CompactPhotoUpload = ({ onPhotoChange, initialPhotos = [] }) => {
  const [photos, setPhotos] = useState(initialPhotos);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 压缩选项
  const compressionOptions = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const uploadToGoogleApps = async (file, base64String, retryCount = 0, onRetryPrompt = null) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000; // 1 second
    
    try {
      // 确保 base64 字符串格式正确
      const base64Data = base64String.includes(',') 
        ? base64String.split(',')[1] 
        : base64String;
      
      // 检查数据大小（Google Apps Script 有 50MB 限制，但实际建议更小）
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
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          return uploadToGoogleApps(file, base64String, retryCount + 1, onRetryPrompt);
        }
        
        // 如果超过重试次数，询问用户是否继续重试
        if (retryCount >= MAX_RETRIES && onRetryPrompt) {
          const shouldRetry = await onRetryPrompt(retryCount + 1);
          if (shouldRetry) {
            console.log(`User requested retry after ${retryCount + 1} attempts`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 2)));
            return uploadToGoogleApps(file, base64String, retryCount + 1, onRetryPrompt);
          } else {
            throw new Error('用户取消重试');
          }
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
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          return uploadToGoogleApps(file, base64String, retryCount + 1, onRetryPrompt);
        }
        
        // 如果超过重试次数，询问用户是否继续重试
        if (retryCount >= MAX_RETRIES && onRetryPrompt) {
          const shouldRetry = await onRetryPrompt(retryCount + 1);
          if (shouldRetry) {
            console.log(`User requested retry after ${retryCount + 1} attempts`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 2)));
            return uploadToGoogleApps(file, base64String, retryCount + 1, onRetryPrompt);
          } else {
            throw new Error('用户取消重试');
          }
        }
        
        throw new Error(`服务器响应格式错误: ${response.status} ${response.statusText}`);
      }

      if (result.success) {
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
        // 网络错误，提供更友好的提示
        throw new Error('网络连接失败。请检查：\n1. 网络连接是否正常\n2. Google Apps Script 是否已正确部署\n3. 浏览器控制台是否有 CORS 错误');
      } else {
        throw new Error(`上传失败: ${error.toString()}`);
      }
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过10MB');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const compressedFile = await imageCompression(file, compressionOptions);
      const base64String = await fileToBase64(compressedFile);
      
      let uploadedUrl = '';
      let failedPhoto = null;
      // 尝试上传照片，但失败不影响使用（照片会在提交费用时一起上传）
      try {
        // 创建重试提示函数
        const retryPrompt = async (attemptCount) => {
          return new Promise((resolve) => {
            const shouldRetry = window.confirm(
              `照片上传失败（已尝试 ${attemptCount} 次）。\n\n是否继续重试？\n\n点击"确定"继续重试\n点击"取消"移除该照片（照片将在提交费用时一起上传）`
            );
            resolve(shouldRetry);
          });
        };
        
        uploadedUrl = await uploadToGoogleApps(file, base64String, 0, retryPrompt);
        if (uploadedUrl) {
          console.log('Photo uploaded successfully:', uploadedUrl);
        }
      } catch (uploadError) {
        // 如果是用户取消重试，移除照片
        if (uploadError.message === '用户取消重试') {
          console.log('User cancelled retry, photo will be uploaded with expense submission');
          failedPhoto = file;
          // 不添加到photos列表，照片会在提交费用时一起上传
          return;
        }
        // 其他错误，静默失败，照片会在提交费用时一起上传到服务器
        console.warn('Photo upload to Google Apps failed, will upload with expense submission:', uploadError);
        failedPhoto = file;
      }
      
      // 如果上传失败且用户选择不重试，不添加照片到列表
      if (failedPhoto) {
        return;
      }
      
      const previewUrl = URL.createObjectURL(compressedFile);
      
      const photoData = {
        base64: base64String,
        preview: previewUrl,
        filename: file.name,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        type: compressedFile.type,
        uploadedUrl: uploadedUrl
      };

      const newPhotos = [...photos, photoData];
      setPhotos(newPhotos);
      
      if (onPhotoChange) {
        onPhotoChange(newPhotos);
      }

    } catch (err) {
      console.error('图片处理失败:', err);
      setError('图片处理失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      handleFileUpload(file);
    });
  };



  return (
    <div className="compact-photo-upload">
      <input
        type="file"
        id="compact-photo-upload"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={isLoading}
      />
      
      <div className="photo-upload-controls">
        <label htmlFor="compact-photo-upload" className="unified-action-button">
          <div className="action-header">
            <span className="action-icon">📷</span>
            <span className="action-name">
              {isLoading ? '处理中...' : '添加照片'}
            </span>
          </div>
          <div className="action-status">
            {photos.length > 0 ? `${photos.length} 张照片` : '未添加'}
          </div>
        </label>
      </div>

      {error && (
        <div className="photo-upload-error-compact">
          {error}
        </div>
      )}
    </div>
  );
};

export default CompactPhotoUpload;
