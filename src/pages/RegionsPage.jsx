import React from 'react';
import PageChrome from '../components/PageChrome';
import LandmarkRegionsManager from '../components/LandmarkRegionsManager';
import '../App.css';

function RegionsPage() {
  return (
    <PageChrome title="地圖管理">
      <div className="app-container feature-page">
        <LandmarkRegionsManager />
      </div>
    </PageChrome>
  );
}

export default RegionsPage;
