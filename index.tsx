// Safari < 15.4 lacks structuredClone; provide a lightweight fallback for our plain-data usage.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (value: any) => JSON.parse(JSON.stringify(value));
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'leaflet/dist/leaflet.css';

const BOOT_BANNER_ID = 'aera-boot-fallback-banner';

const normalizeErrorMessage = (value: unknown): string => {
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const showBootFallbackBanner = (title: string, detail: string) => {
  if (typeof document === 'undefined') return;

  let banner = document.getElementById(BOOT_BANNER_ID);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = BOOT_BANNER_ID;
    banner.style.position = 'fixed';
    banner.style.left = '12px';
    banner.style.right = '12px';
    banner.style.top = '12px';
    banner.style.zIndex = '2147483647';
    banner.style.background = '#fff7ed';
    banner.style.border = '1px solid #fdba74';
    banner.style.color = '#7c2d12';
    banner.style.padding = '12px 14px';
    banner.style.borderRadius = '10px';
    banner.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
    banner.style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)';
    document.body.appendChild(banner);
  }

  banner.innerHTML = `
    <div style="font-size:13px;font-weight:700;line-height:1.3;">${title}</div>
    <div style="font-size:12px;line-height:1.45;margin-top:4px;white-space:pre-wrap;">${detail}</div>
    <div style="font-size:11px;line-height:1.4;margin-top:8px;opacity:0.9;">Try hard refresh (Cmd+Shift+R). If this persists, open browser console and share the first error.</div>
  `;
};

const installBootErrorHandlers = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    const message = event.error ? normalizeErrorMessage(event.error) : (event.message || 'Unknown runtime error');
    showBootFallbackBanner('AERA startup error', message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = normalizeErrorMessage(event.reason || 'Unhandled promise rejection');
    showBootFallbackBanner('AERA startup rejection', message);
  });
};

installBootErrorHandlers();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  showBootFallbackBanner('AERA failed to boot', normalizeErrorMessage(error));
  throw error;
}
