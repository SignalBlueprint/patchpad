import { useEffect, useRef, useCallback, useState } from 'react';

interface UseIdleDetectionOptions {
  idleTimeout?: number; // ms before considered idle
  onIdle?: () => void;
  enabled?: boolean;
}

export function useIdleDetection({
  idleTimeout = 3000,
  onIdle,
  enabled = true,
}: UseIdleDetectionOptions = {}) {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();
    setIsIdle(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setIsIdle(true);
      onIdle?.();
    }, idleTimeout);
  }, [idleTimeout, onIdle, enabled]);

  const reportActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsIdle(false);
      return;
    }

    // Start the timer initially
    resetTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, resetTimer]);

  return {
    isIdle,
    reportActivity,
    timeSinceActivity: () => Date.now() - lastActivityRef.current,
  };
}
