// js/config.js - Configuration for PropTrack

// Auto-detect API URL based on current domain
// For local development, this will be localhost
// For production, this will be the Vercel domain
export const API_BASE_URL = window.location.origin;

// Uncomment and update for separate backend deployment:
// export const API_BASE_URL = 'https://proptrack-backend.vercel.app';

// App configuration
export const APP_CONFIG = {
    name: 'PropTrack',
    version: '2.0.0',
    defaultStatType: 'points',
    defaultDarkMode: true
};
