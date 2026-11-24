import { Accelerometer, LightSensor, Magnetometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { MagMeter, VibrationMeter } from '../domain/measure';

export interface Availability {
  accel: boolean;
  mag: boolean;
  light: boolean;
}

const CALIBRATION_MS = 2000;

/** Suscribe los sensores del equipo mientras `active`; expone los medidores y la calibración del imán. */
export function useSensors(active: boolean) {
  const [avail, setAvail] = useState<Availability>({ accel: false, mag: false, light: false });
  const [calibrating, setCalibrating] = useState(false);
  const vibration = useRef(new VibrationMeter());
  const magnet = useRef(new MagMeter());
  const lux = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([Accelerometer.isAvailableAsync(), Magnetometer.isAvailableAsync(), LightSensor.isAvailableAsync()])
      .then(([accel, mag, light]) => setAvail({ accel, mag, light: Platform.OS === 'android' && light }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!active) return;
    Accelerometer.setUpdateInterval(50);
    Magnetometer.setUpdateInterval(100);
    const subs = [
      Accelerometer.addListener(({ x, y, z }) => vibration.current.push(x, y, z)),
      Magnetometer.addListener(({ x, y, z }) => magnet.current.push(x, y, z)),
    ];
    if (avail.light) {
      LightSensor.setUpdateInterval(500);
      subs.push(LightSensor.addListener(({ illuminance }) => (lux.current = illuminance)));
    }
    return () => subs.forEach((s) => s.remove());
  }, [active, avail.light]);

  const calibrate = useCallback(() => {
    setCalibrating(true);
    magnet.current.startCalibration();
    setTimeout(() => {
      magnet.current.finishCalibration();
      setCalibrating(false);
    }, CALIBRATION_MS);
  }, []);

  return { avail, calibrating, calibrate, vibration, magnet, lux };
}
