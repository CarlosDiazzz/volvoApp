import { ScrollView, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { InfoRow } from '../components/InfoRow';
import type { LinkState } from '../services/link';
import { useSession } from '../session/CaptureSession';
import { useLayout } from '../theme';

const LINK_LABEL: Record<LinkState, string> = {
  connecting: 'conectando…',
  ready: 'enlace seguro activo',
  down: 'sin conexión (reintentando)',
  denied: 'dispositivo no autorizado',
  blocked: 'bloqueado temporalmente',
};

/** Inicio: solo lo esencial del envío (¿está enviando?, ¿llega todo?). Sensores y Ajustes tienen su propia vista. */
export function InicioView({ onSensors }: { onSensors: () => void }) {
  const layout = useLayout();
  const { pairing, capture: c, running, setRunning, saver } = useSession();
  const sending = running && c.link === 'ready';

  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Text style={layout.title}>Nodo sensor</Text>
      <Text style={layout.note}>
        {pairing.device} · autobús {pairing.bus}. Envía sensado cifrado; no tiene acceso a datos de flota.
      </Text>

      <Card title="Envío">
        <InfoRow label="Estado" value={!running ? 'detenido' : LINK_LABEL[c.link]} good={sending} />
        <InfoRow label="Muestras confirmadas" value={String(c.sent)} good={running && c.queued === 0} />
        <InfoRow
          label="En cola (sin confirmar)"
          value={c.queued === 0 ? 'ninguna' : running && c.link !== 'ready' ? `${c.queued} · guardadas, sin red` : `${c.queued} · poniéndose al día`}
        />
        {saver && running && <InfoRow label="Omitidas por ahorro" value={`${c.omitted} (sin cambios)`} />}
        {c.dropped > 0 && <Text style={layout.error}>{c.dropped} muestras antiguas se descartaron: el corte fue más largo que la cola.</Text>}
        {!!c.fault && <Text style={layout.error}>{c.fault}</Text>}
        <AppButton label={running ? 'Detener envío' : 'Iniciar envío'} onPress={() => setRunning((r) => !r)} danger={running} />
      </Card>

      <Card title="Teléfono">
        <InfoRow label="Batería" value={c.stats && c.stats.now >= 0 ? `${Math.round(c.stats.now * 100)} %` : 'n/d'} />
        <InfoRow
          label={`Consumo medido (${saver ? 'ahorro activo' : 'envío continuo'})`}
          value={c.drainPerHour == null ? 'midiendo… (≥ 2 min)' : `${c.drainPerHour.toFixed(1)} %/h`}
        />
      </Card>

      <View style={layout.rowButtons}>
        <AppButton label="Ver sensores" onPress={onSensors} />
      </View>
      <Text style={layout.note}>
        Cada muestra se cifra en el celular (AES-256-GCM): el puente y el broker no pueden leerla ni alterarla. No se capturan imágenes ni se envía audio.
      </Text>
    </ScrollView>
  );
}
