const { contextBridge } = require('electron');
const packageJson = require('../package.json');

contextBridge.exposeInMainWorld('deckrogueDesktop', {
  hostPlatform: 'desktop',
  appVersion: packageJson.version || '0.0.0',
  channel: process.env.DECKROGUE_DESKTOP_CHANNEL === 'production' ? 'production' : 'development',
  isPackaged: process.env.DECKROGUE_DESKTOP_PACKAGED === '1',
});
