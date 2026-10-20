import React from 'react';

const DEFAULT_PLATES = ['PPQ8777', 'WD6060E'];

const VEHICLE_SUBCATS = ['打油', '洗车美容', '维修保养', '车险', '停车费', '车贷'];

export function needsCarPlate(selectedTag, input) {
  return selectedTag === '交通出行' && VEHICLE_SUBCATS.includes(input);
}

/** Quick plate chips near amount — triggers Remark mileage AJAX early via setCarPlate */
function QuickPlateSelect({ selectedTag, input, carPlate, setCarPlate, plates = DEFAULT_PLATES }) {
  if (!needsCarPlate(selectedTag, input) || !setCarPlate) return null;

  return (
    <div className="quick-plate-select">
      <span className="quick-plate-label">車牌</span>
      <div className="quick-plate-chips">
        {plates.map((plate) => (
          <button
            key={plate}
            type="button"
            className={`quick-plate-chip${carPlate === plate ? ' is-active' : ''}`}
            onClick={() => setCarPlate(plate)}
          >
            {plate}
          </button>
        ))}
      </div>
      {carPlate && plates.includes(carPlate) && (
        <span className="quick-plate-hint">已選 · 里程預載中</span>
      )}
    </div>
  );
}

export default QuickPlateSelect;
