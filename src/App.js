import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Datetime from 'react-datetime';
import moment from 'moment';
import 'react-datetime/css/react-datetime.css';
import Header from './Header';
import TagSelector from './TagSelector';
import Calculator from './Calculator';
import Remark from './Remark';
import Geolocation from './Geolocation';
import Log from './Log';
import Output from './Output';
import './App.css';
import { API_ENDPOINTS, EXPENSE_TAGS } from './config';

function App() {
  const [selectedTag, setSelectedTag] = useState(null);
  const tags = EXPENSE_TAGS;
  const [input, setInput] = useState('');       // 管理输入内容的状态
  const [remark, setRemark] = useState('');     // 管理备注的状态
  const [carPlate, setCarPlate] = useState('');     // 管理备注的状态
  const [amount, setAmount] = useState('');    // 管理金额的状态
  const [location, setLocation] = useState(''); // 管理地理位置的状态
  const [currency, setCurrency] = useState('MYR'); // 管理地理位置的状态
  const [log, setLog] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false); // Add new state for tracking submission
  const [output, setOutput] = useState('');
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentOptions, setPaymentOptions] = useState({
    'Cash': { key: 'Cash', card_num: 'Cash' },
    'eWallet1': { key: 'eWallet', card_num: 'TnG' },
    'eWallet2': { key: 'eWallet', card_num: 'GrabPay' },
    'eWallet3': { key: 'eWallet', card_num: 'Setel' },
    'eWallet4': { key: 'eWallet', card_num: 'ShopeePay' }
  }); 

  const handleNumber = (num) => {
    if(/[/+\-*÷×]/.test(amount)) {
      setAmount(amount + num);
      return;
    }
    
    let newAmount = (amount + num).replace(/[^\d]/g, '');
    if (newAmount === '0') {
      setAmount('0');
    } else {
      const numericValue = Number(newAmount) / 100;
      setAmount(numericValue.toFixed(2).toString());
    }
  };
  
  const handleOperator = (op) => {
    // If last character is an operator, replace it
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
      
      const result = Function(`return ${expression}`)();
      setAmount(Number(result).toFixed(2).toString());
    } catch (error) {
      setAmount('');
    }
  };
  async function pushToGsheet(contents) {
    try {
      setOutput('pushing to gsheet');
      const response = await fetch(API_ENDPOINTS.GSHEET_SUBMIT, {
        method: "POST",
        mode: "no-cors",
        redirect: "follow",
        body: JSON.stringify(contents),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      });
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
      // Check cache and its expiration
      const cached = localStorage.getItem('paymentOptions');
      const cacheTimestamp = localStorage.getItem('paymentOptionsTimestamp');
      const now = new Date().getTime();
      const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (cached && cacheTimestamp && (now - parseInt(cacheTimestamp)) < ONE_DAY) {
        setPaymentOptions(JSON.parse(cached));
        return;
      }
  
      try {
        const response = await fetch(API_ENDPOINTS.PAYMENT_OPTIONS);
        const data = await response.json();
        const transformedData = Object.entries(data)
          .filter(([key, value]) => value.card_num)
          .reduce((acc, [key, value]) => {
            acc[value.bank] = {
              key: value.bank,
              card_num: value.card_num
            };
            return acc;
          }, {...paymentOptions});
        
        // Store data with timestamp
      localStorage.setItem('paymentOptions', JSON.stringify(transformedData));
      localStorage.setItem('paymentOptionsTimestamp', now.toString());
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
    setIsSubmitting(true);
    const separator = '|'
    let submitted_value = input+separator+amount+separator+selectedTag+separator+remark+separator+location+separator+paymentMethod;
    console.log({submitted_value});
    const shortcutUrl = 'shortcuts://run-shortcut?name=WebRecordExpenses&input=text&text='+encodeURIComponent(submitted_value);
    
    // Reset all form fields
    setInput('');
    setRemark('');
    setAmount('');
    setSelectedTag('');
    // setLocation('');
    setCarPlate('');
    setPaymentMethod('');
    // Start loading feedback
    setOutput('Pushing to gsheet');
    const loadingInterval = setInterval(() => {
        setOutput(prev => prev + '.');
    }, 1000);
    
    const contents_for_gsheets = {
        timestamp: formatDateTime(selectedDateTime, 'YMDHIS'),
        yearmonth: formatDateTime(selectedDateTime, 'YM'),
        title: input,
        amount: amount,
        remark: remark,
        geolocation: location,
        tag: selectedTag,
        currency: currency,
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
        setPaymentMethod(paymentMethod);
    } finally {
      setIsSubmitting(false);
    }

  };
  // const [input, setInput] = useState('');
  // const [remark, setRemark] = useState('');
  return (
    <div className="app-container">
      <Header />
      <TagSelector input={input} setInput={setInput} setRemark={setRemark} setAmount={setAmount} selectedTag={selectedTag} setSelectedTag={setSelectedTag} tags={tags} />
      <hr/>
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
      <div className="form-container">
        <Calculator 
          amount={amount} 
          setAmount={setAmount}
          currency={currency}
          setCurrency={setCurrency}
          handleNumber={handleNumber}
          handleOperator={handleOperator}
          handleEqual={handleEqual}
        />
        <Remark 
          input={input} 
          setInput={setInput} 
          remark={remark} 
          setCarPlate={setCarPlate} 
          carPlate={carPlate} 
          setRemark={setRemark} 
          amount={amount} 
          selectedTag={selectedTag} 
        />
      </div>
      
      
      
      <div className="form-row">
        <div className="datetime-wrapper">
          <Datetime
            value={selectedDateTime}
            onChange={(date) => {
              // Only update if it's a valid date or a string input
              if (typeof date === 'string') {
                // Let the user continue typing
                return;
              }
              // Handle both manual input and picker selection
              const validDate = moment(date).isValid() ? date : selectedDateTime;
              setSelectedDateTime(validDate._d || validDate);
            }}
            dateFormat="YYYY-MM-DD"
            timeFormat="HH:mm:ss"
            inputProps={{
              className: 'datetime-picker',
              placeholder: 'Select Date and Time',
              // Enable direct input
              readOnly: false,
              // Add these properties to improve mobile support
              inputMode: "numeric",
              pattern: "[0-9]*"
            }}
            onBlur={(e) => {
              // Update the date when input loses focus
              const inputDate = moment(e.target.value);
              if (inputDate.isValid()) {
                setSelectedDateTime(inputDate._d);
              }
            }}
            // Add this to ensure mobile compatibility
            closeOnSelect={false}
            strictParsing={false}
          />
        </div>
        <button className="submit" onClick={handleSubmit}  disabled={isSubmitting || !amount || !selectedTag || !input}>
          {isSubmitting ? '提交中...' : (!amount || !selectedTag || !input)?'请先输入内容':'提交'}
        </button>
      </div>
      <Geolocation location={location} setLocation={setLocation} />
      <Output output={output} />
      <Log setLog={setLog} log={log} />
    </div>
  );
}

export default App;
