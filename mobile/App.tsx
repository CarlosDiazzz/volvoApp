// Import por peso: el índice del paquete arrastra los 18 archivos de Noto Sans al bundle.
import { NotoSans_400Regular } from '@expo-google-fonts/noto-sans/400Regular';
import { NotoSans_700Bold } from '@expo-google-fonts/noto-sans/700Bold';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CaptureSession } from './src/session/CaptureSession';
import { HomeShell } from './src/views/HomeShell';
import { DriverScreen } from './src/screens/DriverScreen';
import { PairingScreen } from './src/screens/PairingScreen';
import { usePairing } from './src/hooks/usePairing';
import { ThemeProvider } from './src/theme';

export default function App() {
  const { pairing, loading, error, busy, pair, pairFromQr, unpair } = usePairing();
  const [driver, setDriver] = useState(false);
  // Noto Sans es el fallback oficial de Volvo Novum. Mientras carga, el texto usa la fuente del sistema.
  const [fontsLoaded] = useFonts({ NotoSans_400Regular, NotoSans_700Bold });

  useEffect(() => {
    // La app es vertical; solo el modo conductor gira a horizontal (lo bloquea DriverScreen mientras está abierto).
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
  }, []);

  return (
    <ThemeProvider fontsLoaded={fontsLoaded}>
      {/* La captura NO se desmonta al abrir el modo conductor: se oculta. Así el nodo sigue enviando (y la cola y el enlace siguen vivos). */}
      <View style={driver ? styles.hidden : styles.fill}>
        {loading ? null : pairing ? (
          <CaptureSession pairing={pairing}>
            <HomeShell hidden={driver} onDriverMode={() => setDriver(true)} onUnpair={unpair} />
          </CaptureSession>
        ) : (
          <PairingScreen error={error} busy={busy} onPair={pair} onScan={pairFromQr} onDriverMode={() => setDriver(true)} />
        )}
      </View>
      {driver && <DriverScreen onExit={() => setDriver(false)} />}
      <StatusBar style="light" hidden={driver} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
