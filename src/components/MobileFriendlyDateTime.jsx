import React, { useState } from 'react';

const MobileFriendlyDateTime = ({ value = new Date(), onChange }) => {
  const [isEditing, setIsEditing] = useState(null); // null, 'date', 'time'
  const [tempDate, setTempDate] = useState(value);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDisplayDateTime = (date) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    const formatted = date.toLocaleString('zh-CN', options);
    const dayOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    return `${formatted} (${dayOfWeek})`;
  };

  const quickTimeOptions = [
    { label: '现在', getValue: () => new Date() },
    { label: '1小时前', getValue: () => new Date(Date.now() - 60 * 60 * 1000) },
    { label: '今天早上9点', getValue: () => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      return today;
    }},
    { label: '昨天', getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }}
  ];

  const quickMinuteOptions = ['00', '15', '30', '45'];
  const hourOptions = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value);
    newDate.setHours(tempDate.getHours(), tempDate.getMinutes());
    setTempDate(newDate);
  };

  const handleTimeChange = (e) => {
    const [hours, minutes] = e.target.value.split(':');
    const newDate = new Date(tempDate);
    newDate.setHours(parseInt(hours), parseInt(minutes));
    setTempDate(newDate);
  };

  const handleQuickTime = (quickOption) => {
    const newDate = quickOption.getValue();
    setTempDate(newDate);
    // Don't close immediately, let user fine-tune
  };

  const handleQuickMinute = (minute) => {
    const newDate = new Date(tempDate);
    newDate.setMinutes(parseInt(minute));
    setTempDate(newDate);
  };

  const handleDateAdjust = (days) => {
    const newDate = new Date(tempDate);
    newDate.setDate(newDate.getDate() + days);
    setTempDate(newDate);
  };

  const handleHourSelect = (hour) => {
    const newDate = new Date(tempDate);
    let hour24 = hour;
    
    // Convert 12-hour to 24-hour if needed
    if (hour === 12) {
      hour24 = tempDate.getHours() >= 12 ? 12 : 0;
    } else {
      hour24 = tempDate.getHours() >= 12 ? hour + 12 : hour;
    }
    
    newDate.setHours(hour24);
    setTempDate(newDate);
  };

  // AM/PM切换逻辑已合并到按钮中

  const getCurrentHour12 = () => {
    const hour = tempDate.getHours();
    return hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  };

  const isAM = () => tempDate.getHours() < 12;

  const handleConfirm = () => {
    onChange(tempDate);
    setIsEditing(null);
  };

  const handleCancel = () => {
    setTempDate(value);
    setIsEditing(null);
  };

  return (
    <div className="mobile-datetime-picker">
      {/* 显示当前时间 */}
      <div className="datetime-display" onClick={() => setIsEditing('date')}>
        <span className="datetime-label">时间:</span>
        <span className="datetime-value">{formatDisplayDateTime(value)}</span>
        <span className="edit-icon">✏️</span>
      </div>

      {/* 编辑弹窗 */}
      {isEditing && (
        <div className="datetime-editor-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCancel();
        }}>
          <div className="datetime-editor">
            <div className="editor-header">
              <h4>选择时间</h4>
              <button className="close-btn" onClick={handleCancel}>×</button>
            </div>

            {/* 快速选项 */}
            <div className="quick-options">
              <h5>快速选择:</h5>
              <div className="quick-buttons">
                {quickTimeOptions.map((option, index) => (
                  <button
                    key={index}
                    className="quick-btn"
                    onClick={() => handleQuickTime(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 日期选择 */}
            <div className="date-section">
              <label>日期:</label>
              <div className="date-input-wrapper">
                <button 
                  type="button"
                  className="date-adjust-btn"
                  onClick={() => {
                    const newDate = new Date(tempDate);
                    newDate.setMonth(newDate.getMonth() - 1);
                    setTempDate(newDate);
                  }}
                >
                  ≪
                </button>
                <button 
                  type="button"
                  className="date-adjust-btn"
                  onClick={() => handleDateAdjust(-1)}
                >
                  ＜
                </button>
                <input
                  type="date"
                  value={formatDate(tempDate)}
                  onChange={handleDateChange}
                  className="date-input"
                />
                <button 
                  type="button"
                  className="date-adjust-btn"
                  onClick={() => handleDateAdjust(1)}
                >
                  ＞
                </button>
                <button 
                  type="button"
                  className="date-adjust-btn"
                  onClick={() => {
                    const newDate = new Date(tempDate);
                    newDate.setMonth(newDate.getMonth() + 1);
                    setTempDate(newDate);
                  }}
                >
                  ≫
                </button>
              </div>
            </div>

            {/* 时间选择 */}
            <div className="time-section">
              <label>时间:</label>
              
              {/* 12小时制小时选择 */}
              <div className="hour-selector">
                <span className="hour-label">小时:</span>
                <div className="hour-buttons-scroll">
                  {hourOptions.map((hour) => (
                    <button
                      key={hour}
                      className={`hour-btn ${getCurrentHour12() === hour ? 'active' : ''}`}
                      onClick={() => handleHourSelect(hour)}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="time-inputs">
                <div className="time-input-row">
                  <input
                    type="time"
                    value={formatTime(tempDate)}
                    onChange={handleTimeChange}
                    className="time-input"
                  />
                  
                  {/* AM/PM 选择 */}
                  <div className="ampm-selector">
                    <button
                      type="button"
                      className={`ampm-btn ${isAM() ? 'active' : ''}`}
                      onClick={() => {
                        const newDate = new Date(tempDate);
                        newDate.setHours(newDate.getHours() < 12 ? newDate.getHours() + 12 : newDate.getHours() - 12);
                        setTempDate(newDate);
                      }}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      className={`ampm-btn ${!isAM() ? 'active' : ''}`}
                      onClick={() => {
                        const newDate = new Date(tempDate);
                        newDate.setHours(newDate.getHours() >= 12 ? newDate.getHours() - 12 : newDate.getHours() + 12);
                        setTempDate(newDate);
                      }}
                    >
                      PM
                    </button>
                  </div>
                </div>
                
                {/* 快速分钟选择 */}
                <div className="quick-minutes">
                  <span>快速分钟:</span>
                  {quickMinuteOptions.map((minute) => (
                    <button
                      key={minute}
                      className={`minute-btn ${tempDate.getMinutes() === parseInt(minute) ? 'active' : ''}`}
                      onClick={() => handleQuickMinute(minute)}
                    >
                      {minute}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 确认按钮 */}
            <div className="editor-actions">
              <button className="cancel-btn" onClick={handleCancel}>
                取消
              </button>
              <button className="confirm-btn" onClick={handleConfirm}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileFriendlyDateTime;
