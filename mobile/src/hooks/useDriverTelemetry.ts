import { useEffect, useState } from 'react';

import type { Snapshot, TelemetrySource } from '../domain/driver/contract.ts';
import { appendHistory, type History } from '../domain/driver/history.ts';

/** Si no llega nada en este tiempo, la pantalla dice «Sin señal» y las tarjetas muestran su antigüedad. */
export const OFFLINE_AFTER_MS = 5_000;

/** Instantánea, historial (para tendencias), hora actual y si hay señal. Se reinicia al cambiar de fuente. */
export function useDriverTelemetry(source: TelemetrySource, tickMs = 1_000) {
  const [state, setState] = useState<{ snapshot: Snapshot | null; history: History }>({ snapshot: null, history: {} });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setState({ snapshot: null, history: {} });
    return source.start((snapshot) => setState((prev) => ({ snapshot, history: appendHistory(prev.history, snapshot) })));
  }, [source]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);

  const online = state.snapshot !== null && now - state.snapshot.receivedAt < OFFLINE_AFTER_MS;
  return { ...state, now, online };
}
