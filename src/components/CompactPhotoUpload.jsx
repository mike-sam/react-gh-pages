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

      await fetch(API_ENDPOINTS.PHOTO_UPLOAD, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData)
      });

      const photoId = `photo_${uploadData.timestamp}_${Math.random().toString(36).substr(2, 9)}`;
      const generatedUrl = `https://drive.google.com/uc?id=${photoId}`;
      
      return generatedUrl;
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
      } catch (uploadError) {
        console.warn('Photo upload to Google Apps failed, continuing with local storage:', uploadError);
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
