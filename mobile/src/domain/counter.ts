/** Almacén clave-valor asíncrono (en la app: Keychain/Keystore). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export class CounterStateError extends Error {}

/**
 * Contador estrictamente creciente que sobrevive a reinicios. Reserva bloques y guarda el techo
 * ANTES de usar ningún valor, de modo que un nonce nunca se repite (los no usados se descartan).
 */
export class BlockCounter {
  private next_ = 0;
  private ceiling = 0;
  private queue: Promise<unknown> = Promise.resolve();

  private readonly store: KeyValueStore;
  private readonly key: string;
  private readonly block: number;

  constructor(store: KeyValueStore, key: string, block = 100) {
    this.store = store;
    this.key = key;
    this.block = block;
  }

  async init(): Promise<void> {
    const raw = await this.store.get(this.key);
    if (raw !== null) {
      const v = Number(raw);
      if (!Number.isSafeInteger(v) || v < 0) throw new CounterStateError('contador corrupto: vuelva a emparejar');
      this.next_ = this.ceiling = v;
    }
  }

  /** Siguiente valor; las llamadas concurrentes se serializan. */
  next(): Promise<number> {
    const run = this.queue.then(() => this.take());
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async take(): Promise<number> {
    if (this.next_ >= this.ceiling) {
      const ceiling = this.next_ + this.block;
      if (ceiling > Number.MAX_SAFE_INTEGER) throw new CounterStateError('contador agotado: vuelva a emparejar');
      await this.store.set(this.key, String(ceiling));
      this.ceiling = ceiling;
    }
    return this.next_++;
  }
}
