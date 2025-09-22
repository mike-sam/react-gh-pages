// 通用的双空格导航工具
export const createDoubleSpaceHandler = (onNavigate, options = {}) => {
  const { shouldTrim = true, preventDefault = true } = options;
  
  return (e) => {
    if (e.key === ' ') {
      const spaceCount = parseInt(e.target.dataset.spaceCount || '0') + 1;
      e.target.dataset.spaceCount = spaceCount;
      
      if (spaceCount >= 2) {
        if (preventDefault) {
          e.preventDefault();
        }
        e.target.dataset.spaceCount = 0;
        
        // Get the current value
        let currentValue = e.target.value;
        
        // Trim the value if requested
        if (shouldTrim) {
          currentValue = currentValue.replace(/\s+$/, '').trim();
        }
        
        // Execute navigation callback with the processed value
        if (onNavigate) {
          onNavigate(currentValue);
        }
      }
    } else {
      e.target.dataset.spaceCount = 0;
    }
  };
};

// 通用的focus到下一个元素的函数
export const focusElement = (selector, delay = 100) => {
  setTimeout(() => {
    const element = document.querySelector(selector);
    if (element) {
      if (element.click && (element.tagName === 'BUTTON' || element.onclick)) {
        element.click();
      } else if (element.focus) {
        element.focus();
        // For mobile devices, especially iOS, trigger a click to ensure keyboard shows
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          if (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent)) {
            setTimeout(() => {
              element.click();
            }, 50);
          }
        }
      }
    }
  }, delay);
};
