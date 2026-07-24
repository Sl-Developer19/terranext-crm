import Image from 'next/image';

import { cn } from '@/lib/utils/cn';

/**
 * TerraNext Global Ventures brand mark.
 *
 * Renders the official circular logo artwork from /brand/logo.png.
 * The image already contains the full "TERRANEXT GLOBAL VENTURES" wordmark
 * baked into the artwork, so no separate text wordmark span is rendered.
 *
 * When `wordmark` is true the image is displayed at 1.5× the base mark size
 * so the embedded text is legible; when false it uses the compact mark size
 * (e.g. collapsed sidebar). The `sr-only` span provides accessible text for
 * all cases. Every call site stays untouched — the public API is unchanged.
 */

/** Pixel dimensions for each named size tier. */
const sizes = {
  //                mark px  wordmark px
  sm: { mark: 24, wordmark: 36 },
  md: { mark: 32, wordmark: 48 },
  lg: { mark: 48, wordmark: 72 },
  xl: { mark: 64, wordmark: 96 },
} as const;

export function Logo({
  size = 'md',
  wordmark = true,
  className,
}: {
  size?: keyof typeof sizes;
  /** When true, the image is rendered larger so the wordmark baked into the
   *  logo artwork is legible. Set false for tight spaces (e.g. collapsed
   *  sidebar) to use the compact mark-only size. */
  wordmark?: boolean;
  className?: string;
}) {
  const px = wordmark ? sizes[size].wordmark : sizes[size].mark;

  return (
    <span className={cn('inline-flex items-center', className)}>
      <Image
        src="/brand/logo.png"
        alt=""
        aria-hidden
        width={px}
        height={px}
        className="shrink-0 object-contain"
        priority
      />
      <span className="sr-only">TerraNext Global Ventures</span>
    </span>
  );
}
