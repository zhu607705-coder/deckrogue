import React, { useCallback, useMemo } from 'react';
import {
  CombatScene,
  createEngineHost,
  createPythonWasmAdapter,
  createRuntimeV2Adapter,
  deriveCombatSceneProps,
  deriveEventSceneProps,
  deriveMapSceneProps,
  deriveRewardSceneProps,
  deriveRestSceneProps,
  deriveShopSceneProps,
  EventScene,
  MapScene,
  RewardScene,
  RestScene,
  ShopScene,
  SurfaceScene,
  type EngineHost,
  type RenderModel,
  type RuleCommand,
  type RuleRuntimeAdapter,
  type RuntimeV2CharacterOption,
  type UnifiedEngineAdapter,
} from '@/runtimeV2';
import { uiCharacters } from '@/ui/content/characters';

interface UnifiedRuntimeV2AdapterDeps {
  createRuleAdapter?: () => RuleRuntimeAdapter;
  createHost?: (adapter: RuleRuntimeAdapter) => EngineHost;
  createUnifiedAdapter?: (host: EngineHost) => UnifiedEngineAdapter;
}

export async function bootUnifiedRuntimeV2Adapter(
  seed: number,
  deps: UnifiedRuntimeV2AdapterDeps = {}
): Promise<UnifiedEngineAdapter> {
  const createRuleAdapter = deps.createRuleAdapter ?? createPythonWasmAdapter;
  const createHost = deps.createHost ?? createEngineHost;
  const createUnifiedAdapter = deps.createUnifiedAdapter ?? createRuntimeV2Adapter;

  const host = createHost(createRuleAdapter());
  const adapter = createUnifiedAdapter(host);
  await adapter.start({ seed });
  return adapter;
}

export function buildUnifiedRuntimeV2Characters(): RuntimeV2CharacterOption[] {
  return (uiCharacters as Array<Record<string, unknown>>).map((character) => ({
    id: String(character.id),
    name: String(character.name ?? character.id),
    description: typeof character.description === 'string' ? character.description : '',
    maxHp: Number(character.maxHp ?? 1),
    maxEnergy: Number(character.maxEnergy ?? 3),
    complexity: (character.complexity === 'low' || character.complexity === 'high') ? character.complexity : 'medium',
    archetype: Array.isArray(character.archetype)
      ? character.archetype.filter((entry): entry is string => typeof entry === 'string')
      : [],
  }));
}

interface UnifiedRuntimeV2ScreenProps {
  renderModel: RenderModel;
  adapter: Pick<UnifiedEngineAdapter, 'dispatch'>;
  characters?: RuntimeV2CharacterOption[];
  onRuntimeError?: (message: string) => void;
}

function isSurfaceScreen(
  screen: RenderModel['screen'],
): screen is Extract<RenderModel['screen'], 'Upgrade' | 'RemoveCard' | 'Enchant' | 'RelicUpgrade' | 'Victory' | 'GameOver'> {
  return (
    screen === 'Upgrade'
    || screen === 'RemoveCard'
    || screen === 'Enchant'
    || screen === 'RelicUpgrade'
    || screen === 'Victory'
    || screen === 'GameOver'
  );
}

