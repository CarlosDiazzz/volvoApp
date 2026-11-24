import { Image, StyleSheet, View } from 'react-native';

import { logo } from '../theme';

const SOURCES = {
  onLight: require('../../assets/brand/volvo-logo-oscuro.png'),
  onDark: require('../../assets/brand/volvo-logo-blanco.png'),
};

interface Props {
  /** Alto del logo en dp. */
  size: number;
  /** Fondo sobre el que se dibuja: logo negro en fondo claro, blanco en fondo oscuro. */
  background: 'light' | 'dark';
}

/**
 * Volvo Iron Mark tal cual (master artwork en PNG): sin recolorear ni deformar.
 * Lleva su zona de protección (1/4 del alto) como margen propio, así nada se le acerca.
 */
export function BrandLogo({ size, background }: Props) {
  return (
    <View style={[styles.area, { padding: logo.ironMarkClearSpace(size) }]}>
      <Image
        source={background === 'dark' ? SOURCES.onDark : SOURCES.onLight}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Volvo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  area: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
