import { useContext } from 'react';
import { ToastContext } from './ToastContext';

// Plain (non-hook) factory so attaching shorthand methods to the callable
// isn't seen as mutating a value inside the hook body itself.
function buildToastApi(addToast, removeToast) {
  const toast = (message, options = {}) => addToast({ message, ...options });
  toast.success = (message, options = {}) => addToast({ message, variant: 'success', ...options });
  toast.error = (message, options = {}) => addToast({ message, variant: 'error', ...options });
  toast.warning = (message, options = {}) => addToast({ message, variant: 'warning', ...options });
  toast.info = (message, options = {}) => addToast({ message, variant: 'info', ...options });
  toast.dismiss = removeToast;
  return toast;
}

/**
 * Hook to trigger toast notifications from anywhere below a ToastProvider.
 *
 * Usage:
 *   const toast = useToast();
 *   toast('Saved!');
 *   toast.success('Saved!');
 *   toast.error('Something went wrong', { title: 'Error', duration: 0 });
 *   toast.dismiss(id);
 */
export const useToast = () => {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }

  return buildToastApi(ctx.addToast, ctx.removeToast);
};

export default useToast;
