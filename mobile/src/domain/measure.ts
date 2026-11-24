import { clamp } from './math.ts';

/** Lux -> % de luz ambiente en escala logarítmica (1 lx = 0 %, 10 000 lx = 100 %). */
export function luxToPct(lux: number): number {
  if (!(lux > 0)) return 0;
  return clamp((Math.log10(lux) / 4) * 100, 0, 100);
}

/** Valor eficaz (g) de la vibración: el acelerómetro menos su componente lenta (gravedad). */
export class VibrationMeter {
  private gravity: number | null = null;
  private sumSq = 0;
  private n = 0;

  push(x: number, y: number, z: number): void {
    const mag = Math.hypot(x, y, z);
    this.gravity = this.gravity === null ? mag : this.gravity + 0.05 * (mag - this.gravity);
    const d = mag - this.gravity;
    this.sumSq += d * d;
    this.n += 1;
  }

  /** RMS desde la última lectura; reinicia la ventana. */
  take(): number {
    const rms = this.n ? Math.sqrt(this.sumSq / this.n) : 0;
    this.sumSq = 0;
    this.n = 0;
    return rms;
  }
}

/** Un imán real da cientos de µT; por debajo de esta banda lo observado es deriva, no evento. */
export const ADAPT_BAND_UT = 50;
/** Adaptación lenta (≈30 s a 10 Hz) de la línea base mientras no haya un imán cerca. */
export const ADAPT_ALPHA = 0.003;

/**
 * Desviación (µT) del campo magnético respecto de una línea base calibrada.
 * La línea base sigue despacio la deriva (el campo cambia al mover el equipo o acercarlo a metal),
 * pero se congela cuando la desviación supera `ADAPT_BAND_UT`, para no "absorber" un imán real.
 */
export class MagMeter {
  baseline: number | null = null;
  private smooth: number | null = null;
  private acc: number[] | null = null;

  push(x: number, y: number, z: number): void {
    const mag = Math.hypot(x, y, z);
    this.smooth = this.smooth === null ? mag : this.smooth + 0.3 * (mag - this.smooth);
    if (this.acc) {
      this.acc.push(mag);
    } else if (this.baseline !== null && Math.abs(this.smooth - this.baseline) < ADAPT_BAND_UT) {
      this.baseline += ADAPT_ALPHA * (this.smooth - this.baseline);
    }
  }

  startCalibration(): void {
    this.acc = [];
  }

  finishCalibration(): boolean {
    const samples = this.acc;
    this.acc = null;
    if (!samples || samples.length < 5) return false;
    this.baseline = samples.reduce((s, v) => s + v, 0) / samples.length;
    return true;
  }

  get delta(): number | null {
    if (this.smooth === null || this.baseline === null) return null;
    return Math.abs(this.smooth - this.baseline);
  }
}
