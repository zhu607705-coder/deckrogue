/**
 * @file uiReadabilityCss.test.ts
 * @description Static readability regressions for responsive card and map UI CSS.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function extractRuleBody(source: string, selector: string): string {
  const selectorIndex = source.indexOf(`${selector} {`);
  assert.ok(selectorIndex >= 0, `${selector} rule missing`);
  const openIndex = source.indexOf('{', selectorIndex);
  assert.ok(openIndex >= 0, `${selector} rule body missing`);

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, index);
      }
    }
  }

  assert.fail(`${selector} rule body did not close`);
}

function remToPx(rem: number): number {
  return rem * 16;
}

function extractFontSizePx(ruleBody: string): number | null {
  const fontSizeMatch = ruleBody.match(/font-size:\s*([0-9.]+)(px|rem)/);
  const shorthandMatch = ruleBody.match(/font:\s*[^;]*?\s([0-9.]+)(px|rem)\//);
  const match = fontSizeMatch ?? shorthandMatch;
  if (!match) return null;
  const value = Number(match[1]);
  if (match[2] === 'rem') return remToPx(value);
  return value;
}

test('compact cards keep readable text sizes', () => {
  const css = readFileSync('src/index.css', 'utf-8');

  const selectors = [
    '.immersive-card--compact .immersive-card__titleZh',
    '.immersive-card--compact .immersive-card__titleEn',
    '.immersive-card--compact .immersive-card__typeBadge',
    '.immersive-card--compact .immersive-card__rarityBadge',
    '.immersive-card--compact .immersive-card__tagline',
    '.immersive-card--compact .immersive-card__text',
  ];

  for (const selector of selectors) {
    const fontSizePx = extractFontSizePx(extractRuleBody(css, selector));
    assert.ok(fontSizePx !== null, `${selector} must declare font-size`);
    assert.ok(fontSizePx >= 8, `${selector} font-size ${fontSizePx}px is below readable floor`);
  }

  assert.doesNotMatch(css, /immersive-card--compact[\s\S]*?font-size:\s*0\.[0-4][0-9]rem/);
});

test('default cards keep readable text sizes', () => {
  const css = readFileSync('src/index.css', 'utf-8');

  const selectors = [
    '.immersive-card__titleZh',
    '.immersive-card__titleEn',
    '.immersive-card__typeBadge',
    '.immersive-card__rarityBadge',
    '.immersive-card__tagline',
    '.immersive-card__text',
  ];

  for (const selector of selectors) {
    const fontSizePx = extractFontSizePx(extractRuleBody(css, selector));
    assert.ok(fontSizePx !== null, `${selector} must declare font-size`);
    assert.ok(fontSizePx >= 8.5, `${selector} font-size ${fontSizePx}px is below readable floor`);
  }
});

test('map node labels keep readable mobile sizes', () => {
  const css = readFileSync('src/ui/theme/grimdark.css', 'utf-8');

  const selectors = [
    '.grimdark-node-card__statusChip',
    '.grimdark-node-card__statusChipSub',
    '.grimdark-node-card__routeMetaTitle',
    '.grimdark-node-card__routeMetaSummary',
    '.grimdark-node-card__routeMetricLabel',
    '.grimdark-node-card__routePreviewLabel',
    '.grimdark-node-card__routePreviewChip',
    '.grimdark-map-screen .grimdark-map-hud__head',
    '.grimdark-map-screen .grimdark-map-hud__subtle',
  ];

  for (const selector of selectors) {
    const fontSizePx = extractFontSizePx(extractRuleBody(css, selector));
    assert.ok(fontSizePx !== null, `${selector} must declare font-size`);
    assert.ok(fontSizePx >= 9, `${selector} font-size ${fontSizePx}px is below readable floor`);
  }

  assert.doesNotMatch(css, /grimdark-map-screen[\s\S]*?font-size:\s*[0-8](?:\.\d+)?px/);
});

test('mobile control buttons keep accessible touch target floors', () => {
  const grimdarkCss = readFileSync('src/ui/theme/grimdark.css', 'utf-8');
  const appCss = readFileSync('src/index.css', 'utf-8');
  const characterSelectSource = readFileSync('src/ui/views/CharacterSelectView.tsx', 'utf-8');
  const mapViewSource = readFileSync('src/ui/views/MapView.tsx', 'utf-8');
  const combatHudSource = readFileSync('src/ui/views/combat/CombatHUD.tsx', 'utf-8');
  const actionHandSource = readFileSync('src/ui/views/combat/ActionHand.tsx', 'utf-8');
  const restViewSource = readFileSync('src/ui/views/RestView.tsx', 'utf-8');
  const setupLauncherSource = readFileSync('src/ui/launcher/SetupLauncher.tsx', 'utf-8');

  const controlButtonRule = extractRuleBody(grimdarkCss, '.grimdark-control-btn');
  assert.match(controlButtonRule, /min-width:\s*40px/);
  assert.match(controlButtonRule, /min-height:\s*40px/);

  const resetButtonRule = extractRuleBody(grimdarkCss, '.map-reset-view-btn');
  assert.match(resetButtonRule, /width:\s*40px/);
  assert.match(resetButtonRule, /height:\s*40px/);
  assert.match(mapViewSource, /map-reset-view-btn/);
  assert.match(grimdarkCss, /@media \(max-width:\s*767px\)[\s\S]*?\.grimdark-map-controls\s*\{[\s\S]*?top:\s*52px !important/);
  assert.match(mapViewSource, /grimdark-map-node-stage/);
  assert.match(mapViewSource, /grimdark-map-node-stack/);
  assert.match(mapViewSource, /grimdark-map-paths/);
  assert.match(grimdarkCss, /@media \(max-width:\s*767px\)[\s\S]*?\.grimdark-map-node-stage\s*\{[\s\S]*?overflow-y:\s*auto !important/);
  assert.match(grimdarkCss, /@media \(max-width:\s*767px\)[\s\S]*?\.grimdark-map-paths\s*\{[\s\S]*?display:\s*none/);
  assert.match(grimdarkCss, /@media \(max-width:\s*767px\)[\s\S]*?\.grimdark-map-node-position\s*\{[\s\S]*?position:\s*static !important/);

  assert.match(characterSelectSource, /className="[^"]*min-h-10[^"]*"/);
  assert.match(characterSelectSource, /展开场外面板/);
  assert.match(combatHudSource, /aria-label=\{`\$\{terms\.game\.deck\.name\}/);
  assert.match(actionHandSource, /aria-label=\{`查看\$\{terms\.game\.drawPile\.name\}/);
  assert.match(actionHandSource, /aria-label=\{`查看\$\{terms\.game\.discardPile\.name\}/);
  assert.match(restViewSource, /className="min-h-10 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 min-w-56"/);
  assert.match(setupLauncherSource, /className="min-h-10 border border-white\/10 bg-white\/5 px-3 py-2 text-sm text-stone-100/);
  assert.match(setupLauncherSource, /className="min-h-10 border border-red-900\/50 bg-red-950\/15 px-3 py-2 text-sm text-red-200/);

  const appMenuButtonRule = extractRuleBody(appCss, '.app-menu-panel button,\n.codex-overlay button,\n.achievement-overlay button,\n.tutorial-overlay button');
  assert.match(appMenuButtonRule, /min-height:\s*40px/);

  assert.match(grimdarkCss, /@media \(max-width:\s*767px\)[\s\S]*?\.combat-hud\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(grimdarkCss, /@media \(max-width:\s*767px\)[\s\S]*?\.combat-hud__deckBtn\s*\{[\s\S]*?width:\s*100%/);
  assert.match(grimdarkCss, /@media \(max-width:\s*767px\)[\s\S]*?\.grimdark-end-turn-container\s*\{[\s\S]*?position:\s*static !important/);
  assert.match(grimdarkCss, /@media \(max-width:\s*767px\)[\s\S]*?\.grimdark-pile-controls\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);

  assert.match(appCss, /\.app-floating-controls\s*\{/);
  assert.match(appCss, /body:has\(\.codex-overlay\) \.app-floating-controls,\nbody:has\(\.achievement-overlay\) \.app-floating-controls,\nbody:has\(\.tutorial-overlay\) \.app-floating-controls\s*\{[\s\S]*?display:\s*none/);
  assert.match(appCss, /@media \(max-width:\s*480px\)[\s\S]*?\.app-floating-controls\s*\{[\s\S]*?top:\s*0\.5rem !important/);
  assert.match(appCss, /@media \(max-width:\s*480px\)[\s\S]*?\.app-topbar-btn\s*\{[\s\S]*?width:\s*40px/);
  assert.match(appCss, /@media \(max-width:\s*480px\)[\s\S]*?\.app-topbar-label\s*\{[\s\S]*?clip:\s*rect\(0 0 0 0\)/);
  assert.match(appCss, /\.codex-overlay,\n\.achievement-overlay\s*\{[\s\S]*?z-index:\s*1200 !important/);
  assert.match(appCss, /\.tutorial-overlay\s*\{[\s\S]*?z-index:\s*1210 !important/);
  assert.match(appCss, /@media \(max-width:\s*1023px\)[\s\S]*?\.codex-overlay__body,\n\s*\.achievement-overlay__body\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(appCss, /@media \(max-width:\s*1023px\)[\s\S]*?\.codex-overlay__entry-list,\n\s*\.achievement-overlay__entry-list\s*\{[\s\S]*?max-height:\s*15rem/);
  assert.match(appCss, /@media \(max-width:\s*480px\)[\s\S]*?\.codex-overlay__body,\n\s*\.achievement-overlay__body\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(appCss, /@media \(max-width:\s*480px\)[\s\S]*?\.codex-overlay__entry-list,\n\s*\.achievement-overlay__entry-list\s*\{[\s\S]*?max-height:\s*13rem/);
  assert.match(appCss, /@media \(max-height:\s*430px\) and \(max-width:\s*900px\)[\s\S]*?\.codex-overlay__body,\n\s*\.achievement-overlay__body\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(appCss, /@media \(max-height:\s*430px\) and \(max-width:\s*900px\)[\s\S]*?\.codex-overlay__entry-list,\n\s*\.achievement-overlay__entry-list\s*\{[\s\S]*?max-height:\s*11rem/);
});

test('error and loading fallbacks keep responsive readable contracts', () => {
  const appCss = readFileSync('src/index.css', 'utf-8');
  const errorBoundarySource = readFileSync('src/ui/components/ErrorBoundary.tsx', 'utf-8');
  const appShellSource = readFileSync('src/ui/views/AppShell.tsx', 'utf-8');
  const mainSource = readFileSync('src/main.tsx', 'utf-8');
  const readabilityScript = readFileSync('scripts/validation/playwright_ui_responsive_readability.ts', 'utf-8');

  assert.match(errorBoundarySource, /className="deckrogue-error-boundary"/);
  assert.match(errorBoundarySource, /role="alert"/);
  assert.match(errorBoundarySource, /deckrogue-error-boundary__action/);
  assert.match(appShellSource, /className="screen-loading-fallback"/);
  assert.match(appShellSource, /role="status"/);
  assert.match(mainSource, /screen-loading-fallback--initializing/);
  assert.match(mainSource, /deckrogue-init-error/);

  const fallbackRootRule = extractRuleBody(appCss, '.screen-loading-fallback,\n.deckrogue-error-boundary');
  assert.match(fallbackRootRule, /min-height:\s*100dvh/);
  assert.match(fallbackRootRule, /overflow-y:\s*auto/);

  const loadingLabelRule = extractRuleBody(appCss, '.screen-loading-fallback__label');
  assert.match(loadingLabelRule, /font-size:\s*clamp\(1rem/);

  const errorTitleRule = extractRuleBody(appCss, '.deckrogue-error-boundary__title');
  assert.match(errorTitleRule, /font-size:\s*clamp\(1\.35rem/);
  assert.match(errorTitleRule, /overflow-wrap:\s*anywhere/);

  const errorMessageRule = extractRuleBody(appCss, '.deckrogue-error-boundary__message');
  assert.match(errorMessageRule, /font-size:\s*clamp\(1rem/);
  assert.match(errorMessageRule, /overflow-wrap:\s*anywhere/);

  const errorActionRule = extractRuleBody(appCss, '.deckrogue-error-boundary__action');
  assert.match(errorActionRule, /min-height:\s*40px/);
  assert.match(errorActionRule, /min-width:\s*40px/);

  assert.match(appCss, /@media \(max-width:\s*480px\)[\s\S]*?\.deckrogue-error-boundary__actions\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(appCss, /@media \(max-width:\s*480px\)[\s\S]*?\.deckrogue-error-boundary__action\s*\{[\s\S]*?width:\s*100%/);
  assert.match(readabilityScript, /name:\s*'screen-loading-fallback'/);
  assert.match(readabilityScript, /name:\s*'error-boundary-fallback'/);
  assert.match(readabilityScript, /synthetic:\s*'screen-loading-fallback'/);
  assert.match(readabilityScript, /synthetic:\s*'error-boundary-fallback'/);
  assert.match(readabilityScript, /'text-zoom-200'[\s\S]*?'screen-loading-fallback'[\s\S]*?'error-boundary-fallback'/);
  assert.match(readabilityScript, /'light-theme'[\s\S]*?'screen-loading-fallback'[\s\S]*?'error-boundary-fallback'/);
});

test('responsive readability gate covers extreme aspect ratio devices', () => {
  const readabilityScript = readFileSync('scripts/validation/playwright_ui_responsive_readability.ts', 'utf-8');

  assert.match(readabilityScript, /mobile-landscape-640x320/);
  assert.match(readabilityScript, /mobile-landscape-844x390/);
  assert.match(readabilityScript, /desktop-short-1024x576/);
  assert.match(readabilityScript, /desktop-ultrawide-2560x1080/);
  assert.match(readabilityScript, /name:\s*'extreme-aspect'/);
  assert.match(readabilityScript, /'extreme-aspect'[\s\S]*?'combat-deck-modal'[\s\S]*?'screen-loading-fallback'[\s\S]*?'error-boundary-fallback'/);
});

test('responsive readability gate covers deep import and save slot states', () => {
  const readabilityScript = readFileSync('scripts/validation/playwright_ui_responsive_readability.ts', 'utf-8');
  const setupLauncherSource = readFileSync('src/ui/launcher/SetupLauncher.tsx', 'utf-8');

  assert.match(readabilityScript, /name:\s*'character-codex-import-tools'/);
  assert.match(readabilityScript, /name:\s*'character-codex-import-error'/);
  assert.match(readabilityScript, /name:\s*'launcher-save-slots'/);
  assert.match(readabilityScript, /name:\s*'launcher-corrupt-save-error'/);
  assert.match(readabilityScript, /name:\s*'launcher-delete-save-error'/);
  assert.match(readabilityScript, /name:\s*'system-menu-quick-load-error'/);
  assert.match(readabilityScript, /createBossPhaseFixture\(\), createCorruptQuickSaveFixture\(\)/);
  assert.match(readabilityScript, /forced-corrupt-quicksave-checksum/);
  assert.match(readabilityScript, /could not find quicksave slot/);
  assert.match(readabilityScript, /data-system-menu-error="true"/);
  assert.match(readabilityScript, /quick load button should be enabled with corrupt quicksave payload/);
  assert.match(readabilityScript, /createReadableBossPhaseFixture\(\), createRewardFixture\(\), createShopFixture\(\)/);
  assert.match(readabilityScript, /getByRole\('button', \{ name:\s*\/导入\\\/同步\//);
  assert.match(readabilityScript, /fill\('\{bad codex json'\)/);
  assert.match(readabilityScript, /forced-corrupt-checksum/);
  assert.match(readabilityScript, /forced delete failure for responsive audit/);
  assert.match(readabilityScript, /deleteFailurePatchActive/);
  assert.match(readabilityScript, /could not install forced delete failure patch/);
  assert.match(readabilityScript, /data-save-slot-action="delete"\]\[data-save-slot-id="readable_boss_phase_flow"/);
  assert.match(readabilityScript, /could not find delete slot button/);
  assert.match(readabilityScript, /document\.body\.textContent\?\.includes\('删除存档失败：readable_boss_phase_flow'\)/);
  assert.match(setupLauncherSource, /role="alert"/);
  assert.match(setupLauncherSource, /data-launcher-error="true"/);
  assert.match(setupLauncherSource, /data-save-slot-action="load"/);
  assert.match(setupLauncherSource, /data-save-slot-action="delete"/);
  assert.match(setupLauncherSource, /data-save-slot-id=\{slot\.id\}/);
  assert.match(setupLauncherSource, /launcher-shell[\s\S]*overflow-x-hidden overflow-y-auto/);
  assert.doesNotMatch(setupLauncherSource, /launcher-shell[\s\S]*overflow-hidden text-white/);
  assert.doesNotMatch(setupLauncherSource, /xl:h-screen xl:overflow-hidden/);
  assert.doesNotMatch(setupLauncherSource, /xl:gap-4 xl:overflow-hidden xl:py-4/);
  assert.match(readabilityScript, /'text-zoom-200'[\s\S]*?'character-codex-import-tools'[\s\S]*?'launcher-save-slots'/);
  assert.match(readabilityScript, /'text-zoom-200'[\s\S]*?'system-menu-quick-load-error'[\s\S]*?'launcher-delete-save-error'/);
  assert.match(readabilityScript, /'light-theme'[\s\S]*?'system-menu-quick-load-error'[\s\S]*?'launcher-save-slots'/);
  assert.match(readabilityScript, /'extreme-aspect'[\s\S]*?'system-menu-quick-load-error'[\s\S]*?'launcher-save-slots'/);
  assert.match(readabilityScript, /queryAudit\('button, \[role="button"\], \[data-keyboard-focus="true"\], input, select, textarea'\)/);
});

test('responsive readability gate covers the relic upgrade screen', () => {
  const readabilityScript = readFileSync('scripts/validation/playwright_ui_responsive_readability.ts', 'utf-8');

  assert.match(readabilityScript, /name:\s*'relic-upgrade'/);
  assert.match(readabilityScript, /createRelicUpgradeFixture\(\)/);
  assert.match(readabilityScript, /getByRole\('button', \{ name:\s*\/遗物升级\//);
  assert.match(readabilityScript, /'text-zoom-200'[\s\S]*?'relic-upgrade'/);
  assert.match(readabilityScript, /'light-theme'[\s\S]*?'relic-upgrade'/);
  assert.match(readabilityScript, /'extreme-aspect'[\s\S]*?'relic-upgrade'/);
});

test('system menu save-load failures remain visible inside responsive menu panel', () => {
  const appShellSource = readFileSync('src/ui/views/AppShell.tsx', 'utf-8');

  assert.match(appShellSource, /const \[systemMenuError, setSystemMenuError\]/);
  assert.match(appShellSource, /setSystemMenuError\('快速读取失败：未找到有效快速存档。'\)/);
  assert.match(appShellSource, /setShowMenu\(true\);\s*setMenuPage\('save'\);/);
  assert.match(appShellSource, /role="alert"/);
  assert.match(appShellSource, /data-system-menu-error="true"/);
  assert.match(appShellSource, /w-\[min\(20rem,calc\(100vw-1rem\)\)\]/);
  assert.match(appShellSource, /max-h-\[calc\(100dvh-4rem\)\] overflow-y-auto/);
  assert.match(appShellSource, /overflowWrap:\s*'anywhere'/);
  assert.doesNotMatch(appShellSource, /setLauncherError\(`快速读取失败/);
  assert.doesNotMatch(appShellSource, /setLauncherError\('快速读取失败/);
});
