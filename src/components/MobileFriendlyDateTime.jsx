import React, { useEffect, useMemo, useRef, useState } from 'react';
import WheelPicker from './WheelPicker';

const HOUR_ORDER = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const MobileFriendlyDateTime = ({ value = new Date(), onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempDate, setTempDate] = useState(value);
  const snapshotRef = useRef(null);
  const prevHourRef = useRef(null);
  const swipeRef = useRef({ x: 0, y: 0, axis: null, moved: false });
  const dateSwipePadRef = useRef(null);
  const nativeDateRef = useRef(null);
  const tempDateRef = useRef(tempDate);
  tempDateRef.current = tempDate;

  const applyTemp = (next) => {
    setTempDate(next);
    if (isEditing) onChange?.(new Date(next));
  };

  const patchDate = (mutator) => {
    const next = new Date(tempDate);
    mutator(next);
    applyTemp(next);
  };

  useEffect(() => {
    if (!isEditing) setTempDate(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (!isEditing) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevent = (e) => {
      if (e.target.closest?.('.datetime-editor')) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('touchmove', prevent);
    };
  }, [isEditing]);

  // Center pad: ←→ day, ↑↓ month; tap opens native date picker
  useEffect(() => {
    if (!isEditing) return undefined;
    const el = dateSwipePadRef.current;
    if (!el) return undefined;

    const onStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      swipeRef.current = { x: t.clientX, y: t.clientY, axis: null, moved: false };
    };
    const onMove = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      const dx = t.clientX - swipeRef.current.x;
      const dy = t.clientY - swipeRef.current.y;
      if (!swipeRef.current.axis) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        swipeRef.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        swipeRef.current.moved = true;
      }
      e.preventDefault();
    };
    const onEnd = (e) => {
      const t = e.changedTouches?.[0];
      if (!t || !swipeRef.current.axis) {
        swipeRef.current.axis = null;
        return;
      }
      const dx = t.clientX - swipeRef.current.x;
      const dy = t.clientY - swipeRef.current.y;
      const next = new Date(tempDateRef.current);
      if (swipeRef.current.axis === 'x' && Math.abs(dx) > 40) {
        next.setDate(next.getDate() + (dx < 0 ? 1 : -1));
        applyTemp(next);
      } else if (swipeRef.current.axis === 'y' && Math.abs(dy) > 40) {
        next.setMonth(next.getMonth() + (dy < 0 ? 1 : -1));
        applyTemp(next);
      }
      swipeRef.current.axis = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const getGmtLabel = (date) => {
    const offsetMin = -date.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m === 0 ? `GMT${sign}${h}` : `GMT${sign}${h}:${String(m).padStart(2, '0')}`;
  };

  const formatDisplayDateTime = (date) => {
    const options = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    const formatted = date.toLocaleString('en-US', options);
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    return `${formatted} (${dayOfWeek}) ${getGmtLabel(date)}`;
  };

  const getDayOfWeekShort = (date) =>
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

  const toNativeDateValue = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const openNativeDatePicker = () => {
    const input = nativeDateRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch {
      input.click();
    }
  };

  const onCenterActivate = () => {
    // Ignore tap that was actually a swipe
    if (swipeRef.current.moved) {
      swipeRef.current.moved = false;
      return;
    }
    openNativeDatePicker();
  };

  const onNativeDateChange = (e) => {
    const raw = e.target.value;
    if (!raw) return;
    const [y, m, d] = raw.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return;
    patchDate((dt) => {
      dt.setFullYear(y, m - 1, d);
    });
  };

  const quickTimeOptions = [
    { label: '现在', getValue: () => new Date() },
    { label: '1小时前', getValue: () => new Date(Date.now() - 60 * 60 * 1000) },
    {
      label: '今天早上9点',
      getValue: () => {
        const today = new Date();
        today.setHours(9, 0, 0, 0);
        return today;
      },
    },
    {
      label: '昨天',
      getValue: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
      },
    },
  ];

  const quickMinuteOptions = ['00', '15', '30', '45'];
  const hour12Opts = useMemo(
    () => HOUR_ORDER.map((h) => ({ value: String(h), label: String(h) })),
    []
  );
  const minuteOpts = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        value: String(i),
        label: String(i).padStart(2, '0'),
      })),
    []
  );
  const ampmOpts = [
    { value: 'AM', label: 'AM' },
    { value: 'PM', label: 'PM' },
  ];

  const getCurrentHour12 = () => {
    const hour = tempDate.getHours();
    return hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  };
  const isAM = () => tempDate.getHours() < 12;

  /** 11↔12 跨越時切換 AM/PM（雙向：AM→PM 與 PM→AM） */
  const setHour12 = (h12) => {
    const nextH = parseInt(h12, 10);
    const prevH = prevHourRef.current ?? getCurrentHour12();
    let am = isAM();
    if ((prevH === 11 && nextH === 12) || (prevH === 12 && nextH === 11)) {
      am = !am;
    }
    prevHourRef.current = nextH;
    patchDate((d) => {
      let hour24;
      if (nextH === 12) hour24 = am ? 0 : 12;
      else hour24 = am ? nextH : nextH + 12;
      d.setHours(hour24);
    });
  };

  const setAmpm = (v) => {
    patchDate((d) => {
      const h = d.getHours();
      if (v === 'AM' && h >= 12) d.setHours(h - 12);
      if (v === 'PM' && h < 12) d.setHours(h + 12);
    });
  };

  const openEditor = () => {
    snapshotRef.current = new Date(value);
    const hour = value.getHours();
    prevHourRef.current = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    setTempDate(new Date(value));
    setIsEditing(true);
  };

  const handleConfirm = () => {
    onChange(new Date(tempDate));
    setIsEditing(false);
    snapshotRef.current = null;
  };

  const handleCancel = () => {
    if (snapshotRef.current) onChange(new Date(snapshotRef.current));
    setTempDate(snapshotRef.current || value);
    setIsEditing(false);
    snapshotRef.current = null;
  };

  const dateLabel = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')} ${getDayOfWeekShort(tempDate)}`;

  return (
    <div className="mobile-datetime-picker">
      <button type="button" className="datetime-inline-btn" onClick={openEditor}>
        <span className="action-icon">⏰</span>
        <span className="action-name">編輯時間</span>
        <span className="datetime-inline-value">{formatDisplayDateTime(value)}</span>
      </button>

      {isEditing && (
        <div
          className="datetime-editor-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div className="datetime-editor" onClick={(e) => e.stopPropagation()}>
            <div className="editor-header">
              <h4>編輯時間</h4>
              <button type="button" className="close-btn" onClick={handleCancel}>
                ×
              </button>
            </div>

            <div className="quick-options">
              <h5>速選</h5>
              <div className="quick-buttons">
                {quickTimeOptions.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    className="quick-btn"
                    onClick={() => applyTemp(option.getValue())}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="date-section">
              <h5>日期</h5>
              <div className="date-adjust-cross">
                <button
                  type="button"
                  className="date-cross-btn date-cross-btn--up"
                  onClick={() => patchDate((d) => d.setMonth(d.getMonth() - 1))}
                  title="上個月"
                >
                  <span className="date-cross-arrow">▲</span>
                  <span className="date-cross-caption">上個月</span>
                </button>

                <button
                  type="button"
                  className="date-cross-btn date-cross-btn--left"
                  onClick={() => patchDate((d) => d.setDate(d.getDate() - 1))}
                  title="昨天"
                >
                  <span className="date-cross-arrow">◀</span>
                  <span className="date-cross-caption">昨天</span>
                </button>

                <div
                  className="date-swipe-pad"
                  ref={dateSwipePadRef}
                  role="button"
                  tabIndex={0}
                  onClick={onCenterActivate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onCenterActivate();
                    }
                  }}
                  title="點擊開啟日期選擇"
                >
                  <div className="date-swipe-main">{dateLabel}</div>
                  <div className="date-swipe-hint">
                    支援上下左右滑動、按鈕 或 點此選擇
                  </div>
                  <input
                    ref={nativeDateRef}
                    type="date"
                    className="date-native-input"
                    value={toNativeDateValue(tempDate)}
                    onChange={onNativeDateChange}
                    tabIndex={-1}
                    aria-hidden
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <button
                  type="button"
                  className="date-cross-btn date-cross-btn--right"
                  onClick={() => patchDate((d) => d.setDate(d.getDate() + 1))}
                  title="明天"
                >
                  <span className="date-cross-arrow">▶</span>
                  <span className="date-cross-caption">明天</span>
                </button>

                <button
                  type="button"
                  className="date-cross-btn date-cross-btn--down"
                  onClick={() => patchDate((d) => d.setMonth(d.getMonth() + 1))}
                  title="下個月"
                >
                  <span className="date-cross-arrow">▼</span>
                  <span className="date-cross-caption">下個月</span>
                </button>
              </div>
            </div>

            <div className="time-section">
              <h5>時間</h5>
              <div className="time-wheels-row">
                <WheelPicker
                  className="time-wheel time-wheel-hour"
                  axis="y"
                  options={hour12Opts}
                  value={String(getCurrentHour12())}
                  onChange={setHour12}
                  ariaLabel="小時"
                />
                <span className="time-wheel-colon">:</span>
                <WheelPicker
                  className="time-wheel time-wheel-min"
                  axis="y"
                  options={minuteOpts}
                  value={String(tempDate.getMinutes())}
                  onChange={(m) => patchDate((d) => d.setMinutes(parseInt(m, 10)))}
                  ariaLabel="分鐘"
                />
                <WheelPicker
                  className="time-wheel time-wheel-ampm"
                  axis="y"
                  options={ampmOpts}
                  value={isAM() ? 'AM' : 'PM'}
                  onChange={setAmpm}
                  infinite={false}
                  ariaLabel="AM/PM"
                />
              </div>

              <div className="quick-minutes">
                <span>速選分鐘</span>
                {quickMinuteOptions.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    className={`minute-btn ${tempDate.getMinutes() === parseInt(minute, 10) ? 'active' : ''}`}
                    onClick={() => patchDate((d) => d.setMinutes(parseInt(minute, 10)))}
                  >
                    {minute}
                  </button>
                ))}
              </div>
            </div>

            <div className="editor-actions">
              <button type="button" className="cancel-btn" onClick={handleCancel}>
                取消還原
              </button>
              <button type="button" className="confirm-btn" onClick={handleConfirm}>
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileFriendlyDateTime;
