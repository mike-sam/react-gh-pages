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

  const uploadToGoogleApps = async (file, base64String) => {
    try {
      const uploadData = {
        action: 'uploadPhoto',
        filename: file.name,
        base64: base64String.split(',')[1],
        timestamp: new Date().getTime()
      };

      const response = await fetch(API_ENDPOINTS.PHOTO_UPLOAD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData)
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Return the actual Google Drive URL from the response
        return result.fileUrl || result.thumbnailUrl || null;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Photo upload failed:', error);
      throw error;
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
      try {
        uploadedUrl = await uploadToGoogleApps(file, base64String);
        if (uploadedUrl) {
          console.log('Photo uploaded successfully:', uploadedUrl);
        }
      } catch (uploadError) {
        console.warn('Photo upload to Google Apps failed, continuing with local storage:', uploadError);
        setError('照片上传失败，将使用本地预览。错误: ' + (uploadError.message || '未知错误'));
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
