import { File, Paths } from 'expo-file-system';

import { DEFAULT_MAX_QUEUE, SendQueue } from '../domain/queue';

/**
 * Respaldo de la cola en el almacenamiento privado de la app. Contiene solo sobres ya cifrados (AES-GCM): sin la clave del
 * dispositivo no revelan nada. Sobrevive a que el sistema cierre la app durante un corte de red.
 */
const fileFor = (deviceId: string): File => new File(Paths.document, `volvo-queue-${deviceId}.json`);

export async function loadQueue(deviceId: string): Promise<SendQueue> {
  try {
    const f = fileFor(deviceId);
    return f.exists ? SendQueue.restore(await f.text(), DEFAULT_MAX_QUEUE) : new SendQueue();
  } catch {
    return new SendQueue();
  }
}

export async function saveQueue(deviceId: string, queue: SendQueue): Promise<void> {
  const f = fileFor(deviceId);
  if (!f.exists) f.create();
  f.write(queue.serialize());
}

export async function deleteQueue(deviceId: string): Promise<void> {
  try {
    const f = fileFor(deviceId);
    if (f.exists) f.delete();
  } catch {
    // ya no existe
  }
}
