import React, { useState } from 'react';

const NumberPad = ({ value, onChange, placeholder = "输入数字", label, allowDecimal = false }) => {
  const [displayValue, setDisplayValue] = useState(value || '');

  const handleNumberClick = (number) => {
    if (number === '.' && (!allowDecimal || displayValue.includes('.'))) {
      return; // 不允许小数或已有小数点
    }
    
    const newValue = displayValue + number;
    setDisplayValue(newValue);
    onChange({ target: { value: newValue } });
  };

  const handleBackspace = () => {
    const newValue = displayValue.slice(0, -1);
    setDisplayValue(newValue);
    onChange({ target: { value: newValue } });
  };

  const handleClear = () => {
    setDisplayValue('');
    onChange({ target: { value: '' } });
  };

  const handleDirectInput = (e) => {
    let newValue = e.target.value;
    if (!allowDecimal) {
      newValue = newValue.replace(/[^\d]/g, ''); // Only allow digits
    } else {
      newValue = newValue.replace(/[^\d.]/g, ''); // Allow digits and decimal
    }
    setDisplayValue(newValue);
    onChange({ target: { value: newValue } });
  };

  return (
    <div className="number-pad-container">
      {label && <label className="unified-label">{label}</label>}
      <input
        type="text"
        value={displayValue}
        onChange={handleDirectInput}
        placeholder={placeholder}
        className="unified-input number-display"
        inputMode="none" // Prevents mobile keyboard
      />
      
      <div className="number-pad">
        <div className="number-pad-main">
          <div className="scrollable-numbers">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
              <button
                key={num}
                type="button"
                className="num-btn"
                onClick={() => handleNumberClick(num.toString())}
              >
                {num}
              </button>
            ))}
            {allowDecimal && (
              <button
                type="button"
                className="num-btn"
                onClick={() => handleNumberClick('.')}
              >
                .
              </button>
            )}
          </div>
          
          <div className="fixed-actions">
            <button
              type="button"
              className="num-btn num-backspace-btn"
              onClick={handleBackspace}
            >
              ⌫
            </button>
            
            <button
              type="button"
              className="num-btn num-clear-btn"
              onClick={handleClear}
            >
              ⌫
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NumberPad;
