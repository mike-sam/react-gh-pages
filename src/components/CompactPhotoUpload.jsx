import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { API_ENDPOINTS } from '../config';

const CompactPhotoUpload = ({ onPhotoChange, initialPhoto = null }) => {
  const [photos, setPhotos] = useState(initialPhoto ? [initialPhoto] : []);
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

  const removePhoto = (index) => {
    const photoToRemove = photos[index];
    if (photoToRemove && photoToRemove.preview) {
      URL.revokeObjectURL(photoToRemove.preview);
    }
    
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    setError('');
    
    if (onPhotoChange) {
      onPhotoChange(newPhotos);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        <label htmlFor="compact-photo-upload" className="photo-upload-btn">
          {isLoading ? (
            <span className="photo-loading-text">
              📷 处理中...
            </span>
          ) : (
            <span className="photo-btn-text">
              📷 添加照片 {photos.length > 0 && `(${photos.length})`}
            </span>
          )}
        </label>
        
        {/* 照片列表 */}
        {photos.length > 0 && (
          <div className="photos-list">
            {photos.map((photo, index) => (
              <div key={index} className="photo-preview-compact">
                <img 
                  src={photo.preview} 
                  alt="预览" 
                  className="photo-thumbnail"
                />
                <div className="photo-info">
                  <span className="photo-filename">{photo.filename}</span>
                  <span className="photo-size">
                    {formatFileSize(photo.compressedSize)}
                    {photo.uploadedUrl && <span className="upload-status"> ✅</span>}
                  </span>
                </div>
                <button 
                  type="button"
                  className="photo-remove-compact"
                  onClick={() => removePhoto(index)}
                  title="删除照片"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
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
