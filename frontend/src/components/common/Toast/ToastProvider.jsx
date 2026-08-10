import React, { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import { ToastContext } from './ToastContext';

const POSITION_CLASSES = {
  'top-right': 'top-4 right-4 items-end',
  'top-left': 'top-4 left-4 items-start',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
};

let idCounter = 0;
const nextId = () => `toast-${Date.now()}-${idCounter++}`;

/**
 * Provides a global toast/notification system via the `useToast` hook.
 * Wrap your app (or a subtree) with this once; call `useToast()` anywhere below it.
 *
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.children
 * @param {string} props.position - Where toasts stack (top-right, top-left, bottom-right, bottom-left, top-center, bottom-center)
 * @param {number} props.maxToasts - Maximum number of toasts visible at once (oldest are dropped)
 */
const ToastProvider = ({ children, position = 'top-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (options) => {
      const id = nextId();
      setToasts((prev) => {
        const next = [...prev, { id, variant: 'info', duration: 4000, ...options }];
        return next.length > maxToasts ? next.slice(next.length - maxToasts) : next;
      });
      return id;
    },
    [maxToasts]
  );

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className={`fixed z-[100] flex flex-col gap-2 ${POSITION_CLASSES[position]}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.map((t) => (
            <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
