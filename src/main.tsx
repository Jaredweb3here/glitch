import React from 'react';
import { createRoot } from 'react-dom/client';
import { GlitchDashboard } from './components/glitch/GlitchDashboard';
import './styles.css';

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <GlitchDashboard />
  </React.StrictMode>
);
