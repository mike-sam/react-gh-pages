import React, { useState } from 'react';
import Select from 'react-select';

const PaymentMethodSelector = ({ 
  paymentOptions, 
  paymentMethod, 
  setPaymentMethod,
  onPaymentFromUrl 
}) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [hasProcessedUrlParams, setHasProcessedUrlParams] = useState(false);
  const [previousPaymentMethod, setPreviousPaymentMethod] = useState('');

  // 分类付款方式
  const categorizePaymentOptions = () => {
    const categories = {
      Cash: [],
      eWallet: [],
      Card: []
    };

    Object.values(paymentOptions).forEach(option => {
      if (option.key === 'Cash') {
        categories.Cash.push(option);
      } else if (option.key === 'eWallet') {
        categories.eWallet.push(option);
      } else {
        categories.Card.push(option);
      }
    });

    return categories;
  };

  const categorizedOptions = categorizePaymentOptions();

  const handleCategorySelect = (category) => {
    // 如果点击已选择的类别，取消选择
    if (getCurrentCategory() === category) {
      setPaymentMethod('');
      setSelectedCategory('');
      return;
    }
    
    const options = categorizedOptions[category];
    
    if (options.length === 1) {
      // 如果只有一个选项，直接选择
      setPaymentMethod(options[0].card_num);
      setSelectedCategory('');
      // Auto-focus to remark after selection with forced keyboard
      requestAnimationFrame(() => {
        const remarkInput = document.querySelector('.content-remark');
        if (remarkInput) {
          remarkInput.focus();
          
          if (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent)) {
            remarkInput.click();
            remarkInput.setAttribute('inputmode', 'text');
            remarkInput.style.transform = 'translateZ(0)';
            remarkInput.focus();
          }
        }
      });
    } else if (options.length > 1) {
      // 如果有多个选项，保存当前选择并清空，显示详细选择
      setPreviousPaymentMethod(paymentMethod);
      setPaymentMethod('');
      setSelectedCategory(category);
    }
  };

  // 获取当前付款方式所属的类别
  const getCurrentCategory = () => {
    if (!paymentMethod) return null;
    
    const currentOption = Object.values(paymentOptions).find(opt => opt.card_num === paymentMethod);
    if (!currentOption) return null;
    
    if (currentOption.key === 'Cash') return 'Cash';
    if (currentOption.key === 'eWallet') return 'eWallet';
    return 'Card';
  };



  // 模糊匹配逻辑
  const fuzzyMatchPayment = (searchTerm) => {
    const lowerSearch = searchTerm.toLowerCase();
    const allOptions = Object.values(paymentOptions);
    
    const exactMatches = allOptions.filter(option => 
      option.card_num.toLowerCase() === lowerSearch || 
      option.key.toLowerCase() === lowerSearch
    );
    
    if (exactMatches.length === 1) {
      return exactMatches[0].card_num;
    }
    
    const partialMatches = allOptions.filter(option => 
      option.card_num.toLowerCase().includes(lowerSearch) || 
      option.key.toLowerCase().includes(lowerSearch)
    );
    
    return partialMatches.length === 1 ? partialMatches[0].card_num : null;
  };

  // 处理URL参数设置 - 只处理一次
  React.useEffect(() => {
    if (onPaymentFromUrl && !hasProcessedUrlParams && Object.keys(paymentOptions).length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentParam = urlParams.get('payment');
      
      if (paymentParam) {
        const matchedPayment = fuzzyMatchPayment(paymentParam);
        if (matchedPayment) {
          setPaymentMethod(matchedPayment);
        }
      }
      setHasProcessedUrlParams(true);
    }
  }, [onPaymentFromUrl, hasProcessedUrlParams, paymentOptions]);

  const getCategoryLabel = (category) => {
    const labels = {
      Cash: '💵 现金',
      eWallet: '📱 电子钱包',
      Card: '💳 银行卡'
    };
    return labels[category] || category;
  };

  const getCategoryCount = (category) => {
    return categorizedOptions[category]?.length || 0;
  };

  const formatOptionLabel = (option) => {
    if (!option) return '';
    
    // 只有明确标记为 eWallet 的项目才截断国家代码
    if (option.key === 'eWallet') {
      // eWallet可以截断，去掉国家代码
      let name = option.card_num;
      // 移除国家代码如 [MY] [SG]
      name = name.replace(/\[[A-Z]{2}\]/g, '').trim();
      return name;
    }
    
    // 所有其他类别（包括 Cash 和 Card）都保留原始显示
    if(option.card_num === option.key){
      return option.card_num;
    }
    return `${option.key} - ${option.card_num}`;
  };

  if (selectedCategory) {
    // 显示详细选择
    return (
      <div className="payment-selector">
        <div className="payment-category-header">
          <button 
            className="back-btn"
            onClick={() => {
              setPaymentMethod(previousPaymentMethod);
              setPreviousPaymentMethod('');
              setSelectedCategory('');
            }}
          >
            ← 返回
          </button>
          <span className="category-title">{getCategoryLabel(selectedCategory)}</span>
        </div>
        
        <Select
          value={paymentMethod ? {
            value: paymentMethod,
            label: formatOptionLabel(Object.values(paymentOptions).find(opt => opt.card_num === paymentMethod))
          } : null}
          onChange={(selected) => {
            setPaymentMethod(selected ? selected.value : '');
            setPreviousPaymentMethod('');
            setSelectedCategory('');
            
            // Store selection for onMenuClose handler
            if (selected) {
              window.selectedPaymentForFocus = true;
            }
          }}
          onMenuClose={() => {
            // Handle focus in the menu close event to maintain user interaction context
            if (window.selectedPaymentForFocus) {
              window.selectedPaymentForFocus = false;
              
              const remarkInput = document.querySelector('.content-remark');
              if (remarkInput) {
                remarkInput.focus();
                
                // For mobile, the menu close event maintains user interaction context
                if (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent)) {
                  remarkInput.click();
                }
              }
            }
          }}
          options={categorizedOptions[selectedCategory].map(option => ({
            value: option.card_num,
            label: formatOptionLabel(option)
          }))}
          isClearable
          placeholder={`选择${getCategoryLabel(selectedCategory)}...`}
          autoFocus={true}
          menuIsOpen={true}
          styles={{
            control: (base) => ({
              ...base,
              borderRadius: '8px',
              padding: '4px',
              borderColor: '#ddd',
            }),
            menu: (base) => ({
              ...base,
              zIndex: 1002,
            }),
            menuPortal: (base) => ({
              ...base,
              zIndex: 1002,
            })
          }}
          menuPortalTarget={document.body}
        />
      </div>
    );
  }

  return (
    <div className="payment-selector">
      <div className="payment-category-buttons">
        {Object.keys(categorizedOptions).map(category => {
          const count = getCategoryCount(category);
          if (count === 0) return null;
          
          const isSelected = getCurrentCategory() === category;
          
          return (
            <button
              key={category}
              className={`payment-category-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => handleCategorySelect(category)}
            >
              <span className="category-label">{getCategoryLabel(category)}</span>
              <span className="category-count">({count})</span>
            </button>
          );
        })}
      </div>
      
      {paymentMethod && (
        <div className="selected-payment">
          <span className="selected-label">已选择:</span>
          <span className="selected-payment-name">
            {formatOptionLabel(Object.values(paymentOptions).find(opt => opt.card_num === paymentMethod))}
          </span>
          <button 
            className="clear-payment-btn"
            onClick={() => setPaymentMethod('')}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodSelector;
