import React, { useEffect, useState } from 'react';

/**
 * Compact number pad — reveals inline (not modal) on field tap.
 * Once open, stays until resetKey changes (category switch / submit clear).
 */
const NumberPad = ({
  value,
  onChange,
  placeholder = '输入数字',
  label,
  allowDecimal = false,
  disabled = false,
  resetKey = '',
}) => {
  const [displayValue, setDisplayValue] = useState(value || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value !== undefined) setDisplayValue(value || '');
  }, [value]);

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

  const emit = (newValue) => {
    setDisplayValue(newValue);
    onChange({ target: { value: newValue } });
  };

  const handleNumberClick = (number) => {
    if (number === '.' && (!allowDecimal || displayValue.includes('.'))) return;
    emit(displayValue + number);
  };

  const handleBackspace = () => emit(displayValue.slice(0, -1));
  const handleClear = () => emit('');

  const openPad = () => {
    if (!disabled) setOpen(true);
  };

  const keys = allowDecimal
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''];

  return (
    <div
      className={`number-pad-container number-pad-container--grid${open ? ' is-pad-open' : ''}`}
    >
      <div className="number-pad-head">
        {label ? <label className="unified-label">{label}</label> : <span />}
        {open && (
          <button type="button" className="section-clear-btn" onClick={handleClear} title="清空">
            清空
          </button>
        )}
      </div>
      <input
        type="text"
        value={displayValue}
        readOnly
        onFocus={openPad}
        onClick={openPad}
        placeholder={placeholder}
        className={`unified-input number-display${open ? ' is-active' : ''}`}
        inputMode="none"
        disabled={disabled}
        aria-expanded={open}
      />

      <div
        className={`number-pad-reveal${open ? ' is-visible' : ''}`}
        aria-hidden={!open}
      >
        <div className="number-pad-reveal-inner">
          <div className="number-pad-grid">
            {keys.map((key, idx) => {
              if (!key) return <div key={`empty-${idx}`} className="num-btn-spacer" />;
              return (
                <button
                  key={`${key}-${idx}`}
                  type="button"
                  className={`num-btn${key === '⌫' ? ' num-backspace-btn' : ''}`}
                  tabIndex={open ? 0 : -1}
                  onClick={() => {
                    if (key === '⌫') handleBackspace();
                    else handleNumberClick(key);
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NumberPad;
