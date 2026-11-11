import React, { useEffect } from 'react';
import { useHashRoute } from './hooks/useHashRoute';
import { ROUTES } from './utils/routing';
import { ensureAppBootstrap } from './utils/appBootstrap';
import EntryPage from './pages/EntryPage';
import ExpensePage from './pages/ExpensePage';
import CalendarPage from './pages/CalendarPage';
import ParkingPage from './pages/ParkingPage';
import RegionsPage from './pages/RegionsPage';
import PhotoPage from './pages/PhotoPage';
import EatPage from './pages/EatPage';
import './App.css';

/**
 * Hash routes (GitHub Pages friendly):
 *   #/           Entry Point
 *   #/expense    記帳（單筆 / 排程 / 報表）
 *   #/expense?tab=scheduled  預定交易
 *   #/expense?tab=summary    報表（?id= 可定位一筆）
 *   #/obligations 同上（相容舊連結）
 *   #/eat        吃什麼
 *   #/calendar   行事曆軌跡
 *   #/vehicles   車輛（#/parking 相容舊連結）
 *   #/regions    地圖管理
 */
function App() {
  const path = useHashRoute();
  useEffect(() => {
    document.title = '自理';
    ensureAppBootstrap();
  }, []);

  switch (path) {
    case ROUTES.EXPENSE:
    case ROUTES.OBLIGATIONS:
      return <ExpensePage />;
    case ROUTES.CALENDAR:
      return <CalendarPage />;
    case ROUTES.PARKING:
    case ROUTES.VEHICLES:
      return <ParkingPage />;
    case ROUTES.REGIONS:
      return <RegionsPage />;
    case ROUTES.PHOTO:
      return <PhotoPage />;
    case ROUTES.EAT:
      return <EatPage />;
    case ROUTES.HOME:
    default:
      return <EntryPage />;
  }
}

export default App;
