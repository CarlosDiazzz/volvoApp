import { useCallback, useEffect, useState } from 'react';

import { parsePairing, type Pairing } from '../domain/pairing';
import { clearPairing, loadPairing, savePairing } from '../services/secureStorage';

export function usePairing() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const unpair = useCallback(async () => {
    if (pairing) await clearPairing(pairing.device).catch(() => undefined);
    setPairing(null);
  }, [pairing]);

  return { pairing, loading, error, pair, unpair };
}
