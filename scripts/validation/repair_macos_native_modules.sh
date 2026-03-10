#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
NODE_MODULES_DIR="$ROOT_DIR/node_modules"

if [[ ! -d "$NODE_MODULES_DIR" ]]; then
  echo "[repair_macos_native_modules] node_modules not found: $NODE_MODULES_DIR" >&2
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[repair_macos_native_modules] skipped: current OS is not macOS"
  exit 0
fi

echo "[repair_macos_native_modules] clearing quarantine and provenance from $NODE_MODULES_DIR"
xattr -dr com.apple.quarantine "$NODE_MODULES_DIR" || true
xattr -dr com.apple.provenance "$NODE_MODULES_DIR" || true

echo "[repair_macos_native_modules] verifying common native toolchain packages"
for target in \
  "$NODE_MODULES_DIR/@rollup" \
  "$NODE_MODULES_DIR/@esbuild" \
  "$NODE_MODULES_DIR/lightningcss-darwin-arm64" \
  "$NODE_MODULES_DIR/@tailwindcss/oxide-darwin-arm64" \
  "$NODE_MODULES_DIR/vite/node_modules/@esbuild" \
  "$NODE_MODULES_DIR/vite/node_modules/@rollup"; do
  if [[ -e "$target" ]]; then
    echo "  - ok: $target"
  fi
done

echo "[repair_macos_native_modules] done"
