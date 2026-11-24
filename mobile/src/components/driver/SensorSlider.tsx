import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';

import { LEVEL_TEXT, type Card } from '../../domain/driver/catalog.ts';
import { DriverIcon } from './DriverIcon';
import { SensorCard } from './SensorCard';
import type { ViewPref } from '../../domain/driver/appearance.ts';
import { levelColorOf, useDriverColors, type DriverColors, type DriverFonts } from './driverTheme';

/**
 * Carrusel de componentes: una tarjeta por página. Se cambia deslizando, con las flechas grandes o con los puntos,
 * que llevan el color del nivel de cada componente (el conductor ve de un vistazo cuál requiere atención).
 */
export function SensorSlider({ cards, index, onIndexChange, now, view, fonts, showControls }: { cards: Card[]; index: number; onIndexChange: (i: number) => void; now: number; view: ViewPref; fonts: DriverFonts; showControls: boolean }) {
  const c = useDriverColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const levelColor = levelColorOf(c);
  const list = useRef<FlatList<Card>>(null);
  const [box, setBox] = useState<LayoutRectangle | null>(null);
  const last = cards.length - 1;
  const go = (i: number) => onIndexChange(Math.min(last, Math.max(0, i)));

  useEffect(() => {
    if (box && cards.length > 0) list.current?.scrollToIndex({ index, animated: true });
  }, [index, box, cards.length]);

  return (
    <View style={styles.root} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      {box && (
        <FlatList
          ref={list}
          horizontal
          pagingEnabled
          data={cards}
          extraData={now}
          keyExtractor={(card) => card.id}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: box.width, offset: box.width * i, index: i })}
          onMomentumScrollEnd={(e) => go(Math.round(e.nativeEvent.contentOffset.x / box.width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width: box.width, height: box.height }} accessibilityLabel={`${i + 1} de ${cards.length}`}>
              <SensorCard card={item} now={now} height={box.height} view={view} fonts={fonts} />
            </View>
          )}
        />
      )}

      {/* Puntos siempre visibles (color = nivel de cada componente); las flechas solo con los controles a la vista. */}
      <View style={styles.nav} pointerEvents="box-none">
        {showControls && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Componente anterior"
            accessibilityState={{ disabled: index === 0 }}
            disabled={index === 0}
            onPress={() => go(index - 1)}
            style={[styles.arrow, index === 0 && styles.disabled]}
          >
            <DriverIcon name="left" size={28} color={c.text} />
          </Pressable>
        )}
        <View style={styles.dots}>
          {cards.map((card, i) => (
            <Pressable
              key={card.id}
              accessibilityRole="button"
              accessibilityLabel={`${card.title}: ${LEVEL_TEXT[card.level]}`}
              accessibilityState={{ selected: i === index }}
              onPress={() => go(i)}
              style={styles.dotHit}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? levelColor[card.level] : card.level === 'warn' || card.level === 'crit' ? levelColor[card.level] : c.lineHi },
                  i === index && styles.dotCurrent,
                ]}
              />
            </Pressable>
          ))}
        </View>
        {showControls && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Componente siguiente"
            accessibilityState={{ disabled: index === last }}
            disabled={index === last}
            onPress={() => go(index + 1)}
            style={[styles.arrow, index === last && styles.disabled]}
          >
            <DriverIcon name="right" size={28} color={c.text} />
          </Pressable>
        )}
      </View>
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
