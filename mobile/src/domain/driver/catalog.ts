import type { Snapshot, System } from './contract.ts';
import { trendOf, type Direction, type History } from './history.ts';
import { AMPS_PER_MODULE, AMPS_PER_ZONE, SIGNALS, type ProfileId } from './simulated.ts';
/** Iconos que la vista sabe dibujar (la lógica no depende de cómo se dibujan). */
export type IconName = 'vibration' | 'snowflake' | 'bulb' | 'tank' | 'door' | 'battery' | 'bolt' | 'sensor' | 'mic' | 'gauge' | 'tilt' | 'rotate';

/**
 * Qué ve el conductor: el estado de MANTENIMIENTO de cada componente de carrocería. Cada tarjeta resume la salud
 * de un componente con un valor, una recomendación en lenguaje llano y un nivel. Lo que cambia a cada momento y no
 * dice nada del desgaste (pasajeros, puertas abiertas ahora, luz exterior, ocupación del sanitario) se omite.
 * Aquí viven los umbrales y los textos; los componentes solo dibujan.
 */

export type Level = 'ok' | 'warn' | 'crit' | 'unknown';

export const LEVEL_TEXT: Record<Level, string> = {
  ok: 'Sin acción',
  warn: 'Programar servicio',
  crit: 'Atender ya',
  unknown: 'Sin datos',
};

export interface Card {
  id: string;
  title: string;
  icon: IconName;
  value: string;
  unit?: string;
  caption: string;
  level: Level;
  /** Medidor 0–1 con sus extremos (para valores con rango). */
  gauge?: { ratio: number; min: string; max: string };
  /** Indicadores de funcionamiento (unidades, módulos, zonas). */
  segments?: { label: string; on: boolean }[];
  /** Valores secundarios pequeños. */
  details?: { label: string; value: string }[];
  /** Tendencia de los últimos minutos (para ver desgaste o degradación). */
  trend?: { points: number[]; domain: [number, number]; direction: Direction; text: string };
  /** Hora (ISO) de la lectura más reciente usada. */
  updatedAt: string | null;
  /** Texto del estado cuando no es el de mantenimiento (p. ej. «Normal / Elevado / Alto» para un sensor). */
  statusText?: string;
}

/** Texto del estado de una tarjeta. */
export const statusOf = (card: Pick<Card, 'level' | 'statusText'>): string => card.statusText ?? LEVEL_TEXT[card.level];

type CardBody = Omit<Card, 'id' | 'title' | 'icon' | 'updatedAt'>;

interface Reader {
  num(name: string): number;
  bool(name: string): boolean;
  /** Historial de la señal (puede estar vacío). */
  series(name: string): number[];
}

interface CardDef {
  id: string;
  title: string;
  icon: IconName;
  system: System;
  uses: string[];
  build(r: Reader): CardBody;
}

const fmt = (v: number, digits = 1) =>
  new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);

const gauge = (v: number, min: number, max: number, unit = '', digits = 0): NonNullable<Card['gauge']> => ({
  ratio: Math.min(1, Math.max(0, (v - min) / (max - min))),
  min: `${fmt(min, digits)}${unit}`,
  max: `${fmt(max, digits)}${unit}`,
});

