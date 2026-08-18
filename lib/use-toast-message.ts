"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_TOAST_MS = 1500;

export function useToastMessage(durationMs = DEFAULT_TOAST_MS) {
  const [message, setMessageState] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMessage = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessageState("");
  }, []);

  const setMessage = useCallback(
    (next: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setMessageState(next);
      if (next) {
        timeoutRef.current = setTimeout(() => {
          setMessageState("");
          timeoutRef.current = null;
        }, durationMs);
      }
    },
    [durationMs],
  );

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { message, setMessage, clearMessage };
}
