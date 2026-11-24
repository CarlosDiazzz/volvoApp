import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MODE_LABEL,
  VIEW_LABEL,
  autoHint,
  type DriverPrefs,
  type ModePref,
  type ViewPref,
} from '../../domain/driver/appearance.ts';
import { useDriverColors, type DriverColors } from './driverTheme';

function Segmented<T extends string>({ label, value, options, onChange, styles }: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.segmented}>
        {(Object.keys(options) as T[]).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: k === value }}
            onPress={() => onChange(k)}
            style={[styles.option, k === value && styles.optionOn]}
          >
            <Text style={[styles.optionText, k === value && styles.optionTextOn]}>{options[k]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Ajustes de pantalla del modo conductor: aspecto (automático por hora, claro o carbón) y cuánta información mostrar. */
export function DisplaySettings({ visible, prefs, now, onChange, onClose }: {
  visible: boolean;
  prefs: DriverPrefs;
  now: number;
  onChange: (p: DriverPrefs) => void;
  onClose: () => void;
}) {
  const c = useDriverColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Modal visible={visible} transparent animationType="fade" supportedOrientations={['landscape', 'portrait']} onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar ajustes">
        <Pressable style={styles.sheet} onPress={() => undefined} accessibilityViewIsModal>
          <Text style={styles.title}>Pantalla</Text>
          <Segmented<ModePref> label="Aspecto" value={prefs.mode} options={MODE_LABEL} onChange={(mode) => onChange({ ...prefs, mode })} styles={styles} />
          {prefs.mode === 'auto' && <Text style={styles.hint}>{autoHint(new Date(now))}</Text>}
          <Segmented<ViewPref> label="Información" value={prefs.view} options={VIEW_LABEL} onChange={(view) => onChange({ ...prefs, view })} styles={styles} />
          <Text style={styles.hint}>
            {prefs.view === 'minimal' ? 'Solo el número grande y su estado, ideal para verlo de lejos.' : 'Número, medidor, estados y tendencia de cada componente.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>Listo</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: DriverColors) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    sheet: { width: '100%', maxWidth: 520, backgroundColor: c.surface, borderRadius: 28, borderWidth: 1, borderColor: c.lineHi, padding: 24, gap: 14 },
    title: { color: c.text, fontSize: 22, fontWeight: '500' },
    group: { gap: 8 },
    groupLabel: { color: c.muted, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
    segmented: { flexDirection: 'row', backgroundColor: c.surface2, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: c.line },
    option: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    optionOn: { backgroundColor: c.accent },
    optionText: { color: c.muted, fontSize: 15, fontWeight: '500' },
    optionTextOn: { color: c.onAccent },
    hint: { color: c.muted, fontSize: 14 },
    done: { minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: c.lineHi, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    doneText: { color: c.accent, fontWeight: '600', fontSize: 16 },
  });
