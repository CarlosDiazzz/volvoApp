import * as Battery from 'expo-battery';
import { requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
import { Accelerometer, Barometer, DeviceMotion, Gyroscope, LightSensor, Magnetometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { appendPhoneHistory, approxSpl, dbfsOf, ema, NO_SENSORS, rms, type MicState, type PhoneAvailability, type PhoneHistory, type PhoneReadings } from '../domain/driver/phone.ts';
import { MagMeter, VibrationMeter } from '../domain/measure';

const TICK_MS = 1000;
const CALIBRATION_MS = 2000;

const EMPTY: PhoneReadings = { vibration: null, gyroDps: null, magDelta: null, tiltDeg: null, pressureHpa: null, lux: null, noiseDb: null, battery: null, at: new Date(0).toISOString() };

/**
 * Todos los sensores del teléfono que el modo conductor puede mostrar, mientras `active`:
 * acelerómetro (vibración), giroscopio, magnetómetro (calibra solo al empezar), barómetro, movimiento (inclinación), luz (solo Android),
 * batería y micrófono. El micrófono se lee como flujo de audio en memoria: SOLO se calcula el nivel de cada bloque y se descarta;
 * nunca se guarda un archivo ni se envía audio. No se usa ubicación ni cámara.
 */
export function usePhoneSensors(active: boolean, withMic = true) {
  const [avail, setAvail] = useState<PhoneAvailability>(NO_SENSORS);
  const [readings, setReadings] = useState<PhoneReadings>(EMPTY);
  const [history, setHistory] = useState<PhoneHistory>({});
  const live = useRef({
    vib: new VibrationMeter(),
    mag: new MagMeter(),
    gyro: null as number | null,
    tilt: null as number | null,
    pressure: null as number | null,
    lux: null as number | null,
    noise: null as number | null,
    battery: null as number | null,
  });
  const micState = useRef<MicState>('pending');

  // Flujo del micrófono (no se inicia hasta que haya permiso).
  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'float32',
    onBuffer: ({ data }) => {
      const level = approxSpl(dbfsOf(rms(new Float32Array(data))));
      live.current.noise = ema(live.current.noise, level, 0.25);
    },
  });

  // Disponibilidad (una vez).
  useEffect(() => {
    let alive = true;
    Promise.all([
      Accelerometer.isAvailableAsync(),
      Gyroscope.isAvailableAsync(),
      Magnetometer.isAvailableAsync(),
      Barometer.isAvailableAsync(),
      LightSensor.isAvailableAsync(),
      DeviceMotion.isAvailableAsync(),
    ])
      .then(([accel, gyro, mag, baro, light, motion]) => alive && setAvail((a) => ({ ...a, accel, gyro, mag, baro, light: Platform.OS === 'android' && light, motion })))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Micrófono: permiso y flujo.
  useEffect(() => {
    if (!active || !withMic) return;
    let alive = true;
    (async () => {
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        micState.current = granted ? 'granted' : 'denied';
        if (alive) setAvail((a) => ({ ...a, mic: micState.current }));
        if (granted && alive) await stream.start();
      } catch {
        micState.current = 'unavailable';
        if (alive) setAvail((a) => ({ ...a, mic: 'unavailable' }));
      }
    })();
    return () => {
      alive = false;
      try {
        stream.stop();
      } catch {
        // ya detenido
      }
      live.current.noise = null;
      micState.current = 'pending';
    };
  }, [active, withMic, stream]);

  // Sensores de movimiento.
  useEffect(() => {
    if (!active) return;
    const l = live.current;
    Accelerometer.setUpdateInterval(50);
    Gyroscope.setUpdateInterval(100);
    Magnetometer.setUpdateInterval(100);
    Barometer.setUpdateInterval(1000);
    DeviceMotion.setUpdateInterval(200);
    const subs = [
      Accelerometer.addListener(({ x, y, z }) => l.vib.push(x, y, z)),
      Gyroscope.addListener(({ x, y, z }) => (l.gyro = (Math.hypot(x, y, z) * 180) / Math.PI)),
      Magnetometer.addListener(({ x, y, z }) => l.mag.push(x, y, z)),
      Barometer.addListener(({ pressure }) => (l.pressure = pressure)),
      DeviceMotion.addListener(({ rotation }) => {
        if (rotation) l.tilt = (Math.max(Math.abs(rotation.beta), Math.abs(rotation.gamma)) * 180) / Math.PI;
      }),
    ];
    if (Platform.OS === 'android') {
      LightSensor.setUpdateInterval(500);
      subs.push(LightSensor.addListener(({ illuminance }) => (l.lux = illuminance)));
    }
    // Línea base del campo magnético: los primeros 2 s con el teléfono quieto y sin imán cerca.
    l.mag.startCalibration();
    const calibration = setTimeout(() => l.mag.finishCalibration(), CALIBRATION_MS);
    return () => {
      clearTimeout(calibration);
      subs.forEach((s) => s.remove());
    };
  }, [active]);

  // Muestra de todo, una vez por segundo.
  useEffect(() => {
    if (!active) return;
    const l = live.current;
    const readBattery = () =>
      Battery.getBatteryLevelAsync()
        .then((v) => (l.battery = v >= 0 ? v : null))
        .catch(() => undefined);
    readBattery();
    const batteryTimer = setInterval(readBattery, 15_000);
    const tick = setInterval(() => {
      const next: PhoneReadings = {
        vibration: l.vib.take(),
        gyroDps: l.gyro,
        magDelta: l.mag.delta,
        tiltDeg: l.tilt,
        pressureHpa: l.pressure,
        lux: l.lux,
        noiseDb: micState.current === 'granted' ? l.noise : null,
        battery: l.battery,
        at: new Date().toISOString(),
      };
      setReadings(next);
      setHistory((h) => appendPhoneHistory(h, next));
    }, TICK_MS);
    return () => {
      clearInterval(batteryTimer);
      clearInterval(tick);
    };
  }, [active]);

  return { avail, readings, history };
}
