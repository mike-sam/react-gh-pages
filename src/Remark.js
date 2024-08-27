import React, { useState, useEffect } from 'react';

function Remark({ remark, setRemark, selectedTag, input, amount }) {
    const [carPlate, setCarPlate] = useState('WD6060E');
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
        let vehicle_related = ['打油', '洗车美容', '维修保养', '车险','停车费','车贷'];
        if (selectedTag === '交通出行' && vehicle_related.includes(input)) {
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
                                    checked={carPlate === 'other'}
                                    onChange={(e) => setCarPlate(e.target.value)}
                                />
                                Other
                            </label>
                        </div>
                    </div>
                    {carPlate === 'other' && (
                        <div className="input-group">
                            <input 
                                type="text" 
                                value={customCarPlate} 
                                onChange={(e) => setCustomCarPlate(e.target.value)} 
                                placeholder="Enter custom plate number"
                                className="custom-input"
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
                                        onChange={(e) => setFuelType(e.target.value)}
                                    />
                                    RON95
                                </label>
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        value="ron97"
                                        checked={fuelType === 'ron97'}
                                        onChange={(e) => setFuelType(e.target.value)}
                                    />
                                    RON97
                                </label>
                            </div>
                        </div>
                        <div className="input-group">
                            <input type="number" value={tripInfo} onChange={(e) => setTripInfo(e.target.value)} placeholder="Trip (km)" className="custom-input" />
                        </div>
                        <p>Average Price/km: RM {averagePrice}</p>
                        </>
                    )}
                    {!['车贷','洗车美容'].includes(input) && (
                        <div className="input-group">
                            <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Mileage" className="custom-input" />
                        </div>
                    )}
                    
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

