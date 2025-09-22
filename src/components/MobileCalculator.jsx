import React, { useState, useEffect } from 'react';
import { createDoubleSpaceHandler, focusElement } from '../utils/keyboardNavigation';

const MobileCalculator = ({ amount, setAmount, currency, setCurrency, onAmountFocus, onCurrencyConversion, onAmountComplete, selectedTag, input }) => {
  const [isCalculatorVisible, setIsCalculatorVisible] = useState(false);

  // Function to show calculator (can be called from parent components)
  const showCalculator = () => {
    if (selectedTag && input && (!amount || amount === '0' || amount === '')) {
      // Hide any visible keyboard by blurring the active element
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      
      // Small delay to ensure keyboard is hidden before showing calculator
      setTimeout(() => {
        setIsCalculatorVisible(true);
      }, 100);
    }
  };

  // Expose showCalculator function globally so TagSelector can call it
  useEffect(() => {
    window.showCalculator = showCalculator;
    return () => {
      delete window.showCalculator;
    };
  }, [selectedTag, input, amount]);
  
  const handleNumber = (num) => {
    // If there's an operator in the amount, we're building an expression
    if(/[/+\-*÷×]/.test(amount)) {
      setAmount(amount + num);
      return;
    }
    
    // Handle special case where amount is '0' - replace it
    if (amount === '0' || amount === '0.00') {
      if (num === '0') {
        return; // Don't allow multiple zeros
      }
      setAmount(num);
      return;
    }
    
    // Normal number entry - like regular calculator
    // Check if we already have a decimal point
    if (amount.includes('.')) {
      const parts = amount.split('.');
      // Limit to 2 decimal places
      if (parts[1] && parts[1].length >= 2) {
        return;
      }
      setAmount(amount + num);
    } else {
      // No decimal point, normal addition
      if (amount === '') {
        setAmount(num);
      } else {
        setAmount(amount + num);
      }
    }
  };
  
  const handleOperator = (op) => {
    if (['+', '-', '×', '÷', '*'].includes(amount.slice(-1))) {
      setAmount(amount.slice(0, -1) + op);
      return;
    }
    setAmount(amount + op);
  };
  
  const handleEqual = () => {
    try {
      const expression = amount
        .replace(/×/g, ' * ')
        .replace(/÷/g, ' / ')
        .replace(/\+/g, ' + ')
        .replace(/-/g, ' - ')
        .trim();
      
      const result = Function(`return ${expression}`)();
      setAmount(Number(result).toFixed(2).toString());
    } catch (error) {
      setAmount('');
    }
  };

  const handleClear = () => {
    setAmount('');
  };

  const handleBackspace = () => {
    if (amount.length > 0) {
      const newAmount = amount.slice(0, -1);
      setAmount(newAmount || '');
    }
  };

  const handleDecimal = () => {
    // If there's an operator in the amount, add decimal to new number
    if(/[/+\-*÷×]/.test(amount)) {
      setAmount(amount + '0.');
      return;
    }
    
    // Don't add decimal if it already exists
    if (amount.includes('.')) {
      return;
    }
    
    // If amount is empty or '0', start with '0.'
    if (amount === '' || amount === '0') {
      setAmount('0.');
    } else {
      setAmount(amount + '.');
    }
  };

  const handleCurrencyChange = (newCurrency) => {
    if (amount && !isNaN(parseFloat(amount))) {
      const originalAmount = parseFloat(amount);
      let rate = 1;
      switch(currency){
        case 'SGD':
          if (newCurrency === 'CNY') rate = 5.41;
          else if (newCurrency === 'MYR') rate = 3.3;
          break;
        case 'MYR':
          if (newCurrency === 'SGD') rate = 0.3;
          else if (newCurrency === 'CNY') rate = 1.60;
          break;
        case 'CNY':
          if (newCurrency === 'SGD') rate = 0.18;
          else if (newCurrency === 'MYR') rate = 0.62;
          break;
      }
      const convertedAmount = originalAmount * rate;
      setAmount(convertedAmount.toFixed(2));
      
      // Record currency conversion
      if (onCurrencyConversion && currency !== newCurrency) {
        const conversion = {
          from: currency,
          to: newCurrency,
          originalAmount: originalAmount.toFixed(2),
          convertedAmount: convertedAmount.toFixed(2),
          rate: rate,
          timestamp: new Date().toLocaleString()
        };
        onCurrencyConversion(conversion);
      }
    }
    setCurrency(newCurrency);
  };

  const handleAmountInputFocus = () => {
    // Check if it's a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // On mobile, blur and show calculator
      document.activeElement.blur();
      setIsCalculatorVisible(true);
    }
    // On desktop, allow direct input
    if (onAmountFocus) onAmountFocus();
  };

  const handleAmountInputChange = (e) => {
    // Allow direct input on desktop
    let value = e.target.value;
    // Only allow numbers, decimal point, and basic operators
    value = value.replace(/[^0-9+\-*/×÷.]/g, '');
    setAmount(value);
  };

  const handleAmountKeyDown = createDoubleSpaceHandler((trimmedValue) => {
    setAmount(trimmedValue);
    focusElement('.payment-section');
  });

  const currencies = ['SGD', 'CNY', 'MYR'];

  return (
    <div className="mobile-calculator-container">
      <div className="amount-input-container">
        <input
          type="text"
          className="mobile-amount-display calculator-btn"
          value={amount}
          onFocus={handleAmountInputFocus}
          onChange={handleAmountInputChange}
          onKeyDown={handleAmountKeyDown}
          placeholder="0.00"
        />
      </div>
      
      <div className="currency-selector">
        {currencies.map(curr => (
          <button 
            key={curr}
            className={`currency-btn ${currency === curr ? 'active' : ''}`} 
            onClick={() => handleCurrencyChange(curr)}
          >
            {curr}
          </button>
        ))}
      </div>

      {isCalculatorVisible && (
        <div 
          className="mobile-calculator-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsCalculatorVisible(false);
            }
          }}
        >
          <div className="mobile-calculator">
            <div className="calculator-header">
              <span className="calculator-title">输入金额</span>
              <button 
                className="calculator-close"
                onClick={() => setIsCalculatorVisible(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="calculator-display">
              {amount || '0'}
            </div>

            <div className="calculator-keypad">
              <button className="calc-btn calc-btn-clear" onClick={handleClear}>C</button>
              <button className="calc-btn calc-btn-backspace" onClick={handleBackspace}>⌫</button>
              <button className="calc-btn calc-btn-operator" onClick={() => handleOperator('÷')}>÷</button>
              <button className="calc-btn calc-btn-operator" onClick={() => handleOperator('×')}>×</button>
              
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('7')}>7</button>
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('8')}>8</button>
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('9')}>9</button>
              <button className="calc-btn calc-btn-operator" onClick={() => handleOperator('-')}>−</button>
              
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('4')}>4</button>
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('5')}>5</button>
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('6')}>6</button>
              <button className="calc-btn calc-btn-operator" onClick={() => handleOperator('+')}>+</button>
              
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('1')}>1</button>
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('2')}>2</button>
              <button className="calc-btn calc-btn-number" onClick={() => handleNumber('3')}>3</button>
              <button className="calc-btn calc-btn-equal" onClick={handleEqual}>=</button>
              
              <button className="calc-btn calc-btn-zero" onClick={() => handleNumber('0')}>0</button>
              <button className="calc-btn calc-btn-number" onClick={handleDecimal}>.</button>
              <button className="calc-btn calc-btn-done" onClick={() => {
                setIsCalculatorVisible(false);
                if (amount && parseFloat(amount) > 0) {
                  // Check if payment method is already selected
                  const paymentSelected = document.querySelector('.selected-payment, .payment-category-btn.selected');
                  
                  setTimeout(() => {
                    if (paymentSelected) {
                      // Payment method already selected, go to remark
                      const remarkInput = document.querySelector('.content-remark, .manual-tag-input');
                      if (remarkInput) {
                        remarkInput.focus();
                      }
                    } else {
                      // No payment method, scroll to payment section
                      const paymentSection = document.querySelector('.payment-section');
                      if (paymentSection) {
                        paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }
                  }, 200);
                  
                  if (onAmountComplete) {
                    onAmountComplete();
                  }
                }
              }}>完成</button>
              <div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileCalculator;
