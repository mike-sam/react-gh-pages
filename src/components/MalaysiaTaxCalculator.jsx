import React, { useState, useEffect } from 'react';

const MalaysiaTaxCalculator = ({ totalAmount, itemizedTotal, onTaxCalculation, onAmountSuggestion }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showDiscrepancySuggestions, setShowDiscrepancySuggestions] = useState(false);

  const calculatePossibleScenarios = (amount) => {
    return [];
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

  const calculateDiscrepancySuggestions = (itemized, total) => {
    if (!itemized || !total || Math.abs(itemized - total) < 0.01) {
      return [];
    }

    const difference = total - itemized;
    const suggestions = [];

    // 如果总额大于明细总额，推荐可能的税费组合
    if (difference > 0) {
      // 检查是否可能是服务费
      const serviceRates = [0.05, 0.10];
      serviceRates.forEach(rate => {
        const expectedServiceCharge = itemized * rate;
        if (Math.abs(expectedServiceCharge - difference) < 0.50) {
          suggestions.push({
            type: 'Service Charge',
            description: `${(rate * 100).toFixed(0)}% 服务费`,
            baseAmount: itemized.toFixed(2),
            taxAmount: expectedServiceCharge.toFixed(2),
            suggestedTotal: (itemized + expectedServiceCharge).toFixed(2),
            confidence: Math.max(0, 100 - Math.abs(expectedServiceCharge - difference) * 200)
          });
        }
      });

      // 检查是否可能是SST
      const sstRates = [0.06, 0.08];
      sstRates.forEach(rate => {
        const expectedSST = itemized * rate;
        if (Math.abs(expectedSST - difference) < 0.50) {
          suggestions.push({
            type: 'SST',
            description: `${(rate * 100).toFixed(0)}% SST`,
            baseAmount: itemized.toFixed(2),
            taxAmount: expectedSST.toFixed(2),
            suggestedTotal: (itemized + expectedSST).toFixed(2),
            confidence: Math.max(0, 100 - Math.abs(expectedSST - difference) * 200)
          });
        }
      });

      // 检查组合：服务费+SST
      serviceRates.forEach(serviceRate => {
        sstRates.forEach(sstRate => {
          const serviceCharge = itemized * serviceRate;
          const baseWithService = itemized + serviceCharge;
          const sst = baseWithService * sstRate;
          const totalWithTax = baseWithService + sst;
          
          if (Math.abs(totalWithTax - total) < 0.50) {
            suggestions.push({
              type: 'Service + SST',
              description: `${(serviceRate * 100).toFixed(0)}% 服务费 + ${(sstRate * 100).toFixed(0)}% SST`,
              baseAmount: itemized.toFixed(2),
              taxAmount: (serviceCharge + sst).toFixed(2),
              suggestedTotal: totalWithTax.toFixed(2),
              confidence: Math.max(0, 100 - Math.abs(totalWithTax - total) * 200),
              breakdown: {
                service: serviceCharge.toFixed(2),
                sst: sst.toFixed(2)
              }
            });
          }
        });
      });
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  };

  useEffect(() => {
    // 检查明细与总额差异
    if (itemizedTotal && totalAmount && Math.abs(itemizedTotal - totalAmount) > 0.01) {
      const discrepancySuggestions = calculateDiscrepancySuggestions(itemizedTotal, totalAmount);
      if (discrepancySuggestions.length > 0) {
        setShowDiscrepancySuggestions(true);
        setSuggestions(discrepancySuggestions);
        return;
      }
    } else {
      setShowDiscrepancySuggestions(false);
    }
    
    // 正常的税费计算
    const scenarios = calculatePossibleScenarios(totalAmount);
    setSuggestions(scenarios);
    
    if (onTaxCalculation && scenarios.length > 0) {
      onTaxCalculation(scenarios[0]);
    }
  }, [totalAmount, itemizedTotal]); // eslint-disable-line react-hooks/exhaustive-deps



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

  const applyDiscrepancySuggestion = (suggestion) => {
    if (onAmountSuggestion) {
      onAmountSuggestion(parseFloat(suggestion.suggestedTotal));
    }
    
    // 显示应用成功的提示
    const difference = (parseFloat(suggestion.suggestedTotal) - parseFloat(suggestion.baseAmount)).toFixed(2);
    alert(`已应用建议：\n明细总额: RM${suggestion.baseAmount}\n${suggestion.description}: RM${difference}\n建议总金额: RM${suggestion.suggestedTotal}`);
  };

  return (
    <div className="malaysia-tax-calculator">
      {showDiscrepancySuggestions ? (
        <>
          <h4>⚠️ 金额差异检测</h4>
          <p className="discrepancy-hint">
            明细总额 RM{itemizedTotal?.toFixed(2)} 与输入金额 RM{totalAmount.toFixed(2)} 不符
            <br />
            以下是可能的税费组合建议:
          </p>
          
          <div className="discrepancy-scenarios">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="discrepancy-scenario">
                <div className="scenario-header">
                  <span className="scenario-type">{suggestion.description}</span>
                  <span className="confidence-badge">
                    {suggestion.confidence.toFixed(0)}% 匹配
                  </span>
                  <button 
                    className="apply-suggestion-btn"
                    onClick={() => applyDiscrepancySuggestion(suggestion)}
                  >
                    采用建议
                  </button>
                </div>
                
                <div className="scenario-details">
                  <div className="tax-line">
                    <span>明细总额:</span>
                    <span>RM {suggestion.baseAmount}</span>
                  </div>
                  
                  <div className="tax-line">
                    <span>{suggestion.description}:</span>
                    <span>RM {suggestion.taxAmount}</span>
                  </div>
                  
                  {suggestion.breakdown && (
                    <div className="breakdown">
                      <div className="tax-line small">
                        <span>　├ 服务费:</span>
                        <span>RM {suggestion.breakdown.service}</span>
                      </div>
                      <div className="tax-line small">
                        <span>　└ SST:</span>
                        <span>RM {suggestion.breakdown.sst}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="tax-line total-line">
                    <span>建议总额:</span>
                    <span>RM {suggestion.suggestedTotal}</span>
                  </div>
                  
                  <div className="difference-line">
                    <span>与输入金额差异:</span>
                    <span>RM {(totalAmount - parseFloat(suggestion.suggestedTotal)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
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
                  
                  {parseFloat(scenario.serviceCharge || 0) > 0 && (
                    <div className="tax-line">
                      <span>服务费 ({scenario.serviceRate}):</span>
                      <span>RM {scenario.serviceCharge}</span>
                    </div>
                  )}
                  
                  {parseFloat(scenario.sst || 0) > 0 && (
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
        </>
      )}
    </div>
  );
};

export default MalaysiaTaxCalculator;
