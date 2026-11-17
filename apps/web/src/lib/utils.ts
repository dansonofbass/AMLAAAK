import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export function compact(value: number | null | undefined) {
  if (value == null) return '—';
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}
export const title = (value: string) => value.replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
export const propertyLabel = (value: string) => value === 'apartment-sell' ? 'Apartment' : 'House / villa';
