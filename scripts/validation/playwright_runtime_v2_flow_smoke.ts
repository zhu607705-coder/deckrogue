import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { GameEngine } from '@/core/events/gameEngine';

type RouteTarget = 'Event' | 'Rest' | 'Shop' | 'Combat';

interface RouteNode {
  nodeId: string;
  type: RouteTarget;
}

interface CoverageRoute {
  seed: number;
  path: RouteNode[];
}

interface RuntimeV2FlowSmokeReport {
  baseUrl: string;
  route: CoverageRoute;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  checks: Array<{ label: string; status: 'passed' | 'failed'; detail: string }>;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://127.0.0.1:3000',
    headed: false,
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg === '--headed') options.headed = true;
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

function findCoverageRoute(maxSeed = 400): CoverageRoute {
  const targets = new Set<RouteTarget>(['Event', 'Rest', 'Combat']);
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
        const nextSeen = new Set(seen);
        const nextPath = [...path];
        if (normalizedType) {
          nextSeen.add(normalizedType);
          nextPath.push({ nodeId, type: normalizedType });
        }

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

  throw new Error(`Could not find a coverage route for Event/Rest/Combat within ${maxSeed} seeds.`);
}

async function waitForMap(page: Page) {
  await page.locator('.runtime-v2-app-shell[data-screen="Map"]').waitFor({ timeout: 30_000 });
}

async function waitForMapNode(page: Page, nodeId: string) {
  await page
    .locator(`.runtime-v2-app-shell[data-screen="Map"][data-current-node-id="${nodeId}"]`)
    .waitFor({ timeout: 30_000 });
}

async function getAvailableNodeIds(page: Page): Promise<string[]> {
  return page.locator('.runtime-v2-app-shell[data-screen="Map"] button.map-node.available').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-node-id') || '')
      .filter((value) => value.length > 0)
      .sort()
  );
}

async function main() {
  const options = parseArgs();
  const route = findCoverageRoute();
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'runtime_v2_flow');
  mkdirSync(outputDir, { recursive: true });

  const report: RuntimeV2FlowSmokeReport = {
    baseUrl: options.url,
    route,
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
    const url = appendQuery(options.url, `runtimeV2=1&adapter=python-wasm&renderer=dom&seed=${route.seed}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByText('Launch Runtime V2').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /开始新局|Start New Run/ }).click();
    await page.locator('[data-screen="CharacterSelect"]').waitFor({ timeout: 30_000 });
    await page.locator('button[data-character-id="informant"]').click();
    await waitForMap(page);
    report.checks.push({ label: 'launcher_to_map', status: 'passed', detail: `Reached map on seed ${route.seed}.` });

    for (const step of route.path) {
      await waitForMap(page);
      await page.locator(`button[data-node-id="${step.nodeId}"]`).click();
      if (step.type === 'Event') {
        await page.locator('[data-screen="Event"] [data-scene="event"]').waitFor({ timeout: 30_000 });
        report.checks.push({ label: `event_${step.nodeId}`, status: 'passed', detail: `Visited event node ${step.nodeId}.` });
        await page.locator('button[data-choice-id]').first().click();
        await waitForMap(page);
      } else if (step.type === 'Rest') {
        await page.locator('[data-screen="Rest"] [data-scene="rest"]').waitFor({ timeout: 30_000 });
        report.checks.push({ label: `rest_${step.nodeId}`, status: 'passed', detail: `Visited rest node ${step.nodeId}.` });
        const restAction = page.locator('button[data-action="rest"]');
        if (await restAction.count()) {
          await restAction.first().click();
        }
        await page.getByRole('button', { name: /继续前进|Continue/ }).click();
        await waitForMap(page);
      } else if (step.type === 'Shop') {
        await page.locator('[data-screen="Shop"] [data-scene="shop"]').waitFor({ timeout: 30_000 });
        report.checks.push({ label: `shop_${step.nodeId}`, status: 'passed', detail: `Visited shop node ${step.nodeId}.` });
        await page.getByRole('button', { name: 'Leave Shop' }).click();
        await waitForMap(page);
      } else if (step.type === 'Combat') {
        await page.locator('[data-screen="Combat"] [data-scene="combat"]').waitFor({ timeout: 30_000 });
        report.checks.push({ label: `combat_${step.nodeId}`, status: 'passed', detail: `Visited combat node ${step.nodeId}.` });
        await page.getByRole('button', { name: 'End Combat' }).click();
        await page.locator('[data-screen="Reward"] [data-scene="reward"]').waitFor({ timeout: 30_000 });
        report.checks.push({ label: `reward_${step.nodeId}`, status: 'passed', detail: `Reached reward after combat node ${step.nodeId}.` });
        await page.locator('button[data-card-id]').first().click();
        await waitForMap(page);
      }
    }

    const savedNodeId = await page.locator('.runtime-v2-app-shell').getAttribute('data-current-node-id');
    const savedAvailableNodeIds = await getAvailableNodeIds(page);
    await page.locator('.save-run-btn').click();
    report.checks.push({
      label: 'save_run',
      status: 'passed',
      detail: `Saved runtime-v2 run at node ${savedNodeId ?? 'unknown'} with available nodes [${savedAvailableNodeIds.join(', ')}].`,
    });
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
    report.checks.push({
      label: 'load_saved_run',
      status: 'passed',
      detail: `Loaded saved run back to node ${loadedNodeId} with matching available nodes [${loadedAvailableNodeIds.join(', ')}].`,
    });
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
    report.checks.push({
      label: 'replay_last_run',
      status: 'passed',
      detail: `Replayed run back to node ${replayedNodeId} with matching available nodes [${replayedAvailableNodeIds.join(', ')}].`,
    });
    await page.screenshot({ path: path.join(outputDir, 'replayed_map.png'), fullPage: true });
  } finally {
    writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }

  if (report.consoleErrors.length || report.pageErrors.length || report.failedRequests.length) {
    throw new Error(
      `runtime-v2 flow smoke failed: console=${report.consoleErrors.length}, page=${report.pageErrors.length}, requests=${report.failedRequests.length}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
