import React, { useEffect, useRef, useState } from 'react';
import MobileFriendlyDateTime from './MobileFriendlyDateTime';

function RangeMenu({ side, open, onClose, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, [open, onClose]);

  if (!open) return null;
  const items =
    side === 'start'
      ? [
          { id: '30m', label: '半小時前' },
          { id: '1h', label: '1小時前' },
          { id: 'manual', label: '手動輸入' },
        ]
      : [
          { id: 'now', label: '現在' },
          { id: '30m', label: '半小時後' },
          { id: '1h', label: '1小時後' },
          { id: 'manual', label: '手動輸入' },
        ];

  return (
    <div className={`datetime-range-menu datetime-range-menu--${side}`} ref={ref}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="datetime-range-menu-item"
          onClick={() => onPick(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Idle: center 記帳時間, +開始 / +結束 chips.
 * After a start/end pick: two compact datetime fields side by side.
 *   +開始 → left = chosen start, right = original time as end
 *   +結束 → left = original as start, right = chosen end
 */
function ExpenseDateTimeRow({ value, onChange, eventStart, setEventStart, eventEnd, setEventEnd }) {
  const [menu, setMenu] = useState(null);
  const [manual, setManual] = useState(null);
  const original = value instanceof Date ? value : new Date();
  const inRange = Boolean(eventStart || eventEnd);

  const enterRange = (start, end) => {
    setEventStart(start);
    setEventEnd(end);
    setMenu(null);
    setManual(null);
  };

  const applyPick = (side, id) => {
    if (id === 'manual') {
      setMenu(null);
      setManual(side);
      return;
    }
    if (side === 'start') {
      const ms = id === '1h' ? 60 * 60 * 1000 : 30 * 60 * 1000;
      enterRange(new Date(original.getTime() - ms), new Date(original));
      return;
    }
    if (id === 'now') {
      enterRange(new Date(original), new Date());
      return;
    }
    const ms = id === '1h' ? 60 * 60 * 1000 : 30 * 60 * 1000;
    enterRange(new Date(original), new Date(original.getTime() + ms));
  };

  const applyManual = (next) => {
    if (!(next instanceof Date) || Number.isNaN(next.getTime())) return;
    if (manual === 'start') enterRange(next, new Date(original));
    else if (manual === 'end') enterRange(new Date(original), next);
  };

  const clearRange = () => {
    setEventStart(null);
    setEventEnd(null);
    setMenu(null);
    setManual(null);
  };

  if (inRange) {
    return (
      <div className="datetime-range-row datetime-range-row--split">
        <MobileFriendlyDateTime
          compact
          title="開始"
          value={eventStart || original}
          onChange={setEventStart}
        />
        <MobileFriendlyDateTime
          compact
          title="結束"
          value={eventEnd || original}
          onChange={setEventEnd}
        />
        <button
          type="button"
          className="datetime-range-clear"
          onClick={clearRange}
          aria-label="取消開始／結束，回到單一時段"
          title="取消開始／結束"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="datetime-range-row">
      <div className="datetime-range-side">
        <button
          type="button"
          className="datetime-range-btn"
          onClick={() => setMenu((m) => (m === 'start' ? null : 'start'))}
        >
          +開始
        </button>
        <RangeMenu
          side="start"
          open={menu === 'start'}
          onClose={() => setMenu(null)}
          onPick={(id) => applyPick('start', id)}
        />
      </div>

      <MobileFriendlyDateTime value={value} onChange={onChange} title="記帳時間" />

      <div className="datetime-range-side datetime-range-side--end">
        <button
          type="button"
          className="datetime-range-btn"
          onClick={() => setMenu((m) => (m === 'end' ? null : 'end'))}
        >
          +結束
        </button>
        <RangeMenu
          side="end"
          open={menu === 'end'}
          onClose={() => setMenu(null)}
          onPick={(id) => applyPick('end', id)}
        />
      </div>

      {manual ? (
        <MobileFriendlyDateTime
          hideTrigger
          autoOpen
          title={manual === 'start' ? '開始時間' : '結束時間'}
          value={
            manual === 'start'
              ? new Date(original.getTime() - 30 * 60 * 1000)
              : new Date()
          }
          onChange={applyManual}
          onDismiss={() => setManual(null)}
        />
      ) : null}
    </div>
  );
}

export default ExpenseDateTimeRow;
