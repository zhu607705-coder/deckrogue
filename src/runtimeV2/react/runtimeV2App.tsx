/**
 * @file runtimeV2App.tsx
 * @description RuntimeV2 应用主组件，组装引擎宿主、场景渲染和交互处理
 *
 * 主要职责:
 * - 管理引擎启动、存档加载和种子解析
 * - 根据屏幕类型渲染对应的场景组件
 * - 处理场景切换和交互回调
 */
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  appendReplayCommand,
  createReplayLogV1,
  createEngineHost,
  createLegacyOracleAdapter,
  createSaveGameV2,
  createPythonWasmAdapter,
  EngineHostProvider,
  restoreSnapshotFromSaveGame,
  useEngineHost,
  useRenderModel,
  useSnapshot,
  RuntimeV2AppShell,
  type RuntimeV2CharacterOption,
  type ReplayLogV1,
  type RuleCommand,
  type RuleSnapshot,
  type EngineHostStartOptions,
  type RuleRuntimeAdapter,
  type RendererType,
} from '@/runtimeV2';
import charactersData from '@/content/data/characters.json';
import { loadRuntimeV2Seed, resolveRuntimeV2SeedFromSearch, saveRuntimeV2Seed } from './launcherSeed';
import {
  loadRuntimeV2ReplayLog,
  loadRuntimeV2SaveGame,
  saveRuntimeV2ReplayLog,
  saveRuntimeV2SaveGame,
} from './runtimeV2Storage';
import { resolveCurrentDesktopEnvironment } from '@/desktop/hostPlatform';

export const DEFAULT_RUNTIME_V2_ADAPTER = 'python-wasm' as const;
export const DEFAULT_RUNTIME_V2_RENDERER = 'dom' as const;

export interface RuntimeV2AppProps {
  seed?: number;
  adapter?: 'legacy' | 'python-wasm';
  renderer?: RendererType;
}

function resolveAdapterFromSearch(search: string, fallback: 'legacy' | 'python-wasm'): 'legacy' | 'python-wasm' {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const params = new URLSearchParams(search);
  const adapterParam = params.get('adapter');
  if (adapterParam === 'python-wasm' || adapterParam === 'wasm') {
    return 'python-wasm';
  }
  if (adapterParam === 'legacy') {
    return 'legacy';
  }
  return fallback;
}

function resolveRendererFromSearch(search: string, fallback: RendererType): RendererType {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const params = new URLSearchParams(search);
  const rendererParam = params.get('renderer');
  if (rendererParam === 'pixi') {
    return 'pixi';
  }
  if (rendererParam === 'dom') {
    return 'dom';
  }
  return fallback;
}

export function RuntimeV2App({
  seed = Date.now(),
  adapter: adapterProp = DEFAULT_RUNTIME_V2_ADAPTER,
  renderer: rendererProp = DEFAULT_RUNTIME_V2_RENDERER,
}: RuntimeV2AppProps) {
  const [adapterType, setAdapterType] = useState(() => {
    if (typeof window === 'undefined') {
      return adapterProp;
    }
    return resolveAdapterFromSearch(window.location.search, adapterProp);
  });

  const rendererType = useMemo<RendererType>(() => {
    if (typeof window === 'undefined') {
      return rendererProp;
    }
    return resolveRendererFromSearch(window.location.search, rendererProp);
  }, [rendererProp]);

  const host = useMemo(() => {
    const adapter: RuleRuntimeAdapter = adapterType === 'python-wasm'
      ? createPythonWasmAdapter()
      : createLegacyOracleAdapter();
    return createEngineHost(adapter);
  }, [adapterType]);

  useEffect(() => {
    return () => {
      host.dispose();
    };
  }, [host]);

  const handleAdapterChange = useCallback((newAdapter: 'legacy' | 'python-wasm') => {
    setAdapterType(newAdapter);
  }, []);

  return (
    <EngineHostProvider host={host}>
      <RuntimeV2AppContent
        seed={seed}
        adapterType={adapterType}
        rendererType={rendererType}
        onAdapterChange={handleAdapterChange}
      />
    </EngineHostProvider>
  );
}

declare global {
  interface Window {
    __deckrogueRuntimeV2?: {
      getSnapshot: () => RuleSnapshot | null;
      getRenderModel: () => ReturnType<typeof useRenderModel>;
      startRun: (seed: number) => Promise<void>;
      dispatch: (command: RuleCommand, options?: { recordReplay?: boolean }) => Promise<void>;
      setSaveGame: (saveGame: ReturnType<typeof createSaveGameV2>) => void;
      setReplayLog: (replayLog: ReplayLogV1) => void;
    };
  }
}

