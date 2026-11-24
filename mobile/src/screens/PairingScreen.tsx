import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppearance } from '../appearance/AppearanceProvider';
import { AppButton } from '../components/AppButton';
import { BrandLogo } from '../components/BrandLogo';
import { useLayout, useTheme, useThemedStyles, type Theme } from '../theme';

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
  const theme = useTheme();
  const layout = useLayout();
  const { insets } = useAppearance();
  const padding = {
    paddingTop: Math.max(24, insets.top + 8),
    paddingBottom: Math.max(24, insets.bottom + 8),
    paddingLeft: Math.max(24, insets.left + 8),
    paddingRight: Math.max(24, insets.right + 8),
  };
  const styles = useThemedStyles(makeStyles);

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
    <View style={layout.root}>
      <ScrollView contentContainerStyle={[layout.content, padding]}>
        <View style={styles.hero}>
          <BrandLogo size={96} background={theme.dark ? 'dark' : 'light'} />
        </View>
        <Text style={layout.title}>Nodo sensor de carrocería</Text>
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

        <Text style={layout.link} onPress={() => setManual((v) => !v)} accessibilityRole="button">
          {manual ? 'Ocultar enlace manual' : '¿No puede escanear? Pegar enlace'}
        </Text>
        {manual && (
          <>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="https://host:8443/#d=…&b=…&k=…&n=…&t=…"
              placeholderTextColor={theme.colors.textSubtlest}
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
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    hero: { paddingVertical: t.space[6] },
    input: {
      ...t.type.body,
      backgroundColor: t.colors.bg,
      borderColor: t.colors.border,
      borderWidth: 1,
      borderRadius: t.radius.md,
      padding: t.space[5],
      minHeight: 80,
      color: t.colors.text,
    },
    camera: { height: 320, borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.brand.black },
  });
