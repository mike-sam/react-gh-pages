import React, { useState } from 'react';

function Calculator({amount, setAmount}) {

  const handleButtonClick = (value) => {
    let tmpAmount = amount.toString();
    let char_1 = '';
    let char_2 = '';
    if (tmpAmount.length >= 1){
        char_1 = tmpAmount.charAt(tmpAmount.length - 1);
    }
    if (tmpAmount.length >= 2){
        char_2 = tmpAmount.substr(tmpAmount.length - 2,1);
    }
    switch(value){
        case 'C':
            setAmount('');
            break;
        case '=':
            try {
                setAmount(eval(amount).toFixed(2));
            } catch (error) {
                setAmount('Error'+ error);
            }
            break;
        case '0':
            if(parseInt(amount) === 0 || amount == ''){
                setAmount('');
            } else {
                if(isNaN(char_1)){
                    setAmount(amount);
                } else {
                    setAmount(amount + value);
                }
            }
            break;
        case 'SGD':
            setAmount((amount * 3.3).toFixed(2));
            break;
        case 'MYR':
            setAmount((amount / 3.3).toFixed(2));
            break;
        default:
            if(char_1 === '0' && char_2 === '0'){
                setAmount(value);
            } else {
                if(char_1 === '0' && char_2 === '0' && amount.length <= 2){
                    setAmount(amount.slice(0,-1) + value);
                } else {
                    setAmount(amount + value);
                }
                // setAmount(amount + value);
            }
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
        <button className="calc-key currency" onClick={() => handleButtonClick('SGD')}>SGD</button>
        <button className="calc-key currency" onClick={() => handleButtonClick('MYR')}>MYR</button>
      </div>
    </div>
  );
}

export default Calculator;
