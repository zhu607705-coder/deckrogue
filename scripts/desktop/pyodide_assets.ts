import { cpSync, existsSync, mkdirSync, rmSync, statSync, utimesSync } from 'node:fs';
import path from 'node:path';

export const REQUIRED_PYODIDE_ASSET_FILES = [
  'pyodide.js',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
] as const;

export interface PyodideAssetFile {
  fileName: string;
  path: string;
  sizeBytes: number;
}

export interface PyodideAssetReport {
  sourceDir: string;
  targetDir: string;
  files: PyodideAssetFile[];
}

interface CopyPyodideAssetsOptions {
  workspaceRoot?: string;
  sourceDir?: string;
  targetDir?: string;
}

function assertWorkspaceChild(workspaceRoot: string, targetPath: string): string {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(targetPath);
  const insideWorkspace =
    resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
  if (!insideWorkspace) {
    throw new Error(`Refusing to write Pyodide assets outside workspace: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

export function copyPyodideAssets(options: CopyPyodideAssetsOptions = {}): PyodideAssetReport {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const sourceDir = path.resolve(options.sourceDir ?? path.join(workspaceRoot, 'node_modules', 'pyodide'));
  const targetDir = assertWorkspaceChild(
    workspaceRoot,
    options.targetDir ?? path.join(workspaceRoot, 'dist', 'pyodide'),
  );

  if (!existsSync(sourceDir)) {
    throw new Error(`Pyodide package assets missing: ${sourceDir}`);
  }

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  const files: PyodideAssetFile[] = [];
  const stagedAt = new Date();
  for (const fileName of REQUIRED_PYODIDE_ASSET_FILES) {
    const sourcePath = path.join(sourceDir, fileName);
    if (!existsSync(sourcePath)) {
      throw new Error(`Required Pyodide asset missing: ${sourcePath}`);
    }
    const targetPath = path.join(targetDir, fileName);
    cpSync(sourcePath, targetPath);
    utimesSync(targetPath, stagedAt, stagedAt);
    const sizeBytes = statSync(targetPath).size;
    if (sizeBytes <= 0) {
      throw new Error(`Required Pyodide asset is empty: ${targetPath}`);
    }
    files.push({ fileName, path: targetPath, sizeBytes });
  }

  return { sourceDir, targetDir, files };
}
