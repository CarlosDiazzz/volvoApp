import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Origin, Vehicle } from '../../domain/driver/contract.ts';
import { useDriverColors, type DriverColors, type DriverFonts } from './driverTheme';

const LOGO_OSCURO = require('../../../assets/brand/volvo-logo-oscuro.png'); // logotipo oscuro: sobre fondo claro
const LOGO_BLANCO = require('../../../assets/brand/volvo-logo-blanco.png'); // logotipo blanco: sobre carbón

export const clock = (now: number) => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(now));

interface Props {
  vehicle: Vehicle;
  busId: string;
  origin: Origin;
  online: boolean;
  now: number;
  fonts: DriverFonts;
  onExit: () => void;
  onSettings: () => void;
  /** Solo con datos simulados: alterna el modelo para la demostración. */
  onSwitchModel?: () => void;
}

/** Barra superior discreta: marca y unidad a la izquierda; origen de los datos (siempre visible), enlace, hora, ajustes y salida. */
export function DriverStatusBar({ vehicle, busId, origin, online, now, fonts, onExit, onSettings, onSwitchModel }: Props) {
  const c = useDriverColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Image source={c.mode === 'dark' ? LOGO_BLANCO : LOGO_OSCURO} style={styles.logo} accessibilityLabel="Volvo" accessibilityIgnoresInvertColors />
        <View>
          <Text style={styles.title}>Mantenimiento de carrocería</Text>
          <Pressable
            disabled={!onSwitchModel}
            onPress={onSwitchModel}
            accessibilityRole={onSwitchModel ? 'button' : 'text'}
            accessibilityHint={onSwitchModel ? 'Cambia el modelo simulado' : undefined}
            hitSlop={8}
          >
            <Text style={styles.sub}>
              {vehicle.model} · {busId}
              {onSwitchModel ? '  ⇄' : ''}
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.origin, origin === 'simulated' ? styles.originSim : styles.originReal]}>
          {origin === 'simulated' ? 'DATOS SIMULADOS' : 'DATOS REALES'}
        </Text>
        <View style={styles.link}>
          <View style={[styles.led, { backgroundColor: online ? c.ok : c.crit }]} />
          <Text style={styles.sub}>{online ? 'En línea' : 'Sin señal'}</Text>
        </View>
        <Text style={[styles.clock, fonts.numeral]}>{clock(now)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ajustes de pantalla" onPress={onSettings} style={styles.iconButton} hitSlop={6}>
          <Text style={styles.iconText}>◐</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Salir del modo conductor" onPress={onExit} style={styles.exit}>
          <Text style={styles.exitText}>Salir</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: DriverColors) =>
  StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 22, paddingVertical: 8, backgroundColor: c.bg },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
    logo: { width: 40, height: 40 },
    title: { color: c.text, fontSize: 15, fontWeight: '500' },
    sub: { color: c.muted, fontSize: 13 },
    right: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    origin: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
    originSim: { color: c.warn, backgroundColor: c.warnSoft },
    originReal: { color: c.ok, backgroundColor: c.okSoft },
    link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    led: { width: 9, height: 9, borderRadius: 5 },
    clock: { color: c.text, fontSize: 34, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
    iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.lineHi, alignItems: 'center', justifyContent: 'center' },
    iconText: { color: c.text, fontSize: 20 },
    exit: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: c.lineHi, alignItems: 'center', justifyContent: 'center' },
    exitText: { color: c.accent, fontWeight: '600' },
  });
