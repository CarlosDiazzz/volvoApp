export interface Pairing {
  host: string;
  device: string;
  bus: string;
  keyHex: string;
  noncePrefixHex: string;
  token: string;
}

const PAIRING_RE =
  /^https:\/\/([A-Za-z0-9.-]+(?::\d{2,5})?)\/?#d=([a-z0-9-]{3,32})&b=([A-Z0-9-]{3,32})&k=([0-9a-f]{64})&n=([0-9a-f]{8})&t=([0-9a-f]{20,128})\s*$/;

/** Enlace de emparejamiento emitido por `make phone`: https://host:8443/#d=…&b=…&k=…&n=…&t=… */
export function parsePairing(text: string): Pairing | null {
  const m = PAIRING_RE.exec(text.trim());
  return m ? { host: m[1], device: m[2], bus: m[3], keyHex: m[4], noncePrefixHex: m[5], token: m[6] } : null;
}

/** Contenido del QR que muestra el tablero: `volvopair://host[:puerto]/<código de un solo uso>`. No contiene ninguna clave. */
export interface PairingQr {
  host: string;
  code: string;
}

const QR_RE = /^volvopair:\/\/([A-Za-z0-9.-]{1,253}(?::\d{2,5})?)\/([A-Za-z0-9_-]{32})$/;

export function parsePairingQr(text: string): PairingQr | null {
  const m = QR_RE.exec(text.trim());
  return m ? { host: m[1], code: m[2] } : null;
}

/** Respuesta del canje (`POST /api/pairing/redeem`). */
export interface Redeemed {
  device: string;
  bus: string;
  keyHex: string;
  noncePrefixHex: string;
  token: string;
  bridgePort: number;
}

/** Valida estrictamente lo que responde el servidor antes de usarlo o guardarlo. */
export function parseRedeemed(value: unknown): Redeemed | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const ok =
    typeof v.device === 'string' && /^[a-z0-9-]{3,32}$/.test(v.device) &&
    typeof v.bus === 'string' && /^[A-Z0-9-]{3,32}$/.test(v.bus) &&
    typeof v.keyHex === 'string' && /^[0-9a-f]{64}$/.test(v.keyHex) &&
    typeof v.noncePrefixHex === 'string' && /^[0-9a-f]{8}$/.test(v.noncePrefixHex) &&
    typeof v.token === 'string' && /^[0-9a-f]{20,128}$/.test(v.token) &&
    typeof v.bridgePort === 'number' && Number.isInteger(v.bridgePort) && v.bridgePort > 0 && v.bridgePort < 65536;
  return ok ? (v as unknown as Redeemed) : null;
}

/** Enlace con el formato histórico (`make phone`), para reutilizar el almacenamiento seguro y el resto de la app. */
export function buildPairingLink(host: string, r: Redeemed): string {
  const hostname = host.replace(/:\d+$/, '');
  return `https://${hostname}:${r.bridgePort}/#d=${r.device}&b=${r.bus}&k=${r.keyHex}&n=${r.noncePrefixHex}&t=${r.token}`;
}
