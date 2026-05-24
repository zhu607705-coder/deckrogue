#!/usr/bin/env node
/**
 * @file dist_win.ts
 * @description Build a Windows Electron installer from the production renderer.
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Arch, build, Platform } from 'electron-builder';

const REPORT_DIR = path.join(process.cwd(), 'reports', 'desktop');
const REPORT_PATH = path.join(REPORT_DIR, 'win-dist.json');
const RELEASE_DIR = path.join(process.cwd(), 'release', 'win');
const STAGING_DIR = path.join(process.cwd(), '.desktop-build', 'win-app');
const SKIP_BUILD = process.argv.includes('--skip-build');

interface WinDistArtifact {
  path: string;
  sizeBytes: number;
  updatedAt: string;
}

interface WinDistReport {
  timestamp: string;
  overallStatus: 'pass' | 'fail';
  releaseDir: string;
  stagingDir: string;
  artifacts: WinDistArtifact[];
  evidence: string[];
}

function writeReport(report: WinDistReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function assertWorkspaceChild(targetPath: string): string {
  const workspaceRoot = path.resolve(process.cwd());
  const resolvedTarget = path.resolve(targetPath);
  const insideWorkspace =
    resolvedTarget === workspaceRoot || resolvedTarget.startsWith(`${workspaceRoot}${path.sep}`);
  if (!insideWorkspace) {
    throw new Error(`Refusing to remove path outside workspace: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

function cleanDir(targetPath: string): void {
  const resolved = assertWorkspaceChild(targetPath);
  if (existsSync(resolved)) {
    rmSync(resolved, { recursive: true, force: true });
  }
  mkdirSync(resolved, { recursive: true });
}

function prepareStagingApp(): void {
  cleanDir(STAGING_DIR);
  cpSync(path.join(process.cwd(), 'dist'), path.join(STAGING_DIR, 'dist'), { recursive: true });
  cpSync(path.join(process.cwd(), 'electron'), path.join(STAGING_DIR, 'electron'), { recursive: true });

  const rootPackage = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
  };
  const desktopPackage = {
    name: rootPackage.name ?? 'deckrogue',
    productName: 'DeckRogue',
    version: rootPackage.version ?? '0.0.0',
    description: rootPackage.description ?? 'DeckRogue desktop build',
    author: rootPackage.author ?? 'DeckRogue',
    type: 'module',
    main: 'electron/main.mjs',
    dependencies: {},
  };
  writeFileSync(path.join(STAGING_DIR, 'package.json'), JSON.stringify(desktopPackage, null, 2));
}

function getInstalledElectronVersion(): string {
  const electronPackagePath = path.join(process.cwd(), 'node_modules', 'electron', 'package.json');
  const electronPackage = JSON.parse(readFileSync(electronPackagePath, 'utf8')) as { version?: string };
  if (!electronPackage.version) {
    throw new Error(`Unable to read installed Electron version from ${electronPackagePath}`);
  }
  return electronPackage.version;
}

function collectArtifacts(): WinDistArtifact[] {
  if (!existsSync(RELEASE_DIR)) return [];
  return readdirSync(RELEASE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const artifactPath = path.join(RELEASE_DIR, entry.name);
      const stats = statSync(artifactPath);
      return {
        path: artifactPath,
        sizeBytes: stats.size,
        updatedAt: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function main(): Promise<void> {
  const evidence: string[] = [];
  try {
    cleanDir(RELEASE_DIR);
    evidence.push('release directory cleaned');

    if (SKIP_BUILD) {
      evidence.push('desktop build reused from current workspace artifacts');
    } else {
      execSync('npm run build:desktop --silent', {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      evidence.push('desktop renderer and Electron entries verified');
    }

    if (!existsSync(path.join(process.cwd(), 'dist', 'index.html'))) {
      throw new Error('dist/index.html missing; run build:desktop before dist:win -- --skip-build');
    }
    prepareStagingApp();
    evidence.push('minimal desktop staging app prepared without production node_modules');

    await build({
      projectDir: STAGING_DIR,
      targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
      config: {
        appId: 'com.deckrogue.desktop',
        productName: 'DeckRogue',
        electronVersion: getInstalledElectronVersion(),
        directories: {
          output: RELEASE_DIR,
        },
        files: [
          'dist/**/*',
          'electron/**/*',
          'package.json',
        ],
        extraMetadata: {
          main: 'electron/main.mjs',
        },
        asar: true,
        compression: 'normal',
        npmRebuild: false,
        buildDependenciesFromSource: false,
        win: {
          artifactName: 'DeckRogue-${version}-${arch}.${ext}',
          signAndEditExecutable: false,
        },
        nsis: {
          oneClick: false,
          perMachine: false,
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
        },
      },
      publish: 'never',
    });

    const artifacts = collectArtifacts();
    const exeArtifacts = artifacts.filter((artifact) => artifact.path.toLowerCase().endsWith('.exe'));
    if (exeArtifacts.length === 0) {
      throw new Error('electron-builder completed but no .exe artifact was produced');
    }
    evidence.push(`exe artifacts produced: ${exeArtifacts.length}`);

    writeReport({
      timestamp: new Date().toISOString(),
      overallStatus: 'pass',
      releaseDir: RELEASE_DIR,
      stagingDir: STAGING_DIR,
      artifacts,
      evidence,
    });
  } catch (error) {
    evidence.push(error instanceof Error ? error.message : String(error));
    writeReport({
      timestamp: new Date().toISOString(),
      overallStatus: 'fail',
      releaseDir: RELEASE_DIR,
      stagingDir: STAGING_DIR,
      artifacts: collectArtifacts(),
      evidence,
    });
    throw error;
  }
}

main().catch((error) => {
  console.error('[dist:win] failed:', error);
  process.exit(1);
});
