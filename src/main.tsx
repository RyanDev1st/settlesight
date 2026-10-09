import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './ui/shell';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element with id "root"');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
