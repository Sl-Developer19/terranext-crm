import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Class-name merge used by every component (Doc 07 §6). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
