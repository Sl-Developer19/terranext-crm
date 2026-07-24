'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * TerraNext ships one luxury dark surface, not a light/dark pair — there is
 * no theme toggle anywhere in the product, so `forcedTheme` pins the `dark`
 * class instead of letting next-themes guess from system preference (which
 * would otherwise flash the wrong class before hydration settles).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" forcedTheme="dark">
      {children}
    </NextThemesProvider>
  );
}
