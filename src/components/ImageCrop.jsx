import React, { useState, useRef, useEffect } from 'react';

const ImageCrop = ({ imageSrc, onCrop, onCancel, initialCropArea, initialPolygonPoints, initialCropMode }) => {
  // 使用useState的初始化函数，只在组件首次渲染时使用初始值
  const [cropArea, setCropArea] = useState(() => initialCropArea || { x: 0, y: 0, width: 0, height: 0 });
  const [polygonPoints, setPolygonPoints] = useState(() => initialPolygonPoints || []);
  const [cropMode, setCropMode] = useState(() => initialCropMode || 'rectangle'); // 'rectangle' or 'polygon'
  const [isDragging, setIsDragging] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustHandle, setAdjustHandle] = useState(null); // 'move', 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w', or point index for polygon
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [previewImage, setPreviewImage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [isDrawingPaused, setIsDrawingPaused] = useState(false); // 是否暂停绘制
  const [showToggleButton, setShowToggleButton] = useState(true); // 是否显示toggle按钮（预设开始）
  const [toggleButtonPulse, setToggleButtonPulse] = useState(false); // toggle按钮动画
  const [imageScale, setImageScale] = useState(1); // 图片缩放比例
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 }); // 图片偏移
  const [lastPinchDistance, setLastPinchDistance] = useState(null); // 上次双指距离
  const scrollContainerRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (imageRef.current) {
      const img = imageRef.current;
      img.onload = () => {
        // 预设显示整张图（不限制最大尺寸，但确保能完整显示）
        const maxWidth = Math.min(window.innerWidth - 40, img.naturalWidth);
        const maxHeight = Math.min(window.innerHeight - 200, img.naturalHeight);
        const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
        
        setImageSize({
          width: img.naturalWidth * scale,
          height: img.naturalHeight * scale
        });
        
        // 初始化缩放为1（显示整张图）
        setImageScale(1);
        setImageOffset({ x: 0, y: 0 });

        // 如果有初始裁剪区域，使用它；否则不预设裁剪区域
        // 注意：initialCropArea是基于显示尺寸的，不需要再次缩放
        if (initialCropArea && initialCropArea.width > 0 && initialCropArea.height > 0) {
          setCropArea(initialCropArea);
        } else if (initialPolygonPoints && initialPolygonPoints.length > 0) {
          // 如果有初始多边形点，使用它
          setPolygonPoints(initialPolygonPoints);
        } else {
          // 不预设裁剪区域，让用户手动选择
          setCropArea({ x: 0, y: 0, width: 0, height: 0 });
        }
        
        // 检查是否需要显示滚动提示
        setTimeout(() => {
          checkScrollHint();
        }, 100);
      };
    }
  }, [imageSrc, cropMode, initialCropArea, initialPolygonPoints]);

  // 检查是否需要显示滚动提示
  const checkScrollHint = () => {
    if (scrollContainerRef.current && imageRef.current) {
      const container = scrollContainerRef.current;
      const img = imageRef.current;
      const containerHeight = container.clientHeight;
      const imgHeight = img.offsetHeight;
      // 如果图片高度大于容器高度，显示滚动提示
      setShowScrollHint(imgHeight > containerHeight + 20); // 加20px容差
    }
  };

  // 监听滚动，隐藏提示
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const handleScroll = () => {
        // 如果滚动了一定距离，隐藏提示
        if (container.scrollTop > 50 || 
            container.scrollHeight - container.scrollTop - container.clientHeight < 50) {
          setShowScrollHint(false);
        }
      };
      container.addEventListener('scroll', handleScroll);
      // 监听窗口大小变化，重新检查
      window.addEventListener('resize', checkScrollHint);
      return () => {
        container.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', checkScrollHint);
      };
    }
  }, []);

  const getEventCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const getHandleAt = (x, y, cropArea) => {
    const handleSize = 10;
    const handles = {
      'nw': { x: cropArea.x, y: cropArea.y },
      'ne': { x: cropArea.x + cropArea.width, y: cropArea.y },
      'sw': { x: cropArea.x, y: cropArea.y + cropArea.height },
      'se': { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height },
      'n': { x: cropArea.x + cropArea.width / 2, y: cropArea.y },
      's': { x: cropArea.x + cropArea.width / 2, y: cropArea.y + cropArea.height },
      'e': { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height / 2 },
      'w': { x: cropArea.x, y: cropArea.y + cropArea.height / 2 },
    };

    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) < handleSize && Math.abs(y - pos.y) < handleSize) {
        return handle;
      }
    }

    // 检查是否在区域内（用于移动）
    if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
        y >= cropArea.y && y <= cropArea.y + cropArea.height) {
      return 'move';
    }

    return null;
  };

  const getPolygonPointAt = (x, y, points) => {
    const handleSize = 12;
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (Math.abs(x - point.x) < handleSize && Math.abs(y - point.y) < handleSize) {
        return i;
      }
    }
    return null;
  };

  // 计算两点之间的距离
  const getDistance = (touch1, touch2) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 计算两点之间的中心点
  const getCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const handleStart = (e) => {
    if (!containerRef.current || !imageRef.current) return;
    
    // 检测双指触摸（pinch zoom）
    if (e.touches && e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      setLastPinchDistance(distance);
      e.preventDefault();
      return;
    }
    
    // 如果暂停绘制模式，允许正常滚动，不阻止默认行为
    if (isDrawingPaused) {
      // 不调用 e.preventDefault()，允许浏览器正常处理滚动
      return;
    }
    
    const coords = getEventCoordinates(e);
    const rect = containerRef.current.getBoundingClientRect();
    const imgRect = imageRef.current.getBoundingClientRect();
    
    // 检查触摸点是否在图片区域内（考虑图片在容器中的位置和缩放）
    const imgLeft = imgRect.left - rect.left;
    const imgTop = imgRect.top - rect.top;
    const imgRight = imgLeft + imgRect.width;
    const imgBottom = imgTop + imgRect.height;
    const relativeX = coords.x - rect.left;
    const relativeY = coords.y - rect.top;
    const isInImage = relativeX >= imgLeft && relativeX <= imgRight &&
                      relativeY >= imgTop && relativeY <= imgBottom;
    
    // 如果不在图片区域内，不阻止默认行为（允许滚动）
    if (!isInImage) {
      return;
    }
    
    
    e.preventDefault();
    
    // 计算相对于图片的坐标（考虑缩放和偏移）
    const x = (relativeX - imgLeft - imageOffset.x) / imageScale;
    const y = (relativeY - imgTop - imageOffset.y) / imageScale;

    if (cropMode === 'polygon') {
      // 多边形模式：检查是否点击在已有顶点上
      const pointIndex = getPolygonPointAt(x, y, polygonPoints);
      if (pointIndex !== null) {
        setIsAdjusting(true);
        setAdjustHandle(pointIndex);
        setDragStart({ x, y });
        return;
      }
      // 检查是否点击在已有边上（用于添加新顶点）
      if (polygonPoints.length >= 2) {
        for (let i = 0; i < polygonPoints.length; i++) {
          const p1 = polygonPoints[i];
          const p2 = polygonPoints[(i + 1) % polygonPoints.length];
          const dist = pointToLineDistance(x, y, p1.x, p1.y, p2.x, p2.y);
          if (dist < 15) {
            // 在边上，添加新顶点
            const newPoints = [...polygonPoints];
            newPoints.splice(i + 1, 0, { x, y });
            setPolygonPoints(newPoints);
            setIsAdjusting(true);
            setAdjustHandle(i + 1);
            setDragStart({ x, y });
            return;
          }
        }
      }
      // 添加新顶点
      setPolygonPoints([...polygonPoints, { x, y }]);
      return;
    }

    // 矩形模式
    if (cropArea.width > 0 && cropArea.height > 0) {
      const handle = getHandleAt(x, y, cropArea);
      if (handle) {
        setIsAdjusting(true);
        setAdjustHandle(handle);
        setDragStart({ x, y });
        return;
      }
    }

    // 开始新选择
    setIsDragging(true);
    setDragStart({ x, y });
    setCropArea({ x, y, width: 0, height: 0 });
  };

  const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleMove = (e) => {
    if (!containerRef.current || !imageRef.current) return;
    
    // 处理双指缩放
    if (e.touches && e.touches.length === 2 && lastPinchDistance !== null) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      const scaleChange = distance / lastPinchDistance;
      const newScale = Math.max(0.5, Math.min(3, imageScale * scaleChange));
      setImageScale(newScale);
      setLastPinchDistance(distance);
      
      // 计算中心点并调整偏移
      const center = getCenter(e.touches[0], e.touches[1]);
      const rect = containerRef.current.getBoundingClientRect();
      const imgRect = imageRef.current.getBoundingClientRect();
      const imgCenterX = imgRect.left + imgRect.width / 2;
      const imgCenterY = imgRect.top + imgRect.height / 2;
      const offsetX = center.x - imgCenterX;
      const offsetY = center.y - imgCenterY;
      setImageOffset({
        x: imageOffset.x + offsetX * (1 - scaleChange),
        y: imageOffset.y + offsetY * (1 - scaleChange)
      });
      
      e.preventDefault();
      return;
    }
    
    // 如果暂停绘制模式，允许正常滚动，不处理绘制
    if (isDrawingPaused) {
      // 不调用 e.preventDefault()，允许浏览器正常处理滚动
      return;
    }
    
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const imgRect = imageRef.current.getBoundingClientRect();
    const coords = getEventCoordinates(e);
    // 使用图片的实际显示尺寸和位置
    const img = imageRef.current;
    const displayedWidth = (img.clientWidth || img.width) * imageScale;
    const displayedHeight = (img.clientHeight || img.height) * imageScale;
    // 计算相对于图片的坐标（考虑图片在容器中的位置、缩放和偏移）
    const imgLeft = imgRect.left - rect.left + imageOffset.x;
    const imgTop = imgRect.top - rect.top + imageOffset.y;
    const x = Math.max(0, Math.min((coords.x - rect.left - imgLeft) / imageScale, displayedWidth / imageScale));
    const y = Math.max(0, Math.min((coords.y - rect.top - imgTop) / imageScale, displayedHeight / imageScale));

    if (cropMode === 'polygon') {
      if (isAdjusting && adjustHandle !== null) {
        const newPoints = [...polygonPoints];
        newPoints[adjustHandle] = { x, y };
        setPolygonPoints(newPoints);
      }
      return;
    }

    // 矩形模式
    if (isAdjusting && adjustHandle) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      let newArea = { ...cropArea };
      
      // 使用图片的实际显示尺寸
      const img = imageRef.current;
      const displayedWidth = img ? img.clientWidth : imageSize.width;
      const displayedHeight = img ? img.clientHeight : imageSize.height;

      if (adjustHandle === 'move') {
        newArea.x = Math.max(0, Math.min(cropArea.x + dx, displayedWidth - cropArea.width));
        newArea.y = Math.max(0, Math.min(cropArea.y + dy, displayedHeight - cropArea.height));
      } else {
        const handles = {
          'nw': { x: cropArea.x + dx, y: cropArea.y + dy, width: cropArea.width - dx, height: cropArea.height - dy },
          'ne': { x: cropArea.x, y: cropArea.y + dy, width: cropArea.width + dx, height: cropArea.height - dy },
          'sw': { x: cropArea.x + dx, y: cropArea.y, width: cropArea.width - dx, height: cropArea.height + dy },
          'se': { x: cropArea.x, y: cropArea.y, width: cropArea.width + dx, height: cropArea.height + dy },
          'n': { x: cropArea.x, y: cropArea.y + dy, width: cropArea.width, height: cropArea.height - dy },
          's': { x: cropArea.x, y: cropArea.y, width: cropArea.width, height: cropArea.height + dy },
          'e': { x: cropArea.x, y: cropArea.y, width: cropArea.width + dx, height: cropArea.height },
          'w': { x: cropArea.x + dx, y: cropArea.y, width: cropArea.width - dx, height: cropArea.height },
        };

        const handle = handles[adjustHandle];
        if (handle) {
          newArea = {
            x: Math.max(0, Math.min(handle.x, displayedWidth)),
            y: Math.max(0, Math.min(handle.y, displayedHeight)),
            width: Math.max(10, Math.min(handle.width, displayedWidth - newArea.x)),
            height: Math.max(10, Math.min(handle.height, displayedHeight - newArea.y))
          };
        }
      }

      setCropArea(newArea);
      setDragStart({ x, y });
      return;
    }

    if (isDragging) {
      const width = Math.abs(x - dragStart.x);
      const height = Math.abs(y - dragStart.y);
      const minX = Math.min(x, dragStart.x);
      const minY = Math.min(y, dragStart.y);
      
      // 使用图片的实际显示尺寸
      const img = imageRef.current;
      const displayedWidth = img ? img.clientWidth : imageSize.width;
      const displayedHeight = img ? img.clientHeight : imageSize.height;

      setCropArea({
        x: minX,
        y: minY,
        width: Math.min(width, displayedWidth - minX),
        height: Math.min(height, displayedHeight - minY)
      });
    }
  };

  const handleEnd = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setIsAdjusting(false);
    setAdjustHandle(null);
    setLastPinchDistance(null);
  };

  const handleReset = () => {
    if (cropMode === 'polygon') {
      setPolygonPoints([]);
    } else {
      setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    }
  };

  const handleUndo = () => {
    if (cropMode === 'polygon' && polygonPoints.length > 0) {
      setPolygonPoints(polygonPoints.slice(0, -1));
    }
  };

  const handleCrop = () => {
    if (!imageRef.current || !containerRef.current) {
      alert('图片加载失败');
      return;
    }

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 获取图片的实际显示尺寸（考虑CSS缩放）
    // 使用getBoundingClientRect获取精确的显示尺寸
    const imgRect = img.getBoundingClientRect();
    const displayedWidth = imgRect.width;
    const displayedHeight = imgRect.height;
    
    // 计算实际显示尺寸与原始尺寸的比例
    const scaleX = img.naturalWidth / displayedWidth;
    const scaleY = img.naturalHeight / displayedHeight;
    
    console.log('Crop debug:', {
      naturalSize: { width: img.naturalWidth, height: img.naturalHeight },
      displayedSize: { width: displayedWidth, height: displayedHeight },
      imgRect: { width: imgRect.width, height: imgRect.height },
      clientSize: { width: img.clientWidth, height: img.clientHeight },
      imageSize: imageSize,
      cropArea: cropArea,
      scale: { x: scaleX, y: scaleY }
    });

    if (cropMode === 'polygon') {
      if (polygonPoints.length < 3) {
        alert('多边形至少需要3个顶点');
        return;
      }

      // 计算多边形的边界框
      const minX = Math.min(...polygonPoints.map(p => p.x));
      const maxX = Math.max(...polygonPoints.map(p => p.x));
      const minY = Math.min(...polygonPoints.map(p => p.y));
      const maxY = Math.max(...polygonPoints.map(p => p.y));

      canvas.width = (maxX - minX) * scaleX;
      canvas.height = (maxY - minY) * scaleY;

      // 创建裁剪路径
      ctx.beginPath();
      const scaledPoints = polygonPoints.map(p => ({
        x: (p.x - minX) * scaleX,
        y: (p.y - minY) * scaleY
      }));
      ctx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
      for (let i = 1; i < scaledPoints.length; i++) {
        ctx.lineTo(scaledPoints[i].x, scaledPoints[i].y);
      }
      ctx.closePath();
      ctx.clip();

      // 绘制图片
      ctx.drawImage(
        img,
        minX * scaleX,
        minY * scaleY,
        (maxX - minX) * scaleX,
        (maxY - minY) * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
    } else {
      // 矩形模式
      if (cropArea.width === 0 || cropArea.height === 0) {
        // 使用整张图片
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      } else {
        // 计算原始图片中的裁剪坐标
        const sourceX = cropArea.x * scaleX;
        const sourceY = cropArea.y * scaleY;
        const sourceWidth = cropArea.width * scaleX;
        const sourceHeight = cropArea.height * scaleY;
        
        // 确保坐标在有效范围内
        const finalX = Math.max(0, Math.min(sourceX, img.naturalWidth));
        const finalY = Math.max(0, Math.min(sourceY, img.naturalHeight));
        const finalWidth = Math.max(1, Math.min(sourceWidth, img.naturalWidth - finalX));
        const finalHeight = Math.max(1, Math.min(sourceHeight, img.naturalHeight - finalY));
        
        canvas.width = finalWidth;
        canvas.height = finalHeight;

        console.log('Crop rectangle:', {
          cropArea,
          source: { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight },
          final: { x: finalX, y: finalY, width: finalWidth, height: finalHeight },
          canvas: { width: canvas.width, height: canvas.height }
        });

        ctx.drawImage(
          img,
          finalX,
          finalY,
          finalWidth,
          finalHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }
    }

    canvas.toBlob((blob) => {
      if (blob) {
        // 创建预览URL
        const previewUrl = URL.createObjectURL(blob);
        setPreviewImage(previewUrl);
        setShowPreview(true);
        // 不立即调用onCrop，等待用户确认预览
      }
    }, 'image/jpeg', 0.95);
  };

  const handleConfirmCrop = () => {
    if (previewImage) {
      // 从预览URL创建File对象
      fetch(previewImage)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
          // 传递裁剪区域信息给父组件
          const cropInfo = {
            cropArea: cropArea,
            polygonPoints: polygonPoints,
            cropMode: cropMode
          };
          // 如果onCrop支持第二个参数，传递裁剪信息
          if (onCrop.length > 1) {
            onCrop(file, cropInfo);
          } else {
            onCrop(file);
          }
          if (previewImage) {
            URL.revokeObjectURL(previewImage);
          }
          setShowPreview(false);
          setPreviewImage(null);
        })
        .catch(err => {
          console.error('Error creating file from preview:', err);
          alert('创建文件失败，请重试');
        });
    }
  };

  const handleCancelPreview = () => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
      setPreviewImage(null);
    }
    setShowPreview(false);
  };

  const getCursor = (x, y) => {
    if (cropMode === 'polygon') {
      const pointIndex = getPolygonPointAt(x, y, polygonPoints);
      if (pointIndex !== null) return 'move';
      if (polygonPoints.length >= 2) {
        for (let i = 0; i < polygonPoints.length; i++) {
          const p1 = polygonPoints[i];
          const p2 = polygonPoints[(i + 1) % polygonPoints.length];
          const dist = pointToLineDistance(x, y, p1.x, p1.y, p2.x, p2.y);
          if (dist < 15) return 'crosshair';
        }
      }
      return 'crosshair';
    }

    if (cropArea.width > 0 && cropArea.height > 0) {
      const handle = getHandleAt(x, y, cropArea);
      if (handle) {
        const cursors = {
          'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize',
          'n': 'n-resize', 's': 's-resize', 'e': 'e-resize', 'w': 'w-resize',
          'move': 'move'
        };
        return cursors[handle] || 'default';
      }
    }
    return 'crosshair';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh'
    }}>
      {/* 顶部菜单 */}
      <div style={{
        background: '#ffffff',
        padding: '15px 20px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        flexShrink: 0
      }}>
        <div style={{
          maxWidth: '90vw',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h3 style={{ margin: 0, color: '#333', fontSize: '18px', fontWeight: 'bold' }}>裁剪图片</h3>
            
            {/* 模式选择 - 使用Radio按钮，直接跟在标题后面 */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#333' }}>
                <input
                  type="radio"
                  name="cropMode"
                  value="rectangle"
                  checked={cropMode === 'rectangle'}
                  onChange={(e) => {
                    setCropMode(e.target.value);
                    setPolygonPoints([]);
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <span>矩形</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#333' }}>
                <input
                  type="radio"
                  name="cropMode"
                  value="polygon"
                  checked={cropMode === 'polygon'}
                  onChange={(e) => {
                    setCropMode(e.target.value);
                    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <span>多边形</span>
              </label>
              
              {/* Toggle按钮 - 暂停/恢复绘制模式 */}
              <button
                onClick={() => {
                  setIsDrawingPaused(!isDrawingPaused);
                  setToggleButtonPulse(false);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: isDrawingPaused ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 152, 0, 0.9)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: toggleButtonPulse ? '0 0 15px rgba(255, 152, 0, 0.8)' : '0 2px 6px rgba(0, 0, 0, 0.2)',
                  fontWeight: 'bold',
                  transition: 'all 0.3s ease',
                  animation: toggleButtonPulse ? 'pulse 0.5s ease-in-out' : 'none',
                  whiteSpace: 'nowrap',
                  marginLeft: '10px'
                }}
                title={isDrawingPaused ? '恢复绘制模式' : '暂停绘制（允许拖曳/移动）'}
              >
                {isDrawingPaused ? '▶ 恢复' : '⏸ 暂停'}
              </button>
            </div>
          </div>
          
          {/* 取消按钮 - X按钮在右上角（红色） */}
          <button
            onClick={onCancel}
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              background: 'rgba(244, 67, 54, 0.1)',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#f44336',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(244, 67, 54, 0.2)';
              e.currentTarget.style.color = '#d32f2f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)';
              e.currentTarget.style.color = '#f44336';
            }}
            title="取消"
          >
            ×
          </button>
        </div>
        
        {/* 提示信息 - 移到header下方 */}
        <div style={{ 
          fontSize: '12px', 
          color: '#666',
          textAlign: 'center',
          paddingTop: '8px',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
          marginTop: '8px'
        }}>
          {isDrawingPaused ? (
            <span>绘制已暂停，可拖曳/移动图片。点击左上角按钮恢复绘制。</span>
          ) : cropMode === 'polygon' ? (
            <div>
              {polygonPoints.length < 3 ? (
                <span>点击图片添加顶点（至少需要3个顶点）</span>
              ) : (
                <span>点击顶点可调整位置，点击边可添加新顶点</span>
              )}
            </div>
          ) : (
            <div>
              {cropArea.width === 0 ? (
                <span>拖拽选择裁剪区域，或点击"预览裁剪"使用整张图片。双指可缩放图片。</span>
              ) : (
                <span>拖拽边缘或角点调整大小，拖拽中心移动位置。双指可缩放图片。</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 可滚动的图片区域 */}
      <div 
        ref={scrollContainerRef}
        className="crop-scroll-container"
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          minHeight: 0, // 允许flex子元素缩小
          // 增强滚动条可见性 (Firefox)
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 193, 7, 0.8) rgba(0, 0, 0, 0.1)',
          // 添加右侧和底部border提示可以滚动
          borderRight: '2px solid rgba(255, 193, 7, 0.3)',
          borderBottom: '2px solid rgba(255, 193, 7, 0.3)'
        }}
      >
        {/* 内容容器 - 使用padding确保可以滚动到边缘 */}
        <div style={{
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100%',
          boxSizing: 'border-box'
        }}>
          {/* 操作按钮组 - 固定在右上角，滚动时不被header遮盖 */}
          <div style={{
            position: 'fixed',
            top: '100px', // header高度约60px + 提示信息约15px = 75px，留出一些空间
            right: '20px',
            zIndex: 10003,
            display: 'flex',
            gap: '8px',
            flexDirection: 'column'
          }}>
          {/* 多边形模式下的撤销按钮（橙红色） */}
          {cropMode === 'polygon' && polygonPoints.length > 0 && (
            <button
              onClick={handleUndo}
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                background: 'rgba(255, 87, 34, 0.9)',
                backdropFilter: 'blur(5px)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                fontWeight: 'bold'
              }}
              title="撤销最后一个点"
            >
              ↶ 撤销
            </button>
          )}
          {/* 重新选择按钮 */}
          {(cropMode === 'rectangle' ? cropArea.width > 0 : polygonPoints.length > 0) && (
            <button
              onClick={handleReset}
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                background: 'rgba(255, 152, 0, 0.9)',
                backdropFilter: 'blur(5px)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                fontWeight: 'bold'
              }}
            >
              🔄 重新选择
            </button>
          )}
          {/* 预览裁剪按钮 */}
          <button
            onClick={handleCrop}
            disabled={cropMode === 'polygon' && polygonPoints.length < 3}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              background: (cropMode === 'polygon' && polygonPoints.length < 3) ? 'rgba(200, 200, 200, 0.9)' : 'rgba(76, 175, 80, 0.9)',
              backdropFilter: 'blur(5px)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (cropMode === 'polygon' && polygonPoints.length < 3) ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              fontWeight: 'bold'
            }}
          >
            ✓ 预览裁剪
          </button>
        </div>
        
        <div style={{
          display: 'inline-block'
        }}>
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              display: 'inline-block',
              cursor: isDrawingPaused ? 'default' : 'crosshair',
              border: '2px solid #fff',
              touchAction: isDrawingPaused ? 'auto' : 'none', // 暂停模式下允许默认触摸行为（滚动）
              userSelect: 'none'
            }}
          onMouseDown={handleStart}
          onMouseMove={(e) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const coords = getEventCoordinates(e);
            const x = coords.x - rect.left;
            const y = coords.y - rect.top;
            e.currentTarget.style.cursor = getCursor(x, y);
            handleMove(e);
          }}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(e) => {
            if (!isDrawingPaused) {
              handleStart(e);
            }
          }}
          onTouchMove={(e) => {
            if (!isDrawingPaused) {
              handleMove(e);
            }
          }}
          onTouchEnd={(e) => {
            if (!isDrawingPaused) {
              handleEnd(e);
            }
          }}
          onTouchCancel={(e) => {
            if (!isDrawingPaused) {
              handleEnd(e);
            }
          }}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              userSelect: 'none',
              margin: 0,
              padding: 0,
              border: 'none',
              transform: `scale(${imageScale}) translate(${imageOffset.x / imageScale}px, ${imageOffset.y / imageScale}px)`,
              transformOrigin: 'top left',
              transition: imageScale === 1 && imageOffset.x === 0 && imageOffset.y === 0 ? 'transform 0.2s' : 'none'
            }}
            draggable={false}
          />
          
          {/* 矩形裁剪区域 */}
          {cropMode === 'rectangle' && cropArea.width > 0 && cropArea.height > 0 && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: cropArea.x,
                  top: cropArea.y,
                  width: cropArea.width,
                  height: cropArea.height,
                  border: '2px dashed #4CAF50',
                  background: 'rgba(76, 175, 80, 0.1)',
                  pointerEvents: 'none'
                }}
              />
              {/* 调整手柄 */}
              {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(handle => {
                const handles = {
                  'nw': { x: cropArea.x, y: cropArea.y },
                  'ne': { x: cropArea.x + cropArea.width, y: cropArea.y },
                  'sw': { x: cropArea.x, y: cropArea.y + cropArea.height },
                  'se': { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height },
                  'n': { x: cropArea.x + cropArea.width / 2, y: cropArea.y },
                  's': { x: cropArea.x + cropArea.width / 2, y: cropArea.y + cropArea.height },
                  'e': { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height / 2 },
                  'w': { x: cropArea.x, y: cropArea.y + cropArea.height / 2 },
                };
                const pos = handles[handle];
                return (
                  <div
                    key={handle}
                    style={{
                      position: 'absolute',
                      left: pos.x - 5,
                      top: pos.y - 5,
                      width: 10,
                      height: 10,
                      background: '#4CAF50',
                      border: '2px solid white',
                      borderRadius: '50%',
                      pointerEvents: 'auto',
                      cursor: handle.includes('n') && handle.includes('w') ? 'nw-resize' :
                              handle.includes('n') && handle.includes('e') ? 'ne-resize' :
                              handle.includes('s') && handle.includes('w') ? 'sw-resize' :
                              handle.includes('s') && handle.includes('e') ? 'se-resize' :
                              handle === 'n' ? 'n-resize' :
                              handle === 's' ? 's-resize' :
                              handle === 'e' ? 'e-resize' :
                              'w-resize'
                    }}
                  />
                );
              })}
            </>
          )}

          {/* 多边形裁剪区域 */}
          {cropMode === 'polygon' && polygonPoints.length > 0 && (
            <>
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none'
                }}
              >
                <polygon
                  points={polygonPoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(76, 175, 80, 0.1)"
                  stroke="#4CAF50"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              </svg>
              {polygonPoints.map((point, index) => (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    left: point.x - 6,
                    top: point.y - 6,
                    width: 12,
                    height: 12,
                    background: '#4CAF50',
                    border: '2px solid white',
                    borderRadius: '50%',
                    pointerEvents: 'auto',
                    cursor: 'move'
                  }}
                />
              ))}
            </>
          )}
          </div>
        </div>
        
        {/* 滚动提示 - 顶部 */}
        {showScrollHint && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(255, 107, 107, 0.6)',
            zIndex: 10003,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'bounce 1.5s ease-in-out infinite',
            whiteSpace: 'nowrap',
            marginTop: '5px'
          }}>
            <span style={{ fontSize: '18px' }}>⬇️</span>
            <span>图片较长，可向下滚动</span>
          </div>
        )}
        
        {/* 滚动提示 - 底部 */}
        {showScrollHint && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(255, 107, 107, 0.6)',
            zIndex: 10003,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'bounce 1.5s ease-in-out infinite',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: '18px' }}>⬇️</span>
            <span>继续向下滚动查看</span>
          </div>
        )}
        </div>
      </div>


      {/* 裁剪预览弹窗 */}
      {showPreview && previewImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      paddingBottom: '80px' // 为底部固定按钮留出空间
    }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>裁剪预览</h3>
            <div style={{
              maxWidth: '100%',
              maxHeight: '60vh',
              marginBottom: '15px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              overflow: 'auto',
              background: '#f5f5f5',
              padding: '10px'
            }}>
              <img
                src={previewImage}
                alt="Crop Preview"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  display: 'block'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleCancelPreview}
                style={{
                  padding: '8px 16px',
                  background: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                重新裁剪
              </button>
              <button
                onClick={handleConfirmCrop}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                确认并识别
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageCrop;

// 添加滚动提示动画样式和滚动条样式
if (typeof document !== 'undefined' && !document.getElementById('crop-scroll-hint-style')) {
  const style = document.createElement('style');
  style.id = 'crop-scroll-hint-style';
  style.textContent = `
    @keyframes bounce {
      0%, 100% {
        transform: translateX(-50%) translateY(0);
      }
      50% {
        transform: translateX(-50%) translateY(-8px);
      }
    }
    /* Webkit浏览器滚动条样式 */
    .crop-scroll-container::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }
    .crop-scroll-container::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.1);
      border-radius: 6px;
    }
    .crop-scroll-container::-webkit-scrollbar-thumb {
      background: rgba(255, 193, 7, 0.8);
      border-radius: 6px;
      border: 2px solid rgba(0, 0, 0, 0.1);
    }
    .crop-scroll-container::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 193, 7, 1);
    }
  `;
  document.head.appendChild(style);
}
