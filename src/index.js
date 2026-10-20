import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { LocationProvider } from './context/LocationContext';
import { ThemeProvider } from './context/ThemeContext';
import { QueueProvider } from './context/QueueContext';
import { FloatingStackProvider } from './context/FloatingStackContext';
import { registerSW } from './utils/registerSW';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <LocationProvider>
        <QueueProvider>
          <FloatingStackProvider>
            <App />
          </FloatingStackProvider>
        </QueueProvider>
      </LocationProvider>
    </ThemeProvider>
  </React.StrictMode>
);

registerSW();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
