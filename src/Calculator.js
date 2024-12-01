import React from 'react';

function Calculator({ amount, setAmount, currency, setCurrency, handleNumber, handleOperator, handleEqual }) {

    const handleAmountClick = () => {
        setAmount(amount.slice(0, -1));
    };

    const handleButtonClick = (value) => {
    let tmpAmount = amount.toString();
    let char_1 = '';
    if (tmpAmount.length >= 1){
        char_1 = tmpAmount.charAt(tmpAmount.length - 1);
    }
    switch(value){
        case 'C':
            setAmount('');
            break;
        case 'SGD':
        case 'CNY':
        case 'MYR':
            let prevCurr = currency;
            let rate = 1;
            switch(prevCurr){
                case 'SGD':
                    if (value === 'CNY'){
                        rate = 5.41;
                    } else if (value === 'MYR'){
                        rate = 3.3;
                    }
                    break;
                case 'MYR':
                    if (value === 'SGD'){
                        rate = 0.3;
                    } else if (value === 'CNY'){
                        rate = 1.60;
                    }
                    break;
                case 'CNY':
                    if (value === 'SGD'){
                        rate = 0.18;
                    } else if (value === 'MYR'){
                        rate = 0.62;
                    }
                    break;
            }
            setCurrency(value);
            setAmount((amount * rate).toFixed(2));
            break;
        case 'NNN':
            break;
        case '←':
            setAmount(amount.slice(0, -1));
            break;
    }
    let check = parseFloat(amount).toFixed(2);
    if (value === '0' && (check === '0.00' || isNaN(check)) ) {
        setAmount('');
    }
  };

  const currencies = ['SGD', 'CNY', 'MYR'];

  return (
    <div id="calculator">
      <div id="keypad">
        <button className="calc-key" onClick={() => handleButtonClick('C')}>C</button>
        <input type="text" id="content-amount" value={amount} onClick={handleAmountClick} className="amount-display" readOnly />
        <button className="calc-key" onClick={() => handleNumber('7')}>7</button>
        <button className="calc-key" onClick={() => handleNumber('8')}>8</button>
        <button className="calc-key" onClick={() => handleNumber('9')}>9</button>
        <button className="calc-key" onClick={() => handleOperator('÷')}>÷</button>
        <button className="calc-key" onClick={() => handleNumber('4')}>4</button>
        <button className="calc-key" onClick={() => handleNumber('5')}>5</button>
        <button className="calc-key" onClick={() => handleNumber('6')}>6</button>
        <button className="calc-key" onClick={() => handleOperator('×')}>×</button>
        <button className="calc-key" onClick={() => handleNumber('1')}>1</button>
        <button className="calc-key" onClick={() => handleNumber('2')}>2</button>
        <button className="calc-key" onClick={() => handleNumber('3')}>3</button>
        <button className="calc-key" onClick={() => handleOperator('-')}>-</button>
        <button className="calc-key" onClick={() => handleNumber('0')}>0</button>
        <button className="calc-key" onClick={() => handleButtonClick('←')}>←</button>
        <button className="calc-key" onClick={() => handleOperator('+')}>+</button>
        <button className="calc-key" onClick={handleEqual}>=</button>
        {currencies.map(curr => (
            <button 
                key={curr}
                className={`calc-key currency ${currency === curr ? 'selected' : ''}`} 
                onClick={() => handleButtonClick(curr)}
            >
                {curr}
            </button>
        ))}
        {/* <button className={`calc-key currency ${currency === 'SGD' ? 'selected' : ''}`} onClick={() => handleButtonClick('SGD')}>SGD</button>
        <button className="calc-key currency {currency==='CNY'?'selected':''}" onClick={() => handleButtonClick('CNY')}>CNY</button>
        <button className="calc-key currency {currency==='MYR'?'selected':''}" onClick={() => handleButtonClick('MYR')}>MYR</button> */}
        <button className="calc-key currency hide" onClick={() => handleButtonClick('')}>NNN</button>
      </div>
    </div>
  );
}

export default Calculator;
