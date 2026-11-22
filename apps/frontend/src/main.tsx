import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './index.css';
import { initDemoInterceptor } from './mock/demoInterceptor.js';

// Initializes seamless in-browser demo engine if backend is offline or on Vercel demo
initDemoInterceptor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
