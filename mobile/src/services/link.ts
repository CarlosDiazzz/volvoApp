import type { Envelope } from '../domain/envelope';
import type { Pairing } from '../domain/pairing';

export type LinkState = 'connecting' | 'ready' | 'down' | 'denied' | 'blocked';

const CLOSE_DENIED = 4401;
const CLOSE_BLOCKED = 4429;

/**
 * Enlace WSS con el puente. Primer mensaje: {hello:{device,token}}.
 * Reintenta con espera creciente; un rechazo (4401) no se reintenta.
 */
export class Link {
  state: LinkState = 'down';
  private ws: WebSocket | null = null;
  private stopped = true;
  private retryMs = 1000;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly pairing: Pairing;
  private readonly onState: (s: LinkState) => void;

  constructor(pairing: Pairing, onState: (s: LinkState) => void) {
    this.pairing = pairing;
    this.onState = onState;
  }

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close(1000);
    this.ws = null;
    this.set('down');
  }

  /** Devuelve false si el enlace no está listo (la muestra ya consumió su contador y se descarta). */
  send(envelope: Envelope): boolean {
    if (this.state !== 'ready' || !this.ws) return false;
    this.ws.send(JSON.stringify(envelope));
    return true;
  }

  private set(state: LinkState): void {
    this.state = state;
    this.onState(state);
  }

  private open(): void {
    this.set('connecting');
    const ws = new WebSocket(`wss://${this.pairing.host}/ws`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ hello: { device: this.pairing.device, token: this.pairing.token } }));
    ws.onmessage = (e) => {
      if (typeof e.data === 'string' && e.data.includes('"ok":true')) {
        this.retryMs = 1000;
        this.set('ready');
      }
    };
    ws.onerror = () => undefined; // el cierre posterior decide el estado
    ws.onclose = (e) => this.handleClose(ws, e.code);
  }

  private handleClose(ws: WebSocket, code: number): void {
    if (this.ws !== ws) return;
    this.ws = null;
    if (this.stopped) return;
    if (code === CLOSE_DENIED) return this.set('denied');
    const blocked = code === CLOSE_BLOCKED;
    this.set(blocked ? 'blocked' : 'down');
    const wait = blocked ? 60_000 : this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, 15_000);
    this.timer = setTimeout(() => !this.stopped && this.open(), wait);
  }
}
