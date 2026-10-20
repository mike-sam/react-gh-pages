import React, { useEffect, useMemo, useRef, useState } from 'react';
import WheelPicker from './WheelPicker';
import PaymentWheel from './PaymentWheel';
import PickerModal from './PickerModal';
import QuickPlateSelect from './QuickPlateSelect';
import { categorizePayments, paymentSectionsFromCats } from '../utils/paymentCategory';

const CURRENCIES = ['MYR', 'TWD', 'USD', 'SGD', 'CNY', 'EUR'];

/**
 * currency ↑↓ infinite | amount calc | payment single cell (↑↓ opt, ←→ cat)
 */
function AmountTripleRow({
  currency,
  setCurrency,
  amount,
  setAmount,
  paymentMethod,
  setPaymentMethod,
  paymentOptions = {},
  onAmountComplete,
  selectedTag,
  input,
  carPlate,
  setCarPlate,
}) {
  const [showPad, setShowPad] = useState(false);
  const [cueAmount, setCueAmount] = useState(false);
  const [currencyModal, setCurrencyModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  /** Only auto-open once per cat+subcat selection; closing won't reopen until selection changes */
  const autoOpenedForKey = useRef('');
  const amountBtnRef = useRef(null);

  // Lock parent page scroll while amount pad is open
  useEffect(() => {
    if (!showPad) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevent = (e) => {
      if (e.target.closest?.('.amount-pad')) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('touchmove', prevent);
    };
  }, [showPad]);

  const categorized = useMemo(() => categorizePayments(paymentOptions), [paymentOptions]);

  const paymentSections = useMemo(() => paymentSectionsFromCats(categorized), [categorized]);

  const openPad = () => {
    if (document.activeElement?.blur) document.activeElement.blur();
    setCueAmount(false);
    setShowPad(true);
  };

  /** Highlight amount cell, then open pad — softer than jumping straight to keypad */
  const openPadWithCue = () => {
    if (document.activeElement?.blur) document.activeElement.blur();
    setCueAmount(true);
    amountBtnRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      setCueAmount(false);
      setShowPad(true);
    }, 480);
  };

  useEffect(() => {
    if (!selectedTag || !input) {
      autoOpenedForKey.current = '';
      return undefined;
    }
    if (amount && amount !== '0' && amount !== '0.00') return undefined;
    const key = `${selectedTag}||${input}`;
    if (autoOpenedForKey.current === key) return undefined;
    autoOpenedForKey.current = key;
    const t = setTimeout(openPadWithCue, 180);
    return () => clearTimeout(t);
  }, [selectedTag, input]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.showCalculator = () => {
      if (selectedTag && input && (!amount || amount === '0' || amount === '')) openPad();
    };
    return () => {
      delete window.showCalculator;
    };
  }, [selectedTag, input, amount]);

  const handleNumber = (num) => {
    if (/[/+\-*÷×]/.test(amount)) {
      setAmount(amount + num);
      return;
    }
    if (amount === '0' || amount === '0.00') {
      if (num === '0') return;
      setAmount(num);
      return;
    }
    if (amount.includes('.')) {
      const parts = amount.split('.');
      if (parts[1] && parts[1].length >= 2) return;
      setAmount(amount + num);
    } else {
      setAmount(amount === '' ? num : amount + num);
    }
  };

  const handleOperator = (op) => {
    if (!amount) return;
    if (['+', '-', '×', '÷', '*'].includes(amount.slice(-1))) {
      setAmount(amount.slice(0, -1) + op);
      return;
    }
    setAmount(amount + op);
  };

  const handleEqual = () => {
    try {
      const expression = amount
        .replace(/×/g, ' * ')
        .replace(/÷/g, ' / ')
        .replace(/\+/g, ' + ')
        .replace(/-/g, ' - ')
        .trim();
      setAmount(Number(Function(`return ${expression}`)()).toFixed(2).toString());
    } catch {
      setAmount('');
    }
  };

  const handleClear = () => setAmount('');
  const handleBackspace = () => setAmount(amount.length > 0 ? amount.slice(0, -1) || '' : '');
  const handleDecimal = () => {
    if (/[/+\-*÷×]/.test(amount)) {
      setAmount(amount + '0.');
      return;
    }
    if (amount.includes('.')) return;
    setAmount(amount === '' || amount === '0' ? '0.' : amount + '.');
  };

  const closeDone = () => {
    setShowPad(false);
    if (amount && parseFloat(amount) > 0) onAmountComplete?.();
  };

  return (
    <div className="amount-triple-row">
      <WheelPicker
        className="amount-triple-currency"
        axis="y"
        options={CURRENCIES}
        value={currency}
        onChange={setCurrency}
        onDoubleSelect={() => setCurrencyModal(true)}
        ariaLabel="幣別（上下，雙擊搜尋）"
      />

      <button
        type="button"
        ref={amountBtnRef}
        className={`amount-triple-amount${cueAmount ? ' is-cue' : ''}`}
        onClick={openPad}
      >
        {amount || '0.00'}
      </button>

      <PaymentWheel
        categorized={categorized}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        onDoubleSelect={() => setPaymentModal(true)}
      />

      {currencyModal && (
        <PickerModal
          title="選擇幣別"
          options={CURRENCIES}
          value={currency}
          onSelect={setCurrency}
          onClose={() => setCurrencyModal(false)}
          searchPlaceholder="搜尋幣別…"
        />
      )}

      {paymentModal && (
        <PickerModal
          title="選擇付款方式"
          sections={paymentSections}
          value={paymentMethod}
          onSelect={setPaymentMethod}
          onClose={() => setPaymentModal(false)}
          searchPlaceholder="搜尋 Cash / TnG / 卡號…"
        />
      )}

      {showPad && (
        <div
          className="amount-pad-overlay amount-pad-overlay--enter"
          onClick={() => setShowPad(false)}
          onWheel={(e) => e.preventDefault()}
        >
          <div
            className="amount-pad amount-pad--calc amount-pad--enter"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div className="amount-pad-display">{amount || '0'}</div>

            <QuickPlateSelect
              selectedTag={selectedTag}
              input={input}
              carPlate={carPlate}
              setCarPlate={setCarPlate}
            />

            <div className="amount-pad-currency-row">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`amount-pad-curr${c === currency ? ' is-active' : ''}`}
                  onClick={() => setCurrency(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="calculator-keypad amount-pad-calc-grid">
              <button type="button" className="calc-btn calc-btn-clear" onClick={handleClear}>
                C
              </button>
              <button type="button" className="calc-btn calc-btn-backspace" onClick={handleBackspace}>
                ⌫
              </button>
              <button type="button" className="calc-btn calc-btn-operator" onClick={() => handleOperator('÷')}>
                ÷
              </button>
              <button type="button" className="calc-btn calc-btn-operator" onClick={() => handleOperator('×')}>
                ×
              </button>

              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('7')}>
                7
              </button>
              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('8')}>
                8
              </button>
              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('9')}>
                9
              </button>
              <button type="button" className="calc-btn calc-btn-operator" onClick={() => handleOperator('-')}>
                −
              </button>

              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('4')}>
                4
              </button>
              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('5')}>
                5
              </button>
              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('6')}>
                6
              </button>
              <button type="button" className="calc-btn calc-btn-operator" onClick={() => handleOperator('+')}>
                +
              </button>

              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('1')}>
                1
              </button>
              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('2')}>
                2
              </button>
              <button type="button" className="calc-btn calc-btn-number" onClick={() => handleNumber('3')}>
                3
              </button>
              <button type="button" className="calc-btn calc-btn-equal" onClick={handleEqual}>
                =
              </button>

              <button type="button" className="calc-btn calc-btn-zero" onClick={() => handleNumber('0')}>
                0
              </button>
              <button type="button" className="calc-btn calc-btn-number" onClick={handleDecimal}>
                .
              </button>
              <button type="button" className="calc-btn calc-btn-done" onClick={closeDone}>
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AmountTripleRow;
