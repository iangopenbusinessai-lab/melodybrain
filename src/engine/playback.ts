// Dev-only preview tool. Never imported by the VST port or production build.
// Uses Web Audio API — intentionally excluded from the pure-engine architecture.

import type { Note } from './types'

let audioCtx: AudioContext | null = null
let activeOscillators: OscillatorNode[] = []
let cleanupTimer: ReturnType<typeof setTimeout> | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  // Best-effort resume — browsers suspend AudioContext until a user gesture
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function midiToHz(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12)
}

function beatsToSeconds(beats: number, tempo: number): number {
  return beats * (60 / tempo)
}

export function stopPreview(): void {
  const ctx = audioCtx
  const now = ctx ? ctx.currentTime : 0
  for (const osc of activeOscillators) {
    try { osc.stop(now) } catch (_) {}
    osc.disconnect()
  }
  activeOscillators = []
  if (cleanupTimer !== null) {
    clearTimeout(cleanupTimer)
    cleanupTimer = null
  }
}

export function previewMelody(notes: Note[], tempo: number): void {
  stopPreview()
  if (notes.length === 0) return

  const ctx = getAudioContext()
  const now = ctx.currentTime
  let lastEndTime = now

  for (const note of notes) {
    const start    = now + beatsToSeconds(note.startBeat, tempo)
    const duration = beatsToSeconds(note.durationBeats, tempo)
    const end      = start + duration
    if (end > lastEndTime) lastEndTime = end

    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.value = midiToHz(note.pitch)

    // Short ramps eliminate clicks at note boundaries
    const peakGain = (note.velocity / 127) * 0.35
    const ramp     = Math.min(0.012, duration * 0.1)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(peakGain, start + ramp)
    gain.gain.setValueAtTime(peakGain, end - ramp)
    gain.gain.linearRampToValueAtTime(0, end)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(end)

    activeOscillators.push(osc)
  }

  // Release references once all oscillators have finished
  const msUntilDone = (lastEndTime - now + 0.15) * 1000
  cleanupTimer = setTimeout(() => {
    activeOscillators = []
    cleanupTimer = null
  }, msUntilDone)
}
