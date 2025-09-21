import React, { useState, useEffect } from 'react';
import ItemizedDescription from './components/ItemizedDescription';
import UnifiedInput from './components/UnifiedInput';
import NumberPad from './components/NumberPad';

function Remark({ remark, setRemark, setCarPlate, carPlate, selectedTag, input, amount, onItemizedTotalChange }) {
    const [fuelPrice, setFuelPrice] = useState('2.05');
    const [fuelType, setFuelType] = useState('ron95');
    const [mileage, setMileage] = useState('');
    const [tripInfo, setTripInfo] = useState('');
    const [averagePrice, setAveragePrice] = useState(0);
    const [averageLitterPer100Km, setLitterPer100Km] = useState(0);

    const carPlates = ['PPQ8777', 'WD6060E'];

    useEffect(() => {
        if (selectedTag === '交通出行' && input === '打油' && tripInfo && amount) {
            const price = parseFloat(amount) || 0;
            const trip = parseFloat(tripInfo) || 0;
            const fuel_price = parseFloat(fuelPrice) || 2.05;
            
            if (trip > 0 && price > 0) {
                // 计算每公里花费
                setAveragePrice((price / trip).toFixed(2));
                
                // 计算油耗相关指标
                let totalLiters = price / fuel_price; // 总升数
                let litersPer100Km = (totalLiters / trip) * 100; // 每100公里油耗
                
                if (typeof(litersPer100Km) === 'number' && litersPer100Km !== Infinity && !isNaN(litersPer100Km)) {
                    setLitterPer100Km(litersPer100Km.toFixed(2));
                } else {
                    setLitterPer100Km('');
                }
            } else {
                setAveragePrice(0);
                setLitterPer100Km('');
            }
        } else {
            setAveragePrice(0);
            setLitterPer100Km('');
        }
    }, [amount, tripInfo, selectedTag, input, fuelPrice]);

    const validateCarPlate = (e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            const value = e.target.value;
            setCarPlate(value);
        } else {
            const value = e.target.value;
            const sanitizedValue = value.replace(/[^a-z0-9\s]/gi, '');
            setCarPlate(sanitizedValue);
        }
    };

    const validateFuelPrice = (e) => {
        if (e.key === 'Backspace') {
            setFuelPrice(prev => prev.slice(0, -1));
        } else if (e.key === 'Delete'){
            setFuelPrice('');
        } else {
            const value = e.target.value;
            const sanitizedValue = value.replace(/[^0-9.]/gi, '');
            setFuelPrice(sanitizedValue);
        }
    };
    const renderSpecialInputs = () => {
        let vehicle_related = ['打油', '洗车美容', '维修保养', '车险','停车费','车贷'];
        if (selectedTag === '交通出行' && vehicle_related.includes(input)) {
            let anotherFuelPrice = fuelType === 'ron95' ? 3.15 : 2.05;
            let anotherFuelType = fuelType === 'ron95' ? 'ron97' : 'ron95';
            let anotherAveragePrice = (anotherFuelPrice*averageLitterPer100Km/100).toFixed(2);
            return (
                <div className="special-inputs">
                    <div className="input-group">
                        <label>Car Plate:</label>
                        <div className="radio-group">
                            {carPlates.map(plate => (
                                <label key={plate} className="radio-label">
                                    <input
                                        type="radio"
                                        value={plate}
                                        checked={carPlate === plate}
                                        onChange={(e) => setCarPlate(e.target.value)}
                                    />
                                    {plate}
                                </label>
                            ))}
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    value="other"
                                    checked={!carPlates.includes(carPlate)}
                                    onChange={(e) => setCarPlate(e.target.value)}
                                />
                                Other
                            </label>
                        </div>
                    </div>
                    {!carPlates.includes(carPlate) && (
                        <div className="input-group">
                            <UnifiedInput 
                                type="text" 
                                value={carPlate === 'other'?'':carPlate}
                                onChange={validateCarPlate}
                                placeholder="输入车牌号码"
                                label="自定义车牌"
                            />
                        </div>
                    )}
                    {!['车贷','洗车美容'].includes(input) && (
                        <div className="input-group">
                            <NumberPad 
                                value={mileage} 
                                onChange={(e) => setMileage(e.target.value)}
                                label="里程数"
                                placeholder="输入里程数"
                            />
                        </div>
                    )}
                    {input === '维修保养' && (
                        <div className="input-group">
                            <textarea 
                                value={remark.split('\n').find(line => line.startsWith('零件: '))?.replace('零件: ', '') || ''}
                                onChange={(e) => {
                                    const parts = remark.split('\n').filter(line => !line.startsWith('零件: '));
                                    if (e.target.value.trim()) {
                                        parts.push(`零件: ${e.target.value}`);
                                    }
                                    setRemark(parts.join('\n'));
                                    setUserEditedRemark(true);
                                }}
                                placeholder="更换的零件 (例如: 机油滤芯、刹车片等)"
                                className="unified-input parts-input"
                                rows="2"
                            />
                        </div>
                    )}
                    {input === '车险' && (
                        <div className="input-group">
                            <UnifiedInput
                                type="date"
                                value={remark.split('\n').find(line => line.startsWith('保险日期: '))?.replace('保险日期: ', '') || ''}
                                onChange={(e) => {
                                    const parts = remark.split('\n').filter(line => !line.startsWith('保险日期: '));
                                    if (e.target.value) {
                                        parts.push(`保险日期: ${e.target.value}`);
                                    }
                                    setRemark(parts.join('\n'));
                                    setUserEditedRemark(true);
                                }}
                                label="保险日期"
                            />
                        </div>
                    )}
                    {input === '打油' && (
                        <>
                        <div className="input-group">
                            <label>Fuel Type:</label>
                            <div className="radio-group">
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        value="ron95"
                                        checked={fuelType === 'ron95'}
                                        onChange={(e) => {setFuelType(e.target.value);setFuelPrice(2.05)}}
                                    />
                                    RON95
                                </label>
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        value="ron97"
                                        checked={fuelType === 'ron97'}
                                        onChange={(e) => {setFuelType(e.target.value);setFuelPrice(3.15)}}
                                    />
                                    RON97
                                </label>
                                <input type="number" value={fuelPrice} onChange={validateFuelPrice} placeholder="Fuel Price per litter" className="custom-input fuel-price-input" />
                            </div>
                        </div>
                        <div className="input-group">
                            <NumberPad 
                                value={tripInfo} 
                                onChange={(e) => setTripInfo(e.target.value)}
                                label="行程距离"
                                placeholder="输入行程(km)"
                                allowDecimal={true}
                            />
                        </div>
                        {averagePrice > 0 && averageLitterPer100Km && (
                            <div className="fuel-calculation-results">
                                <h5 style={{margin: '10px 0 5px 0', color: '#007bff'}}>⛽ 油耗计算结果:</h5>
                                <div className="fuel-stats">
                                    <div className="fuel-stat-item">
                                        <span className="label">每公里成本:</span>
                                        <span className="value">RM {averagePrice}[{fuelType.toUpperCase()}]</span>
                                    </div>
                                    <div className="fuel-stat-item">
                                        <span className="label">每100公里油耗:</span>
                                        <span className="value">{averageLitterPer100Km} 升</span>
                                    </div>
                                    <div className="fuel-stat-item">
                                        <span className="label">每升公里数:</span>
                                        <span className="value">{((parseFloat(tripInfo) || 0) / ((parseFloat(amount) || 0) / (parseFloat(fuelPrice) || 2.05))).toFixed(2)} km/L</span>
                                    </div>
                                    <div className="fuel-stat-item">
                                        <span className="label">对比[{anotherFuelType.toUpperCase()}]:</span>
                                        <span className="value">RM {anotherAveragePrice}/km</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        </>
                    )}
                </div>
            );
        }
        
        // For non-vehicle categories, show itemized description
        return (
            <ItemizedDescription 
                initialValue={remark}
                onChange={setRemark}
                totalAmount={parseFloat(amount) || 0}
                onItemizedTotalChange={onItemizedTotalChange}
            />
        )

    };

    // const formatRemark = 

    // Generate auto-formatted remark for car-related expenses
    const generateAutoRemark = () => {
        if (selectedTag === '交通出行') {
            let anotherFuelPrice = fuelType === 'ron95' ? 3.15 : 2.05;
            let anotherFuelType = fuelType === 'ron95' ? 'ron97' : 'ron95';
            let anotherAveragePrice = (anotherFuelPrice*averageLitterPer100Km/100).toFixed(2);
            const sections = {
                carPlate: carPlate && `CarPlate: ${carPlate}`,
                fuelInfo: input === '打油' && [
                    tripInfo && `Trip: ${tripInfo}km`,
                    `Fuel Type: ${fuelType.toUpperCase()}`,
                    `RM${averagePrice}/km[${fuelType}]`,
                    `RM${anotherAveragePrice}/km[${anotherFuelType}]`,
                    `${averageLitterPer100Km} litter for 100 km`,
                ],
                mileage: !['车贷','洗车美容'].includes(input) && 
                    mileage && `ODO: ${mileage}`
            };
    
            return Object.values(sections)
                .flat()
                .filter(Boolean)
                .join('\n');
        }
        return '';
    };

    // Auto-fill remark when car details change, but only if user hasn't manually edited
    const [userEditedRemark, setUserEditedRemark] = useState(false);
    
    // Reset user edit flag when tag or input changes
    useEffect(() => {
        setUserEditedRemark(false);
    }, [selectedTag, input]);
    
    useEffect(() => {
        if (selectedTag === '交通出行' && !userEditedRemark) {
            const autoRemark = generateAutoRemark();
            if (autoRemark !== remark) {
                setRemark(autoRemark);
            }
        }
    }, [carPlate, fuelType, tripInfo, averagePrice, mileage, input, selectedTag, averageLitterPer100Km, userEditedRemark]);

    // Handle manual remark changes
    const handleRemarkChange = (e) => {
        setRemark(e.target.value);
        setUserEditedRemark(true);
    };
    return (
        <div id="remark-container">
            {renderSpecialInputs()}
            
        </div>
    );
}

export default Remark;

