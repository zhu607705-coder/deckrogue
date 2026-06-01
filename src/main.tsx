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
      <div className="deckrogue-error-boundary deckrogue-init-error" role="alert">
        <div className="deckrogue-error-boundary__panel">
          <h1 className="deckrogue-error-boundary__title">
            初始化异常
          </h1>
          <p className="deckrogue-error-boundary__message">{error}</p>
          <div className="deckrogue-error-boundary__actions">
            <button
              onClick={() => window.location.reload()}
              className="deckrogue-error-boundary__action"
            >
              重试
            </button>
            <button
              onClick={() => {
                window.location.href = window.location.origin;
              }}
              className="deckrogue-error-boundary__action deckrogue-error-boundary__action--secondary"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="screen-loading-fallback screen-loading-fallback--initializing" role="status" aria-live="polite">
        <div className="screen-loading-fallback__panel">
          <span className="screen-loading-fallback__spinner" aria-hidden="true" />
          <p className="screen-loading-fallback__label">正在初始化战区...</p>
          <p className="screen-loading-fallback__hint">正在加载资源和配置</p>
        </div>
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
