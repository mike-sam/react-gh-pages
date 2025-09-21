import React, { useState } from 'react';

const MileageNumberPad = ({ value, onChange, placeholder = "里程数" }) => {
  const [displayValue, setDisplayValue] = useState(value || '');

  const handleNumberClick = (number) => {
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
    const newValue = e.target.value.replace(/[^\d]/g, ''); // Only allow digits
    setDisplayValue(newValue);
    onChange({ target: { value: newValue } });
  };

  return (
    <div className="mileage-numberpad-container">
      <label className="unified-label">里程数</label>
      <input
        type="text"
        value={displayValue}
        onChange={handleDirectInput}
        placeholder={placeholder}
        className="unified-input mileage-display"
        inputMode="none" // Prevents mobile keyboard
      />
      
      <div className="mileage-numberpad">
        <div className="mileage-row">
          {[1, 2, 3, 4, 5].map(num => (
            <button
              key={num}
              type="button"
              className="mileage-num-btn"
              onClick={() => handleNumberClick(num.toString())}
            >
              {num}
            </button>
          ))}
        </div>
        
        <div className="mileage-row">
          {[6, 7, 8, 9].map(num => (
            <button
              key={num}
              type="button"
              className="mileage-num-btn"
              onClick={() => handleNumberClick(num.toString())}
            >
              {num}
            </button>
          ))}
          
          <button
            type="button"
            className="mileage-num-btn"
            onClick={() => handleNumberClick('0')}
          >
            0
          </button>
          
          <button
            type="button"
            className="mileage-num-btn mileage-clear-btn"
            onClick={handleClear}
          >
            清除
          </button>
        </div>
      </div>
    </div>
  );
};

export default MileageNumberPad;
