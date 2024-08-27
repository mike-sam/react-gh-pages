import React, { useState } from 'react';

function Calculator({amount, setAmount}) {

  const handleButtonClick = (value) => {
    switch(value){
        case 'C':
            setAmount('');
            break;
        case '=':
            try {
                setAmount(eval(amount).toString());
            } catch {
                setAmount('Error');
            }
            break;
        case '0':
            if(parseInt(amount) == 0){
                setAmount(value);
            } else {
                setAmount(amount + value);
            }
            break;
        case 'SGD':
            setAmount((amount * 3.3).toFixed(2));
            break;
        case 'MYR':
            setAmount((amount / 3.3).toFixed(2));
            break;
        default:
            setAmount(amount + value);
            break;
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
        <button className="calc-key" onClick={() => handleButtonClick('SGD')}>SGD</button>
        <button className="calc-key" onClick={() => handleButtonClick('MYR')}>MYR</button>
      </div>
    </div>
  );
}

export default Calculator;
