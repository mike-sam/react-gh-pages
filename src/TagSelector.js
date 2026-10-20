import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { SECONDARY_TAGS } from './config';
import { createDoubleSpaceHandler, focusElement } from './utils/keyboardNavigation';

const COLLAPSE_MS = 220;

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
  /** expanded | collapsing | collapsed */
  const [phase, setPhase] = useState('expanded');
  const manualInputRef = useRef(null);
  const collapseTimer = useRef(null);

  const secondaryList =
    selectedTag && SECONDARY_TAGS[selectedTag] ? SECONDARY_TAGS[selectedTag] : [];
  const hasSecondaryList = secondaryList.length > 0;
  const selectionComplete = Boolean(selectedTag && input && input.trim());
  const isPresetSubcat = hasSecondaryList && secondaryList.includes(input);
  const collapsed = phase === 'collapsed';
  const collapsing = phase === 'collapsing';

  useEffect(() => () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
  }, []);

  const requestCollapse = () => {
    if (phase === 'collapsing' || phase === 'collapsed') return;
    setPhase('collapsing');
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => {
      setPhase('collapsed');
      collapseTimer.current = null;
    }, COLLAPSE_MS);
  };

  const requestExpand = () => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    setPhase('expanded');
  };

  /** Clear only cat / subcat (section clear) */
  const clearCategory = () => {
    setInput('');
    setShowManualInput(false);
    setSelectedTag('');
    requestExpand();
  };

  useLayoutEffect(() => {
    if (showManualInput && manualInputRef.current && phase === 'expanded') {
      focusElement('.manual-tag-input', 120);
    }
  }, [showManualInput, phase]);

  const commitManualInput = (raw) => {
    const trimmed = (raw ?? input ?? '').trim();
    if (!trimmed) return;
    setInput(trimmed);
    setShowManualInput(false);
    requestCollapse();
    if (window.showCalculator) {
      window.setTimeout(() => window.showCalculator?.(), COLLAPSE_MS);
    }
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
      requestExpand();
      return;
    }
    setInput('');
    setShowManualInput(tag === '其他');
    setSelectedTag(tag);
    requestExpand();
  };

  /** Pick a preset subcat — works anytime, no need to clear manual text first */
  const handleSecondaryTagClick = (tag) => {
    setInput(tag);
    setShowManualInput(false);
    requestCollapse();
    if (window.showCalculator) {
      window.setTimeout(() => window.showCalculator?.(), COLLAPSE_MS);
    }
  };

  const openManualInput = () => {
    setShowManualInput(true);
    requestExpand();
    if (isPresetSubcat) setInput('');
  };

  if (collapsed && selectionComplete) {
    return (
      <div className="tag-selector-collapsed tag-selector-collapsed--enter">
        <button
          type="button"
          className="tag-collapsed-chip"
          onClick={requestExpand}
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
    <div
      className={`tag-selector-expanded${collapsing ? ' is-collapsing' : ''}`}
      aria-busy={collapsing}
    >
      <div className="section-head">
        <span className="section-head-title">分類</span>
        <div className="section-head-actions">
          {selectionComplete && !collapsing && (
            <button
              type="button"
              className="tag-collapse-hint"
              onClick={requestCollapse}
            >
              收合 ▴
            </button>
          )}
          <button type="button" className="section-clear-btn" onClick={clearCategory}>
            清空
          </button>
        </div>
      </div>

      <div className="tag-level tag-level--cat">
        <div className="tag-level-label">主分類</div>
        <div className="tag-container tag-container--cats">
          {tags.map((tag) => (
            <button
              type="button"
              key={tag}
              className={`tag tag--cat${selectedTag === tag ? ' selected' : ''}`}
              onClick={() => selectTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="tag-level tag-level--sub">
        <div className="tag-level-label">子分類</div>
        <div className="secondary-tags-container">
          {hasSecondaryList ? (
            <ul className="second-tag">
              {secondaryList.map((tag, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className={`tag tag--sub${!showManualInput && tag === input ? ' selected' : ''}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleSecondaryTagClick(tag);
                    }}
                  >
                    {tag}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className={`tag tag--sub tag--manual${showManualInput || (input && !isPresetSubcat) ? ' selected' : ''}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    openManualInput();
                  }}
                >
                  手动输入
                </button>
              </li>
            </ul>
          ) : selectedTag ? (
            <ul className="second-tag">
              <li>
                <button
                  type="button"
                  className="tag tag--sub tag--manual selected"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    openManualInput();
                  }}
                >
                  手动输入
                </button>
              </li>
            </ul>
          ) : (
            <p className="help-message help-message--tag">请先选择主分類</p>
          )}
        </div>
      </div>

      {(showManualInput || (selectedTag && !hasSecondaryList) || (input && !isPresetSubcat && selectedTag)) &&
        selectedTag && (
          <div className="tag-manual-row">
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
                if (e.target.value.trim()) {
                  setTimeout(() => {
                    if (document.activeElement?.classList?.contains('manual-tag-input')) return;
                    commitManualInput(e.target.value);
                  }, 120);
                }
              }}
              placeholder="输入自定义子分类，Enter 完成"
            />
            <button
              type="button"
              className="tag-manual-done"
              onClick={() => commitManualInput(input)}
            >
              完成
            </button>
          </div>
        )}
    </div>
  );
}

export default TagSelector;
