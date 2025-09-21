import React from 'react';

const UnifiedInput = ({ 
  type = 'text', 
  value, 
  onChange, 
  placeholder, 
  className = '',
  label,
  ...props 
}) => {
  return (
    <div className="unified-input-container">
      {label && <label className="unified-label">{label}</label>}
      <input 
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`unified-input ${className}`}
        {...props}
      />
    </div>
  );
};

export default UnifiedInput;