function RuntimeV2AppContent({
  seed,
  adapterType,
  rendererType,
  onAdapterChange,
}: {
  seed: number;
  adapterType: 'legacy' | 'python-wasm';
  rendererType: RendererType;
  onAdapterChange: (adapter: 'legacy' | 'python-wasm') => void;
}) {
  const { host, status, error, start, reset, dispatch } = useEngineHost();
  const renderModel = useRenderModel();
  const snapshot = useSnapshot();
  const [launchSeed, setLaunchSeed] = useState(() => {
    const persistedSeed = loadRuntimeV2Seed(seed);
    if (typeof window === 'undefined') {
      return persistedSeed;
    }
    return resolveRuntimeV2SeedFromSearch(window.location.search, persistedSeed);
  });

  useEffect(() => {
    saveRuntimeV2Seed(launchSeed);
  }, [launchSeed]);

  const [replayLog, setReplayLog] = useState<ReplayLogV1 | null>(() => loadRuntimeV2ReplayLog());
  const [hasStoredSave, setHasStoredSave] = useState(() => loadRuntimeV2SaveGame() !== null);
  const [hasStoredReplay, setHasStoredReplay] = useState(() => loadRuntimeV2ReplayLog() !== null);
  const hostPlatform = useMemo(() => resolveCurrentDesktopEnvironment().hostPlatform, []);

  const characters = useMemo((): RuntimeV2CharacterOption[] => {
    return (charactersData as any[]).map((char) => ({
      id: char.id,
      name: char.name,
      description: char.description || '',
      maxHp: char.maxHp,
      maxEnergy: char.maxEnergy,
      complexity: char.complexity || 'medium',
      archetype: char.archetype || [],
    }));
  }, []);

  const recordReplayCommand = useCallback((command: RuleCommand) => {
    setReplayLog((current) => {
      if (!current) return current;
      const next = appendReplayCommand(current, command);
      saveRuntimeV2ReplayLog(next);
      setHasStoredReplay(true);
      return next;
    });
  }, []);

  const handleSelectCharacter = useCallback(
    async (characterId: string) => {
      const command: RuleCommand = { type: 'select_character', characterId };
      await dispatch(command);
      recordReplayCommand(command);
    },
    [dispatch, recordReplayCommand]
  );

  const handleEnterNode = useCallback(
    async (nodeId: string) => {
      const command: RuleCommand = { type: 'enter_node', nodeId };
      await dispatch(command);
      recordReplayCommand(command);
    },
    [dispatch, recordReplayCommand]
  );

  const handleLeaveRoom = useCallback(async () => {
    const command: RuleCommand = { type: 'leave_room' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleCompleteCombat = useCallback(async () => {
    const command: RuleCommand = { type: 'complete_combat' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleTakeReward = useCallback(
    async (cardId?: string) => {
      const command: RuleCommand = cardId
        ? { type: 'take_reward', cardId }
        : { type: 'take_reward' };
      await dispatch(command);
      recordReplayCommand(command);
    },
    [dispatch, recordReplayCommand]
  );

  const handleSkipReward = useCallback(async () => {
    const command: RuleCommand = { type: 'skip_reward' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleChooseEventOption = useCallback(
    async (choiceId: string) => {
      const command: RuleCommand = { type: 'choose_event_option', choiceId };
      await dispatch(command);
      recordReplayCommand(command);
    },
    [dispatch, recordReplayCommand]
  );

  const handleRest = useCallback(async () => {
    const command: RuleCommand = { type: 'rest' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleBuyShopCard = useCallback(async (cardId: string) => {
    const command: RuleCommand = { type: 'buy_shop_card', cardId };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleBuyShopRelic = useCallback(async (relicId: string) => {
    const command: RuleCommand = { type: 'buy_shop_relic', relicId };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleBuyShopPotion = useCallback(async (potionId: string) => {
    const command: RuleCommand = { type: 'buy_shop_potion', potionId };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleEnterEnchant = useCallback(async () => {
    const command: RuleCommand = { type: 'enter_enchant' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleApplyEnchantment = useCallback(async (cardToken: string) => {
    const command: RuleCommand = { type: 'apply_enchantment', cardInstanceId: cardToken };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleEnterRelicUpgrade = useCallback(async () => {
    const command: RuleCommand = { type: 'enter_relic_upgrade' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleUpgradeRelic = useCallback(async (relicId: string) => {
    const command: RuleCommand = { type: 'upgrade_relic', relicId };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleUpgrade = useCallback(async (cardToken?: string) => {
    const command: RuleCommand = cardToken ? { type: 'upgrade_card', cardInstanceId: cardToken } : { type: 'upgrade_card' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleRemoveCard = useCallback(async (cardToken?: string) => {
    const command: RuleCommand = cardToken ? { type: 'remove_card', cardInstanceId: cardToken } : { type: 'remove_card' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleCancelSurface = useCallback(async () => {
    const command: RuleCommand = { type: 'cancel_surface' };
    await dispatch(command);
    recordReplayCommand(command);
  }, [dispatch, recordReplayCommand]);

  const handleStartRun = useCallback(async () => {
    const options: EngineHostStartOptions = { seed: launchSeed };
    await start(options);
    const nextReplay = createReplayLogV1(launchSeed, []);
    setReplayLog(nextReplay);
    saveRuntimeV2ReplayLog(nextReplay);
    setHasStoredReplay(true);
  }, [launchSeed, start]);

  const handleResetRun = useCallback(() => {
    reset();
  }, [reset]);

  const handleSaveRun = useCallback(() => {
    if (!snapshot) return;
    saveRuntimeV2SaveGame(createSaveGameV2(snapshot, hostPlatform));
    setHasStoredSave(true);
    if (replayLog) {
      saveRuntimeV2ReplayLog(replayLog);
      setHasStoredReplay(true);
    }
  }, [hostPlatform, replayLog, snapshot]);

  const handleLoadSave = useCallback(async () => {
    const saveGame = loadRuntimeV2SaveGame();
    if (!saveGame) return;
    await start({ seed: saveGame.snapshot.seed });
    await dispatch({ type: 'load_snapshot', snapshot: restoreSnapshotFromSaveGame(saveGame) });
    setLaunchSeed(saveRuntimeV2Seed(saveGame.snapshot.seed));
    const storedReplay = loadRuntimeV2ReplayLog();
    setReplayLog(storedReplay);
    setHasStoredSave(true);
    setHasStoredReplay(storedReplay !== null);
  }, [dispatch, start]);

  const handleReplayRun = useCallback(async () => {
    const storedReplay = loadRuntimeV2ReplayLog();
    if (!storedReplay) return;
    await start({ seed: storedReplay.seed });
    for (const command of storedReplay.commands) {
      await dispatch(command);
    }
    setReplayLog(storedReplay);
    setLaunchSeed(saveRuntimeV2Seed(storedReplay.seed));
    setHasStoredReplay(true);
  }, [dispatch, start]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const bridge = {
      getSnapshot: () => structuredClone(snapshot),
      getRenderModel: () => structuredClone(renderModel),
      startRun: async (seedOverride: number) => {
        const options: EngineHostStartOptions = { seed: seedOverride };
        await start(options);
      },
      dispatch: async (command: RuleCommand, options?: { recordReplay?: boolean }) => {
        if (!host) {
          throw new Error('runtime-v2 host is unavailable');
        }
        await host.dispatch(command);
        if (options?.recordReplay !== false) {
          recordReplayCommand(command);
        }
      },
      setSaveGame: (saveGame: ReturnType<typeof createSaveGameV2>) => {
        saveRuntimeV2SaveGame(saveGame);
        setHasStoredSave(true);
      },
      setReplayLog: (nextReplayLog: ReplayLogV1) => {
        saveRuntimeV2ReplayLog(nextReplayLog);
        setReplayLog(nextReplayLog);
        setHasStoredReplay(true);
      },
    };
    window.__deckrogueRuntimeV2 = bridge;
    return () => {
      if (window.__deckrogueRuntimeV2 === bridge) {
        delete window.__deckrogueRuntimeV2;
      }
    };
  }, [host, recordReplayCommand, renderModel, snapshot]);

  return (
    <RuntimeV2AppShell
      status={status}
      renderModel={renderModel}
      seed={launchSeed}
      adapterType={adapterType}
      errorMessage={error?.message ?? null}
      characters={characters}
      renderer={rendererType}
      canLoadSave={hasStoredSave}
      canReplayRun={hasStoredReplay}
      onSeedChange={(nextSeed) => setLaunchSeed(saveRuntimeV2Seed(nextSeed))}
      onStartRun={handleStartRun}
      onResetRun={handleResetRun}
      onSaveRun={handleSaveRun}
      onLoadSave={handleLoadSave}
      onReplayRun={handleReplayRun}
      onSelectCharacter={handleSelectCharacter}
      onEnterNode={handleEnterNode}
      onLeaveRoom={handleLeaveRoom}
      onCompleteCombat={handleCompleteCombat}
      onTakeReward={handleTakeReward}
      onSkipReward={handleSkipReward}
      onChooseEventOption={handleChooseEventOption}
      onRest={handleRest}
      onBuyShopCard={handleBuyShopCard}
      onBuyShopRelic={handleBuyShopRelic}
      onBuyShopPotion={handleBuyShopPotion}
      onEnterEnchant={handleEnterEnchant}
      onApplyEnchantment={handleApplyEnchantment}
      onEnterRelicUpgrade={handleEnterRelicUpgrade}
      onUpgradeRelic={handleUpgradeRelic}
      onUpgrade={handleUpgrade}
      onRemoveCard={handleRemoveCard}
      onCancelSurface={handleCancelSurface}
    />
  );
}
