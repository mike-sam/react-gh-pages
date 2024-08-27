import React, { useState } from 'react';
import Header from './Header';
import TagSelector from './TagSelector';
import Calculator from './Calculator';
import Remark from './Remark';
import Geolocation from './Geolocation';
import './App.css';

function App() {
  const [selectedTag, setSelectedTag] = useState(null);
  const tags = ['餐饮美食', '日常购物', '医疗保健', '交通出行', '自我增值','休闲娱乐', '服饰美容', '旅游放松', '水电网', '人情往来', '家居硬体', '房贷房租物管', '车贷', '宠物', '其他'];
  const [input, setInput] = useState('');       // 管理输入内容的状态
  const [remark, setRemark] = useState('');     // 管理备注的状态
  const [amount, setAmount] = useState('0');    // 管理金额的状态
  const [location, setLocation] = useState(''); // 管理地理位置的状态
  
  const handleSubmit = (e) => {
    // Handle form submission logic here
    e.preventDefault();
    // 提交表单的逻辑
};
  // const [input, setInput] = useState('');
  // const [remark, setRemark] = useState('');
  return (
    <div className="app-container">
      <Header />
      <TagSelector input={input} setInput={setInput} setRemark={setRemark} setAmount={setAmount} selectedTag={selectedTag} setSelectedTag={setSelectedTag} tags={tags} />
      <hr/>
      <div className="form-container">
        <Calculator amount={amount} setAmount={setAmount} />
        <Remark input={input} setInput={setInput} remark={remark} setRemark={setRemark} amount={amount} selectedTag={selectedTag} />
      </div>
      <button className="submit" onClick={handleSubmit}>提交</button>
      <Geolocation setLocation={setLocation} />
    </div>
  );
}

export default App;
