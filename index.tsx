// Safari < 15.4 lacks structuredClone; provide a lightweight fallback for our plain-data usage.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (value: any) => JSON.parse(JSON.stringify(value));
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'leaflet/dist/leaflet.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
