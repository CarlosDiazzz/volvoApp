import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { AlertBanner } from '../components/driver/AlertBanner';
import { DriverStatusBar } from '../components/driver/DriverStatusBar';
import { SensorSlider } from '../components/driver/SensorSlider';
import { NotoSans_200ExtraLight } from '@expo-google-fonts/noto-sans/200ExtraLight';
import { NotoSans_300Light } from '@expo-google-fonts/noto-sans/300Light';
import { useFonts } from 'expo-font';

import { DisplaySettings } from '../components/driver/DisplaySettings';
import { DriverColorsContext, fontsOf, paletteOf, type DriverColors } from '../components/driver/driverTheme';
import { CONTROLS_HIDE_AFTER_S, MODE_LABEL, nextMode, resolveMode } from '../domain/driver/appearance.ts';
import { useDriverPrefs } from '../hooks/useDriverPrefs';
import { alertsOf, buildCards } from '../domain/driver/catalog.ts';
import { createSimulatedSource, type ProfileId } from '../domain/driver/simulated.ts';
import { useDriverTelemetry } from '../hooks/useDriverTelemetry';

const NEXT_PROFILE: Record<ProfileId, ProfileId> = { '9800-foraneo': '7800e-biarticulado', '7800e-biarticulado': '9800-foraneo' };

/**
 * Modo conductor (vista para CarPlay): estado de mantenimiento de la carrocería en un carrusel, en horizontal, a pantalla
 * completa y con la pantalla siempre encendida. Los controles (salir, aspecto, ajustes, flechas) están ocultos: un toque los muestra
 * y se esconden solos tras unos segundos. Por ahora con datos simulados en el propio celular: no recibe datos de la flota.
 */
export function DriverScreen({ onExit }: { onExit: () => void }) {
  const [profile, setProfile] = useState<ProfileId>('9800-foraneo');
  const [index, setIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controls, setControls] = useState(false);
  const [touchedAt, setTouchedAt] = useState(0);
  const [prefs, setPrefs] = useDriverPrefs();
  const [fontsLoaded] = useFonts({ NotoSans_200ExtraLight, NotoSans_300Light });
  const fonts = fontsOf(fontsLoaded);
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

  // Automático: la hora local decide (se reevalúa cada segundo con el reloj de la telemetría).
  const colors = paletteOf(resolveMode(prefs.mode, new Date(now)));
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const touch = useCallback(() => setTouchedAt(Date.now()), []);
  const toggleControls = () => {
    touch();
    setControls((v) => !v);
  };
  // Se ocultan solos: no se esconden mientras el panel de ajustes está abierto ni si no hay datos (hay que poder salir).
  useEffect(() => {
    if (!controls || settingsOpen) return;
    const t = setTimeout(() => setControls(false), CONTROLS_HIDE_AFTER_S * 1000);
    return () => clearTimeout(t);
  }, [controls, settingsOpen, touchedAt]);

  const switchModel = () => {
    touch();
    setIndex(0);
    setProfile((p) => NEXT_PROFILE[p]);
  };
  const showControls = controls || !snapshot;

  return (
    <DriverColorsContext.Provider value={colors}>
      <SafeAreaView style={styles.root}>
        {snapshot && (
          <Pressable style={styles.fill} onPress={toggleControls} accessibilityLabel="Pantalla del modo conductor. Toca para mostrar u ocultar los controles">
            <SensorSlider
              cards={cards}
              index={Math.min(index, cards.length - 1)}
              onIndexChange={(i) => {
                touch();
                setIndex(i);
              }}
              now={now}
              view={prefs.view}
              fonts={fonts}
              showControls={controls}
            />
          </Pressable>
        )}

        {/* Siempre visible, aunque los controles estén ocultos: el origen de los datos y si hay señal. */}
        {snapshot && !controls && (
          <View style={styles.tag} pointerEvents="none">
            <View style={[styles.led, { backgroundColor: online ? colors.ok : colors.crit }]} />
            <Text style={[styles.tagText, snapshot.origin === 'simulated' ? { color: colors.warn } : { color: colors.ok }]}>
              {snapshot.origin === 'simulated' ? 'DATOS SIMULADOS' : 'DATOS REALES'}
            </Text>
          </View>
        )}

        {!snapshot && (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Conectando con la unidad…</Text>
          </View>
        )}

        <View style={styles.top} pointerEvents="box-none">
          {snapshot && showControls && (
            <DriverStatusBar
              vehicle={snapshot.vehicle}
              busId={snapshot.busId}
              origin={snapshot.origin}
              online={online}
              now={now}
              fonts={fonts}
              onExit={onExit}
              onSettings={() => {
                touch();
                setSettingsOpen(true);
              }}
              modeLabel={MODE_LABEL[prefs.mode]}
              onCycleMode={() => {
                touch();
                setPrefs({ ...prefs, mode: nextMode(prefs.mode) });
              }}
              onSwitchModel={snapshot.origin === 'simulated' ? switchModel : undefined}
            />
          )}
          {!snapshot && (
            <Pressable accessibilityRole="button" accessibilityLabel="Salir del modo conductor" onPress={onExit} style={styles.exitLoading}>
              <Text style={styles.exitLoadingText}>Salir</Text>
            </Pressable>
          )}
          <View style={styles.banner} pointerEvents="box-none">
            <AlertBanner alerts={alerts} onShow={(id) => setIndex(Math.max(0, cards.findIndex((c) => c.id === id)))} />
          </View>
        </View>

        <DisplaySettings visible={settingsOpen} prefs={prefs} now={now} onChange={setPrefs} onClose={() => setSettingsOpen(false)} />
      </SafeAreaView>
    </DriverColorsContext.Provider>
  );
}

const makeStyles = (c: DriverColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    fill: { flex: 1 },
    top: { position: 'absolute', top: 0, left: 0, right: 0 },
    banner: { paddingHorizontal: 16, paddingTop: 8 },
    tag: { position: 'absolute', top: 10, right: 20, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.85 },
    tagText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    led: { width: 8, height: 8, borderRadius: 4 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: c.muted, fontSize: 20 },
    exitLoading: { alignSelf: 'flex-end', margin: 16, minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: c.lineHi, alignItems: 'center', justifyContent: 'center' },
    exitLoadingText: { color: c.accent, fontWeight: '600' },
  });
