import React from 'react';
import PageChrome from '../components/PageChrome';
import CalendarTracker from '../components/CalendarTracker';
import '../App.css';

function CalendarPage() {
  return (
    <PageChrome title="行事曆軌跡" showLocationBar>
      <div className="app-container feature-page">
        <CalendarTracker />
      </div>
    </PageChrome>
  );
}

export default CalendarPage;
