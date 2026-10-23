import React from 'react';
import PageChrome from '../components/PageChrome';
import ParkingActions from '../components/ParkingActions';
import '../App.css';

function ParkingPage() {
  return (
    <PageChrome title="車輛">
      <div className="app-container feature-page">
        <ParkingActions />
      </div>
    </PageChrome>
  );
}

export default ParkingPage;
