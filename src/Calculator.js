import React, { useState } from 'react';

function Calculator() {
  const [amount, setAmount] = useState('0');

  const handleButtonClick = (value) => {
    if (value === 'C') {
      setAmount('');
    } else if (value === '=') {
      try {
        setAmount(eval(amount).toString());
      } catch {
        setAmount('Error');
      }
    } else {
      setAmount(amount === '0' ? value : amount + value);
    }
  };

  return (
    <div id="calculator">
      <div id="keypad">
        <button className="calc-key" onClick={() => handleButtonClick('C')}>C</button>
        <input type="text" id="content-amount" value={amount} readOnly />
        <button className="calc-key" onClick={() => handleButtonClick('7')}>7</button>
        <button className="calc-key" onClick={() => handleButtonClick('8')}>8</button>
        <button className="calc-key" onClick={() => handleButtonClick('9')}>9</button>
        <button className="calc-key" onClick={() => handleButtonClick('/')}>/</button>
        <button className="calc-key" onClick={() => handleButtonClick('4')}>4</button>
        <button className="calc-key" onClick={() => handleButtonClick('5')}>5</button>
        <button className="calc-key" onClick={() => handleButtonClick('6')}>6</button>
        <button className="calc-key" onClick={() => handleButtonClick('*')}>*</button>
        <button className="calc-key" onClick={() => handleButtonClick('1')}>1</button>
        <button className="calc-key" onClick={() => handleButtonClick('2')}>2</button>
        <button className="calc-key" onClick={() => handleButtonClick('3')}>3</button>
        <button className="calc-key" onClick={() => handleButtonClick('-')}>-</button>
        <button className="calc-key" onClick={() => handleButtonClick('0')}>0</button>
        <button className="calc-key" onClick={() => handleButtonClick('.')}>.</button>
        <button className="calc-key" onClick={() => handleButtonClick('+')}>+</button>
        <button className="calc-key" onClick={() => handleButtonClick('=')}>=</button>
      </div>
    </div>
  );
}

export default Calculator;
