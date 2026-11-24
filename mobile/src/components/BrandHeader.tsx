import { Platform, StatusBar, StyleSheet, View } from 'react-native';

import { useAppearance } from '../appearance/AppearanceProvider';
import { brand, useTheme } from '../theme';
import { BrandLogo } from './BrandLogo';

/** Banda de marca en Volvo Dark Blue con el logo blanco centrado. */
export function BrandHeader() {
  const { insets } = useAppearance();
  const t = useTheme();
  return (
    <View
      style={[
        styles.band,
        {
          backgroundColor: t.dark ? '#000000' : brand.darkBlue,
          // La banda llega hasta el borde de la pantalla; el logo queda dentro de la zona segura (muesca, esquinas curvas).
          paddingTop: Platform.OS === 'android' ? Math.max(StatusBar.currentHeight ?? 0, insets.top) : insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          borderBottomWidth: t.dark ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: t.colors.borderSubtle,
        },
      ]}
    >
      <BrandLogo size={40} background="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { alignItems: 'center' },
});
