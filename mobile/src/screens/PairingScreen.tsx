import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { layout } from '../components/theme';

interface Props {
  error: string;
  busy: boolean;
  onPair: (link: string) => void;
  onScan: (qrText: string) => void;
  onDriverMode: () => void;
}

export function PairingScreen({ error, busy, onPair, onScan, onDriverMode }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState('');
  const handled = useRef(false);

  const startScan = async () => {
    if (!permission?.granted && !(await requestPermission()).granted) return;
    handled.current = false;
    setScanning(true);
  };

  const onCode = (data: string) => {
    if (handled.current) return; // el mismo QR se reporta varias veces: el código es de un solo uso
    handled.current = true;
    setScanning(false);
    onScan(data);
  };

  return (
    <SafeAreaView style={layout.root}>
      <ScrollView contentContainerStyle={layout.content}>
        <Text style={layout.title}>Nodo sensor Volvo</Text>
        <Text style={layout.note}>
          En el tablero, abra «Emparejar celular», elija el autobús y escanee el código QR con esta app.
        </Text>

        {scanning ? (
          <View style={styles.camera}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => onCode(data)}
            />
          </View>
        ) : null}

        {!!error && <Text style={layout.error}>{error}</Text>}
        {busy && <Text style={layout.note}>Emparejando…</Text>}
        {scanning ? (
          <AppButton label="Cancelar" onPress={() => setScanning(false)} />
        ) : (
          <AppButton label={busy ? 'Emparejando…' : 'Escanear QR'} onPress={() => void startScan()} />
        )}
        {permission && !permission.granted && !permission.canAskAgain && (
          <Text style={layout.note}>
            La cámara está desactivada para esta app. Actívela en Ajustes, o pegue el enlace abajo.
          </Text>
        )}

        <Text style={layout.note} onPress={() => setManual((v) => !v)} accessibilityRole="button">
          {manual ? 'Ocultar enlace manual' : '¿No puede escanear? Pegar enlace'}
        </Text>
        {manual && (
          <>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="https://host:8443/#d=…&b=…&k=…&n=…&t=…"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              accessibilityLabel="Enlace de emparejamiento"
            />
            <AppButton label="Emparejar con enlace" onPress={() => onPair(draft)} />
          </>
        )}

        <Text style={layout.subtitle}>Modo conductor</Text>
        <Text style={layout.note}>Estado de mantenimiento de la carrocería para la pantalla del autobús (CarPlay). Por ahora con datos simulados.</Text>
        <AppButton label="Abrir modo conductor" onPress={onDriverMode} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 10, minHeight: 80, color: '#000' },
  camera: { height: 320, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
});
