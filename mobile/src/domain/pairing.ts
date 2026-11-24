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
