'use client'

import { useUserPreferences } from '@/lib/hooks/useUserPreferences'
import { useTheme } from '@/components/providers/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RotateCcw,
  Loader2,
  Check,
  Type,
  Palette,
  Accessibility,
  Volume2,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react'

export default function SettingsPage() {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
    isLoading,
    isSaving,
  } = useUserPreferences()
  
  const { theme, setTheme } = useTheme()

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Customize your reading experience
        </p>
      </div>

      <div className="space-y-8">
        {/* Reading Preferences */}
        <section className="rounded-lg border p-6">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
            <Type className="h-5 w-5" />
            Reading Preferences
          </h2>

          <div className="space-y-6">
            {/* Font Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Font Size</Label>
                <span className="text-sm text-muted-foreground">
                  {preferences.font_size}%
                </span>
              </div>
              <Slider
                value={[preferences.font_size]}
                onValueChange={([value]) =>
                  updatePreferences({ font_size: value })
                }
                min={50}
                max={200}
                step={10}
              />
              <p className="text-xs text-muted-foreground">
                Adjust the default text size for reading
              </p>
            </div>

            {/* Font Family */}
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select
                value={preferences.font_family}
                onValueChange={(value) =>
                  updatePreferences({ font_family: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">System Default</SelectItem>
                  <SelectItem value="serif">Serif (Times New Roman)</SelectItem>
                  <SelectItem value="sans-serif">Sans-serif (Arial)</SelectItem>
                  <SelectItem value="georgia">Georgia</SelectItem>
                  <SelectItem value="verdana">Verdana</SelectItem>
                  <SelectItem value="opendyslexic">OpenDyslexic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line Spacing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Spacing</Label>
                <span className="text-sm text-muted-foreground">
                  {preferences.line_spacing}x
                </span>
              </div>
              <Slider
                value={[preferences.line_spacing * 10]}
                onValueChange={([value]) =>
                  updatePreferences({ line_spacing: value / 10 })
                }
                min={10}
                max={30}
                step={1}
              />
            </div>

            {/* Margins */}
            <div className="space-y-2">
              <Label>Margins</Label>
              <Select
                value={preferences.margins}
                onValueChange={(value: 'narrow' | 'normal' | 'wide') =>
                  updatePreferences({ margins: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select margins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrow">Narrow</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="wide">Wide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scroll Mode */}
            <div className="space-y-2">
              <Label>Default Reading Mode</Label>
              <Select
                value={preferences.scroll_mode}
                onValueChange={(value: 'vertical' | 'horizontal') =>
                  updatePreferences({ scroll_mode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">Vertical Scroll</SelectItem>
                  <SelectItem value="horizontal">Page Flip</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls the default scrolling direction in the reader
              </p>
            </div>
          </div>
        </section>

        {/* Theme Settings */}
        <section className="rounded-lg border p-6">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
            <Palette className="h-5 w-5" />
            Theme Settings
          </h2>

          <div className="space-y-6">
            {/* Reading Theme */}
            <div className="space-y-2">
              <Label>Reading Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'system', label: 'System', icon: Monitor },
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                ].map((themeOption) => (
                  <button
                    key={themeOption.value}
                    onClick={() => {
                      // Update actual theme
                      setTheme(themeOption.value as 'system' | 'light' | 'dark')
                      // Also save to preferences for sync
                      updatePreferences({
                        reading_theme: themeOption.value as any,
                      })
                    }}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                      theme === themeOption.value
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <themeOption.icon className="h-5 w-5" />
                    <span className="text-sm">{themeOption.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Theme is applied immediately and saved to your account
              </p>
            </div>
          </div>
        </section>

        {/* Accessibility */}
        <section className="rounded-lg border p-6">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
            <Accessibility className="h-5 w-5" />
            Accessibility
          </h2>

          <div className="space-y-6">
            {/* Dyslexia Font */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Dyslexia-Friendly Font</Label>
                <p className="text-sm text-muted-foreground">
                  Use OpenDyslexic font for better readability
                </p>
              </div>
              <Button
                variant={preferences.dyslexia_font ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  updatePreferences({
                    dyslexia_font: !preferences.dyslexia_font,
                  })
                }
              >
                {preferences.dyslexia_font ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div>
                <Label>High Contrast Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Increase contrast for better visibility
                </p>
              </div>
              <Button
                variant={preferences.high_contrast ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  updatePreferences({
                    high_contrast: !preferences.high_contrast,
                  })
                }
              >
                {preferences.high_contrast ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            {/* Reading Time Display */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Show Reading Time</Label>
                <p className="text-sm text-muted-foreground">
                  Display estimated and elapsed reading time
                </p>
              </div>
              <Button
                variant={preferences.show_reading_time ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  updatePreferences({
                    show_reading_time: !preferences.show_reading_time,
                  })
                }
              >
                {preferences.show_reading_time ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>
        </section>

        {/* Text-to-Speech */}
        <section className="rounded-lg border p-6">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
            <Volume2 className="h-5 w-5" />
            Text-to-Speech
          </h2>

          <div className="space-y-6">
            {/* Enable TTS */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Text-to-Speech</Label>
                <p className="text-sm text-muted-foreground">
                  Read aloud using browser's speech synthesis
                </p>
              </div>
              <Button
                variant={preferences.enable_tts ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  updatePreferences({ enable_tts: !preferences.enable_tts })
                }
              >
                {preferences.enable_tts ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            {/* TTS Speed */}
            {preferences.enable_tts && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Speech Speed</Label>
                  <span className="text-sm text-muted-foreground">
                    {preferences.tts_speed}x
                  </span>
                </div>
                <Slider
                  value={[preferences.tts_speed * 10]}
                  onValueChange={([value]) =>
                    updatePreferences({ tts_speed: value / 10 })
                  }
                  min={5}
                  max={20}
                  step={1}
                />
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-6">
          <div>
            <h3 className="font-semibold">Reset Settings</h3>
            <p className="text-sm text-muted-foreground">
              Restore all settings to their default values
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={resetPreferences}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* Save Status */}
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-green-500" />
              Changes save automatically
            </>
          )}
        </div>
      </div>
    </div>
  )
}
