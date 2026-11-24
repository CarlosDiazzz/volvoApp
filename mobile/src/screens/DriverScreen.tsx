import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { AlertBanner } from '../components/driver/AlertBanner';
import { DriverStatusBar } from '../components/driver/DriverStatusBar';
import { SensorSlider } from '../components/driver/SensorSlider';
import { driverColors } from '../components/driver/driverTheme';
import { alertsOf, buildCards } from '../domain/driver/catalog.ts';
import { createSimulatedSource, type ProfileId } from '../domain/driver/simulated.ts';
import { useDriverTelemetry } from '../hooks/useDriverTelemetry';

const NEXT_PROFILE: Record<ProfileId, ProfileId> = { '9800-foraneo': '7800e-biarticulado', '7800e-biarticulado': '9800-foraneo' };

/**
 * Modo conductor (vista para CarPlay): estado de mantenimiento de la carrocería en un carrusel, en horizontal y con la
 * pantalla siempre encendida. Por ahora con datos simulados en el propio celular: no recibe datos de la flota.
 */
export function DriverScreen({ onExit }: { onExit: () => void }) {
  const [profile, setProfile] = useState<ProfileId>('9800-foraneo');
  const [index, setIndex] = useState(0);
  const source = useMemo(() => createSimulatedSource({ profile }), [profile]);
  const { snapshot, history, now, online } = useDriverTelemetry(source);
  const cards = useMemo(() => (snapshot ? buildCards(profile, snapshot, history) : []), [profile, snapshot, history]);
  const alerts = useMemo(() => alertsOf(cards), [cards]);

  useEffect(() => {
    // Horizontal mientras dure el modo conductor; al salir, la app vuelve a vertical. Pantalla siempre encendida.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    activateKeepAwakeAsync('driver').catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
      deactivateKeepAwake('driver').catch(() => undefined);
    };
  }, []);

  const switchModel = () => {
    setIndex(0);
    setProfile((p) => NEXT_PROFILE[p]);
  };

  return (
    <SafeAreaView style={styles.root}>
      {!snapshot ? (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Conectando con la unidad…</Text>
        </View>
      ) : (
        <>
          <DriverStatusBar
            vehicle={snapshot.vehicle}
            busId={snapshot.busId}
            origin={snapshot.origin}
            online={online}
            now={now}
            onExit={onExit}
            onSwitchModel={snapshot.origin === 'simulated' ? switchModel : undefined}
          />
          <View style={styles.content}>
            <AlertBanner alerts={alerts} onShow={(id) => setIndex(Math.max(0, cards.findIndex((c) => c.id === id)))} />
            <SensorSlider cards={cards} index={Math.min(index, cards.length - 1)} onIndexChange={setIndex} now={now} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: driverColors.bg },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: driverColors.muted, fontSize: 20 },
});
