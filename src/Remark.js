import React, { useState, useEffect } from 'react';
import ItemizedDescription from './components/ItemizedDescription';
import UnifiedInput from './components/UnifiedInput';
import NumberPad from './components/NumberPad';
import { API_ENDPOINTS } from './config';
import { getKeyValue } from './utils/keyValueCache';

function Remark({ remark, setRemark, setCarPlate, carPlate, selectedTag, input, amount, onItemizedTotalChange, mileage, setMileage, tripInfo, setTripInfo, simpleDescription, setSimpleDescription, onFuelDataChange, onPhotoAdd}) {
    const [fuelPrice, setFuelPrice] = useState('2.05');
    const [fuelType, setFuelType] = useState('ron95');
    const [averagePrice, setAveragePrice] = useState(0);
    
    // 当 fuelPrice 或 fuelType 改变时，通知父组件
    useEffect(() => {
        if (onFuelDataChange) {
            onFuelDataChange({ fuelPrice, fuelType });
        }
    }, [fuelPrice, fuelType, onFuelDataChange]);

    // 格式化记录时间为 YYYY-MMM-DD HH:ii:ss (Weekday)
    const formatRecordTime = (recordTime) => {
        if (!recordTime) return '';
        
        try {
            // 如果 recordTime 是字符串，尝试解析为日期
            const date = typeof recordTime === 'string' ? new Date(recordTime) : recordTime;
            
            // 检查日期是否有效
            if (isNaN(date.getTime())) {
                return recordTime; // 如果无法解析，返回原始值
            }
            
            // 月份缩写数组
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            // 星期缩写数组
            const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            
            const year = date.getFullYear();
            const month = monthNames[date.getMonth()];
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            const weekday = weekdayNames[date.getDay()];
            
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (${weekday})`;
        } catch (error) {
            console.error('Error formatting recordTime:', error);
            return recordTime; // 如果出错，返回原始值
        }
    };
    const [averageLitterPer100Km, setLitterPer100Km] = useState(0);
    const [isLoadingMileage, setIsLoadingMileage] = useState(false);
    const [lastMileage, setLastMileage] = useState(null); // 保存获取到的最新里程数
    const [lastMileageRecord, setLastMileageRecord] = useState(null); // 保存最后一次里程记录信息

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
        
        // 显示上一次费用记录（对于特定tag：仪容服饰|理发、水电气网|水费/电费/网络费）
        const showLastExpense = lastExpense && !isLoadingLastExpense && expenseHistoryTags[selectedTag] && expenseHistoryTags[selectedTag].includes(input);
        
        if (selectedTag === '交通出行' && vehicle_related.includes(input)) {
            let anotherFuelPrice = fuelType === 'ron95' ? 3.15 : 2.05;
            let anotherFuelType = fuelType === 'ron95' ? 'ron97' : 'ron95';
            let anotherAveragePrice = (anotherFuelPrice*averageLitterPer100Km/100).toFixed(2);
            // 显示上一笔记录信息（所有交通出行分类都显示）
            const showLastRecord = lastMileageRecord && !isLoadingMileage;
            
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
                        {isLoadingMileage && (
                            <div style={{fontSize: '12px', color: '#666', marginTop: '10px'}}>
                                正在获取 {carPlate} 的里程记录...
                            </div>
                        )}
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
                                onChange={(e) => {
                                    const newMileage = e.target.value;
                                    setMileage(newMileage);
                                    setUserEditedMileage(true); // 标记里程数为用户手动编辑
                                    
                                    // 如果输入的里程数 > 上次里程数，自动计算行程距离
                                    if (lastMileage !== null && lastMileage > 0 && newMileage && newMileage.trim() !== '') {
                                        const currentMileage = parseFloat(newMileage);
                                        if (!isNaN(currentMileage) && currentMileage > 0 && currentMileage > lastMileage) {
                                            const calculatedTrip = currentMileage - lastMileage;
                                            setTripInfo(calculatedTrip.toFixed(1));
                                            setUserEditedTripInfo(false); // 自动填充不算用户编辑
                                            console.log(`自动计算行程距离: ${calculatedTrip.toFixed(1)}km (${currentMileage} - ${lastMileage})`);
                                        }
                                    }
                                }}
                                label="里程数"
                                placeholder={isLoadingMileage ? "正在获取..." : lastMileage !== null ? `上次: ${lastMileage}` : "输入里程数"}
                                disabled={isLoadingMileage}
                            />
                            {isLoadingMileage && (
                                <div style={{fontSize: '12px', color: '#666', marginLeft: '10px', marginTop: '5px'}}>
                                    正在获取最新里程...
                                </div>
                            )}
                            {lastMileageRecord && !isLoadingMileage && input === '打油' && (
                                <div style={{fontSize: '12px', color: '#007bff', marginLeft: '10px', marginTop: '5px', padding: '8px', backgroundColor: '#f0f8ff', borderRadius: '4px', border: '1px solid #007bff'}}>
                                    <div style={{fontWeight: 'bold', marginBottom: '4px'}}>📊 上一笔记录:</div>
                                    <div>里程数: <strong>{lastMileageRecord.mileage}km</strong></div>
                                    <div>记录时间: {formatRecordTime(lastMileageRecord.recordTime)}</div>
                                    {lastMileageRecord.expenseType && (
                                        <div>类型: {lastMileageRecord.expenseType}</div>
                                    )}
                                    {mileage && parseFloat(mileage) > lastMileage && (
                                        <div style={{marginTop: '4px', color: '#28a745', fontWeight: 'bold'}}>
                                            本次行程: {(parseFloat(mileage) - lastMileage).toFixed(1)}km
                                        </div>
                                    )}
                                </div>
                            )}
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
                                        onChange={async (e) => {
                                            setFuelType(e.target.value);
                                            // 从缓存获取RON97价格
                                            const result = await getKeyValue('ron97_price');
                                            if (result.success && result.value) {
                                                const price = parseFloat(result.value);
                                                if (!isNaN(price) && price > 0) {
                                                    setFuelPrice(price.toString());
                                                } else {
                                                    setFuelPrice('3.15'); // 默认值
                                                }
                                            } else {
                                                setFuelPrice('3.15'); // 默认值
                                            }
                                        }}
                                    />
                                    RON97
                                </label>
                                <input type="number" value={fuelPrice} onChange={validateFuelPrice} placeholder="Fuel Price per litter" className="custom-input fuel-price-input" />
                            </div>
                        </div>
                        <div className="input-group">
                            <NumberPad 
                                value={tripInfo} 
                                onChange={(e) => {
                                    const newTripInfo = e.target.value;
                                    setTripInfo(newTripInfo);
                                    setUserEditedTripInfo(true); // 标记行程距离为用户手动编辑
                                    
                                    // 如果输入了行程距离，自动计算当前里程数（上次里程 + 行程距离）
                                    if (lastMileage !== null && lastMileage > 0 && newTripInfo && newTripInfo.trim() !== '') {
                                        const trip = parseFloat(newTripInfo);
                                        if (!isNaN(trip) && trip > 0) {
                                            const calculatedMileage = lastMileage + trip;
                                            const mileageStr = calculatedMileage.toFixed(0);
                                            setMileage(mileageStr);
                                            setUserEditedMileage(false); // 自动填充不算用户编辑
                                            console.log(`自动计算当前里程数: ${mileageStr} (${lastMileage} + ${trip})`);
                                        }
                                    } else if (!newTripInfo || newTripInfo.trim() === '') {
                                        // 如果清空了行程距离，也清空里程数（如果里程数是由行程距离自动计算的）
                                        if (!userEditedMileage) {
                                            setMileage('');
                                        }
                                    }
                                }}
                                label="行程距离"
                                placeholder={lastMileage !== null ? `输入行程(km)，将自动计算里程数` : "输入行程(km)"}
                                allowDecimal={true}
                            />
                        </div>
                        {averagePrice > 0 && averageLitterPer100Km && (
                            <div className="fuel-calculation-results">
                                <div className="fuel-results-header">
                                    <span className="fuel-icon">⛽</span>
                                    <h5>油耗计算结果</h5>
                                </div>
                                <div className="fuel-stats-compact">
                                    <div className="fuel-stat-card-compact comparison-combined-compact">
                                        <div className="stat-icon-compact">💰</div>
                                        <div className="stat-content-compact">
                                            <div className="stat-label-compact">每公里成本对比</div>
                                            <div className="cost-comparison-compact">
                                                    <div className="cost-item-compact current">
                                                        <div className="cost-badge-compact">目前</div>
                                                        <div className="cost-type-compact">{fuelType.toUpperCase()}</div>
                                                        <div className="cost-value-compact">RM {averagePrice}</div>
                                                        <div className="cost-rm1-compact">RM1可行驶: {(1 / parseFloat(averagePrice)).toFixed(2)}km</div>
                                                    </div>
                                                    <div className="cost-divider-compact">vs</div>
                                                    <div className="cost-item-compact compare">
                                                        <div className="cost-type-compact">{anotherFuelType.toUpperCase()}</div>
                                                        <div className="cost-value-compact">RM {anotherAveragePrice}</div>
                                                        <div className="cost-rm1-compact">RM1可行驶: {(1 / parseFloat(anotherAveragePrice)).toFixed(2)}km</div>
                                                    </div>
                                            </div>
                                            <div className="cost-difference-compact">
                                                <div className="cost-difference-main">
                                                    {parseFloat(averagePrice) < parseFloat(anotherAveragePrice) ? (
                                                        <span className="saving">节省 RM {(parseFloat(anotherAveragePrice) - parseFloat(averagePrice)).toFixed(2)}/km</span>
                                                    ) : (
                                                        <span className="extra">多花 RM {(parseFloat(averagePrice) - parseFloat(anotherAveragePrice)).toFixed(2)}/km</span>
                                                    )}
                                                </div>
                                                {(() => {
                                                    const trip = parseFloat(tripInfo) || 0;
                                                    const priceDiff = parseFloat(averagePrice) - parseFloat(anotherAveragePrice);
                                                    const totalSavings = Math.abs(priceDiff * trip);
                                                    const kmDiff = (1 / parseFloat(averagePrice)) - (1 / parseFloat(anotherAveragePrice));
                                                    const totalKmDiff = Math.abs(kmDiff * (parseFloat(amount) || 0));
                                                    
                                                    return (
                                                        <div className="cost-total-savings-inline">
                                                            {priceDiff < 0 && trip > 0 && (
                                                                <span className="savings-inline">
                                                                    <span className="savings-icon-inline">💰</span>
                                                                    <span>总共节省: <strong>RM {totalSavings.toFixed(2)}</strong></span>
                                                                </span>
                                                            )}
                                                            {priceDiff > 0 && trip > 0 && (
                                                                <span className="savings-inline extra">
                                                                    <span className="savings-icon-inline">💰</span>
                                                                    <span>总共多花: <strong>RM {totalSavings.toFixed(2)}</strong></span>
                                                                </span>
                                                            )}
                                                            {kmDiff > 0 && (
                                                                <span className="savings-inline">
                                                                    <span className="savings-icon-inline">📏</span>
                                                                    <span>多行驶: <strong>{totalKmDiff.toFixed(2)} km</strong></span>
                                                                </span>
                                                            )}
                                                            {kmDiff < 0 && (
                                                                <span className="savings-inline extra">
                                                                    <span className="savings-icon-inline">📏</span>
                                                                    <span>少行驶: <strong>{totalKmDiff.toFixed(2)} km</strong></span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 加油升数bar，包含两个sub-bar */}
                                <div className="fuel-liters-bar-section">
                                    {(() => {
                                        const liters = (parseFloat(amount) || 0) / (parseFloat(fuelPrice) || 2.05);
                                        const kmPerLiter = (parseFloat(tripInfo) || 0) / (liters || 1);
                                        const litersPer100Km = parseFloat(averageLitterPer100Km) || 0;
                                        const trip = parseFloat(tripInfo) || 0;
                                        
                                        // 加油升数百分比（以100升为基准，用于显示）
                                        // 但bar的实际宽度应该根据实际升数来显示，48.8升应该占满100%宽度
                                        const maxLiters = 100; // 最大显示范围
                                        const litersPercent = Math.min((liters / maxLiters) * 100, 100);
                                        
                                        // 第一个sub-bar：每升公里数对应的升数 = 1升（作为参考）
                                        const kmPerLiterLiters = 1; // 固定为1升
                                        const kmPerLiterLitersPercent = (kmPerLiterLiters / 100) * 100; // 1升在100升基准中的百分比
                                        
                                        // 第二个sub-bar：每100公里油耗对应的升数
                                        // 如果每100km需要10升，那么显示10升
                                        const litersPer100KmLiters = litersPer100Km; // 直接使用每100公里油耗的升数
                                        const litersPer100KmLitersPercent = (litersPer100KmLiters / 100) * 100;
                                        
                                        // 在主bar内的百分比（相对于主bar的宽度，即相对于总升数）
                                        // 例如：总升数38L，1升 = 1/38 * 100% = 2.63%
                                        const kmPerLiterPercentInBar = liters > 0 ? (kmPerLiterLiters / liters) * 100 : 0;
                                        // 例如：总升数38L，10升 = 10/38 * 100% = 26.32%
                                        const litersPer100KmPercentInBar = liters > 0 ? (litersPer100KmLiters / liters) * 100 : 0;
                                        
                                        // 判断文字是否应该显示在右侧
                                        const showTextRight = litersPercent < 30 || kmPerLiterPercentInBar < 5 || litersPer100KmPercentInBar < 5;
                                        
                                        return (
                                            <div className="fuel-liters-bar-container">
                                                <div className="fuel-bar-label-main">
                                                    <span className="bar-icon">🛢️</span>
                                                    <span className="bar-text-main">加油升数: {liters.toFixed(2)} 升 (L)</span>
                                                </div>
                                                <div className="fuel-bar-main-wrapper">
                                                    <div className="fuel-bar-main-fill" style={{width: '100%'}}>
                                                        {/* Sub-bar 1: 每升公里数 - 显示1升（第一行） */}
                                                        {kmPerLiter > 0 && (
                                                            <>
                                                                <div 
                                                                    className="fuel-sub-bar km-per-liter-sub" 
                                                                    style={{
                                                                        width: `${Math.min(kmPerLiterPercentInBar, 100)}%`,
                                                                        top: '2px'
                                                                    }}
                                                                >
                                                                    {/* 每升的bar太小，不在bar内显示文字 */}
                                                                </div>
                                                                {/* 虚线标示 */}
                                                                <div 
                                                                    className="sub-bar-dash-line km-per-liter-dash" 
                                                                    style={{
                                                                        left: `${Math.min(kmPerLiterPercentInBar, 100)}%`,
                                                                        top: '2px'
                                                                    }}
                                                                ></div>
                                                                {/* 每升文字显示在sub-bar右侧（bar内） */}
                                                                <div 
                                                                    className="sub-bar-text-right km-per-liter-text" 
                                                                    style={{
                                                                        left: `${Math.min(kmPerLiterPercentInBar, 100)}%`,
                                                                        top: '2px'
                                                                    }}
                                                                >
                                                                    <span className="text-content">每升: {kmPerLiter.toFixed(2)}km (1L)</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {/* Sub-bar 2: 每100公里油耗 - 显示对应的升数（第二行） */}
                                                        {litersPer100Km > 0 && (
                                                            <>
                                                                <div 
                                                                    className="fuel-sub-bar liters-per-100km-sub" 
                                                                    style={{
                                                                        width: `${Math.min(litersPer100KmPercentInBar, 100)}%`,
                                                                        top: '20px'
                                                                    }}
                                                                >
                                                                    {litersPer100KmPercentInBar > 8 && (
                                                                        <div className="sub-bar-label">100km: {litersPer100Km}L</div>
                                                                    )}
                                                                </div>
                                                                {/* 虚线标示 */}
                                                                <div 
                                                                    className="sub-bar-dash-line liters-per-100km-dash" 
                                                                    style={{
                                                                        left: `${Math.min(litersPer100KmPercentInBar, 100)}%`,
                                                                        top: '20px'
                                                                    }}
                                                                ></div>
                                                                {/* 每100km文字显示在sub-bar右侧（bar内，如果bar太小） */}
                                                                {litersPer100KmPercentInBar <= 8 && (
                                                                    <div 
                                                                        className="sub-bar-text-right liters-per-100km-text" 
                                                                        style={{
                                                                            left: `${Math.min(litersPer100KmPercentInBar, 100)}%`,
                                                                            top: '20px'
                                                                        }}
                                                                    >
                                                                        <div className="text-color-indicator liters-per-100km-color"></div>
                                                                        <div className="text-dash-line"></div>
                                                                        <span className="text-content">100km: {litersPer100Km}L</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="fuel-bar-scale-container">
                                                    <div className="fuel-bar-scale-main">
                                                        <span className="scale-mark scale-left">0</span>
                                                        <span className="scale-mark scale-center">{liters > 0 ? (liters / 2).toFixed(1) : '0'}</span>
                                                        <span className="scale-mark scale-right">{liters.toFixed(1)} 升</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                        </>
                    )}
                </div>
            );
        }
        
        // 显示上一次费用记录（对于特定tag：仪容服饰|理发、水电气网|水费/电费/网络费）
        if (showLastExpense) {
            return (
                <div className="special-inputs">
                    {lastExpense && (
                        <div style={{marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px'}}>
                            <div style={{fontWeight: 'bold', marginBottom: '4px'}}>📊 上一笔记录:</div>
                            <div>金额: <strong>RM{lastExpense.amount}</strong></div>
                            <div>记录时间: {formatRecordTime(lastExpense.timestamp)}</div>
                        </div>
                    )}
                    <ItemizedDescription 
                        initialValue={remark}
                        onChange={setRemark}
                        totalAmount={parseFloat(amount) || 0}
                        onItemizedTotalChange={onItemizedTotalChange}
                        simpleDescription={simpleDescription}
                        setSimpleDescription={setSimpleDescription}
                        onPhotoAdd={onPhotoAdd}
                    />
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
                simpleDescription={simpleDescription}
                setSimpleDescription={setSimpleDescription}
                onPhotoAdd={onPhotoAdd}
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

    // 获取上一次金额和时间的tag列表
    const [lastExpense, setLastExpense] = useState(null);
    const [isLoadingLastExpense, setIsLoadingLastExpense] = useState(false);
    
    // 需要获取上一次记录的tag和title组合
    const expenseHistoryTags = {
        '仪容服饰': ['理发'],
        '水电气网': ['水费', '电费', '网络费']
    };
    
    // 当选择特定tag和title时，自动获取上一次金额和时间
    useEffect(() => {
        const fetchLastExpense = async () => {
            const shouldFetch = expenseHistoryTags[selectedTag] && expenseHistoryTags[selectedTag].includes(input);
            
            if (shouldFetch && !isLoadingLastExpense) {
                setIsLoadingLastExpense(true);
                try {
                    const url = `${API_ENDPOINTS.LAST_EXPENSE}?action=getLastExpense&tag=${encodeURIComponent(selectedTag)}&title=${encodeURIComponent(input)}`;
                    const response = await fetch(url);
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.lastExpense) {
                            setLastExpense(data.lastExpense);
                            console.log('Last expense:', data.lastExpense);
                        } else {
                            setLastExpense(null);
                        }
                    }
                } catch (error) {
                    console.warn('获取上一次费用失败:', error);
                    setLastExpense(null);
                } finally {
                    setIsLoadingLastExpense(false);
                }
            } else {
                setLastExpense(null);
            }
        };
        
        const timer = setTimeout(() => {
            fetchLastExpense();
        }, 300);
        
        return () => clearTimeout(timer);
    }, [selectedTag, input]);
    
    // 当选择车牌且是"交通出行"时，自动获取最新里程数（所有交通出行分类都需要）
    useEffect(() => {
        const fetchMileageData = async () => {
            // 选择"交通出行"且有车牌号时获取（不只是打油）
            const vehicleRelated = ['打油', '洗车美容', '维修保养', '车险', '停车费', '车贷'];
            if (selectedTag === '交通出行' && vehicleRelated.includes(input) && carPlate && carPlate !== 'other' && !isLoadingMileage) {
                setIsLoadingMileage(true);
                try {
                    // 根据 tag 和 input 生成 group，格式为 tag|input
                    const group = selectedTag && input ? `${selectedTag}|${input}` : '打油';
                    const url = `${API_ENDPOINTS.MILEAGE_DATA}?action=getMileageData&carPlate=${encodeURIComponent(carPlate)}&group=${encodeURIComponent(group)}`;
                    const response = await fetch(url);
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log('Mileage API response:', data);
                        
                        if (data.success && data.mileageData) {
                            const mileageData = data.mileageData;
                            const latestMileage = mileageData.latestMileage;
                            const latestRecord = mileageData.records && mileageData.records.length > 0 ? mileageData.records[0] : null;
                            
                            console.log('Mileage data:', {
                                latestMileage,
                                recordsCount: mileageData.records ? mileageData.records.length : 0,
                                latestRecord
                            });
                            
                            setLastMileage(latestMileage);
                            
                            // 保存最后一次记录信息（里程数和时间）
                            if (latestRecord) {
                                setLastMileageRecord({
                                    mileage: latestRecord.mileage,
                                    recordTime: latestRecord.recordTime,
                                    expenseType: latestRecord.expenseType
                                });
                            } else {
                                setLastMileageRecord(null);
                            }
                            
                            if (latestMileage > 0) {
                                console.log(`已获取车牌 ${carPlate} 的最新里程数: ${latestMileage}`, latestRecord);
                            } else {
                                console.warn(`车牌 ${carPlate} 没有找到里程记录，Mileage sheet可能是空的`);
                            }
                        } else {
                            console.warn('获取里程数据失败:', data.error || '未知错误');
                        }
                    } else {
                        console.error('API请求失败:', response.status, response.statusText);
                    }
                } catch (error) {
                    console.warn('获取里程数据失败:', error);
                    // 静默失败，不影响用户体验
                } finally {
                    setIsLoadingMileage(false);
                }
            } else {
                // 如果条件不满足，清空上次里程数和记录
                setLastMileage(null);
                setLastMileageRecord(null);
            }
        };

        // 延迟一下，避免频繁请求
        const timer = setTimeout(() => {
            fetchMileageData();
        }, 300);

        return () => clearTimeout(timer);
    }, [carPlate, selectedTag, input]);

    // 跟踪用户是否手动编辑了里程数或行程距离
    const [userEditedMileage, setUserEditedMileage] = useState(false);
    const [userEditedTripInfo, setUserEditedTripInfo] = useState(false);


    // 重置编辑标志当lastMileage变化时
    useEffect(() => {
        setUserEditedMileage(false);
        setUserEditedTripInfo(false);
    }, [lastMileage]);
    
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

