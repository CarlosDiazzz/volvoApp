import { useState } from 'react';
import { Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { BrandHeader } from '../components/BrandHeader';
import { Card } from '../components/Card';
import { InfoRow } from '../components/InfoRow';
import { useLayout } from '../theme';
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

export function CaptureScreen({ pairing, onUnpair, onDriverMode }: { pairing: Pairing; onUnpair: () => void; onDriverMode: () => void }) {
  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState(1);
  const [door, setDoor] = useState(false);
  const [saver, setSaver] = useState(false);
  const c = useCapture(pairing, running, rate, door, saver);
  const layout = useLayout();

  const magText = !c.avail.mag ? 'no disponible' : c.live.mag == null ? 'calibre primero' : `${c.live.mag.toFixed(0)} µT`;
  const lightText = c.avail.light ? `${Math.round(c.live.lux ?? 0)} lx` : Platform.OS === 'ios' ? 'iOS no expone el sensor' : 'no disponible';

  return (
    <View style={layout.root}>
      <BrandHeader />
      <SafeAreaView style={layout.root}>
        <ScrollView contentContainerStyle={layout.content}>
          <Text style={layout.title}>Nodo sensor {pairing.device}</Text>
          <Text style={layout.note}>Nodo de referencia: solo envía sensado cifrado; no tiene acceso a datos de flota.</Text>

          {/* Arriba y siempre visible: con el nodo emparejado el modo conductor debe seguir a un toque, sin desplazarse. */}
          <AppButton label="Abrir modo conductor" onPress={onDriverMode} />

          <Card title="Estado">
            <InfoRow label="Enlace" value={running ? LINK_LABEL[c.link] : 'detenido'} good={running && c.link === 'ready'} />
            <InfoRow label="Autobús" value={pairing.bus} />
            <InfoRow label="Muestras confirmadas" value={String(c.sent)} good={running && c.queued === 0} />
            <InfoRow
              label="En cola (sin confirmar)"
              value={c.queued === 0 ? 'ninguna' : running && c.link !== 'ready' ? `${c.queued} · guardadas, sin red` : `${c.queued} · poniéndose al día`}
            />
            {c.dropped > 0 && <Text style={layout.error}>{c.dropped} muestras antiguas se descartaron: el corte fue más largo que la cola.</Text>}
            <InfoRow label="Batería" value={c.stats && c.stats.now >= 0 ? `${Math.round(c.stats.now * 100)} %` : 'n/d'} />
            <InfoRow
              label={`Consumo medido (${saver ? 'ahorro activo' : 'envío continuo'})`}
              value={c.drainPerHour == null ? 'midiendo… (≥ 2 min)' : `${c.drainPerHour.toFixed(1)} %/h`}
            />
            {saver && <InfoRow label="Omitidas por ahorro" value={`${c.omitted} (sin cambios)`} />}
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

          <View style={layout.rowButtons}>
            <AppButton
              label={`Ahorro de energía: ${saver ? 'activado' : 'apagado'}`}
              onPress={() => setSaver((s) => !s)}
              selected={saver}
            />
          </View>
          <Text style={layout.note}>
            Con el ahorro activado solo se envía cuando algo cambia o cada 4 s como latido. Para comparar el consumo, deja cada modo al menos
            10 min con la pantalla igual y mira «Consumo medido»; el contador se reinicia al cambiar de modo si detienes e inicias la captura.
          </Text>

          <Text style={layout.subtitle}>Frecuencia de envío</Text>
          <View style={layout.rowButtons}>
            {RATES.map((r) => (
              <AppButton key={r} label={`${r} Hz`} onPress={() => setRate(r)} selected={r === rate} />
            ))}
          </View>

          <AppButton label="Desemparejar este celular" onPress={onUnpair} danger />
          <Text style={layout.note}>
            Cada muestra se cifra en el celular (AES-256-GCM): el puente y el broker no pueden leerla ni alterarla. No se capturan imágenes. El micrófono solo se usa en el modo conductor para medir un nivel de ruido: el audio no se graba ni se envía.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
