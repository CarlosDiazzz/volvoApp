import * as Battery from 'expo-battery';
import { useEffect, useRef, useState } from 'react';

export interface BatteryStats {
  start: number;
  startedAt: number;
  now: number;
}

const REFRESH_MS = 30_000;
const MIN_WINDOW_MS = 120_000;

/** Nivel de batería y consumo medido (%/h) desde que empezó la captura. */
export function useBattery(active: boolean) {
  const [stats, setStats] = useState<BatteryStats | null>(null);
  const level = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const read = () =>
      Battery.getBatteryLevelAsync()
        .then((lvl) => {
          if (!alive) return;
          level.current = lvl;
          setStats((s) => (s ? { ...s, now: lvl } : { start: lvl, startedAt: Date.now(), now: lvl }));
        })
        .catch(() => undefined);
    setStats(null);
    read();
    const id = setInterval(read, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [active]);

  const drainPerHour =
    stats && stats.start >= 0 && Date.now() - stats.startedAt > MIN_WINDOW_MS
      ? ((stats.start - stats.now) * 100) / ((Date.now() - stats.startedAt) / 3_600_000)
      : null;

  return { level, stats, drainPerHour };
}
