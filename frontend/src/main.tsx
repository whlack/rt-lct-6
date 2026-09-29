import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';

document.documentElement.dataset.designStyle = 'standard';
document.documentElement.dataset.fontPreference = 'brand';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
