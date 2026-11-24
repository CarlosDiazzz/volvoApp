// Import por peso: el índice del paquete arrastra los 18 archivos de Noto Sans al bundle.
import { NotoSans_400Regular } from '@expo-google-fonts/noto-sans/400Regular';
import { NotoSans_700Bold } from '@expo-google-fonts/noto-sans/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

import { CaptureScreen } from './src/screens/CaptureScreen';
import { PairingScreen } from './src/screens/PairingScreen';
import { usePairing } from './src/hooks/usePairing';
import { ThemeProvider } from './src/theme';

export default function App() {
  const { pairing, loading, error, busy, pair, pairFromQr, unpair } = usePairing();
  // Noto Sans es el fallback oficial de Volvo Novum. Mientras carga, el texto usa la fuente del sistema.
  const [fontsLoaded] = useFonts({ NotoSans_400Regular, NotoSans_700Bold });
  return (
    <ThemeProvider fontsLoaded={fontsLoaded}>
      {loading ? null : pairing ? (
        <CaptureScreen pairing={pairing} onUnpair={unpair} />
      ) : (
        <PairingScreen error={error} busy={busy} onPair={pair} onScan={pairFromQr} />
      )}
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
