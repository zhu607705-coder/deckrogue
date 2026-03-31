import React, { useEffect, useState, useCallback } from 'react';
import { 
  getToasts, 
  dismissToast, 
  subscribeToToasts, 
  type ToastMessage,
  type ToastType 
} from '@/ui/motion';

const TOAST_ICONS: Record<ToastType, string> = {
  victory: '⚔',
  defeat: '💀',
  upgrade: '↑',
  achievement: '★',
  loot: '◆',
  warning: '⚠',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setToasts(getToasts());
    return subscribeToToasts(setToasts);
  }, []);

  return (
    <div className="toast-container" role="region" aria-label="通知">
      {toasts.map((toast, index) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          stackIndex={index}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: ToastMessage;
  stackIndex: number;
  onDismiss: () => void;
}

function ToastItem({ toast, stackIndex, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onDismiss, 200);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onDismiss]);

  return (
    <div
      className={`toast-item toast-item--${toast.type} ${isExiting ? 'toast-item--exit' : ''}`}
      role="alert"
      style={{ '--stack-index': stackIndex } as React.CSSProperties}
    >
      <div className="toast-icon">
        {TOAST_ICONS[toast.type]}
      </div>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-message">{toast.message}</div>}
      </div>
      <button 
        className="toast-close" 
        onClick={handleDismiss}
        aria-label="关闭通知"
      >
        ✕
      </button>
    </div>
  );
}

export default ToastContainer;
