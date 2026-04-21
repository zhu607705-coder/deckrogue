import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '@/App';
import UnifiedAppShell from '@/ui/views/UnifiedAppShell';
import { RuntimeV2App, resolveAppEntryMode } from '@/runtimeV2';
import { gameSetup } from '@/core';
import { resolveCurrentDesktopEnvironment } from '@/desktop/hostPlatform';
import '@/index.css';

function GameInitializer() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entryMode = resolveAppEntryMode(window.location.search);
  const desktopEnvironment = resolveCurrentDesktopEnvironment();

  useEffect(() => {
    document.documentElement.dataset.hostPlatform = desktopEnvironment.hostPlatform;
    document.documentElement.dataset.hostChannel = desktopEnvironment.channel;
  }, [desktopEnvironment.channel, desktopEnvironment.hostPlatform]);

  useEffect(() => {
    const init = async () => {
      try {
        await gameSetup.initialize();
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? `初始化失败：${err.message}` : '初始化游戏失败');
      }
    };

    init();

    return () => {
      gameSetup.shutdown();
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <h1 className="text-2xl text-red-500 mb-4">初始化异常</h1>
        <p className="text-gray-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700"
        >
          重试
        </button>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400">正在初始化战区...</p>
      </div>
    );
  }

  if (entryMode === 'runtime-v2') {
    return <RuntimeV2App />;
  }

  if (entryMode === 'unified') {
    return <UnifiedAppShell />;
  }

  return <App />;
}

declare global {
  interface Window {
    __deckrogueRoot?: Root;
  }
}

const container = document.getElementById('root')!;
const root = window.__deckrogueRoot ?? createRoot(container);
window.__deckrogueRoot = root;

root.render(
  <StrictMode>
    <GameInitializer />
  </StrictMode>,
);
