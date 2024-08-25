// import React from 'react';
// import Header from './Header';
// import TagSelector from './TagSelector';
// import Calculator from './Calculator';
// import Form from './Form';
// import Geolocation from './Geolocation';
import React, { useState } from 'react';
import Header from './Header';
import TagSelector from './TagSelector';
import Calculator from './Calculator';
import Form from './Form';
import Geolocation from './Geolocation';
import './App.css';

function App() {
  const [input, setInput] = useState('');       // 管理输入内容的状态
  const [remark, setRemark] = useState('');     // 管理备注的状态
  const [amount, setAmount] = useState('0');    // 管理金额的状态
  const [location, setLocation] = useState(''); // 管理地理位置的状态
  // const [input, setInput] = useState('');
  // const [remark, setRemark] = useState('');
  return (
    <div className="app-container">
      <Header />
      <TagSelector input={input} setInput={setInput} setRemark={setRemark} />
      <hr/>
      <div className="form-container">
        <Calculator amount={amount} setAmount={setAmount} />
        <Form input={input} setInput={setInput} remark={remark} setRemark={setRemark} amount={amount} />
      </div>
      <Geolocation setLocation={setLocation} />
    </div>
  );
}

export default App;
