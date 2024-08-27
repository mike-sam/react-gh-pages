import React, { useState, useEffect } from 'react';

function Remark({ remark, setRemark, selectedTag, input, amount }) {
    const [carPlate, setCarPlate] = useState('');
    const [customCarPlate, setCustomCarPlate] = useState('');
    const [fuelType, setFuelType] = useState('ron95');
    const [mileage, setMileage] = useState('');
    const [tripInfo, setTripInfo] = useState('');
    const [averagePrice, setAveragePrice] = useState(0);

    const carPlates = ['PPQ8777', 'WD6060E'];

    useEffect(() => {
        if (selectedTag === '交通出行' && input === '打油') {
            const price = parseFloat(amount) || 0;
            const trip = parseFloat(tripInfo) || 1;
            setAveragePrice((price / trip).toFixed(2));
        }
    }, [amount, tripInfo, selectedTag, input]);

    const renderSpecialInputs = () => {
        if (selectedTag === '交通出行' && input === '打油') {
            return (
                <div className="special-inputs">
                    <select 
                        className="remark-select"
                        value={carPlate} 
                        onChange={(e) => {
                            setCarPlate(e.target.value);
                            if (e.target.value !== 'other') {
                                setCustomCarPlate('');
                            }
                        }}
                    >
                        <option value="">Select Car Plate</option>
                        {carPlates.map(plate => <option key={plate} value={plate}>{plate}</option>)}
                        <option value="other">Other</option>
                    </select>
                    {carPlate === 'other' && (
                        <input 
                            type="text" 
                            value={customCarPlate} 
                            onChange={(e) => setCustomCarPlate(e.target.value)} 
                            placeholder="输入车牌号码"
                        />
                    )}
                    <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="remark-select">
                        <option value="">Select Fuel Type</option>
                        <option value="ron95">RON95</option>
                        <option value="ron97">RON97</option>
                    </select>
                    <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Mileage" />
                    <input type="number" value={tripInfo} onChange={(e) => setTripInfo(e.target.value)} placeholder="Trip (km)" />
                    <p>Average Price/km: RM {averagePrice}</p>
                </div>
            );
        } else {
            return (
                <textarea 
                className="content-remark"
                value={remark} 
                onChange={(e) => setRemark(e.target.value)} 
                placeholder="输入内容"
            />
            )
        }
        return null;
    };

    return (
        <div id="remark-container">
            {renderSpecialInputs()}
            
        </div>
    );
}

export default Remark;