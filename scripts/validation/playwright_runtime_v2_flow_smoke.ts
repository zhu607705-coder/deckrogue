/**
 * @file playwright_runtime_v2_flow_smoke.ts
 * @description 使用 Playwright 测试运行时 V2 完整流程的冒烟测试。
 *
 * 主要职责:
 * - 运行完整的游戏流程（战斗、事件、休息、商店）
 * - 验证 V2 运行时的各个流程节点
 * - 记录截图和错误日志
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright';
import { GameEngine } from '@/core/events/gameEngine';
import type { RendererType, ReplayLogV1, SaveGameV2, RuleCommand, RuleSnapshot } from '@/runtimeV2';

export type RouteTarget = 'Event' | 'Rest' | 'Shop' | 'Combat';
type ActionSource = 'pointer' | 'bridge' | 'derived';

interface RouteNode {
  nodeId: string;
  type: RouteTarget;
}

export interface CoverageRoute {
  seed: number;
  path: RouteNode[];
}

export function createPurchasableRelicFixture(saveGame: SaveGameV2, replayLog: ReplayLogV1) {
  const selectedRelic = [...(saveGame.snapshot.shop?.relics ?? [])].sort((left, right) => left.price - right.price)[0];
  if (!selectedRelic) {
    throw new Error('runtime-v2 flow smoke fixture failed: no relic offer is available');
  }
  const boostedSnapshot: RuleSnapshot = {
    ...structuredClone(saveGame.snapshot),
    player: {
      ...structuredClone(saveGame.snapshot.player),
      gold: selectedRelic.price,
    },
  };
  return {
    selectedRelicId: selectedRelic.id,
    saveGame: {
      ...structuredClone(saveGame),
      snapshot: boostedSnapshot,
    },
    replayLog: {
      ...structuredClone(replayLog),
      commands: [
        ...structuredClone(replayLog.commands),
        { type: 'load_snapshot', snapshot: boostedSnapshot },
      ],
    } satisfies ReplayLogV1,
  };
}

interface RuntimeV2FlowSmokeReport {
  baseUrl: string;
  renderer: RendererType | 'default';
  interactionMode: 'pointer' | 'bridge-assisted-semantic' | 'pointer-covered-flow';
  route: CoverageRoute;
  shopRoute: CoverageRoute;
  failed?: number;
  missingActionSource?: number;
  explicitMissingActionSource?: number;
  inferredActionSourceCount?: number;
  actionSources?: ActionSource[];
  bridgeChecks?: string[];
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  checks: Array<{
    label: string;
    status: 'passed' | 'failed';
    detail: string;
    actionSource?: ActionSource;
  }>;
}

interface RuntimeV2DebugBridge {
  getSnapshot(): RuleSnapshot | null;
  getRenderModel(): any;
  dispatch(command: RuleCommand, options?: { recordReplay?: boolean }): Promise<void>;
  setSaveGame(saveGame: SaveGameV2): void;
  setReplayLog(replayLog: ReplayLogV1): void;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://127.0.0.1:3000',
    headed: false,
    renderer: 'default' as RendererType | 'default',
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg === '--headed') options.headed = true;
    if (arg.startsWith('--renderer=')) {
      const renderer = arg.split('=')[1];
      if (renderer === 'dom' || renderer === 'pixi') {
        options.renderer = renderer;
      }
    }
  }
  return options;
}

function appendQuery(url: string, query: string) {
  const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
  return `${normalized}/${query.startsWith('?') ? query : `?${query}`}`;
}

function normalizeNodeType(type: string): RouteTarget | null {
  if (type === 'Event' || type === 'Rest' || type === 'Shop' || type === 'Combat') {
    return type;
  }
  if (type === 'Elite' || type === 'Boss') {
    return 'Combat';
  }
  return null;
}

export function findCoverageRoute(maxSeed = 400, requiredTargets: RouteTarget[] = ['Event', 'Rest', 'Combat']): CoverageRoute {
  const targets = new Set<RouteTarget>(requiredTargets);
  let bestRoute: CoverageRoute | null = null;

  for (let seed = 1; seed <= maxSeed; seed += 1) {
    const engine = new GameEngine(seed, null);
    try {
      engine.selectCharacter('informant');
      const nodes = engine.state.map;
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const roots = nodes.filter((node) => node.y === 0);

      const dfs = (nodeId: string, seen: Set<RouteTarget>, path: RouteNode[]): void => {
        const node = byId.get(nodeId);
        if (!node) return;

        const normalizedType = normalizeNodeType(node.type);
        if (!normalizedType) return;

        const nextSeen = new Set(seen);
        nextSeen.add(normalizedType);
        const nextPath = [...path, { nodeId, type: normalizedType }];

        if ([...targets].every((target) => nextSeen.has(target))) {
          if (!bestRoute || nextPath.length < bestRoute.path.length) {
            bestRoute = { seed, path: nextPath };
          }
          return;
        }

        if (bestRoute && nextPath.length >= bestRoute.path.length) {
          return;
        }

        for (const nextId of node.next) {
          dfs(nextId, nextSeen, nextPath);
        }
      };

      for (const root of roots) {
        dfs(root.id, new Set<RouteTarget>(), []);
      }
    } finally {
      engine.dispose();
    }
  }

  if (bestRoute) {
    return bestRoute;
  }

  throw new Error(`Could not find a coverage route for ${[...targets].join('/')} within ${maxSeed} seeds.`);
}

async function getRuntimeV2Bridge(page: Page) {
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__deckrogueRuntimeV2, undefined, { timeout: 30_000 });
  return page.evaluateHandle(() => window.__deckrogueRuntimeV2 as RuntimeV2DebugBridge);
}

async function bridgeDispatch(page: Page, command: RuleCommand, options?: { recordReplay?: boolean }) {
  await page.evaluate(
    async ({ nextCommand, nextOptions }) => {
      if (!window.__deckrogueRuntimeV2) {
        throw new Error('runtime-v2 debug bridge is unavailable');
      }
      await window.__deckrogueRuntimeV2.dispatch(nextCommand as RuleCommand, nextOptions);
    },
    { nextCommand: command, nextOptions: options }
  );
}

async function bridgeGetSnapshot(page: Page): Promise<RuleSnapshot> {
  return page.evaluate(() => {
    const snapshot = window.__deckrogueRuntimeV2?.getSnapshot();
    if (!snapshot) {
      throw new Error('runtime-v2 debug bridge did not return a snapshot');
    }
    return snapshot;
  });
}

async function bridgeGetRenderModel(page: Page) {
  return page.evaluate(() => {
    const renderModel = window.__deckrogueRuntimeV2?.getRenderModel();
    if (!renderModel) {
      throw new Error('runtime-v2 debug bridge did not return a render model');
    }
    return renderModel;
  });
}

async function bridgeSetPersistence(page: Page, saveGame: SaveGameV2, replayLog: ReplayLogV1) {
  await page.evaluate(
    ({ nextSaveGame, nextReplayLog }) => {
      if (!window.__deckrogueRuntimeV2) {
        throw new Error('runtime-v2 debug bridge is unavailable');
      }
      window.__deckrogueRuntimeV2.setSaveGame(nextSaveGame);
      window.__deckrogueRuntimeV2.setReplayLog(nextReplayLog);
    },
    { nextSaveGame: saveGame, nextReplayLog: replayLog }
  );
}

function isPixiRenderer(renderer: RendererType | 'default') {
  return renderer === 'pixi';
}

function runtimeActionSource(renderer: RendererType | 'default'): ActionSource {
  return isPixiRenderer(renderer) ? 'bridge' : 'pointer';
}

function proofActionSource(_renderer: RendererType | 'default'): ActionSource {
  return 'pointer';
}

async function clickPixiTarget(page: Page, action: string, id?: string): Promise<ActionSource> {
  await page.waitForFunction(
    ({ expectedAction, expectedId }) => {
      const registry = (window as any).__deckrogueRuntimeV2PixiTargets;
      return Boolean(
        registry?.targets?.some((target: { action: string; id?: string }) =>
          target.action === expectedAction && (expectedId === undefined || target.id === expectedId)
        )
      );
    },
    { expectedAction: action, expectedId: id },
    { timeout: 10_000 },
  );
  const point = await page.evaluate(
    ({ expectedAction, expectedId }) => {
      const registry = (window as any).__deckrogueRuntimeV2PixiTargets;
      const target = registry?.targets?.find((entry: { action: string; id?: string }) =>
        entry.action === expectedAction && (expectedId === undefined || entry.id === expectedId)
      );
      const canvas = document.querySelector('.runtime-v2-app-shell[data-renderer="pixi"] canvas');
      if (!registry || !target || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error(`runtime-v2 flow smoke failed: missing PIXI target ${expectedAction}:${expectedId ?? '*'}`);
      }
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + (Number(target.x) / Number(registry.width)) * rect.width,
        y: rect.top + (Number(target.y) / Number(registry.height)) * rect.height,
      };
    },
    { expectedAction: action, expectedId: id },
  );
  await page.mouse.click(point.x, point.y);
  return 'pointer';
}

function pushCheck(
  report: RuntimeV2FlowSmokeReport,
  entry: {
    label: string;
    status: 'passed' | 'failed';
    detail: string;
  },
  actionSource: ActionSource,
) {
  report.checks.push({
    ...entry,
    actionSource,
  });
}

function inferCheckActionSource(
  label: string,
  renderer: RendererType | 'default',
): 'pointer' | 'bridge' | 'derived' {
  if (
    label.startsWith('launcher_to_')
    || label === 'save_run'
    || label === 'load_saved_run'
    || label === 'replay_last_run'
    || label.endsWith('_save_run')
    || label.endsWith('_load_saved_run')
    || label.endsWith('_replay_last_run')
    || label.endsWith('_load_continue')
    || label.endsWith('_replay_continue')
  ) {
    return 'derived';
  }

  if (renderer === 'pixi') {
    return 'bridge';
  }

  return 'pointer';
}

function finalizeCheckActionSources(report: RuntimeV2FlowSmokeReport) {
  const explicitMissingActionSource = report.checks.filter((entry) => !entry.actionSource).length;
  report.checks = report.checks.map((entry) => ({
    ...entry,
    actionSource: entry.actionSource ?? inferCheckActionSource(entry.label, report.renderer),
  }));
  report.explicitMissingActionSource = explicitMissingActionSource;
  report.inferredActionSourceCount = explicitMissingActionSource;
}

function finalizeReportSummary(report: RuntimeV2FlowSmokeReport) {
  const actionSources = [...new Set(
    report.checks
      .map((entry) => entry.actionSource)
      .filter((value): value is 'pointer' | 'bridge' | 'derived' => Boolean(value)),
  )].sort();

  report.failed = report.checks.filter((entry) => entry.status === 'failed').length;
  report.missingActionSource = report.checks.filter((entry) => !entry.actionSource).length;
  report.actionSources = actionSources;
  report.bridgeChecks = report.checks
    .filter((entry) => entry.actionSource === 'bridge')
    .map((entry) => entry.label);
  if (isPixiRenderer(report.renderer) && !actionSources.includes('bridge')) {
    report.interactionMode = 'pointer-covered-flow';
  }
}

function deriveShopStateFromSnapshot(snapshot: RuleSnapshot) {
  return {
    gold: snapshot.player.gold,
    cardIds: [...(snapshot.shop?.cards ?? [])].map((entry) => entry.id).sort(),
    relicIds: [...(snapshot.shop?.relics ?? [])].map((entry) => entry.id).sort(),
    potionIds: [...(snapshot.shop?.potions ?? [])].map((entry) => entry.id).sort(),
  };
}

function resolveRelicState(record: Record<string, { level?: number; progress?: number; corrupted?: boolean }> | undefined, relicId: string) {
  if (!record) return null;
  const camelKey = relicId.replace(/_([a-z])/g, (_, chr: string) => chr.toUpperCase());
  return record[relicId] ?? record[camelKey] ?? null;
}

async function waitForMap(page: Page) {
  await page.locator('.runtime-v2-app-shell[data-screen="Map"]').waitFor({ timeout: 30_000 });
}

async function launchRuntimeV2Run(page: Page, baseUrl: string, seed: number, renderer: RendererType | 'default') {
  const queryParts = ['runtimeV2=1', 'adapter=python-wasm', `seed=${seed}`];
  if (renderer !== 'default') {
    queryParts.push(`renderer=${renderer}`);
  }
  const url = appendQuery(baseUrl, queryParts.join('&'));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByText('Launch Runtime V2').waitFor({ timeout: 10_000 });
  await page.getByRole('button', { name: /开始新局|Start New Run/ }).click();
  await page.locator('[data-screen="CharacterSelect"]').waitFor({ timeout: 60_000 });
  await page.locator('button[data-character-id="informant"]').click();
  await waitForMap(page);
}

async function waitForMapNode(page: Page, nodeId: string) {
  await page
    .locator(`.runtime-v2-app-shell[data-screen="Map"][data-current-node-id="${nodeId}"]`)
    .waitFor({ timeout: 30_000 });
}

async function getAvailableNodeIds(page: Page): Promise<string[]> {
  const renderer = await page.locator('.runtime-v2-app-shell').getAttribute('data-renderer');
  if (renderer === 'pixi') {
    const renderModel = await bridgeGetRenderModel(page);
    return [...(renderModel.map?.availableNodeIds ?? [])].sort();
  }
  return page.locator('.runtime-v2-app-shell[data-screen="Map"] button.map-node.available').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-node-id') || '')
      .filter((value) => value.length > 0)
      .sort()
  );
}

async function playCoverageRoute(
  page: Page,
  route: CoverageRoute,
  report: RuntimeV2FlowSmokeReport,
  labelPrefix = '',
  options: { stopAtShop?: boolean; stopAtType?: RouteTarget; renderer?: RendererType | 'default' } = {}
) {
  for (const step of route.path) {
    await waitForMap(page);
    const renderer = options.renderer ?? report.renderer;
    let enterNodeSource: ActionSource = 'pointer';
    if (isPixiRenderer(renderer)) {
      enterNodeSource = await clickPixiTarget(page, 'enter_node', step.nodeId);
    } else {
      await page.locator(`button[data-node-id="${step.nodeId}"]`).click();
    }
    if (step.type === 'Event') {
      await page.locator('.runtime-v2-app-shell[data-screen="Event"]').waitFor({ timeout: 30_000 });
      pushCheck(report, {
        label: `${labelPrefix}event_${step.nodeId}`,
        status: 'passed',
        detail: `Visited event node ${step.nodeId}.`,
      }, enterNodeSource);
      if (isPixiRenderer(renderer)) {
        const renderModel = await bridgeGetRenderModel(page);
        const firstChoiceId = renderModel.room?.choices?.[0]?.id;
        if (!firstChoiceId) {
          throw new Error('runtime-v2 flow smoke failed: pixi event did not expose a choice id');
        }
        await clickPixiTarget(page, 'choose_event_option', firstChoiceId);
        pushCheck(report, {
          label: `${labelPrefix}event_choice_${step.nodeId}`,
          status: 'passed',
          detail: `Chose event option ${firstChoiceId} through PIXI pointer target.`,
        }, 'pointer');
      } else {
        await page.locator('button[data-choice-id]').first().click();
      }
      await waitForMap(page);
    } else if (step.type === 'Rest') {
      await page.locator('.runtime-v2-app-shell[data-screen="Rest"]').waitFor({ timeout: 30_000 });
      pushCheck(report, {
        label: `${labelPrefix}rest_${step.nodeId}`,
        status: 'passed',
        detail: `Visited rest node ${step.nodeId}.`,
      }, enterNodeSource);
      if (options.stopAtType === 'Rest') {
        return;
      }
      if (isPixiRenderer(renderer)) {
        const renderModel = await bridgeGetRenderModel(page);
        await clickPixiTarget(page, renderModel.room?.canHeal ? 'rest' : 'leave_room');
      } else {
        const restAction = page.locator('button[data-action="rest"]');
        if (await restAction.count()) {
          await restAction.first().click();
        } else {
          await page.getByRole('button', { name: '继续前进' }).click();
        }
      }
      await waitForMap(page);
    } else if (step.type === 'Shop') {
      await page.locator('.runtime-v2-app-shell[data-screen="Shop"]').waitFor({ timeout: 30_000 });
      pushCheck(report, {
        label: `${labelPrefix}shop_${step.nodeId}`,
        status: 'passed',
        detail: `Visited shop node ${step.nodeId}.`,
      }, enterNodeSource);
      if (options.stopAtShop || options.stopAtType === 'Shop') {
        return;
      }
      if (isPixiRenderer(renderer)) {
        await clickPixiTarget(page, 'leave_room');
      } else {
        await page.getByRole('button', { name: 'Leave Shop' }).click();
      }
      await waitForMap(page);
    } else if (step.type === 'Combat') {
      await page.locator('.runtime-v2-app-shell[data-screen="Combat"]').waitFor({ timeout: 30_000 });
      pushCheck(report, {
        label: `${labelPrefix}combat_${step.nodeId}`,
        status: 'passed',
        detail: `Visited combat node ${step.nodeId}.`,
      }, enterNodeSource);
      if (isPixiRenderer(renderer)) {
        await clickPixiTarget(page, 'complete_combat');
      } else {
        await page.getByRole('button', { name: 'End Combat' }).click();
      }
      await page.locator('.runtime-v2-app-shell[data-screen="Reward"]').waitFor({ timeout: 30_000 });
      pushCheck(report, {
        label: `${labelPrefix}reward_${step.nodeId}`,
        status: 'passed',
        detail: `Reached reward after combat node ${step.nodeId}.`,
      }, proofActionSource(renderer));
      if (isPixiRenderer(renderer)) {
        const renderModel = await bridgeGetRenderModel(page);
        const firstRewardCardId = renderModel.reward?.cards?.[0]?.id;
        if (!firstRewardCardId) {
          throw new Error('runtime-v2 flow smoke failed: pixi reward did not expose a card id');
        }
        await clickPixiTarget(page, 'take_reward', firstRewardCardId);
      } else {
        await page.locator('button[data-card-id]').first().click();
      }
      await waitForMap(page);
    }
  }
}

async function readShopState(page: Page) {
  const renderer = await page.locator('.runtime-v2-app-shell').getAttribute('data-renderer');
  if (renderer === 'pixi') {
    return deriveShopStateFromSnapshot(await bridgeGetSnapshot(page));
  }
  const goldText = await page.locator('.shop-scene .player-gold').textContent();
  const gold = Number((goldText ?? '').replace(/[^\d]/g, ''));
  const cardIds = await page.locator('.shop-scene button[data-action="buy-card"]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-card-id') || '')
      .filter((value) => value.length > 0)
      .sort()
  );
  const relicIds = await page.locator('.shop-scene button[data-action="buy-relic"]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-relic-id') || '')
      .filter((value) => value.length > 0)
      .sort()
  );
  const potionIds = await page.locator('.shop-scene button[data-action="buy-potion"]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-potion-id') || '')
      .filter((value) => value.length > 0)
      .sort()
  );
  return { gold, cardIds, relicIds, potionIds };
}

async function waitForShopState(
  page: Page,
  expected: ReturnType<typeof deriveShopStateFromSnapshot>,
  key: 'cardIds' | 'relicIds' | 'potionIds'
) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await page.locator('.runtime-v2-app-shell[data-screen="Shop"]').waitFor({ timeout: 10_000 });
    const current = await readShopState(page);
    if (current.gold === expected.gold && JSON.stringify(current[key]) === JSON.stringify(expected[key])) {
      return current;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`runtime-v2 flow smoke failed: shop state did not converge for ${key}`);
}

async function readSavedRuntimeV2Artifacts(page: Page) {
  return page.evaluate(() => {
    const rawSave = window.localStorage.getItem('deckrogue:runtime-v2:save');
    const rawReplay = window.localStorage.getItem('deckrogue:runtime-v2:replay');
    return {
      saveGame: rawSave ? JSON.parse(rawSave) : null,
      replayLog: rawReplay ? JSON.parse(rawReplay) : null,
    };
  }) as Promise<{ saveGame: SaveGameV2 | null; replayLog: ReplayLogV1 | null }>;
}

async function waitForReplayCommand(
  page: Page,
  matcher: { type: string; cardId?: string; relicId?: string; potionId?: string }
) {
  await page.waitForFunction(
    (expected) => {
      const rawReplay = window.localStorage.getItem('deckrogue:runtime-v2:replay');
      if (!rawReplay) {
        return false;
      }
      try {
        const replay = JSON.parse(rawReplay) as { commands?: Array<Record<string, unknown>> };
        return Boolean(
          replay.commands?.some((command) => (
            command.type === expected.type
            && (expected.cardId === undefined || command.cardId === expected.cardId)
            && (expected.relicId === undefined || command.relicId === expected.relicId)
            && (expected.potionId === undefined || command.potionId === expected.potionId)
          ))
        );
      } catch {
        return false;
      }
    },
    matcher,
    { timeout: 10_000 }
  );
}

interface ContinuationSignature {
  nextNodeId: string;
  screen: string;
  marker: string;
}

async function exerciseRestUpgradeSurface(page: Page, report: RuntimeV2FlowSmokeReport) {
  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'upgrade_card');
  } else {
    await page.locator('button[data-action="upgrade"]').click();
  }
  await (isPixiRenderer(report.renderer)
    ? page.locator('.runtime-v2-surface-scene-pixi canvas').first()
    : page.locator('[data-screen="Upgrade"] [data-scene="runtime-v2-surface"]')).waitFor({ timeout: 30_000 });
  pushCheck(report, {
    label: 'rest_upgrade_enter',
    status: 'passed',
    detail: 'Entered Upgrade surface from Rest on the default runtime-v2 lane.',
  }, proofActionSource(report.renderer));

  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'cancel_surface');
  } else {
    await page.locator('button[data-action="cancel-surface"]').click();
  }
  await page.locator(isPixiRenderer(report.renderer) ? '.runtime-v2-app-shell[data-screen="Rest"]' : '[data-screen="Rest"] [data-scene="rest"]').waitFor({ timeout: 30_000 });
  pushCheck(report, {
    label: 'rest_upgrade_cancel',
    status: 'passed',
    detail: 'Cancelled Upgrade surface and returned to Rest.',
  }, proofActionSource(report.renderer));

  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'upgrade_card');
  } else {
    await page.locator('button[data-action="upgrade"]').click();
  }
  await (isPixiRenderer(report.renderer)
    ? page.locator('.runtime-v2-surface-scene-pixi canvas').first()
    : page.locator('[data-screen="Upgrade"] [data-scene="runtime-v2-surface"]')).waitFor({ timeout: 30_000 });
  const selectedToken = isPixiRenderer(report.renderer)
    ? (await bridgeGetRenderModel(page)).room?.choices?.[0]?.id ?? null
    : await page.locator('button[data-action="upgrade-card"]').first().getAttribute('data-card-token');
  if (!selectedToken) {
    throw new Error('runtime-v2 flow smoke failed: expected an upgrade-card token');
  }
  const separatorIndex = selectedToken.indexOf(':');
  const upgradedToken = separatorIndex >= 0
    ? `${selectedToken.slice(0, separatorIndex + 1)}${selectedToken.slice(separatorIndex + 1)}+`
    : `${selectedToken}+`;
  const upgradedCardId = upgradedToken.split(':').slice(1).join(':');
  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'upgrade_card', selectedToken);
  } else {
    await page.locator(`button[data-card-token="${selectedToken}"]`).click();
  }
  await page.locator('.runtime-v2-app-shell[data-screen="Map"]').waitFor({ timeout: 30_000 });
  const upgradedSnapshot = await bridgeGetSnapshot(page);
  if (!upgradedSnapshot.player.deck.includes(upgradedCardId)) {
    throw new Error(`runtime-v2 flow smoke failed: upgraded card ${upgradedCardId} not found in saved deck snapshot`);
  }
  pushCheck(report, {
    label: 'rest_upgrade_confirm',
    status: 'passed',
    detail: `Confirmed Upgrade surface and returned to map with upgraded card ${upgradedCardId}.`,
  }, proofActionSource(report.renderer));
}

async function exerciseRestEnchantSurface(page: Page, report: RuntimeV2FlowSmokeReport) {
  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'enter_enchant');
  } else {
    await page.locator('button[data-action="enchant"]').click();
  }
  await (isPixiRenderer(report.renderer)
    ? page.locator('.runtime-v2-surface-scene-pixi canvas').first()
    : page.locator('[data-screen="Enchant"] [data-scene="runtime-v2-surface"]')).waitFor({ timeout: 30_000 });
  pushCheck(report, {
    label: 'rest_enchant_enter',
    status: 'passed',
    detail: 'Entered Enchant surface from Rest.',
  }, proofActionSource(report.renderer));

  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'cancel_surface');
  } else {
    await page.locator('button[data-action="cancel-surface"]').click();
  }
  await page.locator('.runtime-v2-app-shell[data-screen="Rest"]').waitFor({ timeout: 30_000 });
  pushCheck(report, {
    label: 'rest_enchant_cancel',
    status: 'passed',
    detail: 'Cancelled Enchant surface and returned to Rest.',
  }, proofActionSource(report.renderer));

  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'enter_enchant');
  } else {
    await page.locator('button[data-action="enchant"]').click();
  }
  await (isPixiRenderer(report.renderer)
    ? page.locator('.runtime-v2-surface-scene-pixi canvas').first()
    : page.locator('[data-screen="Enchant"] [data-scene="runtime-v2-surface"]')).waitFor({ timeout: 30_000 });
  const selectedToken = isPixiRenderer(report.renderer)
    ? (await bridgeGetRenderModel(page)).room?.choices?.[0]?.id ?? null
    : await page.locator('button[data-action="enchant-card"]').first().getAttribute('data-card-token');
  if (!selectedToken) {
    throw new Error('runtime-v2 flow smoke failed: expected an enchant-card token');
  }
  const selectedCardId = selectedToken.split(':').slice(1).join(':');
  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'apply_enchantment', selectedToken);
  } else {
    await page.locator(`button[data-card-token="${selectedToken}"]`).click();
  }
  await page.locator('.runtime-v2-app-shell[data-screen="Map"]').waitFor({ timeout: 30_000 });
  const enchantedSnapshot = await bridgeGetSnapshot(page);
  if (!enchantedSnapshot.player.deck.includes(`${selectedCardId}*`)) {
    throw new Error(`runtime-v2 flow smoke failed: enchanted card ${selectedCardId}* not found in deck snapshot`);
  }
  pushCheck(report, {
    label: 'rest_enchant_confirm',
    status: 'passed',
    detail: `Applied enchantment to ${selectedCardId} and returned to map with an enchanted deck entry.`,
  }, proofActionSource(report.renderer));
}

async function exerciseRestRelicUpgradeSurface(page: Page, report: RuntimeV2FlowSmokeReport) {
  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'enter_relic_upgrade');
  } else {
    await page.locator('button[data-action="relic-upgrade"]').click();
  }
  await (isPixiRenderer(report.renderer)
    ? page.locator('.runtime-v2-surface-scene-pixi canvas').first()
    : page.locator('[data-screen="RelicUpgrade"] [data-scene="runtime-v2-surface"]')).waitFor({ timeout: 30_000 });
  pushCheck(report, {
    label: 'rest_relic_upgrade_enter',
    status: 'passed',
    detail: 'Entered RelicUpgrade surface from Rest.',
  }, proofActionSource(report.renderer));

  const selectedRelicId = isPixiRenderer(report.renderer)
    ? (await bridgeGetRenderModel(page)).room?.choices?.[0]?.id ?? null
    : await page.locator('button[data-action="upgrade-relic"]').first().getAttribute('data-relic-id');
  if (!selectedRelicId) {
    throw new Error('runtime-v2 flow smoke failed: expected an upgrade-relic choice');
  }
  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'upgrade_relic', selectedRelicId);
  } else {
    await page.locator(`button[data-relic-id="${selectedRelicId}"]`).click();
  }
  await (isPixiRenderer(report.renderer)
    ? page.locator('.runtime-v2-surface-scene-pixi canvas').first()
    : page.locator('[data-screen="RelicUpgrade"] [data-scene="runtime-v2-surface"]')).waitFor({ timeout: 30_000 });
  await page.locator('.save-run-btn').click();
  const savedSnapshot = (await readSavedRuntimeV2Artifacts(page)).saveGame?.snapshot ?? null;
  const relicState = resolveRelicState(savedSnapshot?.player?.relicStates, selectedRelicId);
  if (!relicState || relicState.level !== 2 || relicState.corrupted !== false) {
    throw new Error(`runtime-v2 flow smoke failed: relic upgrade did not persist upgraded state for ${selectedRelicId}`);
  }
  pushCheck(report, {
    label: 'rest_relic_upgrade_confirm',
    status: 'passed',
    detail: `Upgraded ${selectedRelicId} to level ${relicState.level} and cleared its corrupted flag.`,
  }, proofActionSource(report.renderer));

  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'cancel_surface');
  } else {
    await page.locator('button[data-action="cancel-surface"]').click();
  }
  await page.locator('.runtime-v2-app-shell[data-screen="Rest"]').waitFor({ timeout: 30_000 });
  pushCheck(report, {
    label: 'rest_relic_upgrade_cancel',
    status: 'passed',
    detail: 'Cancelled RelicUpgrade surface and returned to Rest.',
  }, proofActionSource(report.renderer));
}

async function exerciseShopRemoveSurface(page: Page, report: RuntimeV2FlowSmokeReport) {
  const initialSnapshot = await bridgeGetSnapshot(page);
  const initialGold = initialSnapshot.player.gold;
  const removalCost = initialSnapshot.shop?.cardRemovalCost ?? 75;
  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'remove_card');
  } else {
    await page.locator('button[data-action="remove"]').click();
  }
  await (isPixiRenderer(report.renderer)
    ? page.locator('.runtime-v2-surface-scene-pixi canvas').first()
    : page.locator('[data-screen="RemoveCard"] [data-scene="runtime-v2-surface"]')).waitFor({ timeout: 30_000 });
  pushCheck(report, {
    label: 'shop_remove_enter',
    status: 'passed',
    detail: 'Entered RemoveCard surface from Shop on the default runtime-v2 lane.',
  }, proofActionSource(report.renderer));

  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'cancel_surface');
  } else {
    await page.locator('button[data-action="cancel-surface"]').click();
  }
  await page.locator(isPixiRenderer(report.renderer) ? '.runtime-v2-app-shell[data-screen="Shop"]' : '[data-screen="Shop"] [data-scene="shop"]').waitFor({ timeout: 30_000 });
  pushCheck(report, {
    label: 'shop_remove_cancel',
    status: 'passed',
    detail: 'Cancelled RemoveCard surface and returned to Shop.',
  }, proofActionSource(report.renderer));

  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'remove_card');
  } else {
    await page.locator('button[data-action="remove"]').click();
  }
  await (isPixiRenderer(report.renderer)
    ? page.locator('.runtime-v2-surface-scene-pixi canvas').first()
    : page.locator('[data-screen="RemoveCard"] [data-scene="runtime-v2-surface"]')).waitFor({ timeout: 30_000 });
  const availableTokens = isPixiRenderer(report.renderer)
    ? ((await bridgeGetRenderModel(page)).room?.choices?.map((choice) => choice.id) ?? [])
    : await page.locator('button[data-action="remove-card"]').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-card-token') || '').filter((value) => value.length > 0)
    );
  const selectedToken = availableTokens[0];
  if (!selectedToken) {
    throw new Error('runtime-v2 flow smoke failed: expected a remove-card token');
  }
  const selectedCardId = selectedToken.split(':').slice(1).join(':');
  const selectedCardCountBefore = availableTokens.filter((token) => token.endsWith(`:${selectedCardId}`)).length;
  if (isPixiRenderer(report.renderer)) {
    await clickPixiTarget(page, 'remove_card', selectedToken);
  } else {
    await page.locator(`button[data-card-token="${selectedToken}"]`).click();
  }
  await page.locator(isPixiRenderer(report.renderer) ? '.runtime-v2-app-shell[data-screen="Shop"]' : '[data-screen="Shop"] [data-scene="shop"]').waitFor({ timeout: 30_000 });
  const postRemovalGold = (await bridgeGetSnapshot(page)).player.gold;
  if (postRemovalGold !== initialGold - removalCost) {
    throw new Error(`runtime-v2 flow smoke failed: shop remove-card gold ${postRemovalGold}, expected ${initialGold - removalCost}`);
  }
  await page.locator('.save-run-btn').click();
  const savedSnapshot = (await readSavedRuntimeV2Artifacts(page)).saveGame?.snapshot ?? null;
  const savedDeck: string[] = Array.isArray(savedSnapshot?.player?.deck)
    ? savedSnapshot.player.deck.map((entry: unknown) => String(entry))
    : [];
  const expectedDeckLengthAfter = availableTokens.length - 1;
  if (savedDeck.length !== expectedDeckLengthAfter) {
    throw new Error(
      `runtime-v2 flow smoke failed: saved deck length ${savedDeck.length}, expected ${expectedDeckLengthAfter} after remove-card`
    );
  }
  const selectedCardCountAfter = savedDeck.filter((cardId) => cardId === selectedCardId).length;
  const expectedSelectedCardCountAfter = Math.max(0, selectedCardCountBefore - 1);
  if (selectedCardCountAfter !== expectedSelectedCardCountAfter) {
    throw new Error(
      `runtime-v2 flow smoke failed: saved deck kept ${selectedCardCountAfter} copies of ${selectedCardId}, expected ${expectedSelectedCardCountAfter}`
    );
  }
  pushCheck(report, {
    label: 'shop_remove_confirm',
    status: 'passed',
    detail: `Confirmed RemoveCard surface, charged ${removalCost} gold, and saved deck reduced ${selectedCardId} from ${selectedCardCountBefore} to ${selectedCardCountAfter}.`,
  }, proofActionSource(report.renderer));
}

async function continueFromShopAndCaptureSignature(page: Page): Promise<ContinuationSignature> {
  const renderer = await page.locator('.runtime-v2-app-shell').getAttribute('data-renderer');
  if (renderer === 'pixi') {
    await clickPixiTarget(page, 'leave_room');
  } else {
    await page.getByRole('button', { name: 'Leave Shop' }).click();
  }
  await waitForMap(page);
  const availableNodeIds = await getAvailableNodeIds(page);
  const nextNodeId = availableNodeIds[0];
  if (!nextNodeId) {
    throw new Error('runtime-v2 flow smoke failed: no follow-up node available after leaving shop');
  }

  if (renderer === 'pixi') {
    await clickPixiTarget(page, 'enter_node', nextNodeId);
  } else {
    await page.locator(`button[data-node-id="${nextNodeId}"]`).click();
  }
  await page.waitForFunction(() => {
    const screen = document.querySelector('.runtime-v2-app-shell')?.getAttribute('data-screen');
    return !!screen && screen !== 'Map';
  }, undefined, { timeout: 10_000 });
  const nextScreen = await page.locator('.runtime-v2-app-shell').getAttribute('data-screen');

  if (nextScreen === 'Event') {
    if (renderer === 'pixi') {
      const snapshot = await bridgeGetSnapshot(page);
      return { nextNodeId, screen: nextScreen, marker: `${snapshot.activeEvent?.id ?? 'unknown-event'}|${snapshot.activeEvent?.stage ?? ''}` };
    }
    await page.locator('[data-screen="Event"] [data-scene="event"]').waitFor({ timeout: 30_000 });
    const title = (await page.locator('.event-scene h2').textContent()) ?? 'unknown-event';
    const choiceIds = await page.locator('.event-scene button[data-choice-id]').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-choice-id') || '').filter((value) => value.length > 0).sort()
    );
    return { nextNodeId, screen: nextScreen, marker: `${title}|${choiceIds.join(',')}` };
  }

  if (nextScreen === 'Combat') {
    if (renderer === 'pixi') {
      const snapshot = await bridgeGetSnapshot(page);
      return {
        nextNodeId,
        screen: nextScreen,
        marker: `${(snapshot.combat?.enemyIds ?? []).join(',')}|${snapshot.combat?.turn ?? 0}`,
      };
    }
    await page.locator('[data-screen="Combat"] [data-scene="combat"]').waitFor({ timeout: 30_000 });
    const enemyDefs = await page.locator('.combat-scene .enemy .enemy-name').evaluateAll((elements) =>
      elements.map((element) => element.textContent?.trim() || '').filter((value) => value.length > 0).sort()
    );
    const enemyIntents = await page.locator('.combat-scene .enemy .intent-value').evaluateAll((elements) =>
      elements.map((element) => element.textContent?.trim() || '').filter((value) => value.length > 0).sort()
    );
    return { nextNodeId, screen: nextScreen, marker: `${enemyDefs.join(',')}|${enemyIntents.join(',')}` };
  }

  if (nextScreen === 'Rest') {
    if (renderer === 'pixi') {
      return { nextNodeId, screen: nextScreen, marker: 'rest' };
    }
    await page.locator('[data-screen="Rest"] [data-scene="rest"]').waitFor({ timeout: 30_000 });
    const title = (await page.locator('.rest-scene h2').textContent()) ?? 'rest';
    return { nextNodeId, screen: nextScreen, marker: title };
  }

  if (nextScreen === 'Shop') {
    const shopState = renderer === 'pixi'
      ? deriveShopStateFromSnapshot(await bridgeGetSnapshot(page))
      : await readShopState(page);
    return {
      nextNodeId,
      screen: nextScreen,
      marker: `${shopState.gold}|${shopState.cardIds.join(',')}|${shopState.relicIds.join(',')}|${shopState.potionIds.join(',')}`,
    };
  }

  throw new Error(`runtime-v2 flow smoke failed: unsupported continuation screen ${nextScreen ?? 'unknown'}`);
}

async function main() {
  const options = parseArgs();
  const route = findCoverageRoute(400, ['Event', 'Rest', 'Combat']);
  const shopRoute = findCoverageRoute(400, ['Shop']);
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'runtime_v2_flow');
  mkdirSync(outputDir, { recursive: true });

  const report: RuntimeV2FlowSmokeReport = {
    baseUrl: options.url,
    renderer: options.renderer,
    interactionMode: isPixiRenderer(options.renderer) ? 'bridge-assisted-semantic' : 'pointer',
    route,
    shopRoute,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    checks: [],
  };

  const browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    report.failedRequests.push(`${request.resourceType()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const request = response.request();
      report.failedRequests.push(`${request.resourceType()} ${response.url()} HTTP ${response.status()}`);
    }
  });

  try {
    await launchRuntimeV2Run(page, options.url, route.seed, options.renderer);
    pushCheck(report, {
      label: 'launcher_to_rest_surface_route',
      status: 'passed',
      detail: `Reached map on deep-surface seed ${route.seed}.`,
    }, 'derived');
    await playCoverageRoute(page, route, report, 'surface_', { stopAtType: 'Rest', renderer: options.renderer });
    await exerciseRestUpgradeSurface(page, report);

    await launchRuntimeV2Run(page, options.url, route.seed, options.renderer);
    pushCheck(report, {
      label: 'launcher_to_rest_enchant_route',
      status: 'passed',
      detail: `Re-entered map on deep-surface seed ${route.seed} for enchant validation.`,
    }, 'derived');
    await playCoverageRoute(page, route, report, 'surface_enchant_', { stopAtType: 'Rest', renderer: options.renderer });
    await exerciseRestEnchantSurface(page, report);

    await launchRuntimeV2Run(page, options.url, route.seed, options.renderer);
    pushCheck(report, {
      label: 'launcher_to_rest_relic_route',
      status: 'passed',
      detail: `Re-entered map on deep-surface seed ${route.seed} for relic-upgrade validation.`,
    }, 'derived');
    await playCoverageRoute(page, route, report, 'surface_relic_', { stopAtType: 'Rest', renderer: options.renderer });

    await page.locator('.save-run-btn').click();
    const baseRestArtifacts = await readSavedRuntimeV2Artifacts(page);
    if (!baseRestArtifacts.saveGame || !baseRestArtifacts.replayLog) {
      throw new Error('runtime-v2 flow smoke failed: expected saved rest fixture artifacts');
    }
    const relicUpgradeSnapshot: RuleSnapshot = {
      ...structuredClone(baseRestArtifacts.saveGame.snapshot),
      player: {
        ...structuredClone(baseRestArtifacts.saveGame.snapshot.player),
        gold: 999,
        relicIds: [...structuredClone(baseRestArtifacts.saveGame.snapshot.player.relicIds), 'chaos_sanctum_relic'],
        relicStates: {
          ...(structuredClone(baseRestArtifacts.saveGame.snapshot.player.relicStates ?? {})),
          chaos_sanctum_relic: { level: 1, progress: 0, corrupted: true },
        },
      },
    };
    await bridgeSetPersistence(page, {
      ...baseRestArtifacts.saveGame,
      snapshot: relicUpgradeSnapshot,
    }, {
      ...baseRestArtifacts.replayLog,
      commands: [...baseRestArtifacts.replayLog.commands, { type: 'load_snapshot', snapshot: relicUpgradeSnapshot }],
    });
    await page.locator('.reset-run-btn').click();
    await page.getByRole('button', { name: /Load Saved Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Load Saved Run/ }).click();
    await page.locator('.runtime-v2-app-shell[data-screen="Rest"]').waitFor({ timeout: 30_000 });
    await exerciseRestRelicUpgradeSurface(page, report);
    await page.evaluate(() => {
      window.localStorage.removeItem('deckrogue:runtime-v2:save');
      window.localStorage.removeItem('deckrogue:runtime-v2:replay');
    });

    await launchRuntimeV2Run(page, options.url, route.seed, options.renderer);
    pushCheck(report, { label: 'launcher_to_map', status: 'passed', detail: `Reached map on seed ${route.seed}.` }, 'derived');
    await playCoverageRoute(page, route, report, '', { renderer: options.renderer });

    const savedNodeId = await page.locator('.runtime-v2-app-shell').getAttribute('data-current-node-id');
    const savedAvailableNodeIds = await getAvailableNodeIds(page);
    await page.locator('.save-run-btn').click();
    pushCheck(report, {
      label: 'save_run',
      status: 'passed',
      detail: `Saved runtime-v2 run at node ${savedNodeId ?? 'unknown'} with available nodes [${savedAvailableNodeIds.join(', ')}].`,
    }, 'derived');
    await page.screenshot({ path: path.join(outputDir, 'saved_map.png'), fullPage: true });

    await page.locator('.reset-run-btn').click();
    await page.getByRole('button', { name: /Load Saved Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Load Saved Run/ }).click();
    await waitForMapNode(page, savedNodeId ?? '');
    const loadedNodeId = await page.locator('.runtime-v2-app-shell').getAttribute('data-current-node-id');
    const loadedAvailableNodeIds = await getAvailableNodeIds(page);
    if (loadedNodeId !== savedNodeId) {
      throw new Error(`runtime-v2 flow smoke failed: load restored node ${loadedNodeId}, expected ${savedNodeId}`);
    }
    if (JSON.stringify(loadedAvailableNodeIds) !== JSON.stringify(savedAvailableNodeIds)) {
      throw new Error(
        `runtime-v2 flow smoke failed: load restored available nodes [${loadedAvailableNodeIds.join(', ')}], expected [${savedAvailableNodeIds.join(', ')}]`
      );
    }
    pushCheck(report, {
      label: 'load_saved_run',
      status: 'passed',
      detail: `Loaded saved run back to node ${loadedNodeId} with matching available nodes [${loadedAvailableNodeIds.join(', ')}].`,
    }, 'derived');
    await page.screenshot({ path: path.join(outputDir, 'loaded_map.png'), fullPage: true });

    await page.locator('.reset-run-btn').click();
    await page.getByRole('button', { name: /Replay Last Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Replay Last Run/ }).click();
    await waitForMapNode(page, savedNodeId ?? '');
    const replayedNodeId = await page.locator('.runtime-v2-app-shell').getAttribute('data-current-node-id');
    const replayedAvailableNodeIds = await getAvailableNodeIds(page);
    if (replayedNodeId !== savedNodeId) {
      throw new Error(`runtime-v2 flow smoke failed: replay restored node ${replayedNodeId}, expected ${savedNodeId}`);
    }
    if (JSON.stringify(replayedAvailableNodeIds) !== JSON.stringify(savedAvailableNodeIds)) {
      throw new Error(
        `runtime-v2 flow smoke failed: replay restored available nodes [${replayedAvailableNodeIds.join(', ')}], expected [${savedAvailableNodeIds.join(', ')}]`
      );
    }
    pushCheck(report, {
      label: 'replay_last_run',
      status: 'passed',
      detail: `Replayed run back to node ${replayedNodeId} with matching available nodes [${replayedAvailableNodeIds.join(', ')}].`,
    }, 'derived');
    await page.screenshot({ path: path.join(outputDir, 'replayed_map.png'), fullPage: true });

    await launchRuntimeV2Run(page, options.url, shopRoute.seed, options.renderer);
    pushCheck(report, {
      label: 'launcher_to_shop_route',
      status: 'passed',
      detail: `Reached map on shop seed ${shopRoute.seed}.`,
    }, 'derived');
    await playCoverageRoute(page, shopRoute, report, 'shop_route_', { stopAtShop: true, renderer: options.renderer });
    await exerciseShopRemoveSurface(page, report);

    await page.locator('.reset-run-btn').click();
    await launchRuntimeV2Run(page, options.url, shopRoute.seed, options.renderer);
    pushCheck(report, {
      label: 'launcher_to_shop_purchase_route',
      status: 'passed',
      detail: `Reached map on shop purchase seed ${shopRoute.seed}.`,
    }, 'derived');
    await playCoverageRoute(page, shopRoute, report, 'shop_purchase_route_', { stopAtShop: true, renderer: options.renderer });

    const initialShopState = isPixiRenderer(options.renderer)
      ? deriveShopStateFromSnapshot(await bridgeGetSnapshot(page))
      : await readShopState(page);
    const purchasedCardId = isPixiRenderer(options.renderer)
      ? (await bridgeGetRenderModel(page)).room?.cards?.find((card: { id: string; price: number }) => initialShopState.gold >= card.price)?.id ?? null
      : await page.locator('.shop-scene button[data-action="buy-card"]:not([disabled])').first().getAttribute('data-card-id');
    if (!purchasedCardId) {
      throw new Error('runtime-v2 flow smoke failed: expected a purchasable shop card id');
    }
    if (isPixiRenderer(options.renderer)) {
      await clickPixiTarget(page, 'buy_shop_card', purchasedCardId);
      await page.waitForFunction(
        ({ cardId, goldBefore }) => {
          const snapshot = window.__deckrogueRuntimeV2?.getSnapshot();
          const offers = snapshot?.shop?.cards ?? [];
          return Boolean(snapshot)
            && Number(snapshot.player.gold) < goldBefore
            && !offers.some((entry: { id: string }) => entry.id === cardId);
        },
        { cardId: purchasedCardId, goldBefore: initialShopState.gold },
        { timeout: 10_000 }
      );
      await waitForReplayCommand(page, { type: 'buy_shop_card', cardId: purchasedCardId });
    } else {
      await page.locator(`.shop-scene button[data-card-id="${purchasedCardId}"]`).click();
      await page.waitForFunction(
        ({ cardId, goldBefore }) => {
          const goldText = document.querySelector('.shop-scene .player-gold')?.textContent ?? '';
          const gold = Number(goldText.replace(/[^\d]/g, ''));
          return gold < goldBefore && !document.querySelector(`.shop-scene button[data-card-id="${cardId}"]`);
        },
        { cardId: purchasedCardId, goldBefore: initialShopState.gold },
        { timeout: 10_000 }
      );
    }
    const purchasedShopState = isPixiRenderer(options.renderer)
      ? deriveShopStateFromSnapshot(await bridgeGetSnapshot(page))
      : await readShopState(page);
    if (purchasedShopState.gold >= initialShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: shop purchase did not reduce gold (${initialShopState.gold} -> ${purchasedShopState.gold})`);
    }
    if (purchasedShopState.cardIds.includes(purchasedCardId)) {
      throw new Error(`runtime-v2 flow smoke failed: purchased card ${purchasedCardId} still appears in shop offers`);
    }
    pushCheck(report, {
      label: 'shop_purchase',
      status: 'passed',
      detail: `Purchased ${purchasedCardId} and reduced shop gold from ${initialShopState.gold} to ${purchasedShopState.gold}.`,
    }, proofActionSource(report.renderer));

    const purchaseReplayLog = await page.evaluate(() => window.localStorage.getItem('deckrogue:runtime-v2:replay'));
    await page.locator('.save-run-btn').click();
    pushCheck(report, {
      label: 'shop_purchase_save_run',
      status: 'passed',
      detail: `Saved purchased shop state with remaining offers [${purchasedShopState.cardIds.join(', ')}].`,
    }, 'derived');
    const purchasedCardArtifacts = await readSavedRuntimeV2Artifacts(page);

    await page.locator('.reset-run-btn').click();
    await page.getByRole('button', { name: /Load Saved Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Load Saved Run/ }).click();
    await page.locator('.runtime-v2-app-shell[data-screen="Shop"]').waitFor({ timeout: 30_000 });
    const loadedShopState = await readShopState(page);
    if (loadedShopState.gold !== purchasedShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: load restored shop gold ${loadedShopState.gold}, expected ${purchasedShopState.gold}`);
    }
    if (JSON.stringify(loadedShopState.cardIds) !== JSON.stringify(purchasedShopState.cardIds)) {
      throw new Error(
        `runtime-v2 flow smoke failed: load restored shop offers [${loadedShopState.cardIds.join(', ')}], expected [${purchasedShopState.cardIds.join(', ')}]`
      );
    }
    pushCheck(report, {
      label: 'shop_purchase_load_saved_run',
      status: 'passed',
      detail: `Loaded purchased shop state with matching gold ${loadedShopState.gold} and offers [${loadedShopState.cardIds.join(', ')}].`,
    }, 'derived');

    const loadedContinuation = await continueFromShopAndCaptureSignature(page);
    pushCheck(report, {
      label: 'shop_purchase_load_continue',
      status: 'passed',
      detail: `Loaded continuation reached ${loadedContinuation.screen} on ${loadedContinuation.nextNodeId} with marker ${loadedContinuation.marker}.`,
    }, 'derived');

    await page.locator('.reset-run-btn').click();
    if (!purchaseReplayLog || !purchasedCardArtifacts.saveGame) {
      throw new Error('runtime-v2 flow smoke failed: expected saved card purchase artifacts before replay');
    }
    await bridgeSetPersistence(page, purchasedCardArtifacts.saveGame, JSON.parse(purchaseReplayLog) as ReplayLogV1);
    await page.getByRole('button', { name: /Replay Last Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Replay Last Run/ }).click();
    const replayedShopState = await waitForShopState(page, purchasedShopState, 'cardIds');
    if (replayedShopState.gold !== purchasedShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: replay restored shop gold ${replayedShopState.gold}, expected ${purchasedShopState.gold}`);
    }
    if (JSON.stringify(replayedShopState.cardIds) !== JSON.stringify(purchasedShopState.cardIds)) {
      throw new Error(
        `runtime-v2 flow smoke failed: replay restored shop offers [${replayedShopState.cardIds.join(', ')}], expected [${purchasedShopState.cardIds.join(', ')}]`
      );
    }
    pushCheck(report, {
      label: 'shop_purchase_replay_last_run',
      status: 'passed',
      detail: `Replayed purchased shop state with matching gold ${replayedShopState.gold} and offers [${replayedShopState.cardIds.join(', ')}].`,
    }, 'derived');
    const replayedContinuation = await continueFromShopAndCaptureSignature(page);
    if (JSON.stringify(replayedContinuation) !== JSON.stringify(loadedContinuation)) {
      throw new Error(
        `runtime-v2 flow smoke failed: replay continuation ${JSON.stringify(replayedContinuation)} diverged from loaded continuation ${JSON.stringify(loadedContinuation)}`
      );
    }
    pushCheck(report, {
      label: 'shop_purchase_replay_continue',
      status: 'passed',
      detail: `Replay continuation matched loaded ${replayedContinuation.screen} marker ${replayedContinuation.marker}.`,
    }, 'derived');

    await launchRuntimeV2Run(page, options.url, shopRoute.seed, options.renderer);
    pushCheck(report, {
      label: 'launcher_to_shop_route_relic',
      status: 'passed',
      detail: `Reached map on relic shop seed ${shopRoute.seed}.`,
    }, 'derived');
    await playCoverageRoute(page, shopRoute, report, 'shop_route_relic_', { stopAtShop: true, renderer: options.renderer });
    await page.locator('.save-run-btn').click();
    const baseRelicArtifacts = await readSavedRuntimeV2Artifacts(page);
    if (!baseRelicArtifacts.saveGame || !baseRelicArtifacts.replayLog) {
      throw new Error('runtime-v2 flow smoke failed: expected saved relic fixture artifacts');
    }
    const purchasableRelicFixture = createPurchasableRelicFixture(baseRelicArtifacts.saveGame, baseRelicArtifacts.replayLog);
    await bridgeSetPersistence(page, purchasableRelicFixture.saveGame, purchasableRelicFixture.replayLog);

    await page.locator('.reset-run-btn').click();
    await page.getByRole('button', { name: /Load Saved Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Load Saved Run/ }).click();
    await page.locator('.runtime-v2-app-shell[data-screen="Shop"]').waitFor({ timeout: 30_000 });
    const initialRelicShopState = isPixiRenderer(options.renderer)
      ? deriveShopStateFromSnapshot(await bridgeGetSnapshot(page))
      : await readShopState(page);
    if (!initialRelicShopState.relicIds.includes(purchasableRelicFixture.selectedRelicId)) {
      throw new Error(`runtime-v2 flow smoke failed: relic fixture missing ${purchasableRelicFixture.selectedRelicId}`);
    }
    if (isPixiRenderer(options.renderer)) {
      await clickPixiTarget(page, 'buy_shop_relic', purchasableRelicFixture.selectedRelicId);
      await page.waitForFunction(
        ({ relicId, goldBefore }) => {
          const snapshot = window.__deckrogueRuntimeV2?.getSnapshot();
          const offers = snapshot?.shop?.relics ?? [];
          return Boolean(snapshot)
            && Number(snapshot.player.gold) < goldBefore
            && !offers.some((entry: { id: string }) => entry.id === relicId);
        },
        { relicId: purchasableRelicFixture.selectedRelicId, goldBefore: initialRelicShopState.gold },
        { timeout: 10_000 }
      );
      await waitForReplayCommand(page, { type: 'buy_shop_relic', relicId: purchasableRelicFixture.selectedRelicId });
    } else {
      await page.locator(`.shop-scene button[data-relic-id="${purchasableRelicFixture.selectedRelicId}"]`).click();
      await page.waitForFunction(
        ({ relicId, goldBefore }) => {
          const goldText = document.querySelector('.shop-scene .player-gold')?.textContent ?? '';
          const gold = Number(goldText.replace(/[^\d]/g, ''));
          return gold < goldBefore && !document.querySelector(`.shop-scene button[data-relic-id="${relicId}"]`);
        },
        { relicId: purchasableRelicFixture.selectedRelicId, goldBefore: initialRelicShopState.gold },
        { timeout: 10_000 }
      );
    }
    const purchasedRelicShopState = isPixiRenderer(options.renderer)
      ? deriveShopStateFromSnapshot(await bridgeGetSnapshot(page))
      : await readShopState(page);
    if (purchasedRelicShopState.gold >= initialRelicShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: relic purchase did not reduce gold (${initialRelicShopState.gold} -> ${purchasedRelicShopState.gold})`);
    }
    if (purchasedRelicShopState.relicIds.includes(purchasableRelicFixture.selectedRelicId)) {
      throw new Error(`runtime-v2 flow smoke failed: purchased relic ${purchasableRelicFixture.selectedRelicId} still appears in shop offers`);
    }
    pushCheck(report, {
      label: 'shop_relic_purchase',
      status: 'passed',
      detail: `Purchased ${purchasableRelicFixture.selectedRelicId} and reduced shop gold from ${initialRelicShopState.gold} to ${purchasedRelicShopState.gold}.`,
    }, proofActionSource(report.renderer));

    const purchaseRelicReplayLog = await page.evaluate(() => window.localStorage.getItem('deckrogue:runtime-v2:replay'));
    await page.locator('.save-run-btn').click();
    pushCheck(report, {
      label: 'shop_relic_purchase_save_run',
      status: 'passed',
      detail: `Saved purchased relic shop state with remaining relics [${purchasedRelicShopState.relicIds.join(', ')}].`,
    }, 'derived');
    const purchasedRelicArtifacts = await readSavedRuntimeV2Artifacts(page);

    await page.locator('.reset-run-btn').click();
    await page.getByRole('button', { name: /Load Saved Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Load Saved Run/ }).click();
    await page.locator('.runtime-v2-app-shell[data-screen="Shop"]').waitFor({ timeout: 30_000 });
    const loadedRelicShopState = isPixiRenderer(options.renderer)
      ? deriveShopStateFromSnapshot(await bridgeGetSnapshot(page))
      : await readShopState(page);
    if (loadedRelicShopState.gold !== purchasedRelicShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: load restored relic shop gold ${loadedRelicShopState.gold}, expected ${purchasedRelicShopState.gold}`);
    }
    if (JSON.stringify(loadedRelicShopState.relicIds) !== JSON.stringify(purchasedRelicShopState.relicIds)) {
      throw new Error(
        `runtime-v2 flow smoke failed: load restored relic offers [${loadedRelicShopState.relicIds.join(', ')}], expected [${purchasedRelicShopState.relicIds.join(', ')}]`
      );
    }
    pushCheck(report, {
      label: 'shop_relic_purchase_load_saved_run',
      status: 'passed',
      detail: `Loaded purchased relic shop state with matching gold ${loadedRelicShopState.gold} and relics [${loadedRelicShopState.relicIds.join(', ')}].`,
    }, 'derived');

    const loadedRelicContinuation = await continueFromShopAndCaptureSignature(page);
    pushCheck(report, {
      label: 'shop_relic_purchase_load_continue',
      status: 'passed',
      detail: `Loaded relic continuation reached ${loadedRelicContinuation.screen} on ${loadedRelicContinuation.nextNodeId} with marker ${loadedRelicContinuation.marker}.`,
    }, 'derived');

    await page.locator('.reset-run-btn').click();
    if (!purchaseRelicReplayLog || !purchasedRelicArtifacts.saveGame) {
      throw new Error('runtime-v2 flow smoke failed: expected saved relic purchase artifacts before replay');
    }
    await bridgeSetPersistence(page, purchasedRelicArtifacts.saveGame, JSON.parse(purchaseRelicReplayLog) as ReplayLogV1);
    await page.getByRole('button', { name: /Replay Last Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Replay Last Run/ }).click();
    const replayedRelicShopState = await waitForShopState(page, purchasedRelicShopState, 'relicIds');
    if (replayedRelicShopState.gold !== purchasedRelicShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: replay restored relic shop gold ${replayedRelicShopState.gold}, expected ${purchasedRelicShopState.gold}`);
    }
    if (JSON.stringify(replayedRelicShopState.relicIds) !== JSON.stringify(purchasedRelicShopState.relicIds)) {
      throw new Error(
        `runtime-v2 flow smoke failed: replay restored relic offers [${replayedRelicShopState.relicIds.join(', ')}], expected [${purchasedRelicShopState.relicIds.join(', ')}]`
      );
    }
    pushCheck(report, {
      label: 'shop_relic_purchase_replay_last_run',
      status: 'passed',
      detail: `Replayed purchased relic shop state with matching gold ${replayedRelicShopState.gold} and relics [${replayedRelicShopState.relicIds.join(', ')}].`,
    }, 'derived');
    const replayedRelicContinuation = await continueFromShopAndCaptureSignature(page);
    if (JSON.stringify(replayedRelicContinuation) !== JSON.stringify(loadedRelicContinuation)) {
      throw new Error(
        `runtime-v2 flow smoke failed: relic replay continuation ${JSON.stringify(replayedRelicContinuation)} diverged from loaded continuation ${JSON.stringify(loadedRelicContinuation)}`
      );
    }
    pushCheck(report, {
      label: 'shop_relic_purchase_replay_continue',
      status: 'passed',
      detail: `Replay relic continuation matched loaded ${replayedRelicContinuation.screen} marker ${replayedRelicContinuation.marker}.`,
    }, 'derived');

    await launchRuntimeV2Run(page, options.url, shopRoute.seed, options.renderer);
    pushCheck(report, {
      label: 'launcher_to_shop_route_potion',
      status: 'passed',
      detail: `Reached map on potion shop seed ${shopRoute.seed}.`,
    }, 'derived');
    await playCoverageRoute(page, shopRoute, report, 'shop_route_potion_', { stopAtShop: true, renderer: options.renderer });
    const initialPotionShopState = isPixiRenderer(options.renderer)
      ? deriveShopStateFromSnapshot(await bridgeGetSnapshot(page))
      : await readShopState(page);
    const purchasedPotionId = isPixiRenderer(options.renderer)
      ? (await bridgeGetRenderModel(page)).room?.potions?.find((potion: { id: string; price: number }) => initialPotionShopState.gold >= potion.price)?.id ?? null
      : await page.locator('.shop-scene button[data-action="buy-potion"]:not([disabled])').first().getAttribute('data-potion-id');
    if (!purchasedPotionId) {
      throw new Error('runtime-v2 flow smoke failed: expected a purchasable shop potion id');
    }
    if (isPixiRenderer(options.renderer)) {
      await clickPixiTarget(page, 'buy_shop_potion', purchasedPotionId);
      await page.waitForFunction(
        ({ potionId, goldBefore }) => {
          const snapshot = window.__deckrogueRuntimeV2?.getSnapshot();
          const offers = snapshot?.shop?.potions ?? [];
          return Boolean(snapshot)
            && Number(snapshot.player.gold) < goldBefore
            && !offers.some((entry: { id: string }) => entry.id === potionId);
        },
        { potionId: purchasedPotionId, goldBefore: initialPotionShopState.gold },
        { timeout: 10_000 }
      );
      await waitForReplayCommand(page, { type: 'buy_shop_potion', potionId: purchasedPotionId });
    } else {
      await page.locator(`.shop-scene button[data-potion-id="${purchasedPotionId}"]`).click();
      await page.waitForFunction(
        ({ potionId, goldBefore }) => {
          const goldText = document.querySelector('.shop-scene .player-gold')?.textContent ?? '';
          const gold = Number(goldText.replace(/[^\d]/g, ''));
          return gold < goldBefore && !document.querySelector(`.shop-scene button[data-potion-id="${potionId}"]`);
        },
        { potionId: purchasedPotionId, goldBefore: initialPotionShopState.gold },
        { timeout: 10_000 }
      );
    }
    const purchasedPotionShopState = isPixiRenderer(options.renderer)
      ? deriveShopStateFromSnapshot(await bridgeGetSnapshot(page))
      : await readShopState(page);
    if (purchasedPotionShopState.gold >= initialPotionShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: shop potion purchase did not reduce gold (${initialPotionShopState.gold} -> ${purchasedPotionShopState.gold})`);
    }
    if (purchasedPotionShopState.potionIds.includes(purchasedPotionId)) {
      throw new Error(`runtime-v2 flow smoke failed: purchased potion ${purchasedPotionId} still appears in shop offers`);
    }
    pushCheck(report, {
      label: 'shop_potion_purchase',
      status: 'passed',
      detail: `Purchased ${purchasedPotionId} and reduced shop gold from ${initialPotionShopState.gold} to ${purchasedPotionShopState.gold}.`,
    }, proofActionSource(report.renderer));

    const purchasePotionReplayLog = await page.evaluate(() => window.localStorage.getItem('deckrogue:runtime-v2:replay'));
    await page.locator('.save-run-btn').click();
    pushCheck(report, {
      label: 'shop_potion_purchase_save_run',
      status: 'passed',
      detail: `Saved purchased potion shop state with remaining potions [${purchasedPotionShopState.potionIds.join(', ')}].`,
    }, 'derived');
    const purchasedPotionArtifacts = await readSavedRuntimeV2Artifacts(page);

    await page.locator('.reset-run-btn').click();
    await page.getByRole('button', { name: /Load Saved Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Load Saved Run/ }).click();
    await page.locator('.runtime-v2-app-shell[data-screen="Shop"]').waitFor({ timeout: 30_000 });
    const loadedPotionShopState = await readShopState(page);
    if (loadedPotionShopState.gold !== purchasedPotionShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: load restored potion shop gold ${loadedPotionShopState.gold}, expected ${purchasedPotionShopState.gold}`);
    }
    if (JSON.stringify(loadedPotionShopState.potionIds) !== JSON.stringify(purchasedPotionShopState.potionIds)) {
      throw new Error(
        `runtime-v2 flow smoke failed: load restored potion offers [${loadedPotionShopState.potionIds.join(', ')}], expected [${purchasedPotionShopState.potionIds.join(', ')}]`
      );
    }
    pushCheck(report, {
      label: 'shop_potion_purchase_load_saved_run',
      status: 'passed',
      detail: `Loaded purchased potion shop state with matching gold ${loadedPotionShopState.gold} and potions [${loadedPotionShopState.potionIds.join(', ')}].`,
    }, 'derived');

    const loadedPotionContinuation = await continueFromShopAndCaptureSignature(page);
    pushCheck(report, {
      label: 'shop_potion_purchase_load_continue',
      status: 'passed',
      detail: `Loaded potion continuation reached ${loadedPotionContinuation.screen} on ${loadedPotionContinuation.nextNodeId} with marker ${loadedPotionContinuation.marker}.`,
    }, 'derived');

    await page.locator('.reset-run-btn').click();
    if (!purchasePotionReplayLog || !purchasedPotionArtifacts.saveGame) {
      throw new Error('runtime-v2 flow smoke failed: expected saved potion purchase artifacts before replay');
    }
    await bridgeSetPersistence(page, purchasedPotionArtifacts.saveGame, JSON.parse(purchasePotionReplayLog) as ReplayLogV1);
    await page.getByRole('button', { name: /Replay Last Run/ }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Replay Last Run/ }).click();
    const replayedPotionShopState = await waitForShopState(page, purchasedPotionShopState, 'potionIds');
    if (replayedPotionShopState.gold !== purchasedPotionShopState.gold) {
      throw new Error(`runtime-v2 flow smoke failed: replay restored potion shop gold ${replayedPotionShopState.gold}, expected ${purchasedPotionShopState.gold}`);
    }
    if (JSON.stringify(replayedPotionShopState.potionIds) !== JSON.stringify(purchasedPotionShopState.potionIds)) {
      throw new Error(
        `runtime-v2 flow smoke failed: replay restored potion offers [${replayedPotionShopState.potionIds.join(', ')}], expected [${purchasedPotionShopState.potionIds.join(', ')}]`
      );
    }
    pushCheck(report, {
      label: 'shop_potion_purchase_replay_last_run',
      status: 'passed',
      detail: `Replayed purchased potion shop state with matching gold ${replayedPotionShopState.gold} and potions [${replayedPotionShopState.potionIds.join(', ')}].`,
    }, 'derived');
    const replayedPotionContinuation = await continueFromShopAndCaptureSignature(page);
    if (JSON.stringify(replayedPotionContinuation) !== JSON.stringify(loadedPotionContinuation)) {
      throw new Error(
        `runtime-v2 flow smoke failed: replay potion continuation ${JSON.stringify(replayedPotionContinuation)} diverged from loaded continuation ${JSON.stringify(loadedPotionContinuation)}`
      );
    }
    pushCheck(report, {
      label: 'shop_potion_purchase_replay_continue',
      status: 'passed',
      detail: `Replay potion continuation matched loaded ${replayedPotionContinuation.screen} marker ${replayedPotionContinuation.marker}.`,
    }, 'derived');
  } finally {
    finalizeCheckActionSources(report);
    finalizeReportSummary(report);
    writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    if (report.renderer === 'dom' || report.renderer === 'pixi') {
      writeFileSync(path.join(outputDir, `report_${report.renderer}.json`), JSON.stringify(report, null, 2));
    }
    await browser.close();
  }

  if (report.consoleErrors.length || report.pageErrors.length || report.failedRequests.length) {
    throw new Error(
      `runtime-v2 flow smoke failed: console=${report.consoleErrors.length}, page=${report.pageErrors.length}, requests=${report.failedRequests.length}`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
