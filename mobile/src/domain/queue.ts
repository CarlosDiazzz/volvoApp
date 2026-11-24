/**
 * Cola de envío con entrega confirmada. Cada elemento es una muestra YA cifrada (con su contador): nada se descifra ni se
 * reordena. Se envía en orden de contador y solo se borra cuando el puente la confirma (ack). Si el enlace se cae, lo no
 * confirmado se reenvía al reconectar; el puente y el backend descartan lo que ya habían recibido.
 *
 * Acotada: si se llena (corte muy largo) se descartan las MÁS ANTIGUAS y se cuentan, para que el desborde sea visible.
 */
export interface QueuedItem {
  ctr: number;
  json: string;
}

export const DEFAULT_MAX_QUEUE = 3000; // ≈ 25 min a 2 Hz
const MAX_JSON_CHARS = 2048;

export class SendQueue {
  private items: QueuedItem[];
  private droppedTotal: number;
  private readonly max: number;

  constructor(max: number = DEFAULT_MAX_QUEUE, items: QueuedItem[] = [], dropped = 0) {
    this.max = max;
    this.items = items;
    this.droppedTotal = dropped;
  }

  get length(): number {
    return this.items.length;
  }

  /** Muestras descartadas por desborde desde que se creó la cola. */
  get dropped(): number {
    return this.droppedTotal;
  }

  get oldestCtr(): number | null {
    return this.items[0]?.ctr ?? null;
  }

  /** Los contadores deben crecer estrictamente: lo que no cumpla se ignora (nunca se reordena ni se duplica). */
  enqueue(item: QueuedItem): boolean {
    const last = this.items[this.items.length - 1];
    if (!Number.isSafeInteger(item.ctr) || item.ctr < 0 || (last && item.ctr <= last.ctr)) return false;
    this.items.push(item);
    while (this.items.length > this.max) {
      this.items.shift();
      this.droppedTotal++;
    }
    return true;
  }

  /** Primer elemento con contador mayor a `cursor` (lo último enviado en esta conexión). */
  next(cursor: number): QueuedItem | undefined {
    return this.items.find((i) => i.ctr > cursor);
  }

  /** Enviados en esta conexión pero sin confirmar: sirve para limitar la ventana. */
  inFlight(cursor: number): number {
    return this.items.filter((i) => i.ctr <= cursor).length;
  }

  /** Confirmación acumulativa: el puente recibe en orden, así que un ack de N confirma todo lo ≤ N. Devuelve cuántas borró. */
  ack(ctr: number): number {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.ctr > ctr);
    return before - this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  serialize(): string {
    return JSON.stringify({ v: 1, dropped: this.droppedTotal, items: this.items });
  }

  /** Lee un respaldo del disco; cualquier cosa inesperada se descarta en vez de romper la app. */
  static restore(text: string | null | undefined, max: number = DEFAULT_MAX_QUEUE): SendQueue {
    try {
      const data: unknown = JSON.parse(text ?? '');
      if (typeof data !== 'object' || data === null) return new SendQueue(max);
      const { v, dropped, items } = data as { v?: unknown; dropped?: unknown; items?: unknown };
      if (v !== 1 || !Array.isArray(items)) return new SendQueue(max);
      const q = new SendQueue(max, [], typeof dropped === 'number' && Number.isSafeInteger(dropped) && dropped >= 0 ? dropped : 0);
      for (const it of items) {
        const { ctr, json } = (it ?? {}) as { ctr?: unknown; json?: unknown };
        if (typeof ctr === 'number' && typeof json === 'string' && json.length <= MAX_JSON_CHARS) q.enqueue({ ctr, json });
      }
      return q;
    } catch {
      return new SendQueue(max);
    }
  }
}

/** Mensajes del puente: {"ack":N} (entregado) o {"nack":N,"reason":"unavailable"} (broker caído: reintentar). */
export type BridgeReply = { kind: 'ack'; ctr: number } | { kind: 'nack'; ctr: number } | { kind: 'ok' } | null;

export function parseBridgeReply(text: string): BridgeReply {
  try {
    const m = JSON.parse(text) as Record<string, unknown>;
    if (m.ok === true) return { kind: 'ok' };
    if (typeof m.ack === 'number' && Number.isSafeInteger(m.ack) && m.ack >= 0) return { kind: 'ack', ctr: m.ack };
    if (typeof m.nack === 'number' && Number.isSafeInteger(m.nack) && m.nack >= 0) return { kind: 'nack', ctr: m.nack };
  } catch {
    // mensaje ajeno: se ignora
  }
  return null;
}
