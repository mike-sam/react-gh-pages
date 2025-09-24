// 通用的双空格导航工具
export const createDoubleSpaceHandler = (onNavigate, options = {}) => {
  const { shouldTrim = true, preventDefault = true } = options;
  
  return (e) => {
    const val = e.target.value;

    // 1. Android：雙空格會變成 ". "，所以要一起判斷
    const isDoubleSpace = /\s\s$/.test(val) || val.endsWith('. ') || val.endsWith('。 ');

    if (isDoubleSpace) {
      let currentValue = val;
      if (shouldTrim) {
        currentValue = currentValue.replace(/\s+$/, '').trim();
      }

      // 清掉尾端空格，避免殘留
      e.target.value = currentValue;

      // 觸發導航回調
      // alert("DEBUG double space detected, navigate:" + JSON.stringify(val));
      onNavigate?.(currentValue);
    }
  };
};

// 通用的focus到下一个元素的函数
export const focusElement = (selector, delay = 100) => {
  setTimeout(() => {
    const element = document.querySelector(selector);
    if (!element) return;

    if (element) {
      if (element.click && (element.tagName === 'BUTTON' || element.onclick)) {
        element.click();
      } else if (element.focus) {
        element.focus();
        // For mobile devices, especially iOS, trigger a click to ensure keyboard shows
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          let mobileDevices = RegExp(/iPhone|iPad|iPod|Android/i);
          mobileDevices = RegExp(/iPhone|iPad|iPod/i);
          if (mobileDevices.test(navigator.userAgent)) {
            element.setAttribute('readonly', 'readonly');
            setTimeout(() => {
              element.removeAttribute('readonly');
              element.focus();
              // element.click();
            }, 50);
          }
          // ✅ Android 不做 click，只保留 focus
        }

        
        // 避免鍵盤遮擋
        setTimeout(() => {
          if (element.scrollIntoViewIfNeeded) {
            element.scrollIntoViewIfNeeded(true);
          } else {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  }, delay);
};
