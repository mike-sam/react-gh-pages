import React, { useState } from 'react';

const MobileOptimizedLayout = ({ 
  children, 
  currentStep, 
  onStepChange,
  steps = ['category', 'amount', 'payment', 'description'] 
}) => {
  const [isStepperVisible, setIsStepperVisible] = useState(true);

  const stepLabels = {
    category: '1. 选择分类',
    amount: '2. 输入金额',
    payment: '3. 付款方式',
    description: '4. 添加描述'
  };

  const handleStepClick = (step) => {
    if (onStepChange) {
      onStepChange(step);
    }
  };

  return (
    <div className="mobile-optimized-layout">
      {/* 步骤指示器 */}
      <div className="step-indicator">
        <div className="steps-container">
          {steps.map((step, index) => (
            <button
              key={step}
              className={`step-button ${currentStep === step ? 'active' : ''} ${
                steps.indexOf(currentStep) > index ? 'completed' : ''
              }`}
              onClick={() => handleStepClick(step)}
            >
              <span className="step-number">{index + 1}</span>
              <span className="step-label">{stepLabels[step]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="content-area">
        {children}
      </div>

      {/* 底部导航 */}
      <div className="bottom-navigation">
        <button 
          className="nav-btn prev-btn"
          onClick={() => {
            const currentIndex = steps.indexOf(currentStep);
            if (currentIndex > 0) {
              handleStepClick(steps[currentIndex - 1]);
            }
          }}
          disabled={steps.indexOf(currentStep) === 0}
        >
          上一步
        </button>
        
        <button 
          className="nav-btn next-btn"
          onClick={() => {
            const currentIndex = steps.indexOf(currentStep);
            if (currentIndex < steps.length - 1) {
              handleStepClick(steps[currentIndex + 1]);
            }
          }}
          disabled={steps.indexOf(currentStep) === steps.length - 1}
        >
          下一步
        </button>
      </div>
    </div>
  );
};

export default MobileOptimizedLayout;
