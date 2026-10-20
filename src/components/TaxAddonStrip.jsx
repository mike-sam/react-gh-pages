import React, { useEffect, useMemo, useState } from 'react';
import WheelPicker from './WheelPicker';

const TAX_TYPES = [
  { value: 'SST', label: 'SST', defaultPct: 6 },
  { value: 'GST', label: 'GST', defaultPct: 9 },
  { value: 'SERVICE', label: '服務費', defaultPct: 10 },
  { value: 'OTHER', label: '其他', defaultPct: 10 },
];

const PCT_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  return { value: String(n), label: `${n}%` };
});

/**
 * Fee addons as tags (not written into remark).
 * - 記錄已含: tag only, final = base
 * - 加計最終額: compound for final amount; main input unchanged
 * Submit: concat selected tags via formatTaxAddonTags()
 */
function TaxAddonStrip({ amount, addons = [], setAddons }) {
  const [taxType, setTaxType] = useState('SST');
  const [pct, setPct] = useState('6');

  const typeOpts = useMemo(
    () => TAX_TYPES.map((t) => ({ value: t.value, label: t.label })),
    []
  );

  useEffect(() => {
    const t = TAX_TYPES.find((x) => x.value === taxType);
    if (t) setPct(String(t.defaultPct));
  }, [taxType]);

  const base = useMemo(() => {
    let raw = amount || '';
    if (/[/+\-*÷×]/.test(raw)) {
      try {
        const expression = raw
          .replace(/×/g, ' * ')
          .replace(/÷/g, ' / ')
          .replace(/\+/g, ' + ')
          .replace(/-/g, ' - ')
          .trim();
        raw = Number(Function(`return ${expression}`)()).toFixed(2);
      } catch {
        return 0;
      }
    }
    const n = parseFloat(raw);
    return !n || Number.isNaN(n) ? 0 : n;
  }, [amount]);

  const finalAmount = useMemo(() => {
    return addons.reduce((acc, a) => {
      if (a.included) return acc;
      return acc * (1 + a.pct / 100);
    }, base);
  }, [addons, base]);

  const typeLabel = (type) => TAX_TYPES.find((t) => t.value === type)?.label || type;

  const addFee = (included) => {
    if (addons.some((a) => a.type === taxType)) return;
    const rate = parseInt(pct, 10);
    if (!rate) return;
    // SST / GST 互斥（通常不會同時）
    let next = addons;
    if (taxType === 'SST') next = next.filter((a) => a.type !== 'GST');
    if (taxType === 'GST') next = next.filter((a) => a.type !== 'SST');

    setAddons([...next, { type: taxType, pct: rate, included }]);
  };

  const removeFee = (type) => {
    setAddons(addons.filter((a) => a.type !== type));
  };

  const already = addons.some((a) => a.type === taxType);
  const hasAdditive = addons.some((a) => !a.included);
  const showFinal = base > 0 && (hasAdditive || addons.length > 0);

  return (
    <div className="tax-addon-strip tax-addon-strip--wheels">
      <div className="tax-addon-wheels">
        <WheelPicker
          className="tax-type-wheel"
          axis="y"
          options={typeOpts}
          value={taxType}
          onChange={setTaxType}
          ariaLabel="稅費類型"
        />
        <WheelPicker
          className="tax-pct-wheel"
          axis="y"
          options={PCT_OPTIONS}
          value={pct}
          onChange={setPct}
          ariaLabel="百分比"
        />
      </div>
      <div className="tax-addon-actions">
        <button
          type="button"
          className="tax-addon-btn tax-addon-btn--soft"
          disabled={already || base <= 0}
          onClick={() => addFee(true)}
          title="金額已含此費，僅標記 tag"
        >
          記錄已含
        </button>
        <button
          type="button"
          className="tax-addon-btn"
          disabled={already || base <= 0}
          onClick={() => addFee(false)}
          title="在下方最終金額加計，不改上方輸入"
        >
          加計最終額
        </button>
      </div>

      {addons.length > 0 && (
        <div className="tax-addon-chips">
          {addons.map((a) => (
            <button
              key={a.type}
              type="button"
              className={`tax-addon-chip${a.included ? ' is-included' : ''}`}
              onClick={() => removeFee(a.type)}
              title="點擊移除"
            >
              {a.included ? '含' : '+'}
              {a.pct}%{typeLabel(a.type)} ×
            </button>
          ))}
        </div>
      )}

      {showFinal && (
        <div className="tax-final-amount">
          {hasAdditive ? (
            <>
              最終金額 <strong>{finalAmount.toFixed(2)}</strong>
              <span className="tax-final-hint">（輸入 {base.toFixed(2)} 未改）</span>
            </>
          ) : (
            <>
              金額 <strong>{base.toFixed(2)}</strong>
              <span className="tax-final-hint">（費用已含，未加計）</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function computeFinalAmount(amount, addons = []) {
  let base = parseFloat(amount);
  if (!base || Number.isNaN(base)) return amount;
  const next = addons.reduce((acc, a) => {
    if (a.included) return acc;
    return acc * (1 + a.pct / 100);
  }, base);
  return next.toFixed(2);
}

/** e.g. "含6%SST|+10%服務費" for AJAX payload */
export function formatTaxAddonTags(addons = []) {
  return addons
    .map((a) => {
      const label = TAX_TYPES.find((t) => t.value === a.type)?.label || a.type;
      return a.included ? `含${a.pct}%${label}` : `+${a.pct}%${label}`;
    })
    .join('|');
}

export default TaxAddonStrip;
