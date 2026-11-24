import { StatusBar } from 'expo-status-bar';

import { CaptureScreen } from './src/screens/CaptureScreen';
import { PairingScreen } from './src/screens/PairingScreen';
import { usePairing } from './src/hooks/usePairing';

export default function App() {
  const { pairing, loading, error, pair, unpair } = usePairing();
  return (
    <>
      {loading ? null : pairing ? (
        <CaptureScreen pairing={pairing} onUnpair={unpair} />
      ) : (
        <PairingScreen error={error} onPair={pair} />
      )}
      <StatusBar style="light" />
    </>
  );
}
