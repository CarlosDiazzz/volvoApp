import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { AppButton } from '../components/AppButton';
import { layout } from '../components/theme';

export function PairingScreen({ error, onPair }: { error: string; onPair: (link: string) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <SafeAreaView style={layout.root}>
      <ScrollView contentContainerStyle={layout.content}>
        <Text style={layout.title}>Nodo sensor Volvo</Text>
        <Text style={layout.note}>Pegue el enlace de emparejamiento que genera el administrador (`make phone`).</Text>
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
        {!!error && <Text style={layout.error}>{error}</Text>}
        <AppButton label="Emparejar" onPress={() => onPair(draft)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 10, minHeight: 80, color: '#000' },
});
