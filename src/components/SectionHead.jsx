import React from 'react';

/** Section title + optional leading slot (e.g. camera) + top-right clear */
function SectionHead({ title, onClear, clearLabel = '清空', leading = null }) {
  return (
    <div className="section-head">
      <span className="section-head-title">{title}</span>
      <div className="section-head-actions">
        {leading}
        {onClear && (
          <button type="button" className="section-clear-btn" onClick={onClear}>
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default SectionHead;
