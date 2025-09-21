import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Header from './Header';
// import DateTimeInput from './DateTimeInput'; // 已替换为MobileFriendlyDateTime
import TagSelector from './TagSelector';
// import Calculator from './Calculator'; // 已移除，使用MobileCalculator
import Remark from './Remark';
import Geolocation from './Geolocation';
import Log from './Log';
import Output from './Output';
import './App.css';
import { API_ENDPOINTS, EXPENSE_TAGS } from './config';
import CompactPhotoUpload from './components/CompactPhotoUpload';
import MobileCalculator from './components/MobileCalculator';
import MalaysiaTaxCalculator from './components/MalaysiaTaxCalculator';
import MobileFriendlyDateTime from './components/MobileFriendlyDateTime';
import PaymentMethodSelector from './components/PaymentMethodSelector';

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
  const [photos, setPhotos] = useState([]); // 支持多张照片
  const [paymentOptions, setPaymentOptions] = useState({
    'Cash': { key: 'Cash', card_num: 'Cash' },
    'eWallet1': { key: 'eWallet', card_num: 'TnG' },
    'eWallet2': { key: 'eWallet', card_num: 'GrabPay' },
    'eWallet3': { key: 'eWallet', card_num: 'Setel' },
    'eWallet4': { key: 'eWallet', card_num: 'ShopeePay' }
  });
  const [skipAutoLocation, setSkipAutoLocation] = useState(false);
  const [currencyConversions, setCurrencyConversions] = useState([]);
  const [taxCalculation, setTaxCalculation] = useState(null);
  const [isAmountManuallySet, setIsAmountManuallySet] = useState(false); 

  // 处理照片变化
  const handlePhotoChange = (photosData) => {
    setPhotos(photosData);
  };

  // 处理汇率换算记录
  const handleCurrencyConversion = (conversion) => {
    setCurrencyConversions(prev => [...prev, conversion]);
  };

  // 处理税费计算
  const handleTaxCalculation = (taxData) => {
    setTaxCalculation(taxData);
  };

  // 处理金额完成后的操作
  const handleAmountComplete = () => {
    setIsAmountManuallySet(true);
    // 如果没有预设付款方式，自动滚动到付款方式选择区域
    if (!paymentMethod) {
      setTimeout(() => {
        const paymentSection = document.querySelector('.step-section:nth-child(3)');
        if (paymentSection) {
          paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    }
  };

  // 处理明细总额变化
  const handleItemizedTotalChange = (total) => {
    // 只有在用户没有手动设置金额时才自动更新
    if (!isAmountManuallySet && total > 0) {
      setAmount(total.toFixed(2));
    }
  };

  const handleNumber = (num) => {
    setIsAmountManuallySet(true); // 用户手动输入了金额
    
    // If there's an operator in the amount, we're building an expression
    if(/[/+\-*÷×]/.test(amount)) {
      setAmount(amount + num);
      return;
    }
    
    // Handle special case where amount is '0' - replace it
    if (amount === '0' || amount === '0.00') {
      if (num === '0') {
        return; // Don't allow multiple zeros
      }
      setAmount(num);
      return;
    }
    
    // Normal number entry - treat as currency input (cents)
    let currentAmount = amount.replace(/[^\d]/g, '');
    let newAmount = currentAmount + num;
    
    // Prevent numbers that are too large
    if (newAmount.length > 8) {
      return;
    }
    
    const numericValue = Number(newAmount) / 100;
    setAmount(numericValue.toFixed(2).toString());
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

  // Read URL parameters and handle POST data on component mount
  useEffect(() => {
    const handleUrlParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Handle various URL parameters
      const txtParam = urlParams.get('txt');
      const catParam = urlParams.get('cat');
      const tagParam = urlParams.get('tag');
      const amountParam = urlParams.get('amount');
      const currencyParam = urlParams.get('currency');
      const remarkParam = urlParams.get('remark');
      const locationParam = urlParams.get('location');
      const longitudeParam = urlParams.get('longitude');
      const latitudeParam = urlParams.get('latitude');
      const paymentParam = urlParams.get('payment');
      
      if (txtParam) setInput(txtParam);
      if (catParam) setSelectedTag(catParam);
      if (tagParam) setInput(tagParam);
      if (amountParam) setAmount(amountParam);
      if (currencyParam) setCurrency(currencyParam);
      if (remarkParam) setRemark(remarkParam);
      if (locationParam) setLocation(locationParam);
      
      // Fuzzy match payment method
      if (paymentParam) {
        const fuzzyMatchPayment = (searchTerm) => {
          const lowerSearch = searchTerm.toLowerCase();
          const matches = Object.values(paymentOptions).filter(option => 
            option.card_num.toLowerCase().includes(lowerSearch) || 
            option.key.toLowerCase().includes(lowerSearch)
          );
          return matches.length === 1 ? matches[0].card_num : null;
        };
        
        const matchedPayment = fuzzyMatchPayment(paymentParam);
        if (matchedPayment) {
          setPaymentMethod(matchedPayment);
        }
      }
      
      // Handle coordinates if provided
      if (longitudeParam && latitudeParam) {
        setLocation(`https://maps.google.com/maps?q=${latitudeParam},${longitudeParam}`);
        setSkipAutoLocation(true);
      } else if (locationParam) {
        setSkipAutoLocation(true);
      }
    };

    const handlePostData = () => {
      // Check if there's POST data stored in sessionStorage
      const postData = sessionStorage.getItem('expensePostData');
      if (postData) {
        try {
          const data = JSON.parse(postData);
          if (data.txt) setInput(data.txt);
          if (data.cat) setSelectedTag(data.cat);
          if (data.tag) setInput(data.tag);
          if (data.amount) setAmount(data.amount.toString());
          if (data.currency) setCurrency(data.currency);
          if (data.remark) setRemark(data.remark);
          if (data.location) setLocation(data.location);
          if (data.longitude && data.latitude) {
            setLocation(`https://maps.google.com/maps?q=${data.latitude},${data.longitude}`);
            setSkipAutoLocation(true);
          }
          // Clear the data after using it
          sessionStorage.removeItem('expensePostData');
        } catch (error) {
          console.error('Error parsing POST data:', error);
        }
      }
    };

    handleUrlParams();
    handlePostData();
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

  const submitData = async (resetFields = true) => {
    setIsSubmitting(true);
    const separator = '|';
    let submitted_value = input + separator + amount + separator + selectedTag + separator + remark + separator + location + separator + paymentMethod;
    console.log({ submitted_value });
    const shortcutUrl = 'shortcuts://run-shortcut?name=WebRecordExpenses&input=text&text=' + encodeURIComponent(submitted_value);
  
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
      payment_method: paymentMethod,
      // 处理多张照片
      photos: photos.map(photo => photo.uploadedUrl || photo.base64).filter(Boolean),
      photo_urls: photos.map(photo => photo.uploadedUrl).filter(Boolean)
    };
  
    submitted_value = formatDateTime() + separator + submitted_value;
    setLog(prevLog => [submitted_value, ...prevLog]);
  
    try {
      const responseText = await pushToGsheet(contents_for_gsheets);
      clearInterval(loadingInterval);
      setOutput(`Success: ${responseText}<br/><a href="${shortcutUrl}">submit through WebRecordExpenses shortcut</a>`);
    } catch (error) {
      clearInterval(loadingInterval);
      setOutput(`Error: ${error.toString()}<br/><a href="${shortcutUrl}">submit through WebRecordExpenses shortcut</a>`);
    } finally {
      setIsSubmitting(false);
      if (resetFields) {
        // Reset all form fields
        setInput('');
        setRemark('');
        setAmount('');
        setSelectedTag('');
        setCarPlate('');
        setPaymentMethod('');
        setPhotos([]); // 重置照片
      }
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitData(true);
  };
  
  const handleSubmitAndDuplicate = async (e) => {
    e.preventDefault();
    await submitData(false);
  };

  return (
    <div className="app-container">
      <Header />
      {/* 步骤1: 选择分类和标签 */}
      <div className="step-section">
        <TagSelector input={input} setInput={setInput} setRemark={setRemark} setAmount={setAmount} selectedTag={selectedTag} setSelectedTag={setSelectedTag} tags={tags} />
      </div>

      {/* 步骤2: 输入金额 */}
      <div className="step-section">
        <MobileCalculator 
          amount={amount} 
          setAmount={setAmount}
          currency={currency}
          setCurrency={setCurrency}
          onAmountFocus={() => {
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
          }}
          onCurrencyConversion={handleCurrencyConversion}
            onAmountComplete={handleAmountComplete}
          />
        
        {/* 马来西亚税费计算器 */}
        {amount && parseFloat(amount) > 0 && currency === 'MYR' && (
          <MalaysiaTaxCalculator
            totalAmount={parseFloat(amount)}
            onTaxCalculation={handleTaxCalculation}
          />
        )}
      </div>

      {/* 步骤3: 选择付款方式 - 使用分类选择 */}
      <div className="step-section payment-section">
        <PaymentMethodSelector
          paymentOptions={paymentOptions}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          onPaymentFromUrl={true}
        />
      </div>

      {/* 步骤4: 描述和备注 - 独立行 */}
      <div className="remark-row">
        <div className="remark-container-wrapper">
          <Remark 
            input={input} 
            setInput={setInput} 
            remark={remark} 
            setCarPlate={setCarPlate} 
            carPlate={carPlate} 
            setRemark={setRemark} 
            amount={amount} 
            selectedTag={selectedTag}
            onItemizedTotalChange={handleItemizedTotalChange}
          />
          
          {/* 显示汇率换算历史 */}
          {currencyConversions.length > 0 && (
            <div className="currency-history">
              <h4>汇率换算记录:</h4>
              {currencyConversions.map((conversion, index) => (
                <div key={index} className="conversion-record">
                  {conversion.originalAmount} {conversion.from} → {conversion.convertedAmount} {conversion.to} (汇率: {conversion.rate})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* 位置和图片并排 */}
      <div className="location-photo-row">
        <div className="location-section">
          <Geolocation location={location} setLocation={setLocation} skipAutoLocation={skipAutoLocation} />
        </div>
        <div className="photo-section">
          <CompactPhotoUpload 
            onPhotoChange={handlePhotoChange}
            initialPhoto={photos.length > 0 ? photos[0] : null}
          />
        </div>
      </div>
      
      {/* 时间选择 */}
      <div className="datetime-section">
        <MobileFriendlyDateTime 
          value={selectedDateTime}
          onChange={setSelectedDateTime}
        />
      </div>
      
      <Output output={output} />
      <Log setLog={setLog} log={log} />
      
      {/* 提交按钮移到最下方 */}
      <div className="submit-section">
        <button className="submit" onClick={handleSubmit}  disabled={isSubmitting || !amount || !selectedTag || !input}>
          {isSubmitting ? '提交中...' : (!amount || !selectedTag || !input)?(!amount?'请填入金额':'请先输入内容'):'提交'}
        </button>
        <button className="resubmit" onClick={handleSubmitAndDuplicate}  disabled={isSubmitting || !amount || !selectedTag || !input}>
          {isSubmitting ? '提交中...' : (!amount || !selectedTag || !input)?(!amount?'请填入金额':'请先输入内容'):'下一笔'}
        </button>
      </div>

      {/* 调试信息 - 仅在开发环境显示 */}
      {process.env.NODE_ENV === 'development' && photos.length > 0 && (
        <div className="help-message">
          <h4>照片调试信息:</h4>
          <pre style={{fontSize: '10px', textAlign: 'left'}}>
            {JSON.stringify({
              count: photos.length,
              photos: photos.map(photo => ({
                filename: photo.filename,
                originalSize: photo.originalSize,
                compressedSize: photo.compressedSize,
                type: photo.type,
                base64Length: photo.base64 ? photo.base64.length : 0,
                hasUploadedUrl: !!photo.uploadedUrl
              }))
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
