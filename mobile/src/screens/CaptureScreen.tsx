import { useState } from 'react';
import { Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { InfoRow } from '../components/InfoRow';
import { layout, mono } from '../components/theme';
import type { Pairing } from '../domain/pairing';
import { useCapture } from '../hooks/useCapture';
import type { LinkState } from '../services/link';

const RATES = [0.5, 1, 2];
const LINK_LABEL: Record<LinkState, string> = {
  connecting: 'conectando…',
  ready: 'enlace seguro activo',
  down: 'sin conexión (reintentando)',
  denied: 'dispositivo no autorizado',
  blocked: 'bloqueado temporalmente',
};

export function CaptureScreen({ pairing, onUnpair }: { pairing: Pairing; onUnpair: () => void }) {
  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState(1);
  const [door, setDoor] = useState(false);
  const c = useCapture(pairing, running, rate, door);

  const magText = !c.avail.mag ? 'no disponible' : c.live.mag == null ? 'calibre primero' : `${c.live.mag.toFixed(0)} µT`;
  const lightText = c.avail.light ? `${Math.round(c.live.lux ?? 0)} lx` : Platform.OS === 'ios' ? 'iOS no expone el sensor' : 'no disponible';

  return (
    <SafeAreaView style={layout.root}>
      <ScrollView contentContainerStyle={layout.content}>
        <Text style={layout.title}>
          Nodo sensor <Text style={{ fontFamily: mono }}>{pairing.device}</Text>
        </Text>
        <Text style={layout.note}>Nodo de referencia: solo envía sensado cifrado; no tiene acceso a datos de flota.</Text>

        <Card title="Estado">
          <InfoRow label="Enlace" value={running ? LINK_LABEL[c.link] : 'detenido'} good={running && c.link === 'ready'} />
          <InfoRow label="Autobús" value={pairing.bus} />
          <InfoRow label="Muestras enviadas" value={String(c.sent)} />
          <InfoRow label="Batería" value={c.stats && c.stats.now >= 0 ? `${Math.round(c.stats.now * 100)} %` : 'n/d'} />
          <InfoRow label="Consumo medido" value={c.drainPerHour == null ? '—' : `${c.drainPerHour.toFixed(1)} %/h`} />
          {!!c.fault && <Text style={layout.error}>{c.fault}</Text>}
        </Card>

        <Card title="Sensores → variable de carrocería">
          <InfoRow label="Vibración → compresor A/C" value={c.avail.accel ? `${c.live.vib.toFixed(3)} g` : 'no disponible'} />
          <InfoRow label="Campo magnético → puerta" value={magText} />
          <InfoRow label="Luz → iluminación interior" value={lightText} />
        </Card>

        <View style={layout.rowButtons}>
          <AppButton label={running ? 'Detener' : 'Iniciar'} onPress={() => setRunning((r) => !r)} danger={running} />
          <AppButton label={c.calibrating ? 'Calibrando…' : 'Calibrar imán'} onPress={c.calibrate} disabled={!running || c.calibrating || !c.avail.mag} />
        </View>
        <View style={layout.rowButtons}>
          <AppButton label={`Puerta: ${door ? 'abierta' : 'cerrada'}`} onPress={() => setDoor((d) => !d)} disabled={!running} />
        </View>

        <Text style={layout.subtitle}>Frecuencia de envío</Text>
        <View style={layout.rowButtons}>
          {RATES.map((r) => (
            <AppButton key={r} label={`${r} Hz`} onPress={() => setRate(r)} selected={r === rate} />
          ))}
        </View>

        <AppButton label="Desemparejar este celular" onPress={onUnpair} danger />
        <Text style={layout.note}>
          Cada muestra se cifra en el celular (AES-256-GCM): el puente y el broker no pueden leerla ni alterarla. No se capturan imágenes ni audio.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
