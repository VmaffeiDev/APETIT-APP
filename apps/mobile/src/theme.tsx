import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SecureStore from 'expo-secure-store'

export const lightColors = {
  bg: '#F7F6F2', surface: '#FFFFFF', surfaceAlt: '#F1F0EB',
  border: '#E3E3DB', borderSoft: '#EEEDE7', text: '#252B24', muted: '#646B61', muted2: '#687060',
  brand: '#BD2343', hero: '#A71E3C', red: '#BD2343', redDark: '#861D35', redSoft: '#FAECEE',
  yellow: '#886012', yellowSoft: '#FCF2DA', green: '#326747', greenSoft: '#EAF2E8',
  danger: '#B72836', dangerSoft: '#FCECEE', white: '#FFFFFF',
}
export type Palette = typeof lightColors
export const darkColors: Palette = {
  bg: '#151916', surface: '#1E2420', surfaceAlt: '#282F29',
  border: '#39423A', borderSoft: '#303831', text: '#F3F4EE', muted: '#B8C0B5', muted2: '#A6B0A2',
  brand: '#BD2343', hero: '#A71E3C', red: '#FF9AB0', redDark: '#FFB2C3', redSoft: '#3C242C',
  yellow: '#E7C26D', yellowSoft: '#393021', green: '#AAD6A6', greenSoft: '#263B2C',
  danger: '#FF9CA3', dangerSoft: '#41282D', white: '#FFFFFF',
}
export type ThemeMode = 'light' | 'dark'
const THEME_KEY = 'apetit-appearance-v1'
const isMode = (value: unknown): value is ThemeMode => value === 'light' || value === 'dark'

function initialMode(): ThemeMode {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { const value = window.localStorage.getItem(THEME_KEY); if (isMode(value)) return value } catch {}
  }
  return 'light'
}

const ThemeContext = createContext<{ colors: Palette; mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({ colors: lightColors, mode: 'light', setMode: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<ThemeMode>(initialMode)
  const colors = mode === 'dark' ? darkColors : lightColors
  useEffect(() => {
    if (Platform.OS !== 'web') {
      let mounted = true
      SecureStore.getItemAsync(THEME_KEY).then(value => { if (mounted && isMode(value)) updateMode(value) }).catch(() => {})
      return () => { mounted = false }
    }
    const sync = (event: StorageEvent) => { if (event.key === THEME_KEY && isMode(event.newValue)) updateMode(event.newValue) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    document.documentElement.style.colorScheme = mode
    document.documentElement.style.setProperty('--apetit-bg', colors.bg)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.bg)
  }, [mode, colors])

  function setMode(next: ThemeMode) {
    updateMode(next)
    // A restricted browser storage must never prevent switching appearance.
    if (Platform.OS === 'web') { try { window.localStorage.setItem(THEME_KEY, next) } catch {} }
    else void SecureStore.setItemAsync(THEME_KEY, next).catch(() => {})
  }
  return <ThemeContext.Provider value={{ colors, mode, setMode }}><StatusBar style={mode === 'dark' ? 'light' : 'dark'}/>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
export function useThemedStyles<T>(factory: (colors: Palette) => T) {
  const { colors } = useTheme()
  return useMemo(() => factory(colors), [colors, factory])
}
export const radius = { sm: 10, md: 15, lg: 19, xl: 23, pill: 999 }
export const shadow = { shadowColor: '#0B1710', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 2 } as const
