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
 *   #/expense    記帳（單筆 / 排程）
 *   #/expense?tab=scheduled  預定交易
 *   #/obligations 同上（相容舊連結）
 *   #/calendar   行事曆軌跡
 *   #/parking    記車位 / 找車
 */
function App() {
  const path = useHashRoute();

  switch (path) {
    case ROUTES.EXPENSE:
    case ROUTES.OBLIGATIONS:
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
