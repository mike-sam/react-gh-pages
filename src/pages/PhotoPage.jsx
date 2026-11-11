import React from 'react';
import PageChrome from '../components/PageChrome';
import LifePhotoPanel from '../components/LifePhotoPanel';
import '../App.css';

function PhotoPage() {
  return (
    <PageChrome title="拍照記錄">
      <div className="app-container feature-page">
        <LifePhotoPanel />
      </div>
    </PageChrome>
  );
}

export default PhotoPage;
