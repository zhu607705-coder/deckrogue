/**
 * @file errorBoundaryContract.test.ts
 * @description Unit tests for shared UI error fallback copy.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

import { ErrorBoundary } from '@/ui/components/ErrorBoundary';

test('ErrorBoundary default fallback uses localized Chinese recovery copy', () => {
  const boundary = new ErrorBoundary({ children: null });
  (boundary as unknown as { state: { hasError: boolean; error: Error } }).state = {
    hasError: true,
    error: new Error('boom'),
  };

  const html = renderToStaticMarkup(boundary.render() as ReactElement);

  assert.match(html, /界面渲染异常/);
  assert.match(html, /重试/);
  assert.match(html, /deckrogue-error-boundary/);
  assert.match(html, /deckrogue-error-boundary__action/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /Something went wrong|Try Again|unexpected error/i);
});
