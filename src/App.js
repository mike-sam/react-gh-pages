import React, { useState } from 'react';
import Header from './Header';
import TagSelector from './TagSelector';
import Calculator from './Calculator';
import Remark from './Remark';
import Geolocation from './Geolocation';
import Log from './Log';
import Output from './Output';
import './App.css';

function App() {
  const [selectedTag, setSelectedTag] = useState(null);
  const tags = ['餐饮美食', '日常购物', '医疗保健', '交通出行', '自我增值', '投资金融', '休闲娱乐', '服饰美容', '旅游放松', '水电气网', '人情往来', '居家生活', '宠物', '其他'];
  const [input, setInput] = useState('');       // 管理输入内容的状态
  const [remark, setRemark] = useState('');     // 管理备注的状态
  const [carPlate, setCarPlate] = useState('');     // 管理备注的状态
  const [amount, setAmount] = useState('');    // 管理金额的状态
  const [location, setLocation] = useState(''); // 管理地理位置的状态
  const [log, setLog] = useState([]); 
  const [output, setOutput] = useState('');
  
  async function pushToGsheet(contents) {
    const gs_appscript_url = 'https://script.google.com/macros/s/AKfycbyUOZimpAo5_hOCv1cvG6rXgns0htqk-lymPUlte7yoRFh_8V427Egnzpsv8PnpnjWXRw/exec';
    try {
      const response = await fetch(gs_appscript_url, {
        method: "POST",
        mode: "no-cors",
        redirect: "follow",
        body: JSON.stringify(contents),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      });
       // Convert response to string for logging
       const responseText = JSON.stringify(response);
       console.log("Success:", responseText);
       return responseText;
    } catch (error) {
      console.error("Error:", error.toString());
      throw error;
    }
  }  
  const formatDateTime = (date = new Date(), format = 'YMDHIS') => {
    const pad = num => num.toString().padStart(2, "0");
    const parts = {
      Y: date.getFullYear(),
      M: pad(date.getMonth() + 1),
      D: pad(date.getDate()),
      H: pad(date.getHours()),
      I: pad(date.getMinutes()),
      S: pad(date.getSeconds())
    };

    switch (format) {
      case 'YMDHIS':
        return `${parts.Y}-${parts.M}-${parts.D} ${parts.H}:${parts.I}:${parts.S}`;
      case 'YM':
        return `${parts.Y}${parts.M}`;
      default:
        return '';
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    const separator = '|'
    let submitted_value = input+separator+amount+separator+selectedTag+separator+remark+separator+location;
    const shortcutUrl = 'shortcuts://run-shortcut?name=WebRecordExpenses&input=text&text='+encodeURIComponent(submitted_value);
    const contents_for_gsheets = {
        timestamp: formatDateTime(new Date(), 'YMDHIS'),
        yearmonth: formatDateTime(new Date(), 'YM'),
        title: input,
        amount: amount,
        remark: remark,
        geolocation: location,
        tag: selectedTag,
    };
    setOutput(`<a href="${shortcutUrl}">${shortcutUrl}</a>`);
    submitted_value = formatDateTime(new Date(), 'YMDHIS') + separator + submitted_value;
    setLog(prevLog => [submitted_value,...prevLog]);
    // document.getElementById("record").appendChild(_p_ele);
    // document.getElementById('empty-btn').click();
    
    // Handle form submission logic here
    
    await pushToGsheet(contents_for_gsheets);
      
    // Reset all form fields after successful submission
    setInput('');
    setRemark('');
    setAmount('');
    setSelectedTag('');
    setLocation('');
    setCarPlate('');
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
        <Remark input={input} setInput={setInput} remark={remark} setCarPlate={setCarPlate} carPlate={carPlate} setRemark={setRemark} amount={amount} selectedTag={selectedTag} />
      </div>
      <button className="submit" onClick={handleSubmit}>提交</button>
      <Geolocation location={location} setLocation={setLocation} />
      <Output output={output} />
      <Log setLog={setLog} log={log} />
    </div>
  );
}

export default App;
