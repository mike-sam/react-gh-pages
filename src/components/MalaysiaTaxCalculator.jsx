import React, { useState, useEffect } from 'react';

const MalaysiaTaxCalculator = ({ totalAmount, onTaxCalculation }) => {
  const [suggestions, setSuggestions] = useState([]);

  const calculatePossibleScenarios = (amount) => {
    if (!amount || amount <= 0) return [];

    const scenarios = [];
    
    // SST rates (6% and 8%)
    const sstRates = [0.06, 0.08];
    // Service charge rates (5% and 10%)
    const serviceRates = [0.05, 0.10];

    // Scenario 1: Only Service Charge
    serviceRates.forEach(serviceRate => {
      const baseAmount = amount / (1 + serviceRate);
      const serviceCharge = baseAmount * serviceRate;
      
      if (Math.abs((baseAmount + serviceCharge) - amount) < 0.01) {
        scenarios.push({
          type: 'Service Charge Only',
          baseAmount: baseAmount.toFixed(2),
          serviceCharge: serviceCharge.toFixed(2),
          serviceRate: `${(serviceRate * 100).toFixed(0)}%`,
          sst: 0,
          sstRate: '0%',
          total: amount.toFixed(2),
          accuracy: 'exact'
        });
      }
    });

    // Scenario 2: Only SST
    sstRates.forEach(sstRate => {
      const baseAmount = amount / (1 + sstRate);
      const sst = baseAmount * sstRate;
      
      if (Math.abs((baseAmount + sst) - amount) < 0.01) {
        scenarios.push({
          type: 'SST Only',
          baseAmount: baseAmount.toFixed(2),
          serviceCharge: 0,
          serviceRate: '0%',
          sst: sst.toFixed(2),
          sstRate: `${(sstRate * 100).toFixed(0)}%`,
          total: amount.toFixed(2),
          accuracy: 'exact'
        });
      }
    });

    // Scenario 3: Service Charge first, then SST
    serviceRates.forEach(serviceRate => {
      sstRates.forEach(sstRate => {
        const baseAmount = amount / ((1 + serviceRate) * (1 + sstRate));
        const afterService = baseAmount * (1 + serviceRate);
        const serviceCharge = baseAmount * serviceRate;
        const sst = afterService * sstRate;
        const calculatedTotal = baseAmount + serviceCharge + sst;
        
        if (Math.abs(calculatedTotal - amount) < 0.01) {
          scenarios.push({
            type: 'Service → SST',
            baseAmount: baseAmount.toFixed(2),
            serviceCharge: serviceCharge.toFixed(2),
            serviceRate: `${(serviceRate * 100).toFixed(0)}%`,
            sst: sst.toFixed(2),
            sstRate: `${(sstRate * 100).toFixed(0)}%`,
            total: amount.toFixed(2),
            accuracy: 'exact'
          });
        }
      });
    });

    return scenarios.slice(0, 3); // Limit to top 3 most likely scenarios
  };

  useEffect(() => {
    const scenarios = calculatePossibleScenarios(totalAmount);
    setSuggestions(scenarios);
    
    if (onTaxCalculation && scenarios.length > 0) {
      onTaxCalculation(scenarios[0]); // Pass the most likely scenario
    }
  }, [totalAmount, onTaxCalculation]);

  const applyScenario = (scenario) => {
    if (onTaxCalculation) {
      onTaxCalculation(scenario);
    }
    
    // 可以在这里添加更多逻辑，比如将税费信息添加到描述中
    const taxInfo = `基础: RM${scenario.baseAmount}`;
    const serviceInfo = parseFloat(scenario.serviceCharge) > 0 ? ` + 服务费(${scenario.serviceRate}): RM${scenario.serviceCharge}` : '';
    const sstInfo = parseFloat(scenario.sst) > 0 ? ` + SST(${scenario.sstRate}): RM${scenario.sst}` : '';
    const fullInfo = `${taxInfo}${serviceInfo}${sstInfo} = RM${scenario.total}`;
    
    // 显示应用成功的提示
    alert(`已应用税费计算：\n${fullInfo}`);
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="malaysia-tax-calculator">
      <h4>🧮 马来西亚税费建议</h4>
      <p className="tax-hint">基于总金额 RM{totalAmount.toFixed(2)} 的可能计算方式:</p>
      
      <div className="tax-scenarios">
        {suggestions.map((scenario, index) => (
          <div key={index} className="tax-scenario">
            <div className="scenario-header">
              <span className="scenario-type">{scenario.type}</span>
              <button 
                className="apply-scenario-btn"
                onClick={() => applyScenario(scenario)}
              >
                应用
              </button>
            </div>
            
            <div className="scenario-details">
              <div className="tax-line">
                <span>基础金额:</span>
                <span>RM {scenario.baseAmount}</span>
              </div>
              
              {parseFloat(scenario.serviceCharge) > 0 && (
                <div className="tax-line">
                  <span>服务费 ({scenario.serviceRate}):</span>
                  <span>RM {scenario.serviceCharge}</span>
                </div>
              )}
              
              {parseFloat(scenario.sst) > 0 && (
                <div className="tax-line">
                  <span>SST ({scenario.sstRate}):</span>
                  <span>RM {scenario.sst}</span>
                </div>
              )}
              
              <div className="tax-line total-line">
                <span>总计:</span>
                <span>RM {scenario.total}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MalaysiaTaxCalculator;
