import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsProvider } from './lib/context/SettingsContext';
import SRLDesktop from './SRLDesktop';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <SRLDesktop />
    </SettingsProvider>
  </React.StrictMode>
);