export function UnifiedRuntimeV2Screen({
  renderModel,
  adapter,
  characters = buildUnifiedRuntimeV2Characters(),
  onRuntimeError,
}: UnifiedRuntimeV2ScreenProps) {
  const safeDispatch = useCallback((command: RuleCommand) => {
    void adapter.dispatch(command).catch((error) => {
      onRuntimeError?.(error instanceof Error ? error.message : String(error));
    });
  }, [adapter, onRuntimeError]);

  const mapScene = deriveMapSceneProps(renderModel);
  const combatScene = deriveCombatSceneProps(renderModel);
  const rewardScene = deriveRewardSceneProps(renderModel);
  const restScene = deriveRestSceneProps(renderModel);
  const eventScene = deriveEventSceneProps(renderModel);
  const shopScene = deriveShopSceneProps(renderModel);
  const roomTitle = renderModel.room?.title ?? `${renderModel.screen} Room`;
  const roomBody = renderModel.room?.body ?? `Phase: ${renderModel.lifecycle.phase}`;

  return (
    <div className="unified-runtime-v2-screen" data-screen={renderModel.screen}>
      {renderModel.screen === 'CharacterSelect' && (
        <UnifiedRuntimeV2CharacterSelect
          title={renderModel.room?.title}
          body={renderModel.room?.body}
          characters={characters}
          onSelect={(characterId) => safeDispatch({ type: 'select_character', characterId })}
        />
      )}

      {renderModel.screen === 'Map' && mapScene && (
        <MapScene
          scene={mapScene}
          onEnterNode={(nodeId) => safeDispatch({ type: 'enter_node', nodeId })}
        />
      )}

      {renderModel.screen === 'Combat' && combatScene && (
        <CombatScene
          scene={combatScene}
          onComplete={() => safeDispatch({ type: 'complete_combat' })}
        />
      )}

      {renderModel.screen === 'Reward' && rewardScene && (
        <RewardScene
          scene={rewardScene}
          onTake={(cardId) => safeDispatch(cardId ? { type: 'take_reward', cardId } : { type: 'take_reward' })}
          onSkip={() => safeDispatch({ type: 'skip_reward' })}
        />
      )}

      {renderModel.screen === 'Rest' && restScene && (
        <RestScene
          scene={restScene}
          onRest={() => safeDispatch({ type: 'rest' })}
          onEnterEnchant={() => safeDispatch({ type: 'enter_enchant' })}
          onEnterRelicUpgrade={() => safeDispatch({ type: 'enter_relic_upgrade' })}
          onUpgrade={() => safeDispatch({ type: 'upgrade_card' })}
          onRemoveCard={() => safeDispatch({ type: 'remove_card' })}
          onLeave={() => safeDispatch({ type: 'leave_room' })}
        />
      )}

      {renderModel.screen === 'Event' && eventScene && (
        <EventScene
          scene={eventScene}
          onChooseOption={(choiceId) => safeDispatch({ type: 'choose_event_option', choiceId })}
        />
      )}

      {renderModel.screen === 'Shop' && shopScene && (
        <ShopScene
          scene={shopScene}
          onBuyCard={(cardId) => safeDispatch({ type: 'buy_shop_card', cardId })}
          onBuyRelic={(relicId) => safeDispatch({ type: 'buy_shop_relic', relicId })}
          onBuyPotion={(potionId) => safeDispatch({ type: 'buy_shop_potion', potionId })}
          onEnterEnchant={() => safeDispatch({ type: 'enter_enchant' })}
          onLeave={() => safeDispatch({ type: 'leave_room' })}
          onRemoveCard={() => safeDispatch({ type: 'remove_card' })}
        />
      )}

      {isSurfaceScreen(renderModel.screen) && (
        <SurfaceScene
          screen={renderModel.screen}
          room={renderModel.room}
          player={renderModel.player}
          onApplyEnchantment={(cardToken) => safeDispatch({ type: 'apply_enchantment', cardInstanceId: cardToken })}
          onUpgradeRelic={(relicId) => safeDispatch({ type: 'upgrade_relic', relicId })}
          onUpgrade={(cardToken) => safeDispatch(cardToken ? { type: 'upgrade_card', cardInstanceId: cardToken } : { type: 'upgrade_card' })}
          onRemoveCard={(cardToken) => safeDispatch(cardToken ? { type: 'remove_card', cardInstanceId: cardToken } : { type: 'remove_card' })}
          onCancelSurface={() => safeDispatch({ type: 'cancel_surface' })}
        />
      )}

      {renderModel.screen !== 'CharacterSelect' &&
        renderModel.screen !== 'Map' &&
        renderModel.screen !== 'Combat' &&
        renderModel.screen !== 'Reward' &&
        renderModel.screen !== 'Rest' &&
        renderModel.screen !== 'Event' &&
        renderModel.screen !== 'Shop' &&
        renderModel.screen !== 'Upgrade' &&
        renderModel.screen !== 'RemoveCard' &&
        renderModel.screen !== 'Enchant' &&
        renderModel.screen !== 'RelicUpgrade' &&
        renderModel.screen !== 'Victory' &&
        renderModel.screen !== 'GameOver' && (
          <UnifiedRuntimeV2GenericRoom
            title={roomTitle}
            body={roomBody}
            onLeave={() => safeDispatch({ type: 'leave_room' })}
          />
        )}
    </div>
  );
}

function UnifiedRuntimeV2CharacterSelect({
  title,
  body,
  characters,
  onSelect,
}: {
  title?: string;
  body?: string;
  characters: RuntimeV2CharacterOption[];
  onSelect: (characterId: string) => void;
}) {
  const decoratedCharacters = useMemo(() => characters.map((character) => ({
    ...character,
    icon: character.id === 'informant'
      ? '🔍'
      : character.id === 'brute'
        ? '⚔️'
        : character.id === 'tactician'
          ? '🛡️'
          : character.id === 'puppeteer'
            ? '🎭'
            : character.id === 'chronomancer'
              ? '⏳'
              : character.id === 'alchemist'
                ? '⚗️'
                : '?',
  })), [characters]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center p-8 bg-slate-900/80 rounded-xl border border-slate-700 max-w-4xl">
        <h2 className="text-2xl text-white mb-4">{title ?? '新引擎模式'}</h2>
        <p className="text-slate-400 mb-6">{body ?? '请选择角色开始游戏'}</p>
        <div className="grid grid-cols-3 gap-4">
          {decoratedCharacters.map((character) => (
            <button
              key={character.id}
              onClick={() => onSelect(character.id)}
              className="flex flex-col items-center p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 rounded-lg text-white transition-colors"
              data-character-id={character.id}
            >
              <div className="w-16 h-16 bg-slate-700 rounded-full mb-3 flex items-center justify-center text-2xl">
                {character.icon}
              </div>
              <span className="font-medium">{character.name}</span>
              <span className="text-xs text-slate-400 mt-1">HP: {character.maxHp}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UnifiedRuntimeV2GenericRoom({
  title,
  body,
  onLeave,
}: {
  title: string;
  body: string;
  onLeave: () => void;
}) {
  return (
    <div className="generic-room-screen" data-scene="generic-room">
      <h2>{title}</h2>
      <p>{body}</p>
      <button onClick={onLeave} className="generic-room-action-btn">
        Return
      </button>
    </div>
  );
}
