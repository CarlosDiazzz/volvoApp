import { parseRedeemed, type PairingQr, type Redeemed } from '../domain/pairing';

export type PairingFailure = 'network' | 'rejected' | 'rate' | 'server';

export class PairingError extends Error {
  constructor(readonly kind: PairingFailure) {
    super(kind);
  }
}

/** Mensaje accionable para cada causa (en vez de un genérico "no se puede conectar"). */
export const PAIRING_MESSAGE: Record<PairingFailure, string> = {
  network:
    'No se pudo llegar al sistema. Revise que el celular y la laptop estén en la misma red wifi (sin aislamiento de clientes) y que el celular confíe en el certificado del sistema (se instala una vez desde la página de emparejamiento).',
  rejected: 'El código no es válido, ya se usó o caducó. Genere un QR nuevo en el tablero.',
  rate: 'Demasiados intentos. Espere un minuto y vuelva a escanear.',
  server: 'El sistema respondió algo inesperado. Intente de nuevo; si persiste, avise al administrador.',
};

const TIMEOUT_MS = 10_000;

/** Canjea el código de un solo uso por las credenciales del dispositivo (el servidor lo invalida al primer uso). */
export async function redeemCode(qr: PairingQr): Promise<Redeemed> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`https://${qr.host}/api/pairing/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code: qr.code }),
      signal: abort.signal,
    });
  } catch {
    throw new PairingError('network');
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 404) throw new PairingError('rejected');
  if (response.status === 429) throw new PairingError('rate');
  if (!response.ok) throw new PairingError('server');
  const redeemed = parseRedeemed(await response.json().catch(() => null));
  if (!redeemed) throw new PairingError('server');
  return redeemed;
}
