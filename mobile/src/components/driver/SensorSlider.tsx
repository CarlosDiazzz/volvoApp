import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';

import { LEVEL_TEXT, type Card } from '../../domain/driver/catalog.ts';
import type { ViewPref } from '../../domain/driver/appearance.ts';
import { REPEAT, actualOf, nearestVirtual, recenter, startVirtual } from '../../domain/driver/carousel.ts';
import { DriverIcon } from './DriverIcon';
import { SensorCard } from './SensorCard';
import { levelColorOf, useDriverColors, type DriverColors, type DriverFonts } from './driverTheme';

interface Slot {
  card: Card;
  key: string;
}

/**
 * Carrusel INFINITO de componentes: deslizando (o con las flechas) del último se pasa al primero y viceversa. La lista se repite
 * REPEAT veces y, al terminar cada deslizamiento, se vuelve en silencio al bloque central (ver `domain/driver/carousel.ts`).
 * Los puntos llevan el color del nivel de cada componente.
 */
export function SensorSlider({ cards, index, onIndexChange, now, view, fonts, showControls }: {
  cards: Card[];
  index: number;
  onIndexChange: (i: number) => void;
  now: number;
  view: ViewPref;
  fonts: DriverFonts;
  showControls: boolean;
}) {
  const c = useDriverColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const levelColor = levelColorOf(c);
  const list = useRef<FlatList<Slot>>(null);
  const [box, setBox] = useState<LayoutRectangle | null>(null);
  const n = cards.length;
  const infinite = n > 1;
  const data = useMemo<Slot[]>(
    () => (infinite ? Array.from({ length: REPEAT }, (_, r) => cards.map((card) => ({ card, key: `${r}-${card.id}` }))).flat() : cards.map((card) => ({ card, key: card.id }))),
    [cards, infinite],
  );
  // Posición virtual actual (dentro de la lista repetida). Se reinicia si cambia la cantidad de componentes.
  const virtual = useRef(infinite ? startVirtual(n, Math.min(index, n - 1)) : 0);
  const lastN = useRef(n);
  if (lastN.current !== n) {
    lastN.current = n;
    virtual.current = infinite ? startVirtual(n, Math.min(index, n - 1)) : 0;
  }

  const scrollTo = (v: number, animated: boolean) => list.current?.scrollToIndex({ index: v, animated });

  // Un cambio de componente pedido desde fuera (el botón «Ver» de un aviso): por el camino más corto.
  useEffect(() => {
    if (!box || n === 0 || actualOf(virtual.current, n) === index) return;
    const target = infinite ? nearestVirtual(virtual.current, n, index) : index;
    virtual.current = target;
    scrollTo(target, true);
  }, [index, box, n, infinite]);

  const settle = (raw: number) => {
    const v = infinite ? recenter(raw, n) : raw;
    if (v !== raw) scrollTo(v, false); // salto invisible al bloque central
    virtual.current = v;
    onIndexChange(actualOf(v, n));
  };
  const step = (d: number) => {
    const target = virtual.current + d;
    virtual.current = target;
    scrollTo(target, true);
    onIndexChange(actualOf(target, n));
  };
  const goDot = (i: number) => {
    const target = infinite ? nearestVirtual(virtual.current, n, i) : i;
    virtual.current = target;
    scrollTo(target, true);
    onIndexChange(i);
  };

  return (
    <View style={styles.root} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      {box && n > 0 && (
        <FlatList
          key={n}
          ref={list}
          horizontal
          pagingEnabled
          data={data}
          extraData={now}
          keyExtractor={(slot) => slot.key}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={virtual.current}
          getItemLayout={(_, i) => ({ length: box.width, offset: box.width * i, index: i })}
          onMomentumScrollEnd={(e) => settle(Math.round(e.nativeEvent.contentOffset.x / box.width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width: box.width, height: box.height }} accessibilityLabel={`${actualOf(i, n) + 1} de ${n}`}>
              <SensorCard card={item.card} now={now} height={box.height} view={view} fonts={fonts} />
            </View>
          )}
        />
      )}

      {/* Puntos y flechas solo con los controles a la vista: en pantalla completa no queda nada más que el número. */}
      {showControls && (
      <View style={styles.nav} pointerEvents="box-none">
        {showControls && (
          <Pressable accessibilityRole="button" accessibilityLabel="Componente anterior" onPress={() => step(-1)} style={styles.arrow}>
            <DriverIcon name="left" size={28} color={c.text} />
          </Pressable>
        )}
        <View style={styles.dots}>
          {cards.map((card, i) => {
            const current = i === actualOf(virtual.current, n) || i === index;
            return (
              <Pressable
                key={card.id}
                accessibilityRole="button"
                accessibilityLabel={`${card.title}: ${LEVEL_TEXT[card.level]}`}
                accessibilityState={{ selected: i === index }}
                onPress={() => goDot(i)}
                style={styles.dotHit}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: i === index ? levelColor[card.level] : card.level === 'warn' || card.level === 'crit' ? levelColor[card.level] : c.lineHi },
                    current && i === index && styles.dotCurrent,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        {showControls && (
          <Pressable accessibilityRole="button" accessibilityLabel="Componente siguiente" onPress={() => step(1)} style={styles.arrow}>
            <DriverIcon name="right" size={28} color={c.text} />
          </Pressable>
        )}
      </View>
      )}
    </View>
  );
}

const makeStyles = (c: DriverColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    nav: { position: 'absolute', left: 0, right: 0, bottom: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    arrow: { width: 60, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.lineHi, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
    disabled: { opacity: 0.35 },
    dots: { flexDirection: 'row' },
    // El punto se ve chico, pero el área táctil es de 36 × 44.
    dotHit: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotCurrent: { width: 26 },
  });
