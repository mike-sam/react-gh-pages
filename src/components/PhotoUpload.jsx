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
  const uploadToGoogleApps = async (file, base64String) => {
    try {
      setUploadProgress(10);
      
      const uploadData = {
        action: 'uploadPhoto',
        filename: file.name,
        base64: base64String.split(',')[1], // 移除 data:image/xxx;base64, 前缀
        timestamp: new Date().getTime()
      };

      setUploadProgress(50);
      
      const response = await fetch(API_ENDPOINTS.PHOTO_UPLOAD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData)
      });

      setUploadProgress(90);
      
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setUploadProgress(100);
        // Return the actual Google Drive URL from the response
        return result.fileUrl || result.thumbnailUrl || null;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Photo upload failed:', error);
      throw error;
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
      try {
        uploadedUrl = await uploadToGoogleApps(file, base64String);
        if (uploadedUrl) {
          console.log('Photo uploaded successfully:', uploadedUrl);
        }
      } catch (uploadError) {
        console.warn('Photo upload to Google Apps failed, continuing with local storage:', uploadError);
        setError('照片上传失败，将使用本地预览。错误: ' + (uploadError.message || '未知错误'));
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