const TREND_TEXT: Record<Direction, string> = {
  up: 'Tendencia: subiendo',
  down: 'Tendencia: bajando',
  flat: 'Tendencia: estable',
};
/** Tendencia dibujada sobre el rango del componente (`domain`), para que el ruido no parezca un cambio. */
const trend = (points: number[], tolerance: number, domain: [number, number]): Card['trend'] => {
  if (points.length < 2) return undefined;
  const direction = trendOf(points, tolerance);
  return { points: points.slice(-120), domain, direction, text: TREND_TEXT[direction] };
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// ---- Umbrales (exportados para las pruebas y para ajustarlos en un solo lugar) ----
export const VIBRATION = { warn: 0.3, crit: 0.45 };
export const AC = { warmCabin: 28, hotCabin: 30 };
/** Diferencia aceptable entre el consumo medido y el esperado para las luces encendidas. */
export const LIGHT_DEVIATION_A = 1.5;
export const LIGHT_OVERCURRENT_A = 15;
export const TANK = { warn: 80, crit: 92 };
/** Intervalo de servicio de puertas (aperturas). Valor de ejemplo: ajustar al plan de mantenimiento de Volvo. */
export const DOOR_SERVICE = { interval: 10_000, warnAt: 9_000 };
export const ZONE_SPREAD_C = 3;
export const BATTERY = { warnLow: 24.5, critLow: 23.5 };
export const DCDC_TEMP = { warn: 70, crit: 85 };

const compressor: CardDef = {
  id: 'compressor',
  title: 'Compresor del A/C',
  icon: 'vibration',
  system: 'hvac',
  uses: ['vibration_rms', 'compressor_on'],
  build: (r) => {
    const g = r.num('vibration_rms');
    const level: Level = g >= VIBRATION.crit ? 'crit' : g >= VIBRATION.warn ? 'warn' : 'ok';
    const caption =
      level === 'crit'
        ? 'Vibración excesiva: revisar el compresor cuanto antes'
        : level === 'warn'
          ? 'Vibración alta: posible desgaste, programe revisión'
          : 'Vibración normal';
    return {
      value: fmt(g, 2),
      unit: 'g',
      caption,
      level,
      gauge: gauge(g, 0, 0.5, '', 1),
      details: [{ label: 'Compresor', value: r.bool('compressor_on') ? 'Encendido' : 'Apagado' }],
      trend: trend(r.series('vibration_rms'), 0.02, [0, 0.5]),
    };
  },
};

const acPerformance: CardDef = {
  id: 'ac_performance',
  title: 'Rendimiento del A/C',
  icon: 'snowflake',
  system: 'hvac',
  uses: ['compressor_on', 'fan_on', 'cabin_temp'],
  build: (r) => {
    const on = r.bool('compressor_on');
    const fan = r.bool('fan_on');
    const t = r.num('cabin_temp');
    let value = 'Correcto';
    let caption = 'Enfría correctamente';
    let level: Level = 'ok';
    if (!on) {
      value = 'Sin enfriar';
      level = t >= AC.hotCabin ? 'crit' : 'warn';
      caption = 'El compresor no está funcionando: reportar a mantenimiento';
    } else if (t >= AC.warmCabin) {
      value = 'Bajo';
      level = 'warn';
      caption = 'Enfría poco: revisar gas refrigerante y filtros';
    } else if (!fan) {
      value = 'Bajo';
      level = 'warn';
      caption = 'Ventilador detenido: revisar el motor del ventilador';
    }
    return {
      value,
      caption,
      level,
      segments: [
        { label: 'Compresor', on },
        { label: 'Ventilador', on: fan },
      ],
      details: [{ label: 'Cabina', value: `${fmt(t)} °C` }],
      trend: trend(r.series('cabin_temp'), 0.5, [15, 35]),
    };
  },
};

/** Compara el consumo medido con el esperado para las luces encendidas. */
function lightingBody(current: number, expected: number, on: number, total: number, label: string): CardBody {
  const deviation = current - expected;
  let level: Level = 'ok';
  let caption = 'Consumo correcto para las luces encendidas';
  if (current >= LIGHT_OVERCURRENT_A) {
    level = 'crit';
    caption = 'Sobrecorriente: revisar el circuito cuanto antes';
  } else if (deviation <= -LIGHT_DEVIATION_A) {
    level = 'warn';
    caption = 'Consumo bajo: posible lámpara fundida';
  } else if (deviation >= LIGHT_DEVIATION_A) {
    level = 'warn';
    caption = 'Consumo alto: posible corto en el circuito';
  }
  return {
    value: fmt(current),
    unit: 'A',
    caption,
    level,
    gauge: gauge(current, 0, 20),
    details: [
      { label: label, value: `${on} de ${total}` },
      { label: 'Esperado', value: `${fmt(expected)} A` },
    ],
  };
}

const lightingCircuit: CardDef = {
  id: 'lighting_circuit',
  title: 'Circuito de iluminación',
  icon: 'bulb',
  system: 'lighting',
  uses: ['current', 'zone1_on', 'zone2_on', 'zone3_on', 'zone4_on'],
  build: (r) => {
    const on = range(4).filter((z) => r.bool(`zone${z}_on`)).length;
    return {
      ...lightingBody(r.num('current'), on * AMPS_PER_ZONE, on, 4, 'Zonas encendidas'),
      trend: trend(r.series('current'), 0.5, [0, 20]),
    };
  },
};

const lightingModules: CardDef = {
  id: 'lighting_modules',
  title: 'Circuito de iluminación',
  icon: 'bulb',
  system: 'lighting',
  uses: ['current', 'module1_on', 'module2_on', 'module3_on'],
  build: (r) => {
    const on = range(3).filter((m) => r.bool(`module${m}_on`)).length;
    return {
      ...lightingBody(r.num('current'), on * AMPS_PER_MODULE, on, 3, 'Módulos encendidos'),
      trend: trend(r.series('current'), 0.5, [0, 20]),
    };
  },
};

const tank: CardDef = {
  id: 'tank',
  title: 'Tanque del sanitario',
  icon: 'tank',
  system: 'restroom',
  uses: ['tank_level'],
  build: (r) => {
    const p = r.num('tank_level');
    const level: Level = p >= TANK.crit ? 'crit' : p >= TANK.warn ? 'warn' : 'ok';
    const caption =
      level === 'crit' ? 'Tanque lleno: vaciar en cuanto pueda' : level === 'warn' ? 'Vaciar en la próxima terminal' : 'Nivel adecuado';
    return {
      value: fmt(p, 0),
      unit: '%',
      caption,
      level,
      gauge: gauge(p, 0, 100, '%'),
      trend: trend(r.series('tank_level'), 0.5, [0, 100]),
    };
  },
};

const doorService: CardDef = {
  id: 'door_service',
  title: 'Servicio de puertas',
  icon: 'door',
  system: 'doors',
  uses: ['door_cycles'],
  build: (r) => {
    const cycles = r.num('door_cycles');
    const left = DOOR_SERVICE.interval - cycles;
    const level: Level = left <= 0 ? 'crit' : cycles >= DOOR_SERVICE.warnAt ? 'warn' : 'ok';
    return {
      value: left <= 0 ? 'Vencido' : fmt(left, 0),
      unit: left <= 0 ? undefined : 'ciclos',
      caption:
        level === 'crit'
          ? 'Servicio de puertas vencido: agendar de inmediato'
          : level === 'warn'
            ? 'Servicio próximo: agéndelo en la terminal'
            : 'Ciclos restantes para el servicio',
      level,
      gauge: {
        ...gauge(cycles, 0, DOOR_SERVICE.interval),
        min: '0',
        max: fmt(DOOR_SERVICE.interval, 0),
      },
      details: [{ label: 'Aperturas acumuladas', value: fmt(cycles, 0) }],
    };
  },
};

const climateUnits: CardDef = {
  id: 'climate_units',
  title: 'Unidades de clima',
  icon: 'snowflake',
  system: 'hvac',
  uses: ['unit1_on', 'unit2_on', 'unit3_on', 'zone1_temp', 'zone2_temp', 'zone3_temp'],
  build: (r) => {
    const units = range(3).map((u) => ({ label: `Unidad ${u}`, on: r.bool(`unit${u}_on`) }));
    const temps = range(3).map((z) => r.num(`zone${z}_temp`));
    const off = units.filter((u) => !u.on);
    const hottest = temps.indexOf(Math.max(...temps));
    const spread = Math.max(...temps) - Math.min(...temps);
    let level: Level = 'ok';
    let caption = 'Las 3 unidades funcionan';
    if (off.length > 0) {
      level = 'warn';
      caption = `${off.map((u) => u.label).join(' y ')} sin funcionar: reportar a mantenimiento`;
    } else if (spread >= ZONE_SPREAD_C) {
      level = 'warn';
      caption = `El módulo ${hottest + 1} no alcanza la temperatura: revisar su unidad`;
    }
    return {
      value: `${units.length - off.length} de 3`,
      caption,
      level,
      segments: units,
      details: temps.map((t, i) => ({ label: `Módulo ${i + 1}`, value: `${fmt(t)} °C` })),
    };
  },
};

const battery: CardDef = {
  id: 'battery_24v',
  title: 'Batería de 24 V',
  icon: 'battery',
  system: 'electrical',
  uses: ['battery_24v'],
  build: (r) => {
    const v = r.num('battery_24v');
    const level: Level = v <= BATTERY.critLow ? 'crit' : v <= BATTERY.warnLow ? 'warn' : 'ok';
    return {
      value: fmt(v),
      unit: 'V',
      caption: level === 'ok' ? 'Carga correcta' : 'Voltaje bajo: revisar convertidor DC/DC y baterías',
      level,
      gauge: gauge(v, 22, 29),
      trend: trend(r.series('battery_24v'), 0.15, [22, 29]),
    };
  },
};

const dcdc: CardDef = {
  id: 'dcdc',
  title: 'Convertidor DC/DC',
  icon: 'bolt',
  system: 'electrical',
  uses: ['dcdc_on', 'dcdc_temp', 'dcdc_current'],
  build: (r) => {
    const on = r.bool('dcdc_on');
    const t = r.num('dcdc_temp');
    if (!on) {
      return {
        value: 'Apagado',
        caption: 'Convertidor sin funcionar: la batería se está descargando',
        level: 'crit',
        details: [{ label: 'Temperatura', value: `${fmt(t, 0)} °C` }],
      };
    }
    const level: Level = t >= DCDC_TEMP.crit ? 'crit' : t >= DCDC_TEMP.warn ? 'warn' : 'ok';
    return {
      value: fmt(t, 0),
      unit: '°C',
      caption: level === 'ok' ? 'Temperatura de operación normal' : 'Sobrecalentamiento: revisar ventilación',
      level,
      gauge: gauge(t, 20, 90, '°'),
      details: [{ label: 'Corriente', value: `${fmt(r.num('dcdc_current'), 0)} A` }],
      trend: trend(r.series('dcdc_temp'), 1, [20, 90]),
    };
  },
};

/** Orden de las tarjetas en el carrusel, por modelo. */
export const CATALOG: Record<ProfileId, CardDef[]> = {
  '9800-foraneo': [compressor, acPerformance, lightingCircuit, tank],
  '7800e-biarticulado': [doorService, climateUnits, battery, dcdc, lightingModules],
};

const SYSTEM_LABEL: Record<System, string> = {
  hvac: 'clima',
  lighting: 'iluminación',
  restroom: 'sanitario',
  doors: 'puertas',
  occupancy: 'ocupación',
  electrical: 'sistema eléctrico',
};

/** Salud de los propios sensores: un sensor que no reporta también es mantenimiento. */
export function sensorHealthCard(profile: ProfileId, snapshot: Snapshot): Card {
  const defs = SIGNALS[profile];
  const missing = defs.filter((d) => {
    const s = snapshot.signals[`${d.system}/${d.name}`];
    return !s || s.quality !== 'ok' || s.value === null;
  });
  const systems = [...new Set(missing.map((d) => SYSTEM_LABEL[d.system]))];
  const reporting = defs.length - missing.length;
  return {
    id: 'sensors',
    title: 'Sensores de carrocería',
    icon: 'sensor',
    value: `${reporting} de ${defs.length}`,
    caption: missing.length === 0 ? 'Todos los sensores reportan' : `Sin datos de ${systems.join(', ')}: revisar sensores y cableado`,
    level: missing.length === 0 ? 'ok' : 'warn',
    gauge: gauge(reporting, 0, defs.length),
    updatedAt: new Date(snapshot.receivedAt).toISOString(),
  };
}

class Missing extends Error {}

/** Construye las tarjetas de la instantánea. Si falta una lectura válida, la tarjeta dice «Sin datos». */
export function buildCards(profile: ProfileId, snapshot: Snapshot, history: History = {}): Card[] {
  const cards = CATALOG[profile].map((d): Card => {
    const get = (name: string) => {
      const s = snapshot.signals[`${d.system}/${name}`];
      if (!s || s.quality !== 'ok' || s.value === null) throw new Missing(name);
      return s;
    };
    const reader: Reader = {
      num: (name) => {
        const v = get(name).value;
        if (typeof v !== 'number') throw new Missing(name);
        return v;
      },
      bool: (name) => {
        const v = get(name).value;
        if (typeof v !== 'boolean') throw new Missing(name);
        return v;
      },
      series: (name) => history[`${d.system}/${name}`] ?? [],
    };
    const base = { id: d.id, title: d.title, icon: d.icon };
    try {
      const body = d.build(reader);
      const times = d.uses.map((n) => get(n).ts).sort();
      return { ...base, ...body, updatedAt: times.at(-1) ?? null };
    } catch (e) {
      if (!(e instanceof Missing)) throw e;
      return {
        ...base,
        value: '—',
        caption: 'El sensor no está enviando datos',
        level: 'unknown',
        updatedAt: null,
      };
    }
  });
  return [...cards, sensorHealthCard(profile, snapshot)];
}

const SEVERITY: Record<Level, number> = { crit: 3, warn: 2, unknown: 1, ok: 0 };

/** Tarjetas que requieren mantenimiento, de la más grave a la menos (sin contar las que no tienen datos). */
export const alertsOf = (cards: Card[]): Card[] =>
  cards.filter((c) => c.level === 'warn' || c.level === 'crit').sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]);
