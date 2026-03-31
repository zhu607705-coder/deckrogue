import { useEffect } from 'react';
import type { AppKeyboardContext, KeyboardActionId, KeybindMap } from './keybinds';
import { resolveKeyboardAction } from './keybinds';

interface GlobalKeyboardInputOptions {
  context: AppKeyboardContext;
  keybinds: KeybindMap;
  onAction: (action: KeyboardActionId, event: KeyboardEvent) => void;
  onCaptureKey?: (code: string, event: KeyboardEvent) => void;
  onCaptureCancel?: (event: KeyboardEvent) => void;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

export function useGlobalKeyboardInput({
  context,
  keybinds,
  onAction,
  onCaptureKey,
  onCaptureCancel
}: GlobalKeyboardInputOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const runtimeContext = {
        ...context,
        overlay: document.querySelector('[data-keyboard-overlay="true"]') ? 'overlay' : context.overlay,
        modal: document.querySelector('[data-keyboard-modal="true"]') ? 'modal' : context.modal
      };

      if (context.rebindingAction) {
        event.preventDefault();
        event.stopPropagation();
        if (event.code === 'Escape') {
          onCaptureCancel?.(event);
          return;
        }
        onCaptureKey?.(event.code, event);
        return;
      }

      if (isTypingTarget(event.target)) return;

      const action = resolveKeyboardAction(event.code, runtimeContext, keybinds);
      if (!action) return;

      event.preventDefault();
      onAction(action, event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [context, keybinds, onAction, onCaptureKey, onCaptureCancel]);
}
