import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { CaptureScreen } from './src/screens/CaptureScreen';
import { DriverScreen } from './src/screens/DriverScreen';
import { PairingScreen } from './src/screens/PairingScreen';
import { usePairing } from './src/hooks/usePairing';

export default function App() {
  const { pairing, loading, error, busy, pair, pairFromQr, unpair } = usePairing();
  const [driver, setDriver] = useState(false);

  useEffect(() => {
    // La app es vertical; solo el modo conductor gira a horizontal (lo bloquea DriverScreen mientras está abierto).
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
  }, []);

  if (driver) {
    return (
      <>
        <DriverScreen onExit={() => setDriver(false)} />
        <StatusBar hidden />
      </>
    );
  }

  return (
    <>
      {loading ? null : pairing ? (
        <CaptureScreen pairing={pairing} onUnpair={unpair} onDriverMode={() => setDriver(true)} />
      ) : (
        <PairingScreen error={error} busy={busy} onPair={pair} onScan={pairFromQr} onDriverMode={() => setDriver(true)} />
      )}
      <StatusBar style="light" />
    </>
  );
}
