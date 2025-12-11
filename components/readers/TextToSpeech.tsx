'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ChevronDown,
  RotateCcw,
  Square,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface TextToSpeechProps {
  text: string
  theme?: 'light' | 'dark'
}

interface Voice {
  id: string
  name: string
  lang: string
  natural: boolean
}

export function TextToSpeech({ text, theme = 'light' }: TextToSpeechProps) {
  const isDark = theme === 'dark'
  
  // State
  const [ttsSupported, setTtsSupported] = useState(false)
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused'>('idle')
  const [charProgress, setCharProgress] = useState(0) // Current character position in text
  const [voices, setVoices] = useState<Voice[]>([])
  const [voiceId, setVoiceId] = useState('')
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  
  // Refs for callbacks
  const statusRef = useRef(status)
  const charRef = useRef(charProgress)
  const voiceIdRef = useRef(voiceId)
  const rateRef = useRef(rate)
  const volumeRef = useRef(volume)
  const mutedRef = useRef(muted)
  const utteranceIdRef = useRef(0)
  const lastTextRef = useRef(text)
  
  // Keep refs in sync
  statusRef.current = status
  charRef.current = charProgress
  voiceIdRef.current = voiceId
  rateRef.current = rate
  volumeRef.current = volume
  mutedRef.current = muted

  // Detect browser TTS support once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      setTtsSupported(true)
    }
  }, [])

  // Reset playback and slider when the source text changes (e.g., page scroll)
  useEffect(() => {
    if (lastTextRef.current === text) return

    // Cancel any ongoing speech for the previous text
    if (ttsSupported && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    setStatus('idle')
    statusRef.current = 'idle'
    setCharProgress(0)
    charRef.current = 0

    lastTextRef.current = text
  }, [text, ttsSupported])

  const totalChars = text?.length || 1

  // Get character position from progress percentage (0-100)
  const getCharFromProgress = (progress: number): number => {
    return Math.floor((progress / 100) * totalChars)
  }

  // Get progress percentage from character position
  const getProgressFromChar = (charPos: number): number => {
    return Math.min(100, (charPos / totalChars) * 100)
  }

  // Current progress as percentage
  const progressPercent = getProgressFromChar(charProgress)

  // Load voices
  useEffect(() => {
    if (!ttsSupported) return

    const load = () => {
      const list = window.speechSynthesis.getVoices()
      if (list.length === 0) return
      
      const mapped: Voice[] = list.map(v => ({
        id: v.name,
        name: v.name.replace(/Microsoft |Google |- Natural|- Online|Neural/gi, '').trim(),
        lang: v.lang,
        natural: /natural|neural|premium|enhanced/i.test(v.name) || !v.localService
      }))
      
      mapped.sort((a, b) => {
        if (a.natural !== b.natural) return a.natural ? -1 : 1
        const aEn = a.lang.startsWith('en')
        const bEn = b.lang.startsWith('en')
        if (aEn !== bEn) return aEn ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      
      setVoices(mapped)
      if (!voiceIdRef.current && mapped.length > 0) {
        const def = mapped.find(v => v.lang.startsWith('en') && v.natural) 
          || mapped.find(v => v.lang.startsWith('en'))
          || mapped[0]
        setVoiceId(def.id)
      }
    }
    
    load()
    window.speechSynthesis.onvoiceschanged = load
    setTimeout(load, 100)
    
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [ttsSupported])

  // Cleanup
  useEffect(() => {
    if (!ttsSupported) return
    return () => { window.speechSynthesis.cancel() }
  }, [ttsSupported])

  // Start speaking from a specific character position in the full text
  const speakFromChar = (startChar: number) => {
    if (!ttsSupported) return

    const safeStart = Math.max(0, Math.min(totalChars - 1, startChar || 0))

    // Increment utterance id so older utterances ignore their events
    utteranceIdRef.current += 1
    const utteranceId = utteranceIdRef.current

    window.speechSynthesis.cancel()

    if (!text?.trim() || totalChars === 0 || safeStart >= totalChars) {
      setStatus('idle')
      statusRef.current = 'idle'
      setCharProgress(totalChars)
      charRef.current = totalChars
      return
    }

    const remainingText = text.slice(safeStart)
    const utterance = new window.SpeechSynthesisUtterance(remainingText)
    
    utterance.rate = rateRef.current
    utterance.volume = mutedRef.current ? 0 : volumeRef.current
    utterance.pitch = 1
    
    const voice = window.speechSynthesis.getVoices().find(v => v.name === voiceIdRef.current)
    if (voice) utterance.voice = voice
    
    // Update progress as words are spoken
    utterance.onboundary = (e) => {
      if (utteranceId !== utteranceIdRef.current) return
      // Some browsers don't set name; rely on charIndex when available
      if (typeof e.charIndex === 'number') {
        const currentChar = safeStart + e.charIndex
        setCharProgress(currentChar)
        charRef.current = currentChar
      }
    }

    utterance.onend = () => {
      if (utteranceId !== utteranceIdRef.current) return
      if (statusRef.current !== 'playing') return

      // Finished this text
      setStatus('idle')
      statusRef.current = 'idle'
      setCharProgress(totalChars)
      charRef.current = totalChars
    }

    utterance.onerror = (e) => {
      if (utteranceId !== utteranceIdRef.current) return
      if (e.error === 'interrupted' || e.error === 'canceled') return
      console.error('TTS error:', e.error)
      setStatus('idle')
      statusRef.current = 'idle'
    }

    setCharProgress(safeStart)
    charRef.current = safeStart
    setStatus('playing')
    statusRef.current = 'playing'

    window.speechSynthesis.speak(utterance)
  }

  // Play from current position
  const play = () => {
    if (!ttsSupported) return

    if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
      statusRef.current = 'playing'
    } else {
      speakFromChar(charRef.current)
    }
  }

  const pause = () => {
    if (!ttsSupported) return

    window.speechSynthesis.pause()
    setStatus('paused')
    statusRef.current = 'paused'
  }

  const stop = () => {
    if (!ttsSupported) return

    window.speechSynthesis.cancel()
    setStatus('idle')
    statusRef.current = 'idle'
    setCharProgress(0)
    charRef.current = 0
  }

  const skipBack = () => {
    const delta = Math.max(1, Math.floor(totalChars * 0.05)) // jump back 5%
    const newChar = Math.max(0, charRef.current - delta)

    setCharProgress(newChar)
    charRef.current = newChar

    if (statusRef.current === 'playing') {
      speakFromChar(newChar)
    }
  }

  const skipForward = () => {
    const delta = Math.max(1, Math.floor(totalChars * 0.05)) // jump forward 5%
    const newChar = Math.min(totalChars, charRef.current + delta)

    setCharProgress(newChar)
    charRef.current = newChar

    if (statusRef.current === 'playing') {
      speakFromChar(newChar)
    }
  }

  const restart = () => {
    setCharProgress(0)
    charRef.current = 0
    
    if (statusRef.current === 'playing') {
      speakFromChar(0)
    } else {
      if (ttsSupported) {
        window.speechSynthesis.cancel()
      }
      setStatus('idle')
      statusRef.current = 'idle'
    }
  }

  // Seek to a percentage position
  const seekToProgress = (progress: number) => {
    const targetChar = getCharFromProgress(progress)
    setCharProgress(targetChar)
    charRef.current = targetChar
    
    if (statusRef.current === 'playing') {
      speakFromChar(targetChar)
    }
  }

  const changeRate = (newRate: number) => {
    setRate(newRate)
    rateRef.current = newRate
    if (statusRef.current === 'playing') {
      speakFromChar(charRef.current)
    }
  }

  const changeVoice = (newVoiceId: string) => {
    setVoiceId(newVoiceId)
    voiceIdRef.current = newVoiceId
    if (statusRef.current === 'playing') {
      speakFromChar(charRef.current)
    }
  }

  const toggleMute = () => {
    setMuted(m => !m)
    mutedRef.current = !mutedRef.current
  }

  const changeVolume = (v: number) => {
    setVolume(v)
    volumeRef.current = v
    if (v > 0 && muted) {
      setMuted(false)
      mutedRef.current = false
    }
  }

  // Estimate time
  const wordsPerMin = 150 * rate
  const totalWords = text?.split(/\s+/).length || 0
  const totalSeconds = Math.round((totalWords / wordsPerMin) * 60)
  const elapsedSeconds = Math.round((progressPercent / 100) * totalSeconds)
  
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Browser support check / loading state
  if (!ttsSupported) {
    return <div className="text-sm text-muted-foreground">TTS not supported or still initializing in this browser.</div>
  }

  const isPlaying = status === 'playing'
  const englishVoices = voices.filter(v => v.lang.startsWith('en'))

  return (
    <div className={`space-y-4 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
      {/* Progress bar with time */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono w-10 text-right opacity-60">
          {formatTime(elapsedSeconds)}
        </span>
        <Slider
          value={[progressPercent]}
          min={0}
          max={100}
          step={0.5}
          // Drag updates the visual position without restarting audio on every frame
          onValueChange={([v]) => {
            const targetChar = getCharFromProgress(v)
            setCharProgress(targetChar)
            charRef.current = targetChar
          }}
          // Commit (mouse/touch release) actually seeks playback
          onValueCommit={([v]) => seekToProgress(v)}
          className="flex-1"
        />
        <span className="text-xs font-mono w-10 opacity-60">
          {formatTime(totalSeconds)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Volume */}
        <div className="flex items-center gap-1 min-w-[100px]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={toggleMute}
          >
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[muted ? 0 : volume * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => changeVolume(v / 100)}
            className="w-16"
          />
        </div>

        {/* Playback */}
        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={restart} title="Restart">
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={skipBack}
            disabled={charProgress <= 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          {isPlaying ? (
            <Button type="button" variant="default" size="icon" className="h-10 w-10 rounded-full mx-1" onClick={pause}>
              <Pause className="h-5 w-5" />
            </Button>
          ) : (
            <Button type="button" variant="default" size="icon" className="h-10 w-10 rounded-full mx-1" onClick={play}>
              <Play className="h-5 w-5 ml-0.5" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={skipForward}
            disabled={charProgress >= totalChars}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={stop}
            disabled={status === 'idle'}
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {/* Speed & Voice */}
        <div className="flex items-center gap-1 min-w-[100px] justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs">
                {rate}x <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Speed</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                <DropdownMenuItem key={r} onClick={() => changeRate(r)} className={rate === r ? 'bg-accent' : ''}>
                  {r}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs max-w-[70px] truncate">
                {voices.find(v => v.id === voiceId)?.name || 'Voice'}
                <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
              <DropdownMenuLabel>Voice</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {englishVoices.slice(0, 12).map(v => (
                <DropdownMenuItem 
                  key={v.id} 
                  onClick={() => changeVoice(v.id)}
                  className={voiceId === v.id ? 'bg-accent' : ''}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{v.name}</span>
                    <span className="text-xs text-muted-foreground">{v.lang}{v.natural ? ' • Natural' : ''}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status line */}
      <div className="text-center text-xs text-muted-foreground">
        {status === 'paused' && <span className="text-yellow-500 mr-2">Paused •</span>}
        {Math.round(progressPercent)}%
      </div>
    </div>
  )
}
