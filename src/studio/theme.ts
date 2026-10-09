import { studioTheme } from 'ag-studio';

export const paypalTheme = studioTheme
  .withParams(
    {
      accentColor: '#0070BA',
      backgroundColor: '#FFFFFF',
      foregroundColor: '#2C2E2F',
      browserColorScheme: 'light',
    },
    'light-paypal'
  )
  .withParams(
    {
      accentColor: '#0070BA',
      backgroundColor: '#0A192F',
      foregroundColor: '#CCD6F6',
      browserColorScheme: 'dark',
    },
    'dark-paypal'
  );
