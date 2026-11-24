import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { buildSensorRows, STATE_TEXT } from '../domain/sensorInfo';
import { usePhoneSensors } from '../hooks/usePhoneSensors';
import { useSession } from '../session/CaptureSession';
import { useLayout, useThemedStyles, type Theme } from '../theme';

/** Sensores: qué mide el teléfono ahora, para qué sirve y si viaja al sistema. El micrófono se activa a mano. */
export function SensoresView({ active }: { active: boolean }) {
  const layout = useLayout();
  const styles = useThemedStyles(makeStyles);
  const { capture: c, running, door, setDoor } = useSession();
  const [micOn, setMicOn] = useState(false);
  const { avail, readings } = usePhoneSensors(active, micOn);
  const rows = buildSensorRows(readings, avail, micOn);

  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Text style={layout.title}>Sensores</Text>
      <Text style={layout.note}>Lo que mide este teléfono en este momento. «Se envía» significa que el valor viaja cifrado al sistema; los demás solo se ven aquí y en el modo conductor.</Text>

      <Card title="En vivo">
        {rows.map((r) => (
          <View key={r.id} style={styles.row} accessibilityLabel={`${r.name}: ${r.value}. ${STATE_TEXT[r.state]}`}>
            <View style={styles.rowHead}>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={[styles.value, r.state !== 'ok' && styles.valueOff]}>{r.value}</Text>
            </View>
            <Text style={layout.note}>{r.purpose}</Text>
            <View style={styles.tags}>
              <Text style={[styles.tag, r.state === 'ok' ? styles.tagOk : styles.tagOff]}>{STATE_TEXT[r.state]}</Text>
              <Text style={[styles.tag, r.sent ? styles.tagSent : styles.tagLocal]}>{r.sent ? 'Se envía' : 'Solo en el teléfono'}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card title="Controles">
        <AppButton label={`Micrófono: ${micOn ? 'activado' : 'apagado'}`} onPress={() => setMicOn((v) => !v)} selected={micOn} />
        <Text style={layout.note}>El micrófono solo calcula un nivel de ruido (≈ dB, sin calibrar). El audio no se graba ni se envía.</Text>
        <AppButton label={c.calibrating ? 'Calibrando…' : 'Calibrar imán (puerta)'} onPress={c.calibrate} disabled={!running || c.calibrating || !c.avail.mag} />
        {!running && <Text style={layout.note}>Para calibrar el imán, inicia el envío en Inicio.</Text>}
        <AppButton label={`Puerta manual: ${door ? 'abierta' : 'cerrada'}`} onPress={() => setDoor((d) => !d)} disabled={!running} />
      </Card>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { gap: t.space[2], paddingBottom: t.space[4], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.borderSubtle },
    rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: t.space[4] },
    name: { ...t.type.subtitle2, color: t.colors.text, flexShrink: 1 },
    value: { ...t.type.subtitle1, color: t.colors.text, flexShrink: 1, textAlign: 'right' },
    valueOff: { color: t.colors.textSubtle },
    tags: { flexDirection: 'row', gap: t.space[3], flexWrap: 'wrap' },
    tag: { ...t.type.caption1, paddingHorizontal: t.space[4], paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
    tagOk: { backgroundColor: t.colors.bgVariant, color: t.colors.success },
    tagOff: { backgroundColor: t.colors.bgVariant, color: t.colors.textSubtle },
    tagSent: { backgroundColor: t.colors.primary, color: t.colors.onPrimary },
    tagLocal: { backgroundColor: t.colors.bgVariant, color: t.colors.textSubtle },
  });
