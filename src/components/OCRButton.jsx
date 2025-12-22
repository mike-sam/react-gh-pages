import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import imageCompression from 'browser-image-compression';
import ImageCrop from './ImageCrop';

const OCRButton = ({ onTextRecognized, onPhotoAdd, onItemsExtracted, onRemoveOCRItems }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadAsPhoto, setUploadAsPhoto] = useState(true); // 预设勾选
  const [language, setLanguage] = useState('chi_sim+eng'); // 默认中英
  const [psm, setPsm] = useState('6'); // Page Segmentation Mode: 6 = 统一文本块
  const [showCrop, setShowCrop] = useState(false);
  const [originalImage, setOriginalImage] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrWords, setOcrWords] = useState([]); // 存储OCR识别的单词信息（包含alternatives）
  const [pendingImage, setPendingImage] = useState(null);
  const [selectedCharIndex, setSelectedCharIndex] = useState(-1);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternativesList, setAlternativesList] = useState([]);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [savedCropArea, setSavedCropArea] = useState(null); // 保存之前的裁剪区域
  const [savedPolygonPoints, setSavedPolygonPoints] = useState(null); // 保存之前的多边形点
  const [savedCropMode, setSavedCropMode] = useState('rectangle'); // 保存之前的裁剪模式
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const performOCR = async (file, selectedLanguage = language) => {
    if (!file) return;

    setIsProcessing(true);

    try {
      // 压缩图片（OCR需要，但可以保持较高质量）
      const compressionOptions = {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.9
      };

      const compressedFile = await imageCompression(file, compressionOptions);
      const base64String = await fileToBase64(compressedFile);

      // 使用 Tesseract.js 进行 OCR
      const worker = await createWorker(selectedLanguage);
      
      // 设置PSM（Page Segmentation Mode）以提高识别精度
      // PSM 6: 统一文本块（适合单列文本）
      // PSM 11: 稀疏文本（适合不规则布局）
      // PSM 12: 带OSD的稀疏文本
      // PSM 7: 单行文本
      // PSM 8: 单个单词
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        // 注意：如果包含中文，不要设置字符白名单，否则会限制中文识别
        // 只对纯英文/数字场景使用白名单
        // tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@.，。：:、,，.@#$%&*()[]{}<>+=_-/\\|?!"\'`~^;',
      });
      
      const { data: { text, words } } = await worker.recognize(compressedFile);
      await worker.terminate();

      // 清理识别出的文字（去除多余空白）
      let cleanedText = text;
      
      // 1. 移除中文字符之间的空格（中中之间不应有空格）
      cleanedText = cleanedText.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
      
      // 2. 移除标点符号前后的空格（中文标点）
      cleanedText = cleanedText.replace(/\s+([，。：；、！？])/g, '$1');
      cleanedText = cleanedText.replace(/([，。：；、！？])\s+/g, '$1');
      
      // 3. 移除多个连续空格，保留单个空格（但保留换行）
      cleanedText = cleanedText.replace(/[ \t]+/g, ' ');
      
      // 4. 移除行首行尾的空格（但保留换行）
      cleanedText = cleanedText.split('\n').map(line => line.trim()).join('\n');
      
      // 5. 移除多个连续换行（最多保留2个）
      cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
      
      // 6. 移除首尾空白
      cleanedText = cleanedText.trim();
      
      // 7. 移除中文字符和英文/数字之间的多余空格（只保留一个）
      // 但保留中英文之间的必要空格（如"苹果 Apple"）
      cleanedText = cleanedText.replace(/([\u4e00-\u9fa5])\s{2,}([a-zA-Z0-9])/g, '$1 $2');
      cleanedText = cleanedText.replace(/([a-zA-Z0-9])\s{2,}([\u4e00-\u9fa5])/g, '$1 $2');
      
      // 8. 移除数字和单位之间的多余空格（如"5 . 50" -> "5.50"）
      cleanedText = cleanedText.replace(/(\d)\s+\.\s+(\d)/g, '$1.$2');
      cleanedText = cleanedText.replace(/(\d)\s+([x×])\s+(\d)/g, '$1 $2 $3');
      
      // 显示文本编辑器，让用户编辑
      setOcrText(cleanedText);
      setOcrWords(words || []); // 保存单词信息（包含alternatives）
      setPendingImage(file);
      setShowTextEditor(true);
      setIsProcessing(false);

    } catch (error) {
      console.error('OCR识别失败:', error);
      alert('文字识别失败，请重试');
      setIsProcessing(false);
    }
  };

  const handleProcessOCRText = (text) => {
    console.log('handleProcessOCRText called, text length:', text?.length);
    
    if (!text || !text.trim()) {
      alert('文本为空，无法提取项目');
      return;
    }

    try {
      // 移除之前OCR添加的项目
      if (onRemoveOCRItems) {
        console.log('Removing previous OCR items');
        onRemoveOCRItems();
      }

      // 解析品名和单价，提取项目明细
      const extractedItems = parseItemsFromText(text);
      console.log('Extracted items count:', extractedItems.length, extractedItems);
      const remainingText = removeExtractedItems(text, extractedItems);
      console.log('Remaining text:', remainingText);

      // 如果有提取到项目明细，调用回调
      if (extractedItems.length > 0) {
        if (onItemsExtracted) {
          console.log('Calling onItemsExtracted with', extractedItems.length, 'items');
          onItemsExtracted(extractedItems);
        } else {
          console.warn('onItemsExtracted callback is not provided');
        }
      } else {
        console.log('No items extracted, will only add text to remark');
      }

      // 将剩余文字插入到备注栏（如果有）
      if (remainingText.trim()) {
        if (onTextRecognized) {
          console.log('Calling onTextRecognized with remaining text');
          onTextRecognized(remainingText.trim());
        } else {
          console.warn('onTextRecognized callback is not provided');
        }
      } else if (extractedItems.length === 0) {
        // 如果没有提取到项目，也没有剩余文字，至少把原始文本添加到备注
        if (onTextRecognized) {
          console.log('No items extracted, adding all text to remark');
          onTextRecognized(text.trim());
        }
      }

      // 如果勾选了上传为附件，上传原图
      if (uploadAsPhoto && onPhotoAdd && pendingImage) {
        console.log('Uploading photo as attachment');
        const previewUrl = URL.createObjectURL(pendingImage);
        fileToBase64(pendingImage).then(base64String => {
          const photoData = {
            base64: base64String,
            preview: previewUrl,
            filename: pendingImage.name,
            originalSize: pendingImage.size,
            compressedSize: pendingImage.size,
            type: pendingImage.type,
            uploadedUrl: ''
          };
          onPhotoAdd(photoData);
        }).catch(err => {
          console.error('Failed to convert image to base64:', err);
        });
      }

      // 关闭编辑器
      setShowTextEditor(false);
      setOcrText('');
      setOcrWords([]);
      setPendingImage(null);
      setShowAlternatives(false);
      setSelectedCharIndex(-1);
      setAlternativesList([]);
      // 清理预览图片URL（延迟清理，以便用户还能预览）
      // 不立即清理，保留预览功能
      
      console.log('handleProcessOCRText completed');
    } catch (error) {
      console.error('处理OCR文本失败:', error);
      alert('处理文本时出错: ' + error.message);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
      }
      
      // 如果勾选了上传附件，先显示裁剪界面
      if (uploadAsPhoto) {
        setOriginalImage(file);
        fileToBase64(file).then(src => {
          setShowCrop(true);
        });
      } else {
        // 直接进行OCR
        performOCR(file);
      }
    }
    // 清空input，以便可以重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = (croppedFile, cropInfo = null) => {
    setCroppedImage(croppedFile);
    setShowCrop(false); // 裁剪完成后关闭裁剪界面
    // 保留originalImage，以便可以重新裁剪
    
    // 保存裁剪区域信息，以便重新裁剪时恢复
    if (cropInfo) {
      setSavedCropArea(cropInfo.cropArea);
      setSavedPolygonPoints(cropInfo.polygonPoints);
      setSavedCropMode(cropInfo.cropMode);
    }
    
    // 创建预览URL用于显示
    const previewUrl = URL.createObjectURL(croppedFile);
    setPreviewImageUrl(previewUrl);
    
    // 裁剪后，先保存图片，等待用户选择语言或直接OCR
    // 如果用户已经在文本编辑器中，不自动OCR
    if (!showTextEditor) {
      performOCR(croppedFile);
    }
  };

  const handleRecrop = () => {
    // 关闭文本编辑器，优先显示裁剪界面
    setShowTextEditor(false);
    
    // 重新显示裁剪界面
    if (originalImage) {
      setShowCrop(true);
    } else if (croppedImage) {
      // 如果原图已清除，使用裁剪后的图片作为原图
      setOriginalImage(croppedImage);
      setShowCrop(true);
    } else if (pendingImage) {
      // 如果只有待处理的图片，使用它作为原图
      setOriginalImage(pendingImage);
      setShowCrop(true);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    // 如果当前有pending的图片，重新识别
    if (pendingImage) {
      performOCR(pendingImage, newLanguage);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  // 解析文本中的品名和单价
  const parseItemsFromText = (text) => {
    const items = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line && line.length > 2);
    
    // 匹配各种格式：
    // 1. 品名 单价 (如: "苹果 5.50")
    // 2. 品名: 单价 (如: "苹果: 5.50")
    // 3. 品名 数量 x 单价 = 小计 (如: "苹果 2 x 5.50 = 11.00")
    // 4. 品名 单价 数量 (如: "苹果 5.50 2")
    // 5. 品名 RM单价 (如: "苹果 RM5.50")
    
    lines.forEach(line => {
      // 移除常见的货币符号和单位
      const cleanLine = line.replace(/RM|MYR|\$|€|£|¥/gi, '').trim();
      
      // 跳过明显不是商品信息的行（如总计、合计、日期等）
      if (/总计|合计|小计|总计|日期|时间|收据|发票/i.test(cleanLine)) {
        return;
      }
      
      // 匹配格式: 品名 数量 x 单价 = 小计
      let match = cleanLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)$/i);
      if (match) {
        const name = match[1].trim();
        const qty = parseFloat(match[2]) || 1;
        const price = parseFloat(match[3]) || 0;
        const subtotal = parseFloat(match[4]) || 0;
        
        if (name && price > 0 && qty > 0) {
          items.push({
            name: name,
            unitPrice: price,
            quantity: qty,
            subtotal: subtotal || (price * qty)
          });
        }
        return;
      }
      
      // 匹配格式: 品名: 单价
      match = cleanLine.match(/^(.+?):\s*(\d+(?:\.\d+)?)$/);
      if (match) {
        const name = match[1].trim();
        const price = parseFloat(match[2]) || 0;
        
        if (name && price > 0 && price <= 99999) {
          items.push({
            name: name,
            unitPrice: price,
            quantity: 1,
            subtotal: price
          });
        }
        return;
      }
      
      // 匹配格式: 品名 单价 数量 (或 品名 数量 单价)
      match = cleanLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
      if (match) {
        const name = match[1].trim();
        const num1 = parseFloat(match[2]);
        const num2 = parseFloat(match[3]);
        
        if (name && num1 > 0 && num2 > 0) {
          // 判断哪个是单价，哪个是数量（通常单价是小数，数量是整数）
          let unitPrice, quantity;
          if (num1 % 1 !== 0 && num2 % 1 === 0) {
            // num1是小数（单价），num2是整数（数量）
            unitPrice = num1;
            quantity = num2;
          } else if (num1 % 1 === 0 && num2 % 1 !== 0) {
            // num1是整数（数量），num2是小数（单价）
            unitPrice = num2;
            quantity = num1;
          } else if (num1 <= 100 && num2 > 1) {
            // 如果num1较小，可能是数量；num2较大，可能是单价
            unitPrice = num2;
            quantity = num1;
          } else {
            // 默认第一个是单价，第二个是数量
            unitPrice = num1;
            quantity = num2;
          }
          
          if (unitPrice > 0 && quantity > 0 && unitPrice <= 99999) {
            items.push({
              name: name,
              unitPrice: unitPrice,
              quantity: quantity,
              subtotal: parseFloat((unitPrice * quantity).toFixed(2))
            });
          }
        }
        return;
      }
      
      // 匹配格式: 品名 单价 (单价是数字，后面可能跟其他文字)
      match = cleanLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)(?:\s|$)/);
      if (match) {
        const name = match[1].trim();
        const price = parseFloat(match[2]);
        // 如果品名不是纯数字，且单价合理（0.01-99999之间），则认为是有效的
        if (name && !/^\d+$/.test(name) && price >= 0.01 && price <= 99999) {
          items.push({
            name: name,
            unitPrice: price,
            quantity: 1,
            subtotal: price
          });
        }
      }
    });
    
    return items;
  };

  // 从文本中移除已提取的项目
  const removeExtractedItems = (text, extractedItems) => {
    if (extractedItems.length === 0) return text;
    
    let remainingText = text;
    const lines = remainingText.split('\n');
    
    // 标记要移除的行
    const linesToKeep = lines.filter(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return true; // 保留空行
      
      // 检查这一行是否包含已提取的项目信息
      for (const item of extractedItems) {
        const itemName = item.name.trim();
        const itemPrice = item.unitPrice.toString();
        
        // 如果这一行包含品名和单价，则移除
        if (trimmedLine.includes(itemName) && trimmedLine.includes(itemPrice)) {
          return false;
        }
      }
      
      return true;
    });
    
    // 重新组合文本
    remainingText = linesToKeep.join('\n');
    
    // 清理多余的空行
    return remainingText.replace(/\n{3,}/g, '\n\n').trim();
  };

  const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // 查找字符的替换选项
  const findAlternativesForChar = (charIndex, char) => {
    if (!ocrWords || ocrWords.length === 0) {
      // 如果没有words信息，尝试从字符本身生成一些常见替换
      const commonAlternatives = generateCommonAlternatives(char);
      if (commonAlternatives.length > 0) {
        setAlternativesList(commonAlternatives);
        setSelectedCharIndex(charIndex);
        setShowAlternatives(true);
      }
      return;
    }

    // 查找包含该字符位置的单词
    let currentPos = 0;
    for (const word of ocrWords) {
      const wordStart = currentPos;
      const wordEnd = currentPos + word.text.length;
      
      if (charIndex >= wordStart && charIndex < wordEnd) {
        // 找到包含该字符的单词
        const charPosInWord = charIndex - wordStart;
        const alternatives = [];
        
        // 如果有symbols信息，获取该字符的alternatives
        if (word.symbols && word.symbols[charPosInWord]) {
          const symbol = word.symbols[charPosInWord];
          if (symbol.alternatives && symbol.alternatives.length > 0) {
            alternatives.push(...symbol.alternatives.map(alt => ({
              text: alt.text,
              confidence: alt.confidence
            })));
          }
        }
        
        // 如果没有alternatives，生成一些常见替换
        if (alternatives.length === 0) {
          const commonAlts = generateCommonAlternatives(char);
          alternatives.push(...commonAlts);
        }
        
        if (alternatives.length > 0) {
          setAlternativesList(alternatives);
          setSelectedCharIndex(charIndex);
          setShowAlternatives(true);
        }
        return;
      }
      
      currentPos = wordEnd;
      // 加上单词之间的空格
      if (wordEnd < ocrText.length && ocrText[wordEnd] === ' ') {
        currentPos++;
      }
    }
    
    // 如果没找到，尝试生成常见替换
    const commonAlternatives = generateCommonAlternatives(char);
    if (commonAlternatives.length > 0) {
      setAlternativesList(commonAlternatives);
      setSelectedCharIndex(charIndex);
      setShowAlternatives(true);
    }
  };

  // 生成常见字符替换选项
  const generateCommonAlternatives = (char) => {
    const alternatives = [];
    
    // 常见易混淆字符映射
    const commonMistakes = {
      '0': ['O', 'o', 'D'],
      'O': ['0', 'o', 'Q'],
      'o': ['0', 'O', 'a'],
      '1': ['l', 'I', '|'],
      'l': ['1', 'I', '|'],
      'I': ['1', 'l', '|'],
      '5': ['S', 's'],
      'S': ['5', 's'],
      's': ['5', 'S'],
      '8': ['B', 'b'],
      'B': ['8', 'b'],
      'b': ['8', 'B'],
      '6': ['G', 'g'],
      'G': ['6', 'g'],
      'g': ['6', 'G'],
      'Z': ['2', 'z'],
      'z': ['2', 'Z'],
      '2': ['Z', 'z'],
      'rn': ['m'],
      'm': ['rn'],
      'vv': ['w'],
      'w': ['vv'],
    };
    
    if (commonMistakes[char]) {
      alternatives.push(...commonMistakes[char].map(text => ({ text, confidence: 50 })));
    }
    
    // 如果是中文字符，提供一些常见易混淆的中文字
    if (/[\u4e00-\u9fa5]/.test(char)) {
      const chineseMistakes = {
        '一': ['二', '三', '十'],
        '二': ['一', '三', '十'],
        '三': ['一', '二', '十'],
        '十': ['一', '二', '三'],
        '人': ['入', '八'],
        '入': ['人', '八'],
        '八': ['人', '入'],
        '大': ['太', '天'],
        '太': ['大', '天'],
        '天': ['大', '太'],
      };
      
      if (chineseMistakes[char]) {
        alternatives.push(...chineseMistakes[char].map(text => ({ text, confidence: 50 })));
      }
    }
    
    return alternatives;
  };

  return (
    <>
      {/* 文件选择input - 用于图库选择 */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileSelect}
        style={{display: 'none'}}
      />
      {/* 相机input - 用于直接拍摄 */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{display: 'none'}}
      />
      {/* 主页面OCR按钮组 - 较小尺寸 */}
      <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
        <button
          onClick={handleCameraClick}
          disabled={isProcessing}
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            background: isProcessing ? '#ccc' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="拍摄单据并识别文字"
        >
          {isProcessing ? '⏳' : '📷 拍摄'}
        </button>
        <button
          onClick={handleButtonClick}
          disabled={isProcessing}
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            background: isProcessing ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="从图库选择图片并识别文字"
        >
          {isProcessing ? '⏳' : '🖼️ 图库'}
        </button>
      </div>

      {/* 图片裁剪界面 */}
      {showCrop && originalImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 10004, // 确保裁剪界面在文本编辑器之上
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>裁剪图片</h3>
            <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* OCR按钮和选项 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={handleCameraClick}
                    disabled={isProcessing}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      background: isProcessing ? '#ccc' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 'bold'
                    }}
                    title="拍摄单据并识别文字"
                  >
                    {isProcessing ? '⏳ 识别中...' : '📷 拍摄识别'}
                  </button>
                  <button
                    onClick={handleButtonClick}
                    disabled={isProcessing}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      background: isProcessing ? '#ccc' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 'bold'
                    }}
                    title="从图库选择图片并识别文字"
                  >
                    {isProcessing ? '⏳ 识别中...' : '🖼️ 图库识别'}
                  </button>
                </div>
                <label style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={uploadAsPhoto}
                    onChange={(e) => setUploadAsPhoto(e.target.checked)}
                    style={{cursor: 'pointer'}}
                  />
                  <span>同时上传为附件</span>
                </label>
              </div>
              
              {/* 语言和PSM选择 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px' }}>OCR语言:</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      fontSize: '11px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="chi_sim+eng">中英</option>
                    <option value="chi_sim">中</option>
                    <option value="eng">英</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px' }}>PSM:</label>
                  <select
                    value={psm}
                    onChange={(e) => setPsm(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      fontSize: '11px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      minWidth: '280px'
                    }}
                  >
                    <option value="6">PSM 6: 统一文本块（例：收据单列列表）</option>
                    <option value="7">PSM 7: 单行文本（例：一行价格或标题）</option>
                    <option value="8">PSM 8: 单个单词（例：单个商品名）</option>
                    <option value="11">PSM 11: 稀疏文本（例：多列、不规则布局）</option>
                    <option value="12">PSM 12: 带OSD稀疏文本（例：复杂排版）</option>
                  </select>
                </div>
              </div>
            </div>
            <ImageCrop
              imageSrc={URL.createObjectURL(originalImage)}
              onCrop={(croppedFile, cropInfo) => {
                handleCropComplete(croppedFile, cropInfo);
                setShowCrop(false); // 裁剪完成后关闭裁剪界面
              }}
              onCancel={() => {
                setShowCrop(false);
                // 不清除originalImage，以便可以重新裁剪
              }}
              initialCropArea={savedCropArea}
              initialPolygonPoints={savedPolygonPoints}
              initialCropMode={savedCropMode}
            />
          </div>
        </div>
      )}

      {/* 预览识别图弹窗 */}
      {showImagePreview && previewImageUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          zIndex: 10004,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
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
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>识别图片预览</h3>
            <div style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              marginBottom: '15px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              overflow: 'auto',
              background: '#f5f5f5',
              padding: '10px'
            }}>
              <img
                src={previewImageUrl}
                alt="OCR Preview"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  display: 'block'
                }}
              />
            </div>
            <button
              onClick={() => setShowImagePreview(false)}
              style={{
                padding: '8px 16px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* OCR文本编辑器 */}
      {showTextEditor && !showCrop && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: '600px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>编辑OCR识别文本</h3>
            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <label style={{ fontSize: '12px' }}>语言:</label>
                <select
                  value={language}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    setLanguage(newLang);
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="chi_sim+eng">中英</option>
                  <option value="chi_sim">中</option>
                  <option value="eng">英</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <label style={{ fontSize: '12px' }}>PSM:</label>
                <select
                  value={psm}
                  onChange={(e) => setPsm(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    minWidth: '280px'
                  }}
                  title="页面分割模式：选择最适合您图片布局的模式"
                >
                  <option value="6">PSM 6: 统一文本块（例：收据单列列表）</option>
                  <option value="7">PSM 7: 单行文本（例：一行价格或标题）</option>
                  <option value="8">PSM 8: 单个单词（例：单个商品名）</option>
                  <option value="11">PSM 11: 稀疏文本（例：多列、不规则布局）</option>
                  <option value="12">PSM 12: 带OSD稀疏文本（例：复杂排版）</option>
                </select>
              </div>
              <label style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer'}}>
                <input
                  type="checkbox"
                  checked={uploadAsPhoto}
                  onChange={(e) => setUploadAsPhoto(e.target.checked)}
                  style={{cursor: 'pointer'}}
                />
                <span>同时上传为附件</span>
              </label>
              <button
                onClick={() => {
                  if (pendingImage) {
                    performOCR(pendingImage, language);
                  }
                }}
                disabled={isProcessing || !pendingImage}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: isProcessing ? '#ccc' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? '识别中...' : '重新识别'}
              </button>
              <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                {(originalImage || croppedImage) && (
                  <button
                    onClick={handleRecrop}
                    disabled={isProcessing}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: isProcessing ? '#ccc' : '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isProcessing ? 'not-allowed' : 'pointer'
                    }}
                    title="重新裁剪图片"
                  >
                    🔄 重新裁剪
                  </button>
                )}
                {previewImageUrl && (
                  <button
                    onClick={() => setShowImagePreview(true)}
                    disabled={isProcessing}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: isProcessing ? '#ccc' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isProcessing ? 'not-allowed' : 'pointer'
                    }}
                    title="预览识别图"
                  >
                    🖼️ 预览识别图
                  </button>
                )}
              </div>
            </div>
            <div style={{ position: 'relative', marginBottom: '15px' }}>
              <textarea
                ref={textareaRef}
                value={ocrText}
                onChange={(e) => {
                  setOcrText(e.target.value);
                  setShowAlternatives(false); // 编辑时隐藏替换选项
                }}
                onSelect={(e) => {
                  const start = e.target.selectionStart;
                  const end = e.target.selectionEnd;
                  if (start === end && start >= 0 && start < ocrText.length) {
                    // 单个字符被选中，查找该字符的alternatives
                    const char = ocrText[start];
                    if (char && char.trim()) {
                      findAlternativesForChar(start, char);
                    }
                  } else {
                    setShowAlternatives(false);
                  }
                }}
                onClick={(e) => {
                  // 点击时也尝试查找替换选项
                  const start = e.target.selectionStart;
                  if (start >= 0 && start < ocrText.length) {
                    const char = ocrText[start];
                    if (char && char.trim()) {
                      findAlternativesForChar(start, char);
                    }
                  }
                }}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
                placeholder="编辑识别出的文本...（点击字符可查看替换选项）"
              />
              {/* 显示替换选项 - 移动端优化 */}
              {showAlternatives && alternativesList.length > 0 && selectedCharIndex >= 0 && (
                <div style={{
                  position: 'fixed',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'white',
                  border: '2px solid #4CAF50',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  zIndex: 10003,
                  maxWidth: '90vw',
                  width: 'auto',
                  minWidth: '250px'
                }}>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    marginBottom: '8px',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    替换字符: "{ocrText[selectedCharIndex]}"
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    marginBottom: '8px'
                  }}>
                    {alternativesList.map((alt, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (selectedCharIndex >= 0 && selectedCharIndex < ocrText.length) {
                            const newText = ocrText.substring(0, selectedCharIndex) + alt.text + ocrText.substring(selectedCharIndex + 1);
                            setOcrText(newText);
                            setShowAlternatives(false);
                            setSelectedCharIndex(-1);
                            // 恢复焦点到textarea
                            setTimeout(() => {
                              if (textareaRef.current) {
                                textareaRef.current.focus();
                                textareaRef.current.setSelectionRange(selectedCharIndex + 1, selectedCharIndex + 1);
                              }
                            }, 0);
                          }
                        }}
                        style={{
                          padding: '10px 16px',
                          fontSize: '16px',
                          background: idx === 0 ? '#4CAF50' : '#f0f0f0',
                          color: idx === 0 ? 'white' : '#333',
                          border: idx === 0 ? '2px solid #4CAF50' : '1px solid #ddd',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          minWidth: '60px',
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                        title={alt.confidence ? `置信度: ${alt.confidence.toFixed(1)}%` : ''}
                      >
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{alt.text}</div>
                        {alt.confidence && (
                          <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                            {alt.confidence.toFixed(0)}%
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowAlternatives(false);
                      setSelectedCharIndex(-1);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      background: '#ccc',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      touchAction: 'manipulation'
                    }}
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowTextEditor(false);
                  setOcrText('');
                  setPendingImage(null);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#ccc',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={() => handleProcessOCRText(ocrText)}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                确认并提取项目
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OCRButton;

