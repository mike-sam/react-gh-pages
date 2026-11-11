import React from 'react';
import PageChrome from '../components/PageChrome';
import EatWhatPanel from '../components/EatWhatModal';
import '../App.css';

function EatPage() {
  return (
    <PageChrome title="吃什麼">
      <div className="app-container feature-page">
        <EatWhatPanel />
      </div>
    </PageChrome>
  );
}

export default EatPage;
