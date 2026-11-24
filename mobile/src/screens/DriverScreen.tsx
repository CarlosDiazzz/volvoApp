import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { AlertBanner } from '../components/driver/AlertBanner';
import { DriverStatusBar } from '../components/driver/DriverStatusBar';
import { SensorSlider } from '../components/driver/SensorSlider';
import { DisplaySettings } from '../components/driver/DisplaySettings';
import { DriverColorsContext, driverFonts as fonts, paletteOf, type DriverColors } from '../components/driver/driverTheme';
import { isTap } from '../domain/driver/carousel.ts';
import { CONTROLS_HIDE_AFTER_S, MODE_LABEL, nextMode, resolveMode } from '../domain/driver/appearance.ts';
import { useDriverPrefs } from '../hooks/useDriverPrefs';
import { alertsOf, buildCards } from '../domain/driver/catalog.ts';
import type { Origin, TelemetrySource, Vehicle } from '../domain/driver/contract.ts';
import { buildPhoneCards } from '../domain/driver/phone.ts';
import { createSimulatedSource, type ProfileId } from '../domain/driver/simulated.ts';
import { useDriverTelemetry } from '../hooks/useDriverTelemetry';
import { usePhoneSensors } from '../hooks/usePhoneSensors';

/** `phone` = los sensores REALES de este teléfono (predeterminado); los otros dos son modelos simulados para la demostración. */
type DataSource = 'phone' | ProfileId;
const ORDER: DataSource[] = ['phone', '9800-foraneo', '7800e-biarticulado'];

const PHONE_VEHICLE: Vehicle = { profile: 'phone', label: 'Teléfono', model: 'Sensores del teléfono', service: '—', lengthM: 0, modules: 0 };
/** Fuente que nunca emite: con el teléfono como origen no corre el simulador (solo se aprovecha el reloj del hook). */
const IDLE_SOURCE: TelemetrySource = { start: () => () => undefined };

interface Feed {
  vehicle: Vehicle;
  busId: string;
  origin: Origin;
  online: boolean;
  cards: ReturnType<typeof buildCards>;
}

/**
 * Modo conductor (vista para CarPlay): estado de mantenimiento de la carrocería en un carrusel, en horizontal, a pantalla
 * completa y con la pantalla siempre encendida. Los controles (salir, aspecto, ajustes, flechas) están ocultos: un toque los muestra
 * y se esconden solos tras unos segundos. Por defecto muestra los sensores REALES del teléfono (movimiento, giro, campo magnético,
 * presión, luz, batería y nivel de sonido del micrófono); con ⇄ se pasa a los modelos simulados. Aún no recibe datos de la flota.
 */
export function DriverScreen({ onExit }: { onExit: () => void }) {
  const [dataSource, setDataSource] = useState<DataSource>('phone');
  const [index, setIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controls, setControls] = useState(false);
  const [touchedAt, setTouchedAt] = useState(0);
  const [prefs, setPrefs] = useDriverPrefs();
  const simulated = dataSource !== 'phone';
  const source = useMemo(() => (simulated ? createSimulatedSource({ profile: dataSource }) : IDLE_SOURCE), [simulated, dataSource]);
  const { snapshot, history, now, online } = useDriverTelemetry(source);
  const phone = usePhoneSensors(!simulated);
  const feed = useMemo<Feed | null>(() => {
    if (!simulated) {
      return { vehicle: PHONE_VEHICLE, busId: 'Este teléfono', origin: 'real', online: true, cards: buildPhoneCards(phone.readings, phone.history, phone.avail) };
    }
    if (!snapshot) return null;
    return { vehicle: snapshot.vehicle, busId: snapshot.busId, origin: snapshot.origin, online, cards: buildCards(dataSource, snapshot, history) };
  }, [simulated, dataSource, snapshot, history, online, phone.readings, phone.history, phone.avail]);
  const cards = feed?.cards ?? [];
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
  // Solo un TOQUE muestra u oculta los controles: un deslizamiento (cambiar de componente) no debe desplegar la barra.
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
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
    setDataSource((d) => ORDER[(ORDER.indexOf(d) + 1) % ORDER.length]!);
  };
  const showControls = controls || !feed;

  return (
    <DriverColorsContext.Provider value={colors}>
      <SafeAreaView style={styles.root}>
        {feed && (
          <View
            style={styles.fill}
            onTouchStart={(e) => {
              touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() };
            }}
            onTouchEnd={(e) => {
              const start = touchStart.current;
              touchStart.current = null;
              if (start && isTap(start, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() })) toggleControls();
            }}
          >
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
          </View>
        )}

        {/* Para lector de pantalla (VoiceOver): un botón que muestra u oculta los controles. */}
        {feed && (
          <Pressable accessibilityRole="button" accessibilityLabel="Mostrar u ocultar los controles" onPress={toggleControls} style={styles.a11y} />
        )}

        {!feed && (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Conectando con la unidad…</Text>
          </View>
        )}

        <View style={styles.top} pointerEvents="box-none">
          {feed && showControls && (
            <DriverStatusBar
              vehicle={feed.vehicle}
              busId={feed.busId}
              origin={feed.origin}
              online={feed.online}
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
              onSwitchModel={switchModel}
            />
          )}
          {!feed && (
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
    a11y: { position: 'absolute', top: 0, left: 0, width: 44, height: 44 },
    top: { position: 'absolute', top: 0, left: 0, right: 0 },
    banner: { paddingHorizontal: 16, paddingTop: 8 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: c.muted, fontSize: 20 },
    exitLoading: { alignSelf: 'flex-end', margin: 16, minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: c.lineHi, alignItems: 'center', justifyContent: 'center' },
    exitLoadingText: { color: c.accent, fontWeight: '600' },
  });
