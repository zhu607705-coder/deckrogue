import React, { useState, useCallback } from 'react';
import type { RenderModel } from '../contracts';
import {
  deriveMapSceneProps,
  deriveCombatSceneProps,
  deriveRewardSceneProps,
  deriveRestSceneProps,
  deriveEventSceneProps,
  deriveShopSceneProps,
} from '../sceneProps';
import {
  MapScene,
  CombatScene,
  RewardScene,
  RestScene,
  EventScene,
  ShopScene,
} from '../scenes';
import {
  MapScenePixi,
  CombatScenePixi,
  RewardScenePixi,
  RestScenePixi,
  EventScenePixi,
  ShopScenePixi,
} from '../pixi';

export type RendererType = 'dom' | 'pixi';

export interface RuntimeV2CharacterOption {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  maxEnergy: number;
  complexity: 'low' | 'medium' | 'high';
  archetype: string[];
}

export interface RuntimeV2AppShellProps {
  status: 'idle' | 'starting' | 'ready' | 'error';
  renderModel: RenderModel | null;
  seed: number;
  adapterType?: 'legacy' | 'python-wasm';
  errorMessage?: string | null;
  characters: RuntimeV2CharacterOption[];
  renderer?: RendererType;
  canLoadSave?: boolean;
  canReplayRun?: boolean;
  onSeedChange: (seed: number) => void;
  onStartRun: () => void;
  onResetRun: () => void;
  onSaveRun: () => void;
  onLoadSave: () => void;
  onReplayRun: () => void;
  onSelectCharacter: (characterId: string) => void;
  onEnterNode: (nodeId: string) => void;
  onLeaveRoom: () => void;
  onCompleteCombat: () => void;
  onTakeReward: (cardId?: string) => void;
  onSkipReward: () => void;
  onChooseEventOption: (choiceId: string) => void;
  onRest: () => void;
  onUpgrade: () => void;
  onRemoveCard: () => void;
}

export function RuntimeV2AppShell({
  status,
  renderModel,
  seed,
  adapterType = 'python-wasm',
  errorMessage,
  characters,
  renderer = 'dom',
  canLoadSave = false,
  canReplayRun = false,
  onSeedChange,
  onStartRun,
  onResetRun,
  onSaveRun,
  onLoadSave,
  onReplayRun,
  onSelectCharacter,
  onEnterNode,
  onLeaveRoom,
  onCompleteCombat,
  onTakeReward,
  onSkipReward,
  onChooseEventOption,
  onRest,
  onUpgrade,
  onRemoveCard,
}: RuntimeV2AppShellProps) {
  if (!renderModel) {
    return (
      <div className="runtime-v2-app-shell" data-screen="Launcher" data-renderer={renderer} data-adapter={adapterType}>
        <header className="runtime-v2-header">
          <h1>运行时 V2 控制台</h1>
          <div className="status-indicator" data-status={status}>
            {status}
          </div>
        </header>
        <main className="runtime-v2-content">
          <LauncherScreen
            status={status}
            seed={seed}
            errorMessage={errorMessage ?? null}
            canLoadSave={canLoadSave}
            canReplayRun={canReplayRun}
            onSeedChange={onSeedChange}
            onStartRun={onStartRun}
            onResetRun={onResetRun}
            onLoadSave={onLoadSave}
            onReplayRun={onReplayRun}
          />
        </main>
      </div>
    );
  }

  const { screen, player, room } = renderModel;

  const mapSceneProps = deriveMapSceneProps(renderModel);
  const combatSceneProps = deriveCombatSceneProps(renderModel);
  const rewardSceneProps = deriveRewardSceneProps(renderModel);
  const restSceneProps = deriveRestSceneProps(renderModel);
  const eventSceneProps = deriveEventSceneProps(renderModel);
  const shopSceneProps = deriveShopSceneProps(renderModel);

  return (
    <div className="runtime-v2-app-shell" data-screen={screen} data-renderer={renderer} data-adapter={adapterType} data-current-node-id={renderModel.map.currentNodeId ?? ''}>
      <header className="runtime-v2-header">
        <h1>运行时 V2 控制台</h1>
        <div className="status-indicator" data-status={status}>
          {status}
        </div>
        <button className="save-run-btn" onClick={onSaveRun}>
          保存进度
        </button>
        <button className="reset-run-btn" onClick={onResetRun}>
          新局远征
        </button>
      </header>

      <main className="runtime-v2-content">
        {screen === 'CharacterSelect' && (
          <CharacterSelectScreen
            characters={characters}
            room={room}
            onSelect={onSelectCharacter}
          />
        )}

        {screen === 'Map' && mapSceneProps && (
          renderer === 'pixi' ? (
            <MapScenePixi
              scene={mapSceneProps}
              onEnterNode={onEnterNode}
            />
          ) : (
            <MapScene
              scene={mapSceneProps}
              onEnterNode={onEnterNode}
            />
          )
        )}

        {screen === 'Combat' && combatSceneProps && (
          renderer === 'pixi' ? (
            <CombatScenePixi
              scene={combatSceneProps}
              onComplete={onCompleteCombat}
            />
          ) : (
            <CombatScene
              scene={combatSceneProps}
              onComplete={onCompleteCombat}
            />
          )
        )}

        {screen === 'Reward' && rewardSceneProps && (
          renderer === 'pixi' ? (
            <RewardScenePixi
              scene={rewardSceneProps}
              onTake={onTakeReward}
              onSkip={onSkipReward}
            />
          ) : (
            <RewardScene
              scene={rewardSceneProps}
              onTake={onTakeReward}
              onSkip={onSkipReward}
            />
          )
        )}

        {screen === 'Shop' && shopSceneProps && (
          renderer === 'pixi' ? (
            <ShopScenePixi
              scene={shopSceneProps}
              onLeave={onLeaveRoom}
            />
          ) : (
            <ShopScene
              scene={shopSceneProps}
              onLeave={onLeaveRoom}
            />
          )
        )}

        {screen === 'Rest' && restSceneProps && (
          renderer === 'pixi' ? (
            <RestScenePixi
              scene={restSceneProps}
              onRest={onRest}
              onUpgrade={onUpgrade}
              onRemoveCard={onRemoveCard}
              onLeave={onLeaveRoom}
            />
          ) : (
            <RestScene
              scene={restSceneProps}
              onRest={onRest}
              onUpgrade={onUpgrade}
              onRemoveCard={onRemoveCard}
              onLeave={onLeaveRoom}
            />
          )
        )}

        {screen === 'Event' && eventSceneProps && (
          renderer === 'pixi' ? (
            <EventScenePixi
              scene={eventSceneProps}
              onChooseOption={onChooseEventOption}
            />
          ) : (
            <EventScene
              scene={eventSceneProps}
              onChooseOption={onChooseEventOption}
            />
          )
        )}

        {screen !== 'CharacterSelect' &&
          screen !== 'Map' &&
          screen !== 'Combat' &&
          screen !== 'Reward' &&
          screen !== 'Shop' &&
          screen !== 'Rest' &&
          screen !== 'Event' && (
            <GenericRoomScreen
              title={`${screen} Room`}
              description={`Phase: ${renderModel.lifecycle.phase}`}
              actionLabel="Return"
              onAction={onLeaveRoom}
            />
          )}
      </main>
    </div>
  );
}

