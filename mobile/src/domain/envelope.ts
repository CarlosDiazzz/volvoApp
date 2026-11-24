import { gcm } from '@noble/ciphers/aes.js';

import type { Pairing } from './pairing.ts';
import type { Sample } from './sample.ts';

export interface Envelope {
  v: 1;
  device: string;
  bus: string;
  ctr: number;
  ct: string;
}

const VERSION = 1;

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 || /[^0-9a-f]/i.test(hex)) throw new Error('hex inválido');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

function u64(ctr: number): Uint8Array {
  const b = new Uint8Array(8);
  const view = new DataView(b.buffer);
  view.setUint32(0, Math.floor(ctr / 2 ** 32));
  view.setUint32(4, ctr % 2 ** 32);
  return b;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function buildNonce(prefix: Uint8Array, ctr: number): Uint8Array {
  return concat(prefix, u64(ctr));
}

export function buildAad(device: string, bus: string, ctr: number): Uint8Array {
  const enc = new TextEncoder();
  return concat(Uint8Array.of(VERSION), enc.encode(device), Uint8Array.of(0), enc.encode(bus), Uint8Array.of(0), u64(ctr));
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Cifra bytes ya serializados (usado por los vectores de prueba). */
export function encryptBytes(p: Pairing, ctr: number, plaintext: Uint8Array): Envelope {
  if (!Number.isSafeInteger(ctr) || ctr < 0) throw new Error('contador inválido');
  const cipher = gcm(hexToBytes(p.keyHex), buildNonce(hexToBytes(p.noncePrefixHex), ctr), buildAad(p.device, p.bus, ctr));
  return { v: VERSION, device: p.device, bus: p.bus, ctr, ct: toBase64(cipher.encrypt(plaintext)) };
}

export function encryptSample(p: Pairing, ctr: number, sample: Sample): Envelope {
  return encryptBytes(p, ctr, new TextEncoder().encode(JSON.stringify(sample)));
}
