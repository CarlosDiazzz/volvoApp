import { createContext, useContext, useState, type ReactNode } from 'react';

import type { Pairing } from '../domain/pairing';
import { useCapture } from '../hooks/useCapture';

type Capture = ReturnType<typeof useCapture>;

export const RATES = [0.5, 1, 2];

interface Session {
  pairing: Pairing;
  capture: Capture;
  running: boolean;
  setRunning: (v: boolean | ((r: boolean) => boolean)) => void;
  rate: number;
  setRate: (r: number) => void;
  door: boolean;
  setDoor: (v: boolean | ((d: boolean) => boolean)) => void;
  saver: boolean;
  setSaver: (v: boolean | ((s: boolean) => boolean)) => void;
}

const Ctx = createContext<Session | null>(null);

/**
 * La sesión de captura vive POR ENCIMA de las vistas: cambiar entre Inicio, Sensores y Ajustes (o abrir el modo conductor)
 * no detiene el envío ni pierde la cola. Los ajustes de envío se comparten entre las vistas.
 */
export function CaptureSession({ pairing, children }: { pairing: Pairing; children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState(1);
  const [door, setDoor] = useState(false);
  const [saver, setSaver] = useState(false);
  const capture = useCapture(pairing, running, rate, door, saver);
  return <Ctx.Provider value={{ pairing, capture, running, setRunning, rate, setRate, door, setDoor, saver, setSaver }}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession requiere <CaptureSession>');
  return s;
}
