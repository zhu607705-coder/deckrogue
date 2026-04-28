import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '@/App';
import { gameSetup } from '@/core';
import { resolveCurrentDesktopEnvironment } from '@/desktop/hostPlatform';
import '@/index.css';

function GameInitializer() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-4">
        <h1 className="text-2xl text-red-500 mb-4 flex items-center gap-2">
          <span>初始化异常</span>
        </h1>
        <p className="text-gray-400 mb-6 text-center max-w-md">{error}</p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-medium rounded transition-colors"
          >
            重试
          </button>
          <button
            onClick={() => {
              window.location.href = window.location.origin;
            }}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-gray-400 text-lg">正在初始化战区...</p>
        <p className="text-gray-600 text-sm mt-2">正在加载资源和配置</p>
      </div>
    );
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
