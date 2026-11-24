import type { Readings } from './sample.ts';

/** Cuánto debe cambiar cada valor (respecto de lo último ENVIADO) para que valga la pena enviar otra muestra. */
export interface DeadbandConfig {
  vib: number; // g
  mag: number; // µT
  lightPct: number; // puntos porcentuales
  /** Silencio máximo: aunque nada cambie se envía una muestra «latido» para que el sistema sepa que el nodo sigue vivo. */
  heartbeatMs: number;
}

/**
 * El latido (4 s) es menor que la ventana de frescura del modo híbrido (6 s) y que el hueco mínimo que cuenta la confiabilidad (5 s):
 * ahorrar energía no debe hacer ver «sin comunicación» a un nodo que está bien.
 */
export const DEFAULT_DEADBAND: DeadbandConfig = { vib: 0.02, mag: 15, lightPct: 5, heartbeatMs: 4000 };

/**
 * Banda muerta: decide si una lectura merece enviarse. Compara con la última muestra enviada, no con la última leída, para que un
 * cambio lento y sostenido acabe superando el umbral. Un cambio de la puerta se envía siempre.
 */
export class Deadband {
  private readonly cfg: DeadbandConfig;
  private last: Readings | null = null;
  private lastSentAt = 0;
  private skippedCount = 0;

  constructor(cfg: DeadbandConfig = DEFAULT_DEADBAND) {
    this.cfg = cfg;
  }

  /** Muestras omitidas desde que empezó. */
  get skipped(): number {
    return this.skippedCount;
  }

  shouldSend(now: number, r: Readings): boolean {
    if (this.last === null || now - this.lastSentAt >= this.cfg.heartbeatMs || this.changed(this.last, r)) {
      this.last = { ...r };
      this.lastSentAt = now;
      return true;
    }
    this.skippedCount++;
    return false;
  }

  reset(): void {
    this.last = null;
    this.lastSentAt = 0;
    this.skippedCount = 0;
  }

  private changed(a: Readings, b: Readings): boolean {
    return (
      a.door !== b.door ||
      differs(a.vib, b.vib, this.cfg.vib) ||
      differs(a.mag, b.mag, this.cfg.mag) ||
      differs(a.light, b.light, this.cfg.lightPct)
    );
  }
}

/** Un sensor que aparece o desaparece cuenta como cambio; si ambos faltan, no. */
function differs(a: number | null | undefined, b: number | null | undefined, band: number): boolean {
  if (a == null || b == null) return (a == null) !== (b == null);
  return Math.abs(a - b) > band;
}
