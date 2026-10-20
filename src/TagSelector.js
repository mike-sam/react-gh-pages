import React, { useState, useRef, useLayoutEffect } from 'react';
import { SECONDARY_TAGS } from './config';
import { createDoubleSpaceHandler, focusElement } from './utils/keyboardNavigation';

function TagSelector({
  input,
  setInput,
  setRemark,
  setAmount,
  selectedTag,
  setSelectedTag,
  tags,
}) {
  const [showManualInput, setShowManualInput] = useState(false);
  /** After cat+subcat chosen, collapse; tap compact bar to expand again */
  const [expanded, setExpanded] = useState(true);
  const manualInputRef = useRef(null);

  const secondaryList =
    selectedTag && SECONDARY_TAGS[selectedTag] ? SECONDARY_TAGS[selectedTag] : [];
  const hasSecondaryList = secondaryList.length > 0;
  const selectionComplete = Boolean(selectedTag && input && input.trim());
  const collapsed = selectionComplete && !expanded;
  const isPresetSubcat = hasSecondaryList && secondaryList.includes(input);

  /** Clear only cat / subcat (section clear) */
  const clearCategory = () => {
    setInput('');
    setShowManualInput(false);
    setSelectedTag('');
    setExpanded(true);
  };

  const handleReset = () => {
    clearCategory();
    setRemark('');
    setAmount('');
  };

  useLayoutEffect(() => {
    if (showManualInput && manualInputRef.current && expanded) {
      focusElement('.manual-tag-input', 120);
    }
  }, [showManualInput, expanded]);

  const commitManualInput = (raw) => {
    const trimmed = (raw ?? input ?? '').trim();
    if (!trimmed) return;
    setInput(trimmed);
    setShowManualInput(false);
    setExpanded(false); // same as picking a preset subcat
    if (window.showCalculator) window.showCalculator();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitManualInput(e.target.value);
      return;
    }
    createDoubleSpaceHandler((trimmedValue) => {
      commitManualInput(trimmedValue);
    })(e);
  };

  const selectTag = (tag) => {
    if (selectedTag === tag) {
      setSelectedTag('');
      setInput('');
      setShowManualInput(false);
      setExpanded(true);
      return;
    }
    setInput('');
    setShowManualInput(tag === '其他');
    setSelectedTag(tag);
    setExpanded(true);
  };

  /** Pick a preset subcat — works anytime, no need to clear manual text first */
  const handleSecondaryTagClick = (tag) => {
    setInput(tag);
    setShowManualInput(false);
    setExpanded(false);
  };

  const openManualInput = () => {
    setShowManualInput(true);
    setExpanded(true);
    // Only wipe when switching away from a preset chip; keep custom text if already typing
    if (isPresetSubcat) setInput('');
  };

  if (collapsed) {
    return (
      <div className="tag-selector-collapsed">
        <button
          type="button"
          className="tag-collapsed-chip"
          onClick={() => setExpanded(true)}
          title="點擊展開重新選擇"
        >
          <span className="tag-collapsed-cat">{selectedTag}</span>
          <span className="tag-collapsed-sep">›</span>
          <span className="tag-collapsed-sub">{input}</span>
          <span className="tag-collapsed-edit">展開</span>
        </button>
        <button type="button" className="tag-collapsed-clear" onClick={clearCategory}>
          清空
        </button>
      </div>
    );
  }

  return (
    <div className="tag-selector-expanded">
      <div className="section-head">
        <span className="section-head-title">分類</span>
        <div className="section-head-actions">
          {selectionComplete && (
            <button
              type="button"
              className="tag-collapse-hint"
              onClick={() => setExpanded(false)}
            >
              收合 ▴
            </button>
          )}
          <button type="button" className="section-clear-btn" onClick={clearCategory}>
            清空
          </button>
        </div>
      </div>

      <div className="tag-container">
        {tags.map((tag) => (
          <div
            key={tag}
            className={`tag ${selectedTag === tag ? 'selected' : ''}`}
            onClick={() => selectTag(tag)}
          >
            {tag}
          </div>
        ))}
      </div>

      <div className="secondary-tags-container">
        {hasSecondaryList ? (
          <ul className="second-tag">
            {secondaryList.map((tag, index) => (
              <li
                className={`tag ${!showManualInput && tag === input ? 'selected' : ''}`}
                key={index}
                // pointerDown before input blur — avoids collapse/unmount eating the click
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleSecondaryTagClick(tag);
                }}
              >
                {tag}
              </li>
            ))}
            <li
              className={`tag manual-input-tag ${showManualInput || (input && !isPresetSubcat) ? 'selected' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault();
                openManualInput();
              }}
            >
              手动输入
            </li>
          </ul>
        ) : selectedTag ? (
          <ul className="second-tag">
            <li
              className="tag manual-input-tag selected"
              onPointerDown={(e) => {
                e.preventDefault();
                openManualInput();
              }}
            >
              手动输入
            </li>
          </ul>
        ) : (
          <p className="help-message">请先选择分类</p>
        )}
      </div>

      {(showManualInput || (selectedTag && !hasSecondaryList) || (input && !isPresetSubcat && selectedTag)) &&
        selectedTag && (
          <div className="input-container grid grid-2">
            <input
              type="text"
              ref={manualInputRef}
              className="manual-tag-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowManualInput(true);
              }}
              onKeyDown={handleKeyDown}
              onBlur={(e) => {
                // 完成輸入後收合（與選 preset 一致）；點其他子分類時由 pointerDown 搶先處理
                if (e.target.value.trim()) {
                  setTimeout(() => {
                    if (document.activeElement?.classList?.contains('manual-tag-input')) return;
                    commitManualInput(e.target.value);
                  }, 120);
                }
              }}
              placeholder="输入自定义子分类，Enter 完成"
              style={{ padding: '10px' }}
            />
            <button type="button" onClick={() => commitManualInput(input)}>
              完成
            </button>
          </div>
        )}
    </div>
  );
}

export default TagSelector;
