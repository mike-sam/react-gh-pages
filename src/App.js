import React, { useState, useEffect } from 'react';
import Select from 'react-select';
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
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentOptions, setPaymentOptions] = useState({
    '[Cash]': { key: '[Cash]', card_num: '[Cash]' },
    'eWallet': { key: 'eWallet', card_num: 'eWallet' }
  }); 
  async function pushToGsheet(contents) {
    const gs_appscript_url = 'https://script.google.com/macros/s/AKfycbyUOZimpAo5_hOCv1cvG6rXgns0htqk-lymPUlte7yoRFh_8V427Egnzpsv8PnpnjWXRw/exec';
    try {
      setOutput('pushing to gsheet');
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

  useEffect(() => {
    const fetchPaymentOptions = async () => {
      try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbz2NiyxrNvirBRFYy7j-GT8anX1OUKoiv7fTg38-QKYs77TVyPnDYrDlu4N3pbnOVPK7w/exec');
        console.log({response})
        const data = await response.json();
        // Transform the object into array format we need
        const transformedData = Object.entries(data)
        .filter(([key, value]) => value.card_num)
        .reduce((acc, [key, value]) => {
          acc[value.bank] = {
            key: value.bank,
            card_num: value.card_num
          };
          return acc;
        }, {...paymentOptions});
        setPaymentOptions(transformedData);
      } catch (error) {
        console.error('Error fetching payment options:', error);
      }
    };
    fetchPaymentOptions();
  }, []);

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
    let submitted_value = input+separator+amount+separator+selectedTag+separator+remark+separator+location+separator+paymentMethod;
    console.log({submitted_value});
    const shortcutUrl = 'shortcuts://run-shortcut?name=WebRecordExpenses&input=text&text='+encodeURIComponent(submitted_value);
    
    // Reset all form fields
    setInput('');
    setRemark('');
    setAmount('');
    setSelectedTag('');
    setLocation('');
    setCarPlate('');
    // Start loading feedback
    setOutput('Pushing to gsheet');
    const loadingInterval = setInterval(() => {
        setOutput(prev => prev + '.');
    }, 1000);
    
    const contents_for_gsheets = {
        timestamp: formatDateTime(new Date(), 'YMDHIS'),
        yearmonth: formatDateTime(new Date(), 'YM'),
        title: input,
        amount: amount,
        remark: remark,
        geolocation: location,
        tag: selectedTag,
        payment_method: paymentMethod,  // Add this line
    };

    submitted_value = formatDateTime() + separator + submitted_value;
    setLog(prevLog => [submitted_value,...prevLog]);
    
    try {
        
        const responseText = await pushToGsheet(contents_for_gsheets);
        clearInterval(loadingInterval);
        setOutput(`Success: ${responseText}<br/><a href="${shortcutUrl}">submit through WebRecordExpenses shortcut</a>`);
    } catch (error) {
        clearInterval(loadingInterval);
        setOutput(`Error: ${error.toString()}<br/><a href="${shortcutUrl}">submit through WebRecordExpenses shortcut</a>`);
        // Revert all form fields if error
        setInput(input);
        setRemark(remark);
        setAmount(amount);
        setSelectedTag(selectedTag);
        setLocation(location);
    }

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
      <Select
        value={paymentMethod ? {
          value: paymentMethod,
          label: Object.values(paymentOptions).find(opt => opt.card_num === paymentMethod)?.key === paymentMethod ? 
            paymentMethod : 
            `${Object.values(paymentOptions).find(opt => opt.card_num === paymentMethod)?.key} - ${paymentMethod}`
        } : null}
        onChange={(selected) => setPaymentMethod(selected ? selected.value : '')}
        options={Object.values(paymentOptions).map(option => ({
          value: option.card_num,
          label: option.key === option.card_num ? option.key : `${option.key} - ${option.card_num}`
        }))}
        isClearable
        placeholder="Select or search payment method..."
        styles={{
          container: (base) => ({
            ...base,
            flex: 1,
            margin: '10px 0px 0px 0px'
          }),
          option: (base) => ({
            ...base,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }),
        }}
      />
      <button className="submit" onClick={handleSubmit}>提交</button>
      <Geolocation location={location} setLocation={setLocation} />
      <Output output={output} />
      <Log setLog={setLog} log={log} />
    </div>
  );
}

export default App;
