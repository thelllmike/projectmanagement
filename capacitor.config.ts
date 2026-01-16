// 
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vibevm.app',
  appName: 'vibe-pm',

  // must contain an index.html (required by Capacitor)
  webDir: 'www',

  // load your real Next.js site
  server: {
    url: 'https://projectmanagement-henna.vercel.app/',
    cleartext: false,
  },
};

export default config;