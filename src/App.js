import React from 'react';
import { useHashRoute } from './hooks/useHashRoute';
import { ROUTES } from './utils/routing';
import EntryPage from './pages/EntryPage';
import ExpensePage from './pages/ExpensePage';
import CalendarPage from './pages/CalendarPage';
import ParkingPage from './pages/ParkingPage';
import './App.css';

/**
 * Hash routes (GitHub Pages friendly):
 *   #/           Entry Point
 *   #/expense    記帳
 *   #/calendar   行事曆軌跡
 *   #/parking    記車位 / 找車
 */
function App() {
  const path = useHashRoute();

  switch (path) {
    case ROUTES.EXPENSE:
      return <ExpensePage />;
    case ROUTES.CALENDAR:
      return <CalendarPage />;
    case ROUTES.PARKING:
      return <ParkingPage />;
    case ROUTES.HOME:
    default:
      return <EntryPage />;
  }
}

export default App;
