/**
 * @file desktopPyodideAssets.test.ts
 * @description Desktop packaging regressions for bundled Pyodide runtime assets.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  REQUIRED_PYODIDE_ASSET_FILES,
  copyPyodideAssets,
} from '../../scripts/desktop/pyodide_assets.ts';

test('desktop Pyodide asset copier stages required runtime files into dist', () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'deckrogue-pyodide-assets-'));
  const pyodideSourceDir = join(workspaceRoot, 'node_modules', 'pyodide');
  const distDir = join(workspaceRoot, 'dist');

  try {
    mkdirSync(pyodideSourceDir, { recursive: true });
    mkdirSync(distDir, { recursive: true });
    for (const fileName of REQUIRED_PYODIDE_ASSET_FILES) {
      writeFileSync(join(pyodideSourceDir, fileName), `fixture:${fileName}`);
    }

    const report = copyPyodideAssets({ workspaceRoot });

    assert.equal(report.files.length, REQUIRED_PYODIDE_ASSET_FILES.length);
    assert.equal(report.targetDir, join(distDir, 'pyodide'));
    for (const fileName of REQUIRED_PYODIDE_ASSET_FILES) {
      assert.equal(existsSync(join(distDir, 'pyodide', fileName)), true, `${fileName} should be copied`);
    }
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
