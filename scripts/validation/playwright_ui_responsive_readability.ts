/**
 * @file playwright_ui_responsive_readability.ts
 * @description Multi-viewport readability audit for dense DeckRogue UI surfaces.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createBossPhaseFixture,
  createEventFixture,
  createGameOverFixture,
  createRestFixture,
  createRemoveCardFixture,
  createRewardFixture,
  createShopFixture,
  createVictoryFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  spawnDevServer,
  waitForServer,
  type SaveSlotFixture,
} from './flow_smoke_helpers';
import { cardsData } from '@/content/narrative/numericSystem';
import { createRunCardInstance } from '@/core/combat/runCardInstance';

type ViewportSpec = {
  name: string;
  width: number;
  height: number;
};

type AuditProfile = {
  name: string;
  surfaceNames: string[];
  viewportNames: string[];
  rootFontPercent?: number;
  colorScheme?: 'dark' | 'light';
};

type SurfaceSpec = {
  name: string;
  fixtureName?: string;
  fixtures?: () => SaveSlotFixture[];
  afterBootstrap?: (context: BrowserContext) => Promise<void>;
  waitFor: string | RegExp;
  afterOpen?: (page: Page) => Promise<void>;
  auditRoot?: string;
  synthetic?: 'screen-loading-fallback' | 'error-boundary-fallback';
};

type ReadabilityIssue = {
  surface: string;
  viewport: string;
  kind:
    | 'horizontal-overflow'
    | 'vertical-lock'
    | 'small-text'
    | 'card-text-small'
    | 'card-title-small'
    | 'tap-target-small'
    | 'tap-target-occluded';
  selector: string;
  detail: string;
};

type SurfaceAudit = {
  surface: string;
  viewport: string;
  profile: string;
  screenshot: string;
  documentWidth: number;
  viewportWidth: number;
  horizontalOverflow: boolean;
  cardCount: number;
  minCardTextFontPx: number | null;
  minCardTitleFontPx: number | null;
  smallTextCount: number;
  smallTapTargetCount: number;
};

const viewports: ViewportSpec[] = [
  { name: 'mobile-320x640', width: 320, height: 640 },
  { name: 'mobile-360x740', width: 360, height: 740 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-414x896', width: 414, height: 896 },
  { name: 'mobile-landscape-640x320', width: 640, height: 320 },
  { name: 'mobile-landscape-844x390', width: 844, height: 390 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-short-1024x576', width: 1024, height: 576 },
  { name: 'desktop-1440x960', width: 1440, height: 960 },
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-ultrawide-2560x1080', width: 2560, height: 1080 },
];

const surfaces: SurfaceSpec[] = [
  {
    name: 'launcher',
    waitFor: 'text=战区启动器',
  },
  {
    name: 'character-select',
    waitFor: 'text=执行体档案墙',
    afterOpen: async (page) => {
      await page.getByRole('button').first().click({ force: true });
      await page.getByText('执行体档案墙').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'character-codex-overlay',
    waitFor: 'text=图鉴 /',
    auditRoot: '.codex-overlay',
    afterOpen: async (page) => {
      await page.getByRole('button').first().click({ force: true });
      await page.getByText('执行体档案墙').waitFor({ timeout: 10_000 });
      await ensureCharacterMetaPanelOpen(page, '点击进入图鉴说明书');
      await page.locator('button.campaign-action').filter({ hasText: '点击进入图鉴说明书' }).first().click({ force: true });
      await page.getByText('图鉴 /').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'character-codex-import-tools',
    waitFor: 'text=将其他设备导出的图鉴 JSON',
    auditRoot: '.codex-overlay',
    afterOpen: async (page) => {
      await page.getByRole('button').first().click({ force: true });
      await page.getByText('执行体档案墙').waitFor({ timeout: 10_000 });
      await ensureCharacterMetaPanelOpen(page, '点击进入图鉴说明书');
      await page.locator('button.campaign-action').filter({ hasText: '点击进入图鉴说明书' }).first().click({ force: true });
      await page.getByText('图鉴 /').waitFor({ timeout: 10_000 });
      await page.getByRole('button', { name: /导入\/同步/ }).click({ force: true });
      await page.getByText('将其他设备导出的图鉴 JSON').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'character-codex-import-error',
    waitFor: /导入失败：/,
    auditRoot: '.codex-overlay',
    afterOpen: async (page) => {
      await page.getByRole('button').first().click({ force: true });
      await page.getByText('执行体档案墙').waitFor({ timeout: 10_000 });
      await ensureCharacterMetaPanelOpen(page, '点击进入图鉴说明书');
      await page.locator('button.campaign-action').filter({ hasText: '点击进入图鉴说明书' }).first().click({ force: true });
      await page.getByText('图鉴 /').waitFor({ timeout: 10_000 });
      await page.getByRole('button', { name: /导入\/同步/ }).click({ force: true });
      await page.getByPlaceholder('{"version":1,"unlocked":...}').fill('{bad codex json');
      await page.getByRole('button', { name: '导入并合并' }).click({ force: true });
      await page.getByText(/导入失败：/).waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'character-achievements-overlay',
    waitFor: /成就 \/|Achievements/,
    auditRoot: '.achievement-overlay',
    afterOpen: async (page) => {
      await page.getByRole('button').first().click({ force: true });
      await page.getByText('执行体档案墙').waitFor({ timeout: 10_000 });
      await ensureCharacterMetaPanelOpen(page, /尚未解锁成就|最新：/);
      await page.locator('button.campaign-action').filter({ hasText: /尚未解锁成就|最新：/ }).first().waitFor({ timeout: 10_000 });
      await page.locator('button.campaign-action').filter({ hasText: /尚未解锁成就|最新：/ }).first().click({ force: true });
      await page.getByText(/成就 \/|Achievements/).waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'launcher-tutorial-overlay',
    waitFor: 'text=新手战区教程',
    auditRoot: '.tutorial-overlay',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: /术语、资源与战斗流程|战区教程/ }).click({ force: true });
      await page.getByText('新手战区教程').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'launcher-save-slots',
    fixtures: () => [createReadableBossPhaseFixture(), createRewardFixture(), createShopFixture()],
    waitFor: 'text=Readable Boss Phase Flow',
    auditRoot: '.launcher-shell',
  },
  {
    name: 'launcher-corrupt-save-error',
    fixtures: () => [createReadableBossPhaseFixture()],
    afterBootstrap: async (context) => {
      await context.addInitScript(() => {
        const slotsRaw = localStorage.getItem('deckrogue_save_slots');
        const slots = slotsRaw ? JSON.parse(slotsRaw) : [];
        const slot = slots.find((entry: { id?: string }) => entry.id === 'readable_boss_phase_flow');
        if (slot) {
          slot.checksum = 'forced-corrupt-checksum';
          localStorage.setItem('deckrogue_save_slots', JSON.stringify(slots));
        }
      });
    },
    waitFor: /读取存档失败：readable_boss_phase_flow/,
    auditRoot: '.launcher-shell',
    afterOpen: async (page) => {
      await loadSlotFromLauncher(page, 'Readable Boss Phase Flow');
      await page.getByText(/读取存档失败：readable_boss_phase_flow/).waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'launcher-delete-save-error',
    fixtures: () => [createReadableBossPhaseFixture()],
    waitFor: /删除存档失败：readable_boss_phase_flow/,
    auditRoot: '.launcher-shell',
    afterOpen: async (page) => {
      await page.evaluate(`
        (() => {
          const storagePrototype = Storage.prototype;
          if (!storagePrototype.__deckrogueForcedDeleteFailureOriginalRemoveItem) {
            storagePrototype.__deckrogueForcedDeleteFailureOriginalRemoveItem = storagePrototype.removeItem;
          }
          storagePrototype.removeItem = function(key) {
            if (String(key).startsWith('deckrogue_save_')) {
              throw new Error('forced delete failure for responsive audit');
            }
            return storagePrototype.__deckrogueForcedDeleteFailureOriginalRemoveItem.call(this, key);
          };
        })()
      `);
      const deleteFailurePatchActive = await page.evaluate(`
        (() => {
          try {
            localStorage.removeItem('deckrogue_save_probe');
            return false;
          } catch (error) {
            return error instanceof Error && error.message.includes('forced delete failure for responsive audit');
          }
        })()
      `);
      if (!deleteFailurePatchActive) {
        throw new Error('launcher-delete-save-error could not install forced delete failure patch');
      }
      const deleteButton = page.locator('[data-save-slot-action="delete"][data-save-slot-id="readable_boss_phase_flow"]');
      await deleteButton.waitFor({ state: 'attached', timeout: 10_000 });
      await deleteButton.scrollIntoViewIfNeeded();
      await page.evaluate(`
        (() => {
          const button = document.querySelector('[data-save-slot-action="delete"][data-save-slot-id="readable_boss_phase_flow"]');
          if (!(button instanceof HTMLButtonElement)) {
            throw new Error('launcher-delete-save-error could not find delete slot button');
          }
          button.click();
        })()
      `);
      await page.waitForFunction(
        () => document.body.textContent?.includes('删除存档失败：readable_boss_phase_flow'),
        undefined,
        { timeout: 10_000 }
      );
    },
  },
  {
    name: 'screen-loading-fallback',
    waitFor: 'text=正在加载 战斗...',
    auditRoot: '.screen-loading-fallback',
    synthetic: 'screen-loading-fallback',
  },
  {
    name: 'error-boundary-fallback',
    waitFor: 'text=界面渲染异常',
    auditRoot: '.deckrogue-error-boundary',
    synthetic: 'error-boundary-fallback',
  },
  {
    name: 'system-menu-root',
    fixtureName: 'Boss Phase Flow',
    waitFor: 'text=返回启动器',
    auditRoot: '.app-menu-backdrop',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: '菜单' }).click({ force: true });
      await page.getByText('返回启动器').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'system-menu-theme',
    fixtureName: 'Boss Phase Flow',
    waitFor: 'text=主题与视觉',
    auditRoot: '.app-menu-backdrop',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: '菜单' }).click({ force: true });
      await page.getByRole('button', { name: '主题与视觉' }).click({ force: true });
      await page.getByText('主题与视觉').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'system-menu-save-load',
    fixtureName: 'Boss Phase Flow',
    waitFor: 'text=存档 / 读取',
    auditRoot: '.app-menu-backdrop',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: '菜单' }).click({ force: true });
      await page.getByRole('button', { name: '存档 / 读取' }).click({ force: true });
      await page.getByText('存档 / 读取').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'system-menu-quick-load-error',
    fixtures: () => [createBossPhaseFixture(), createCorruptQuickSaveFixture()],
    waitFor: /快速读取失败：/,
    auditRoot: '.app-menu-backdrop',
    afterOpen: async (page) => {
      await loadSlotFromLauncher(page, 'Boss Phase Flow');
      await page.evaluate(`
        (() => {
          const slots = JSON.parse(localStorage.getItem('deckrogue_save_slots') || '[]');
          const quickSlot = slots.find((slot) => slot && slot.id === 'quicksave');
          if (!quickSlot) {
            throw new Error('system-menu-quick-load-error could not find quicksave slot');
          }
          quickSlot.checksum = 'forced-corrupt-quicksave-checksum';
          localStorage.setItem('deckrogue_save_slots', JSON.stringify(slots));
        })()
      `);
      await page.locator('.app-topbar-btn').last().click({ force: true });
      await page.locator('.app-menu-panel [data-keyboard-option="2"]').first().click({ force: true });
      const quickLoadButton = page.locator('.app-menu-panel [data-keyboard-option="2"]').first();
      await quickLoadButton.waitFor({ state: 'attached', timeout: 10_000 });
      const disabled = await quickLoadButton.evaluate((button) => button.hasAttribute('disabled'));
      if (disabled) {
        throw new Error('system-menu-quick-load-error quick load button should be enabled with corrupt quicksave payload');
      }
      await quickLoadButton.click({ force: true });
      await page.locator('[data-system-menu-error="true"]').filter({ hasText: /快速读取失败：/ }).waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'system-menu-keybinds',
    fixtureName: 'Boss Phase Flow',
    waitFor: 'text=键位设置',
    auditRoot: '.app-menu-backdrop',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: '菜单' }).click({ force: true });
      await page.getByRole('button', { name: '键位设置' }).click({ force: true });
      await page.getByText('键位设置').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'system-menu-restart-confirm',
    fixtureName: 'Restartable Boss Phase Flow',
    waitFor: 'text=确认重开当前战斗？',
    auditRoot: '.restart-combat-confirm',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: '菜单' }).click({ force: true });
      await page.getByRole('button', { name: '重开当前战斗' }).click({ force: true });
      await page.getByText('确认重开当前战斗？').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'reward',
    fixtureName: 'Reward Flow Smoke',
    waitFor: 'text=选取一张记忆印痕',
  },
  {
    name: 'map-from-reward',
    fixtureName: 'Reward Flow Smoke',
    waitFor: 'button[data-node-id]',
    afterOpen: async (page) => {
      await page.getByText('保持当前构筑').click({ force: true });
      await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'combat',
    fixtureName: 'Boss Phase Flow',
    waitFor: 'text=结束周期',
    afterOpen: async (page) => {
      await page.getByText('结束周期').first().waitFor({ timeout: 10_000 });
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const dismissGuide = buttons.find((button) => button.textContent?.includes('知道了')) as HTMLButtonElement | undefined;
        dismissGuide?.click();
      });
      await page.locator('[data-testid="combat-guide-panel"]').waitFor({ state: 'detached', timeout: 3_000 }).catch(() => undefined);
    },
  },
  {
    name: 'combat-deck-modal',
    fixtureName: 'Readable Boss Phase Flow',
    waitFor: 'text=记忆印痕库',
    auditRoot: '[data-keyboard-modal="true"]',
    afterOpen: async (page) => {
      await page.locator('.combat-hud__deckBtn').first().click({ force: true });
      await page.getByText('记忆印痕库').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'combat-draw-pile-modal',
    fixtureName: 'Readable Boss Phase Flow',
    waitFor: '[data-keyboard-modal="true"]',
    auditRoot: '[data-keyboard-modal="true"]',
    afterOpen: async (page) => {
      await page.locator('.grimdark-pile-btn--draw').first().click({ force: true });
      await page.getByRole('heading', { name: /战术缓存/ }).waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'combat-discard-pile-modal',
    fixtureName: 'Readable Boss Phase Flow',
    waitFor: '[data-keyboard-modal="true"]',
    auditRoot: '[data-keyboard-modal="true"]',
    afterOpen: async (page) => {
      await page.locator('.grimdark-pile-btn--discard').first().click({ force: true });
      await page.getByRole('heading', { name: /已执行指令/ }).waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'event',
    fixtureName: 'Event Flow Smoke',
    waitFor: 'text=无名神龛',
  },
  {
    name: 'rest',
    fixtureName: 'Rest Flow Smoke',
    waitFor: 'text=篝火据点',
  },
  {
    name: 'upgrade',
    fixtureName: 'Rest Flow Smoke',
    waitFor: 'text=选择一张记忆印痕进行强化',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: /锻造/ }).click({ force: true });
      await page.getByText('选择一张记忆印痕进行强化').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'rest-enchant',
    fixtureName: 'Rest Flow Smoke',
    waitFor: 'text=营火刻印',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: /刻写附魔/ }).click({ force: true });
      await page.getByText('营火刻印').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'remove-card',
    fixtureName: 'Remove Card Flow Smoke',
    waitFor: 'text=焚毁记忆印痕',
    afterOpen: async (page) => {
      await page.getByRole('button', { name: /移除卡牌|焚毁/ }).click({ force: true });
      await page.getByText('焚毁记忆印痕').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'shop',
    fixtureName: 'Shop Flow Smoke',
    waitFor: 'text=黑市拾荒者',
  },
  {
    name: 'shop-enchant',
    fixtureName: 'Shop Flow Smoke',
    waitFor: 'text=黑市附魔',
    afterOpen: async (page) => {
      const enchantButton = page.getByText('附魔服务').locator('xpath=ancestor::button[1]').first();
      await enchantButton.scrollIntoViewIfNeeded();
      await enchantButton.click({ force: true });
      await page.getByText('黑市附魔').waitFor({ timeout: 10_000 });
    },
  },
  {
    name: 'victory',
    fixtureName: 'Terminal Flow Victory',
    waitFor: 'text=行动归档',
  },
  {
    name: 'game-over',
    fixtureName: 'Terminal Flow GameOver',
    waitFor: 'text=执行失败 (MIA/KIA)',
  },
];

async function ensureCharacterMetaPanelOpen(page: Page, entryText: string | RegExp) {
  const entry = page.locator('button.campaign-action').filter({ hasText: entryText }).first();
  if (await entry.isVisible().catch(() => false)) {
    return;
  }
  await page.getByRole('button', { name: /展开场外面板|收起场外面板/ }).first().click({ force: true });
  await entry.waitFor({ timeout: 10_000 });
}

const auditProfiles: AuditProfile[] = [
  {
    name: 'baseline',
    surfaceNames: surfaces.map((surface) => surface.name),
    viewportNames: viewports.map((viewport) => viewport.name),
  },
  {
    name: 'text-zoom-200',
    surfaceNames: [
      'launcher',
      'system-menu-root',
      'system-menu-restart-confirm',
      'system-menu-quick-load-error',
      'character-codex-import-tools',
      'character-codex-import-error',
      'launcher-save-slots',
      'launcher-corrupt-save-error',
      'launcher-delete-save-error',
      'reward',
      'map-from-reward',
      'combat',
      'combat-deck-modal',
      'combat-draw-pile-modal',
      'screen-loading-fallback',
      'error-boundary-fallback',
      'shop',
      'game-over',
    ],
    viewportNames: ['mobile-320x640', 'mobile-390x844', 'tablet-768x1024'],
    rootFontPercent: 200,
  },
  {
    name: 'light-theme',
    surfaceNames: [
      'launcher',
      'character-select',
      'character-codex-import-tools',
      'character-codex-import-error',
      'system-menu-theme',
      'system-menu-quick-load-error',
      'launcher-save-slots',
      'launcher-corrupt-save-error',
      'launcher-delete-save-error',
      'map-from-reward',
      'combat',
      'reward',
      'shop',
      'screen-loading-fallback',
      'error-boundary-fallback',
    ],
    viewportNames: ['mobile-390x844', 'desktop-1440x960'],
    colorScheme: 'light',
  },
  {
    name: 'extreme-aspect',
    surfaceNames: [
      'launcher',
      'character-select',
      'system-menu-root',
      'system-menu-quick-load-error',
      'character-codex-overlay',
      'character-codex-import-tools',
      'character-codex-import-error',
      'launcher-save-slots',
      'launcher-corrupt-save-error',
      'launcher-delete-save-error',
      'map-from-reward',
      'combat',
      'combat-deck-modal',
      'combat-draw-pile-modal',
      'reward',
      'shop',
      'screen-loading-fallback',
      'error-boundary-fallback',
    ],
    viewportNames: [
      'mobile-landscape-640x320',
      'mobile-landscape-844x390',
      'desktop-short-1024x576',
      'desktop-ultrawide-2560x1080',
    ],
  },
];

function getSurfaceFixtures(surface: SurfaceSpec) {
  if (surface.fixtures) {
    return surface.fixtures();
  }

  switch (surface.fixtureName) {
    case 'Readable Boss Phase Flow':
      return [createReadableBossPhaseFixture()];
    case 'Restartable Boss Phase Flow':
      return [createRestartableBossPhaseFixture()];
    case 'Boss Phase Flow':
      return [createBossPhaseFixture()];
    case 'Event Flow Smoke':
      return [createEventFixture()];
    case 'Rest Flow Smoke':
      return [createRestFixture()];
    case 'Remove Card Flow Smoke':
      return [createRemoveCardFixture()];
    case 'Reward Flow Smoke':
      return [createRewardFixture()];
    case 'Shop Flow Smoke':
      return [createShopFixture()];
    case 'Terminal Flow Victory':
      return [createVictoryFixture()];
    case 'Terminal Flow GameOver':
      return [createGameOverFixture()];
    default:
      return [];
  }
}

const fixtureCardIds = ['strike', 'defend', 'gather_intel', 'precision_strike', 'bash', 'quick_slash'];
const fixtureCards = fixtureCardIds.map((id, index) => {
  const card = cardsData.find((entry) => entry.id === id);
  if (!card) {
    throw new Error(`responsive readability fixture missing card ${id}`);
  }
  return createRunCardInstance(card, `readability_card_${index}_${id}`);
});

function cloneCardList(prefix: string, cards = fixtureCards) {
  return cards.map((card, index) => ({
    ...JSON.parse(JSON.stringify(card)),
    instanceId: `${prefix}_${index}_${card.id}`,
  }));
}

function createReadableBossPhaseFixture(): SaveSlotFixture {
  const fixture = createBossPhaseFixture();
  const saveData = fixture.saveData as { state?: any };
  const state = saveData.state;
  const combat = state?.combat;
  if (!state || !combat) {
    throw new Error('responsive readability fixture could not create combat state');
  }
  state.player.deck = cloneCardList('readability_deck');
  combat.drawPile = cloneCardList('readability_draw', fixtureCards.slice(0, 4));
  combat.discardPile = cloneCardList('readability_discard', fixtureCards.slice(2));
  combat.hand = cloneCardList('readability_hand', fixtureCards.slice(0, 3));
  fixture.slotId = 'readable_boss_phase_flow';
  fixture.slot.id = fixture.slotId;
  fixture.slot.name = 'Readable Boss Phase Flow';
  return fixture;
}

function createCorruptQuickSaveFixture(): SaveSlotFixture {
  const fixture = createBossPhaseFixture();
  fixture.slotId = 'quicksave';
  fixture.slot.id = fixture.slotId;
  fixture.slot.name = 'Broken Quick Save';
  return fixture;
}

function createRestartableBossPhaseFixture(): SaveSlotFixture {
  const fixture = createReadableBossPhaseFixture();
  const saveData = fixture.saveData as { state?: any };
  const state = saveData.state;
  if (!state?.combat) {
    throw new Error('responsive readability fixture could not create restartable combat state');
  }
  state.combatRestartCheckpoint = {
    nodeId: state.currentNodeId ?? 'boss_phase_node',
    nodeType: 'Boss',
    rngState: state.rngState ?? 0,
    pendingNodeResolution: true,
    stateSnapshot: {
      ...JSON.parse(JSON.stringify(state)),
      screen: 'Map',
      combat: null,
      combatRestartCheckpoint: undefined,
      pendingNodeResolution: true,
    },
  };
  fixture.slotId = 'restartable_boss_phase_flow';
  fixture.slot.id = fixture.slotId;
  fixture.slot.name = 'Restartable Boss Phase Flow';
  return fixture;
}

async function renderSyntheticSurface(page: Page, surface: SurfaceSpec) {
  if (surface.synthetic === 'screen-loading-fallback') {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <main class="screen-loading-fallback" role="status" aria-live="polite">
          <div class="screen-loading-fallback__panel">
            <span class="screen-loading-fallback__spinner" aria-hidden="true"></span>
            <span class="screen-loading-fallback__label">正在加载 战斗...</span>
          </div>
        </main>
      `;
    });
    return;
  }

  if (surface.synthetic === 'error-boundary-fallback') {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <main class="deckrogue-error-boundary" role="alert">
          <div class="deckrogue-error-boundary__panel">
            <h2 class="deckrogue-error-boundary__title">界面渲染异常</h2>
            <p class="deckrogue-error-boundary__message">发生了未预期的界面错误，请重试或返回首页。</p>
            <div class="deckrogue-error-boundary__actions">
              <button class="deckrogue-error-boundary__action" type="button">重试</button>
              <button class="deckrogue-error-boundary__action deckrogue-error-boundary__action--secondary" type="button">返回首页</button>
            </div>
          </div>
        </main>
      `;
    });
  }
}

async function openSurface(context: BrowserContext, baseUrl: string, surface: SurfaceSpec, profile: AuditProfile): Promise<Page> {
  await bootstrapContext(context, getSurfaceFixtures(surface));
  if (surface.afterBootstrap) {
    await surface.afterBootstrap(context);
  }
  await context.addInitScript((profileOptions) => {
    const options = profileOptions as { colorScheme?: 'dark' | 'light' };
    if (options.colorScheme) {
      localStorage.setItem('deckrogue_theme_mode', options.colorScheme);
    }
  }, { colorScheme: profile.colorScheme });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  if (profile.rootFontPercent) {
    await page.addStyleTag({
      content: `html { font-size: ${profile.rootFontPercent}% !important; }`,
    });
  }
  if (surface.synthetic) {
    await renderSyntheticSurface(page, surface);
  }
  if (surface.fixtureName) {
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, surface.fixtureName);
  }
  if (surface.afterOpen) {
    await surface.afterOpen(page);
  }
  if (typeof surface.waitFor === 'string') {
    await page.locator(surface.waitFor).first().waitFor({ timeout: 10_000 });
  } else {
    await page.getByText(surface.waitFor).first().waitFor({ timeout: 10_000 });
  }
  return page;
}

async function auditSurface(page: Page, surface: SurfaceSpec, viewport: string, profile: string): Promise<Omit<SurfaceAudit, 'surface' | 'viewport' | 'profile' | 'screenshot'> & { issues: ReadabilityIssue[] }> {
  const auditScript = `
    (() => {
    const surface = ${JSON.stringify(surface.name)};
    const viewport = ${JSON.stringify(viewport)};
    const profile = ${JSON.stringify(profile)};
    const auditRootSelector = ${JSON.stringify(surface.auditRoot ?? null)};
    const issues = [];
    const doc = document.documentElement;
    const viewportWidth = window.innerWidth;
    const documentWidth = doc.scrollWidth;
    const horizontalOverflow = documentWidth > viewportWidth + 2;
    const viewportHeight = window.innerHeight;
    const documentHeight = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
    const verticalScrollAvailable = documentHeight <= viewportHeight + 2 || window.getComputedStyle(document.body).overflowY !== 'hidden' || window.getComputedStyle(doc).overflowY !== 'hidden';
    if (horizontalOverflow) {
      issues.push({
        surface,
        viewport,
        profile,
        kind: 'horizontal-overflow',
        selector: 'document',
        detail: 'documentWidth=' + documentWidth + ', viewportWidth=' + viewportWidth,
      });
    }
    if (!verticalScrollAvailable) {
      issues.push({
        surface,
        viewport,
        profile,
        kind: 'vertical-lock',
        selector: 'document',
        detail: 'documentHeight=' + documentHeight + ', viewportHeight=' + viewportHeight + ', bodyOverflowY=' + window.getComputedStyle(document.body).overflowY,
      });
    }

    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const isPointInsideVisibleAncestors = (element, x, y) => {
      let current = element.parentElement;
      while (current && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        const clips = /(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY);
        if (clips) {
          const rect = current.getBoundingClientRect();
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            return false;
          }
        }
        current = current.parentElement;
      }
      return true;
    };
    const auditRoot = auditRootSelector ? document.querySelector(auditRootSelector) : document;
    const queryAudit = (selector) => auditRoot ? auditRoot.querySelectorAll(selector) : [];

    const smallTextSelectors = [
      '.campaign-shell',
      '.campaign-action',
      '.campaign-copy',
      '.campaign-kicker',
      '.campaign-choice',
      '.combat-guide-panel',
      '.grimdark-map-hud',
      '.grimdark-resource-card',
      '.grimdark-node-card',
      '.combat-hud',
      '.combat-hud__bandLabel',
      '.combat-hud__turnLabel',
      '.grimdark-relic-descriptions',
      '.grimdark-pile-btn',
      '.grimdark-end-turn-btn',
      '.grimdark-turn',
      '.grimdark-intent',
      '.grimdark-enemy-intent',
      '.grimdark-player-hud',
      '.grimdark-enemy-hud',
      '.grimdark-action-hand',
      '.event-npc-stage',
      '.app-menu-panel',
      '.codex-overlay',
      '.achievement-overlay',
      '.tutorial-overlay',
      '.codex-overlay input',
      '.codex-overlay select',
      '.codex-overlay textarea',
      '.deckrogue-error-boundary',
      '.screen-loading-fallback',
    ];

    let smallTextCount = 0;
    for (const element of Array.from(queryAudit(smallTextSelectors.join(',')))) {
      if (!isVisible(element)) continue;
      const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
      if (fontSize > 0 && fontSize < 10) {
        smallTextCount += 1;
        if (issues.length < 80) {
          issues.push({
            surface,
            viewport,
            profile,
            kind: 'small-text',
            selector: element.className ? '.' + String(element.className).split(/\\s+/).slice(0, 3).join('.') : element.tagName.toLowerCase(),
            detail: 'fontSize=' + fontSize + 'px text=' + (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
          });
        }
      }
    }

    let smallTapTargetCount = 0;
    for (const element of Array.from(queryAudit('button, [role="button"], [data-keyboard-focus="true"], input, select, textarea'))) {
      if (!isVisible(element)) continue;
      if (element.disabled || element.getAttribute('aria-disabled') === 'true') continue;
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.right < 0 || rect.top > viewportHeight || rect.left > viewportWidth) continue;
      const isTinyIcon = rect.width <= 34 && rect.height <= 34 && (element.textContent || '').trim().length <= 2;
      const minTarget = viewportWidth < 768 ? 40 : 32;
      if (!isTinyIcon && (rect.width < minTarget || rect.height < minTarget)) {
        smallTapTargetCount += 1;
        if (issues.length < 100) {
          issues.push({
            surface,
            viewport,
            profile,
            kind: 'tap-target-small',
            selector: element.className ? '.' + String(element.className).split(/\\s+/).slice(0, 3).join('.') : element.tagName.toLowerCase(),
            detail: 'target=' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ' text=' + (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
          });
        }
      }
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      if (centerX >= 0 && centerY >= 0 && centerX <= viewportWidth && centerY <= viewportHeight) {
        if (!isPointInsideVisibleAncestors(element, centerX, centerY)) continue;
        const hit = document.elementFromPoint(centerX, centerY);
        const hitButton = hit?.closest ? hit.closest('button, [role="button"], [data-keyboard-focus="true"]') : null;
        if (hit && hit !== element && !element.contains(hit) && hitButton !== element) {
          issues.push({
            surface,
            viewport,
            profile,
            kind: 'tap-target-occluded',
            selector: element.className ? '.' + String(element.className).split(/\\s+/).slice(0, 3).join('.') : element.tagName.toLowerCase(),
            detail: 'centerHit=' + (hit.className ? '.' + String(hit.className).split(/\\s+/).slice(0, 3).join('.') : hit.tagName.toLowerCase()) + ' text=' + (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
          });
        }
      }
    }

    const cardTextFonts = [];
    const cardTitleFonts = [];
    for (const card of Array.from(queryAudit('.immersive-card'))) {
      if (!isVisible(card)) continue;
      const text = card.querySelector('.immersive-card__text');
      const title = card.querySelector('.immersive-card__titleZh');
      if (text && isVisible(text)) {
        const fontSize = Number.parseFloat(window.getComputedStyle(text).fontSize);
        cardTextFonts.push(fontSize);
        if (fontSize < 9.5) {
          issues.push({
            surface,
            viewport,
            profile,
            kind: 'card-text-small',
            selector: '.immersive-card__text',
            detail: 'fontSize=' + fontSize + 'px text=' + (text.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
          });
        }
      }
      if (title && isVisible(title)) {
        const fontSize = Number.parseFloat(window.getComputedStyle(title).fontSize);
        cardTitleFonts.push(fontSize);
        if (fontSize < 10) {
          issues.push({
            surface,
            viewport,
            profile,
            kind: 'card-title-small',
            selector: '.immersive-card__titleZh',
            detail: 'fontSize=' + fontSize + 'px text=' + (title.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
          });
        }
      }
    }

    return {
      documentWidth,
      viewportWidth,
      horizontalOverflow,
      verticalScrollAvailable,
      cardCount: queryAudit('.immersive-card').length,
      minCardTextFontPx: cardTextFonts.length ? Math.min(...cardTextFonts) : null,
      minCardTitleFontPx: cardTitleFonts.length ? Math.min(...cardTitleFonts) : null,
      smallTextCount,
      smallTapTargetCount,
      issues,
    };
    })()
  `;
  return page.evaluate(auditScript);
}

function parseNameFilter(value: string | undefined): Set<string> | null {
  if (!value?.trim()) return null;
  return new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean));
}

function writeReport(
  reportPath: string,
  baseUrl: string,
  selectedProfiles: AuditProfile[],
  selectedViewports: ViewportSpec[],
  selectedSurfaces: SurfaceSpec[],
  audits: SurfaceAudit[],
  issues: ReadabilityIssue[]
) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewportCount: selectedViewports.length,
    surfaceCount: selectedSurfaces.length,
    profileCount: selectedProfiles.length,
    profiles: selectedProfiles.map((profile) => ({
      name: profile.name,
      surfaceCount: profile.surfaceNames.length,
      viewportCount: profile.viewportNames.length,
      rootFontPercent: profile.rootFontPercent ?? 100,
      colorScheme: profile.colorScheme ?? 'default',
    })),
    overallStatus: issues.length === 0 ? 'pass' : 'fail',
    audits,
    issues,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'ui-responsive-readability');
  const reportPath = path.join(process.cwd(), 'reports', 'ui', 'responsive-readability.json');
  ensureDir(outputDir);
  ensureDir(path.dirname(reportPath));

  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const audits: SurfaceAudit[] = [];
  const issues: ReadabilityIssue[] = [];

  const viewportByName = new Map(viewports.map((viewport) => [viewport.name, viewport]));
  const surfaceByName = new Map(surfaces.map((surface) => [surface.name, surface]));
  const profileFilter = parseNameFilter(process.env.RESPONSIVE_READABILITY_PROFILES);
  const viewportFilter = parseNameFilter(process.env.RESPONSIVE_READABILITY_VIEWPORTS);
  const surfaceFilter = parseNameFilter(process.env.RESPONSIVE_READABILITY_SURFACES);
  const selectedProfiles = auditProfiles
    .filter((profile) => !profileFilter || profileFilter.has(profile.name))
    .map((profile) => ({
      ...profile,
      viewportNames: profile.viewportNames.filter((name) => !viewportFilter || viewportFilter.has(name)),
      surfaceNames: profile.surfaceNames.filter((name) => !surfaceFilter || surfaceFilter.has(name)),
    }))
    .filter((profile) => profile.viewportNames.length > 0 && profile.surfaceNames.length > 0);
  const selectedViewportNames = new Set(selectedProfiles.flatMap((profile) => profile.viewportNames));
  const selectedSurfaceNames = new Set(selectedProfiles.flatMap((profile) => profile.surfaceNames));
  const selectedViewports = viewports.filter((viewport) => selectedViewportNames.has(viewport.name));
  const selectedSurfaces = surfaces.filter((surface) => selectedSurfaceNames.has(surface.name));

  if (selectedProfiles.length === 0) {
    throw new Error('responsive readability selected no audit profiles; check filter environment variables');
  }

  try {
    for (const profile of selectedProfiles) {
      for (const viewportName of profile.viewportNames) {
        const viewport = viewportByName.get(viewportName);
        if (!viewport) {
          throw new Error(`responsive readability profile ${profile.name} references unknown viewport ${viewportName}`);
        }
        for (const surfaceName of profile.surfaceNames) {
          const surface = surfaceByName.get(surfaceName);
          if (!surface) {
            throw new Error(`responsive readability profile ${profile.name} references unknown surface ${surfaceName}`);
          }
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        });
        const page = await openSurface(context, baseUrl, surface, profile);
        const screenshot = path.join(outputDir, `${profile.name}-${viewport.name}-${surface.name}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        const result = await auditSurface(page, surface, viewport.name, profile.name);
        audits.push({
          surface: surface.name,
          viewport: viewport.name,
          profile: profile.name,
          screenshot,
          documentWidth: result.documentWidth,
          viewportWidth: result.viewportWidth,
          horizontalOverflow: result.horizontalOverflow,
          cardCount: result.cardCount,
          minCardTextFontPx: result.minCardTextFontPx,
          minCardTitleFontPx: result.minCardTitleFontPx,
          smallTextCount: result.smallTextCount,
          smallTapTargetCount: result.smallTapTargetCount,
        });
        issues.push(...result.issues);
        writeReport(reportPath, baseUrl, selectedProfiles, selectedViewports, selectedSurfaces, audits, issues);
        await context.close();
      }
    }
    }
  } finally {
    await browser.close();
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }

  writeReport(reportPath, baseUrl, selectedProfiles, selectedViewports, selectedSurfaces, audits, issues);

  if (issues.length > 0) {
    throw new Error(`responsive readability audit failed with ${issues.length} issue(s); see ${reportPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
