import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ToastData } from '../components/Toast';

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((
    type: ToastData['type'],
    title: string,
    message?: string,
    duration?: number
  ) => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string) => {
    return addToast('success', title, message);
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast('error', title, message, 6000);
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast('info', title, message);
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast('warning', title, message, 5000);
  }, [addToast]);

  return {
    toasts,
    addToast,
    dismissToast,
    success,
    error,
    info,
    warning,
  };
}
