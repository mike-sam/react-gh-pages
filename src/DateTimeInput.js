import React, { useState } from 'react';
import moment from 'moment';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';

function DateTimeInput({ value, onChange }) {
  const [inputValue, setInputValue] = useState(moment(value).format('YYYY-MM-DD HH:mm:ss'));
  const [isValid, setIsValid] = useState(true);
  
  const validateTime = (timeStr) => {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours >= 0 && hours <= 23 && 
           minutes >= 0 && minutes <= 59 && 
           seconds >= 0 && seconds <= 59;
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const momentDate = moment(newValue);
    const valid = momentDate.isValid() && validateTime(momentDate.format('HH:mm:ss'));
    setIsValid(valid);
    
    if (valid) {
      onChange(momentDate.toDate());
    }
  };

  const handlePickerChange = (momentDate) => {
    if (moment.isMoment(momentDate) && momentDate.isValid()) {
      const timeStr = momentDate.format('HH:mm:ss');
      const valid = validateTime(timeStr);
      setIsValid(valid);
      
      if (valid) {
        setInputValue(momentDate.format('YYYY-MM-DD HH:mm:ss'));
        onChange(momentDate.toDate());
      }
    }
  };

  const renderTimeInput = (type, value, onChange) => {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const newValue = parseInt(e.target.value, 10);
          if (!isNaN(newValue)) {
            onChange(newValue);
          }
        }}
        min={type === 'hours' ? 0 : 0}
        max={type === 'hours' ? 23 : 59}
        className="rdtCount"
      />
    );
  };
  const inputStyle = {
    border: isValid ? '1px solid #ccc' : '1px solid red',
    backgroundColor: isValid ? 'white' : '#fff0f0'
  };

  return (
    <Datetime
      value={inputValue}
      onChange={handlePickerChange}
      inputProps={{
        value: inputValue,
        onChange: handleInputChange,
        className: 'datetime-picker',
        style: inputStyle
      }}
      dateFormat="YYYY-MM-DD"
      timeFormat="HH:mm:ss"
      closeOnSelect={false}
      strictParsing={true}
      renderHour={(props, value) => renderTimeInput('hours', value, props.onChange)}
      renderMinute={(props, value) => renderTimeInput('minutes', value, props.onChange)}
      renderSecond={(props, value) => renderTimeInput('seconds', value, props.onChange)}
    />
  );
}

export default DateTimeInput;