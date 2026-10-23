import React from 'react';
import {
  loadVehicleRoster,
  VEHICLE_EXPENSE_SUBCATS,
  vehicleNeedsOdo,
} from '../utils/vehicles';

const VEHICLE_SUBCATS = VEHICLE_EXPENSE_SUBCATS;

export function needsCarPlate(selectedTag, input) {
  return selectedTag === '交通出行' && VEHICLE_SUBCATS.includes(input);
}

/** Quick plate chips near amount — triggers Remark mileage AJAX early via setCarPlate */
function QuickPlateSelect({ selectedTag, input, carPlate, setCarPlate, plates = loadVehicleRoster() }) {
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
      {carPlate && plates.includes(carPlate) && vehicleNeedsOdo(selectedTag, input) ? (
        <span className="quick-plate-hint">已選 · 里程預載中</span>
      ) : null}
    </div>
  );
}

export default QuickPlateSelect;
