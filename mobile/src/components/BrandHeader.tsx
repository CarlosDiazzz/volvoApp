import { Platform, SafeAreaView, StatusBar, StyleSheet } from 'react-native';

import { brand } from '../theme';
import { BrandLogo } from './BrandLogo';

/** Banda de marca en Volvo Dark Blue con el logo blanco centrado. */
export function BrandHeader() {
  return (
    <SafeAreaView style={styles.band}>
      <BrandLogo size={40} background="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: brand.darkBlue,
    // SafeAreaView solo actúa en iOS; en Android la app dibuja bajo la barra de estado.
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
});
