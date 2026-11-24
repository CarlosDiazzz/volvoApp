import { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { BrandHeader } from '../components/BrandHeader';
import { TabBar } from '../components/TabBar';
import type { TabId } from '../domain/sensorInfo';
import { useLayout } from '../theme';
import { AjustesView } from './AjustesView';
import { InicioView } from './InicioView';
import { SensoresView } from './SensoresView';

/** Marco de la app emparejada: cabecera de marca, la vista activa y la barra inferior. Cada vista es independiente. */
export function HomeShell({ onDriverMode, onUnpair, hidden }: { onDriverMode: () => void; onUnpair: () => void; hidden: boolean }) {
  const layout = useLayout();
  const [tab, setTab] = useState<TabId>('inicio');
  return (
    <View style={layout.root}>
      <BrandHeader />
      <SafeAreaView style={styles.body}>
        {tab === 'inicio' && <InicioView onSensors={() => setTab('sensores')} />}
        {/* Los sensores solo se suscriben mientras su vista está a la vista (y el modo conductor cerrado). */}
        {tab === 'sensores' && <SensoresView active={!hidden} />}
        {tab === 'ajustes' && <AjustesView onUnpair={onUnpair} />}
      </SafeAreaView>
      <TabBar tab={tab} onTab={setTab} onDriverMode={onDriverMode} />
    </View>
  );
}

const styles = StyleSheet.create({ body: { flex: 1 } });
