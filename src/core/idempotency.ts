import { getRuntimeOptions } from '../lib/runtime.js';

export function getIdempotencyKey(): string | undefined {
  const key = getRuntimeOptions().idempotencyKey?.trim();
  return key ? key : undefined;
}
