import { useCallback, useEffect, useState } from 'react';

import { buildPairingLink, parsePairing, parsePairingQr, type Pairing } from '../domain/pairing';
import { PAIRING_MESSAGE, PairingError, redeemCode } from '../services/pairingApi';
import { deleteQueue } from '../services/queueStorage';
import { clearPairing, loadPairing, savePairing } from '../services/secureStorage';

export function usePairing() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPairing()
      .then(setPairing)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const pair = useCallback(async (link: string) => {
    const parsed = parsePairing(link);
    if (!parsed) return setError('Enlace inválido. Use el que imprime `make phone` en volvoInfra.');
    try {
      await savePairing(link);
    } catch {
      return setError('No se pudo guardar el emparejamiento de forma segura.');
    }
    setError('');
    setPairing(parsed);
  }, []);

  /** Escaneo del QR del tablero: canjea el código de un solo uso y guarda las credenciales en el almacén seguro. */
  const pairFromQr = useCallback(async (text: string) => {
    const qr = parsePairingQr(text);
    if (!qr) return setError('Ese QR no es de emparejamiento de Volvo. Use el que muestra el tablero (Emparejar celular).');
    setBusy(true);
    try {
      const link = buildPairingLink(qr.host, await redeemCode(qr));
      const parsed = parsePairing(link);
      if (!parsed) return setError(PAIRING_MESSAGE.server);
      await savePairing(link);
      setError('');
      setPairing(parsed);
    } catch (e) {
      setError(e instanceof PairingError ? PAIRING_MESSAGE[e.kind] : 'No se pudo guardar el emparejamiento de forma segura.');
    } finally {
      setBusy(false);
    }
  }, []);

  const unpair = useCallback(async () => {
    if (pairing) {
      await clearPairing(pairing.device).catch(() => undefined);
      await deleteQueue(pairing.device); // la cola pertenece a ese emparejamiento: no se reenvía con otra clave
    }
    setPairing(null);
  }, [pairing]);

  return { pairing, loading, error, busy, pair, pairFromQr, unpair };
}
