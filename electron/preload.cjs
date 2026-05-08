const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('deckrogueDesktop', {
  hostPlatform: 'desktop',
  appVersion: process.env.DECKROGUE_DESKTOP_APP_VERSION || '0.0.0',
  channel: process.env.DECKROGUE_DESKTOP_CHANNEL === 'production' ? 'production' : 'development',
  isPackaged: process.env.DECKROGUE_DESKTOP_PACKAGED === '1',
});
