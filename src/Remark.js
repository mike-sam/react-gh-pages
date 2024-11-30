import React, { useState, useEffect } from 'react';

function Remark({ remark, setRemark, setCarPlate, carPlate, selectedTag, input, amount }) {
    const [fuelPrice, setFuelPrice] = useState('2.05');
    const [fuelType, setFuelType] = useState('ron95');
    const [mileage, setMileage] = useState('');
    const [tripInfo, setTripInfo] = useState('');
    const [averagePrice, setAveragePrice] = useState(0);
    const [averageLitterPer100Km, setLitterPer100Km] = useState(0);

    const carPlates = ['PPQ8777', 'WD6060E'];

    useEffect(() => {
        if (selectedTag === '交通出行' && input === '打油') {
            const price = parseFloat(amount) || 0;
            const trip = parseFloat(tripInfo) || 1;
            setAveragePrice((price / trip).toFixed(2));
            let totalLitter = price/fuelPrice;
            let kmPer100Km = totalLitter/trip*100;
            setLitterPer100Km('');
            if(typeof(kmPer100Km) == 'number' && kmPer100Km != Infinity){
                setLitterPer100Km(kmPer100Km.toFixed(2));
            }
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
                            <input 
                                type="text" 
                                value={carPlate === 'other'?'':carPlate}
                                onChange={validateCarPlate}
                                placeholder="Enter custom plate number"
                                className="custom-input car-plate-input"
                            />
                        </div>
                    )}
                    {!['车贷','洗车美容'].includes(input) && (
                        <div className="input-group">
                            <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Mileage" className="custom-input" />
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
                            <input type="number" value={tripInfo} onChange={(e) => setTripInfo(e.target.value)} placeholder="Trip (km)" className="custom-input" />
                        </div>
                        {averagePrice > 0 && (<p>RM{averagePrice}/km[{fuelType}] RM{anotherAveragePrice}/km[{anotherFuelType}] <code style={{color:'red'}}>or</code> {averageLitterPer100Km} litter for 100 km</p>)}
                        </>
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

    };

    // const formatRemark = 

    useEffect(() => {
        setRemark(() => {
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
            } else {
                return remark;
            }
        });
    }, [carPlate, fuelType, tripInfo, averagePrice, mileage, input, setRemark, remark, selectedTag, averageLitterPer100Km]);
    return (
        <div id="remark-container">
            {renderSpecialInputs()}
            
        </div>
    );
}

export default Remark;

