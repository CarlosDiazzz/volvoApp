import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';

import { BlockCounter } from '../domain/counter';
import { encryptSample } from '../domain/envelope';
import { luxToPct } from '../domain/measure';
import type { Pairing } from '../domain/pairing';
import { buildSample } from '../domain/sample';
import { Link, type LinkState } from '../services/link';
import { counterKey, secureKeyValueStore } from '../services/secureStorage';
import { useBattery } from './useBattery';
import { useSensors } from './useSensors';

export interface LiveValues {
  vib: number;
  mag: number | null;
  lux: number | null;
}

/**
 * Orquesta la captura: cada 1/rate s toma las lecturas, reserva un contador, cifra y envía.
 * Toda la lógica de decisión vive en `domain`; aquí solo se conectan las piezas.
 */
export function useCapture(pairing: Pairing, running: boolean, rate: number, door: boolean) {
  const sensors = useSensors(running);
  const battery = useBattery(running);
  const [link, setLink] = useState<LinkState>('down');
  const [sent, setSent] = useState(0);
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
    const connection = new Link(pairing, setLink);
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
        if (alive && connection.send(encryptSample(pairing, ctr, sample))) setSent((n) => n + 1);
      } catch (e) {
        setFault(e instanceof Error ? e.message : 'error de captura');
      }
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    counter
      .init()
      .then(() => {
        if (!alive) return;
        connection.start();
        timer = setInterval(tick, 1000 / rate);
      })
      .catch((e) => setFault(e instanceof Error ? e.message : 'error de contador'));

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      connection.stop();
      deactivateKeepAwake('capture').catch(() => undefined);
    };
  }, [running, pairing, rate, avail, vibration, magnet, lux, batteryLevel]);

  return { ...sensors, ...battery, link, sent, live, fault };
}
