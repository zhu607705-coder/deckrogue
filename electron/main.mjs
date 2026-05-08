import { app, BrowserWindow, net, protocol, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'deckrogue',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const preloadPath = path.join(__dirname, 'preload.cjs');
const rendererIndexPath = path.join(repoRoot, 'dist', 'index.html');
const distRoot = path.join(repoRoot, 'dist');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const requestedUserDataDir = process.env.DECKROGUE_USER_DATA_DIR;
if (requestedUserDataDir) {
  app.setPath('userData', requestedUserDataDir);
}

const devServerUrl = process.env.VITE_DEV_SERVER_URL?.trim() || '';
const forceLocalDist = process.env.DECKROGUE_FORCE_LOCAL_DIST === '1';
const useDevServer = Boolean(devServerUrl) && !forceLocalDist;

function buildEntryQuery() {
  const params = new URLSearchParams();
  params.set('legacy', '1');
  return params;
}

function openExternalHttpUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return;
    }
    void shell.openExternal(parsed.toString());
  } catch {
    // Ignore malformed external URLs.
  }
}

function createWindow() {
  process.env.DECKROGUE_DESKTOP_CHANNEL = useDevServer ? 'development' : 'production';
  process.env.DECKROGUE_DESKTOP_PACKAGED = app.isPackaged ? '1' : '0';
  process.env.DECKROGUE_DESKTOP_APP_VERSION = packageJson.version || '0.0.0';

  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'DeckRogue',
    backgroundColor: '#050608',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttpUrl(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (useDevServer && url.startsWith(devServerUrl)) return;
    if (!useDevServer && url.startsWith('deckrogue://app')) return;
    event.preventDefault();
    openExternalHttpUrl(url);
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (useDevServer) {
    const url = new URL(devServerUrl);
    const params = buildEntryQuery();
    params.forEach((value, key) => url.searchParams.set(key, value));
    void win.loadURL(url.toString());
  } else {
    const url = new URL('deckrogue://app/index.html');
    const params = buildEntryQuery();
    params.forEach((value, key) => url.searchParams.set(key, value));
    void win.loadURL(url.toString());
  }

  if (useDevServer && process.env.DECKROGUE_OPEN_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}

function registerAppProtocol() {
  protocol.handle('deckrogue', (request) => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const candidatePath = path.resolve(distRoot, relativePath);
    const relativeToDist = path.relative(distRoot, candidatePath);
    if (relativeToDist.startsWith('..') || path.isAbsolute(relativeToDist)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(candidatePath).toString());
  });
}

if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [existingWindow] = BrowserWindow.getAllWindows();
    if (!existingWindow) return;
    if (existingWindow.isMinimized()) {
      existingWindow.restore();
    }
    existingWindow.focus();
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
