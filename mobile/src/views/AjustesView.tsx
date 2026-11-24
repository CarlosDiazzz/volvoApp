import { Alert, ScrollView, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { InfoRow } from '../components/InfoRow';
import { MODE_LABEL, VIEW_LABEL, type ModePref, type ViewPref } from '../domain/driver/appearance.ts';
import { useDriverPrefs } from '../hooks/useDriverPrefs';
import { RATES, useSession } from '../session/CaptureSession';
import { useLayout } from '../theme';

/** Ajustes de la app: envío, aspecto del modo conductor, emparejamiento y privacidad. Nada de sensores aquí (tienen su vista). */
export function AjustesView({ onUnpair }: { onUnpair: () => void }) {
  const layout = useLayout();
  const { pairing, rate, setRate, saver, setSaver } = useSession();
  const [prefs, setPrefs] = useDriverPrefs();

  const confirmUnpair = () =>
    Alert.alert(
      'Desemparejar este celular',
      'Se borrarán su clave y su contador del teléfono. Para volver a enviar datos habrá que emparejarlo de nuevo con un código nuevo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desemparejar', style: 'destructive', onPress: onUnpair },
      ],
    );

  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Text style={layout.title}>Ajustes</Text>

      <Card title="Envío de datos">
        <Text style={layout.subtitle}>Frecuencia</Text>
        <View style={layout.rowButtons}>
          {RATES.map((r) => (
            <AppButton key={r} label={`${r} Hz`} onPress={() => setRate(r)} selected={r === rate} />
          ))}
        </View>
        <AppButton label={`Ahorro de energía: ${saver ? 'activado' : 'apagado'}`} onPress={() => setSaver((s) => !s)} selected={saver} />
        <Text style={layout.note}>
          Con el ahorro activado solo se envía cuando algo cambia o cada 4 s como latido. Para comparar el consumo, deja cada modo al menos 10 min y mira
          «Consumo medido» en Inicio.
        </Text>
      </Card>

      <Card title="Modo conductor">
        <Text style={layout.subtitle}>Aspecto</Text>
        <View style={layout.rowButtons}>
          {(Object.keys(MODE_LABEL) as ModePref[]).map((m) => (
            <AppButton key={m} label={MODE_LABEL[m]} onPress={() => setPrefs({ ...prefs, mode: m })} selected={prefs.mode === m} />
          ))}
        </View>
        <Text style={layout.subtitle}>Información</Text>
        <View style={layout.rowButtons}>
          {(Object.keys(VIEW_LABEL) as ViewPref[]).map((v) => (
            <AppButton key={v} label={VIEW_LABEL[v]} onPress={() => setPrefs({ ...prefs, view: v })} selected={prefs.view === v} />
          ))}
        </View>
        <Text style={layout.note}>También se cambian dentro del modo conductor (un toque, ◐ y ⚙). Automático: claro de 7:00 a 19:00 y carbón el resto.</Text>
      </Card>

      <Card title="Emparejamiento">
        <InfoRow label="Dispositivo" value={pairing.device} />
        <InfoRow label="Autobús" value={pairing.bus} />
        <AppButton label="Desemparejar este celular" onPress={confirmUnpair} danger />
      </Card>

      <Card title="Privacidad">
        <Text style={layout.note}>
          Se envían como máximo cinco valores numéricos (luz, vibración, campo magnético, puerta y batería), cifrados en el teléfono con AES-256-GCM. No se envían
          imágenes, audio ni ubicación. El micrófono solo mide un nivel de ruido en la pantalla y no se transmite.
        </Text>
      </Card>
    </ScrollView>
  );
}
