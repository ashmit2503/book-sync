'use client'

import { useEffect } from 'react'

interface AccessibilityProviderProps {
  children: React.ReactNode
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  useEffect(() => {
    // Load preferences from localStorage on mount
    const loadPreferences = () => {
      try {
        const cached = localStorage.getItem('user-preferences')
        if (cached) {
          const prefs = JSON.parse(cached)
          applyAccessibilityClasses(prefs.dyslexia_font, prefs.high_contrast)
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Apply accessibility classes to document
    const applyAccessibilityClasses = (dyslexiaFont: boolean, highContrast: boolean) => {
      const root = document.documentElement
      
      // Dyslexia font
      if (dyslexiaFont) {
        root.classList.add('dyslexia-font')
      } else {
        root.classList.remove('dyslexia-font')
      }
      
      // High contrast
      if (highContrast) {
        root.classList.add('high-contrast')
      } else {
        root.classList.remove('high-contrast')
      }
    }

    loadPreferences()

    // Listen for preference changes via storage event (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user-preferences' && e.newValue) {
        try {
          const prefs = JSON.parse(e.newValue)
          applyAccessibilityClasses(prefs.dyslexia_font, prefs.high_contrast)
        } catch {
          // Ignore
        }
      }
    }

    // Listen for custom event for same-tab updates
    const handlePreferenceUpdate = (e: CustomEvent) => {
      const { dyslexia_font, high_contrast } = e.detail
      applyAccessibilityClasses(dyslexia_font, high_contrast)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('accessibility-update', handlePreferenceUpdate as EventListener)

    // Set up interval to check preferences (backup sync mechanism)
    const intervalId = setInterval(() => {
      try {
        const cached = localStorage.getItem('user-preferences')
        if (cached) {
          const prefs = JSON.parse(cached)
          applyAccessibilityClasses(prefs.dyslexia_font, prefs.high_contrast)
        }
      } catch {
        // Ignore
      }
    }, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('accessibility-update', handlePreferenceUpdate as EventListener)
      clearInterval(intervalId)
    }
  }, [])

  return <>{children}</>
}
