"use client";

import { useEffect, useState } from "react";

/** Текущее время, обновляемое каждые intervalMs (для обратного отсчёта) */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
