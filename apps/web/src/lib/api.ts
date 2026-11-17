import { z } from 'zod';
export async function api<T extends z.ZodType>(path: string, schema: T, options?: RequestInit): Promise<z.infer<T>> {
  const response = await fetch(`/api/v1/${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || `Request failed (${response.status})`);
  const result = schema.safeParse(body);
  if (!result.success) throw new Error('The API returned an incompatible response. Check frontend/backend versions.');
  return result.data;
}