interface LauncherScreenProps {
  status: RuntimeV2AppShellProps['status'];
  seed: number;
  errorMessage: string | null;
  canLoadSave: boolean;
  canReplayRun: boolean;
  onSeedChange: (seed: number) => void;
  onStartRun: () => void;
  onResetRun: () => void;
  onLoadSave: () => void;
  onReplayRun: () => void;
}

function LauncherScreen({
  status,
  seed,
  errorMessage,
  canLoadSave,
  canReplayRun,
  onSeedChange,
  onStartRun,
  onResetRun,
  onLoadSave,
  onReplayRun,
}: LauncherScreenProps) {
  return (
    <div className="runtime-v2-launcher-screen">
      <h2>Launch Runtime V2</h2>
      <p>Start an isolated EngineHost-backed run without the legacy AppShell.</p>
      <label className="runtime-v2-seed-field">
        <span>Seed</span>
        <input
          type="number"
          value={seed}
          onChange={(event) => onSeedChange(Number(event.target.value) || 0)}
        />
      </label>
      {errorMessage ? <div className="runtime-v2-error-banner">{errorMessage}</div> : null}
      <div className="runtime-v2-launcher-actions">
        <button onClick={onStartRun} disabled={status === 'starting'}>
          {status === 'starting' ? '正在启动…' : '开始新局'}
        </button>
        {canLoadSave ? (
          <button onClick={onLoadSave}>
            Load Saved Run
          </button>
        ) : null}
        {canReplayRun ? (
          <button onClick={onReplayRun}>
            Replay Last Run
          </button>
        ) : null}
        {(status === 'error' || status === 'ready') ? (
          <button onClick={onResetRun}>Reset Host</button>
        ) : null}
      </div>
    </div>
  );
}

interface CharacterSelectScreenProps {
  characters: RuntimeV2CharacterOption[];
  room: RenderModel['room'];
  onSelect: (characterId: string) => void;
}

function CharacterSelectScreen({ characters, room, onSelect }: CharacterSelectScreenProps) {
  return (
    <div className="character-select-screen">
      <h2>{room?.title ?? 'Select Character'}</h2>
      {room?.body && <p className="room-description">{room.body}</p>}
      <div className="character-roster">
        {characters.map((char) => (
          <button
            key={char.id}
            className="character-option"
            onClick={() => onSelect(char.id)}
            data-character-id={char.id}
          >
            <div className="character-name">{char.name}</div>
            <div className="character-description">{char.description}</div>
            <div className="character-stats">
              HP: {char.maxHp} | Energy: {char.maxEnergy}
            </div>
            <div className="character-archetypes">
              {char.archetype.join(', ')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface GenericRoomScreenProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

function GenericRoomScreen({ title, description, actionLabel, onAction }: GenericRoomScreenProps) {
  return (
    <div className="generic-room-screen">
      <h2>{title}</h2>
      <p>{description}</p>
      <button onClick={onAction} className="generic-room-action-btn">
        {actionLabel}
      </button>
    </div>
  );
}
