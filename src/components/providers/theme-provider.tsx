'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      // suppressHydrationWarning prevents React from bailing on hydration
      // when next-themes injects the theme class before React mounts.
      // The <html> tag already has suppressHydrationWarning in layout.tsx.
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
