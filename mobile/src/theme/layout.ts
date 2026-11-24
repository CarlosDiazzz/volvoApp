import { StyleSheet } from 'react-native';

import { useThemedStyles, type Theme } from './ThemeProvider';

const makeLayout = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bgBase },
    content: { padding: t.space[6], gap: t.space[5] },
    rowButtons: { flexDirection: 'row', gap: t.space[4], flexWrap: 'wrap' },
    title: { ...t.type.h3, color: t.colors.text },
    subtitle: { ...t.type.subtitle1, color: t.colors.text, marginTop: t.space[2] },
    note: { ...t.type.caption1, color: t.colors.textSubtle },
    link: { ...t.type.caption1, color: t.colors.accent, textDecorationLine: 'underline' },
    error: { ...t.type.caption1, color: t.colors.error },
  });

/** Estilos compartidos por las pantallas. */
export const useLayout = () => useThemedStyles(makeLayout);
