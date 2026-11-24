import { Platform, StyleSheet } from 'react-native';

export const colors = {
  bg: '#0b1f3a', card: '#12305a', text: '#ffffff', muted: '#9fb4d6', label: '#cfe0ff',
  primary: '#1f6feb', danger: '#b42318', ok: '#7dffb0', selected: '#0a8f5a', error: '#ff8a8a',
};

export const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export const layout = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  rowButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.label, fontSize: 15, fontWeight: '600', marginTop: 4 },
  note: { color: colors.muted, fontSize: 13 },
  error: { color: colors.error },
});
