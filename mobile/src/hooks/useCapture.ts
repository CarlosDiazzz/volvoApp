import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';

import { BlockCounter } from '../domain/counter';
import { encryptSample } from '../domain/envelope';
import { luxToPct } from '../domain/measure';
import type { Pairing } from '../domain/pairing';
import { buildSample } from '../domain/sample';
import { SendQueue } from '../domain/queue';
import { Link, type LinkState } from '../services/link';
import { loadQueue, saveQueue } from '../services/queueStorage';
import { counterKey, secureKeyValueStore } from '../services/secureStorage';
import { useBattery } from './useBattery';
import { useSensors } from './useSensors';

export interface LiveValues {
  vib: number;
  mag: number | null;
  lux: number | null;
}

const PUMP_MS = 300; // ≈ 3 envíos/s: pone al día una cola sin superar el límite del puente (6/s) junto con la captura (≤ 2 Hz)
const WINDOW = 20; // máximo de muestras enviadas y sin confirmar
const SAVE_MS = 3000;

/**
 * Orquesta la captura: cada 1/rate s toma las lecturas, reserva un contador, cifra y la ENCOLA. Un bombeo aparte las envía en orden
 * y solo las borra cuando el puente las confirma: si se corta la red, nada se pierde y al reconectar se pone al día.
 * Toda la lógica de decisión vive en `domain`; aquí solo se conectan las piezas.
 */
export function useCapture(pairing: Pairing, running: boolean, rate: number, door: boolean) {
  const sensors = useSensors(running);
  const battery = useBattery(running);
  const [link, setLink] = useState<LinkState>('down');
  const [sent, setSent] = useState(0); // confirmadas por el puente
  const [queued, setQueued] = useState(0); // pendientes de confirmar
  const [dropped, setDropped] = useState(0); // descartadas por desborde de la cola
  const [live, setLive] = useState<LiveValues>({ vib: 0, mag: null, lux: null });
  const [fault, setFault] = useState('');
  const doorRef = useRef(door);
  doorRef.current = door;
  const { avail, vibration, magnet, lux } = sensors;
  const batteryLevel = battery.level;

  useEffect(() => {
    if (!running) return;
    let alive = true;
    const counter = new BlockCounter(secureKeyValueStore, counterKey(pairing.device));
    let queue = new SendQueue();
    let cursor = -1; // último contador enviado EN ESTA conexión (al reconectar se reinicia y se reenvía lo no confirmado)
    let dirty = false;
    const refresh = () => {
      setQueued(queue.length);
      setDropped(queue.dropped);
    };
    const connection = new Link(
      pairing,
      (s) => {
        setLink(s);
        if (s === 'ready') cursor = -1;
      },
      (reply) => {
        if (reply.kind === 'ack') {
          const removed = queue.ack(reply.ctr);
          if (removed > 0) {
            dirty = true;
            setSent((n) => n + removed);
            refresh();
          }
        } else if (reply.kind === 'nack') {
          cursor = Math.min(cursor, reply.ctr - 1); // el puente no pudo entregarla: se reintenta desde esa
        }
      },
    );
    activateKeepAwakeAsync('capture').catch(() => undefined); // el sistema suspende sensores con la pantalla apagada
    setFault('');

    const tick = async () => {
      const vib = vibration.current.take();
      const mag = magnet.current.delta;
      const luxNow = lux.current;
      setLive({ vib, mag, lux: luxNow });
      try {
        const ctr = await counter.next();
        const sample = buildSample(Date.now(), {
          light: luxNow == null ? null : luxToPct(luxNow),
          vib: avail.accel ? vib : null,
          mag: avail.mag ? mag : null,
          door: doorRef.current,
          battery: batteryLevel.current,
        });
        if (alive && queue.enqueue({ ctr, json: JSON.stringify(encryptSample(pairing, ctr, sample)) })) {
          dirty = true;
          refresh();
        }
      } catch (e) {
        setFault(e instanceof Error ? e.message : 'error de captura');
      }
    };

    const pump = () => {
      if (connection.state !== 'ready' || queue.inFlight(cursor) >= WINDOW) return;
      const item = queue.next(cursor);
      if (item && connection.sendRaw(item.json)) cursor = item.ctr;
    };
    const persist = () => {
      if (!dirty) return;
      dirty = false;
      saveQueue(pairing.device, queue).catch(() => {
        dirty = true; // se reintenta en el siguiente ciclo
      });
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    let pumpTimer: ReturnType<typeof setInterval> | null = null;
    let saveTimer: ReturnType<typeof setInterval> | null = null;
    Promise.all([counter.init(), loadQueue(pairing.device)])
      .then(([, restored]) => {
        if (!alive) return;
        queue = restored; // lo que quedó sin confirmar la última vez (corte de red o app cerrada)
        refresh();
        connection.start();
        timer = setInterval(tick, 1000 / rate);
        pumpTimer = setInterval(pump, PUMP_MS);
        saveTimer = setInterval(persist, SAVE_MS);
      })
      .catch((e) => setFault(e instanceof Error ? e.message : 'error de contador'));

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (pumpTimer) clearInterval(pumpTimer);
      if (saveTimer) clearInterval(saveTimer);
      dirty = true;
      persist(); // al detener se respalda lo pendiente
      connection.stop();
      deactivateKeepAwake('capture').catch(() => undefined);
    };
  }, [running, pairing, rate, avail, vibration, magnet, lux, batteryLevel]);

  return { ...sensors, ...battery, link, sent, queued, dropped, live, fault };
}
