// Dev-only preview tool. Never imported by the VST port or production build.
// Uses Web Audio API — intentionally excluded from the pure-engine architecture.

import type { Note, Chord } from './types'

let audioCtx: AudioContext | null = null
// Single pool: both melody and chord oscillators live here so stopPreview kills everything.
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

function scheduleOscillator(
  ctx: AudioContext,
  frequency: number,
  peakGain: number,
  start: number,
  end: number,
): OscillatorNode {
  const osc      = ctx.createOscillator()
  const gainNode = ctx.createGain()
  const ramp     = Math.min(0.015, (end - start) * 0.1)

  osc.type            = 'sine'
  osc.frequency.value = frequency

  gainNode.gain.setValueAtTime(0, start)
  gainNode.gain.linearRampToValueAtTime(peakGain, start + ramp)
  gainNode.gain.setValueAtTime(peakGain, end - ramp)
  gainNode.gain.linearRampToValueAtTime(0, end)

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(start)
  osc.stop(end)

  return osc
}

function armCleanup(ctx: AudioContext, lastEndTime: number): void {
  if (cleanupTimer !== null) clearTimeout(cleanupTimer)
  cleanupTimer = setTimeout(() => {
    activeOscillators = []
    cleanupTimer = null
  }, (lastEndTime - ctx.currentTime + 0.15) * 1000)
}

// Stops all active oscillators — melody and chord alike.
export function stopPreview(): void {
  const now = audioCtx ? audioCtx.currentTime : 0
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

// gain: 0–1 master volume for melody oscillators (applied on top of per-note velocity).
export function previewMelody(notes: Note[], tempo: number, gain = 1.0): void {
  stopPreview()
  if (notes.length === 0) return

  const ctx = getAudioContext()
  const now = ctx.currentTime
  let lastEndTime = now

  for (const note of notes) {
    const start = now + beatsToSeconds(note.startBeat, tempo)
    const end   = start + beatsToSeconds(note.durationBeats, tempo)
    if (end > lastEndTime) lastEndTime = end

    const peakGain = (note.velocity / 127) * gain * 0.35
    activeOscillators.push(
      scheduleOscillator(ctx, midiToHz(note.pitch), peakGain, start, end)
    )
  }

  armCleanup(ctx, lastEndTime)
}

// Plays the chord progression in the background, looping for CHORD_LOOPS passes.
// Call after previewMelody — does not call stopPreview() so it adds to existing playback.
// gain: 0–1 master volume per chord tone (lower than melody by default).
const CHORD_LOOPS = 3

export function previewChords(chords: Chord[], tempo: number, gain = 0.5): void {
  if (chords.length === 0) return

  const ctx = getAudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  const now = ctx.currentTime

  const cycleBeats = chords.reduce((s, c) => s + c.durationBeats, 0)
  let lastEndTime  = now

  for (let loop = 0; loop < CHORD_LOOPS; loop++) {
    let chordBeat = loop * cycleBeats

    for (const chord of chords) {
      const start    = now + beatsToSeconds(chordBeat, tempo)
      const end      = start + beatsToSeconds(chord.durationBeats, tempo)
      if (end > lastEndTime) lastEndTime = end

      // One oscillator per chord tone; divide gain by tone count to avoid clipping
      const toneCount = chord.intervals.length
      const peakGain  = (gain * 0.4) / Math.max(toneCount, 1)

      for (const interval of chord.intervals) {
        activeOscillators.push(
          scheduleOscillator(ctx, midiToHz(chord.root + interval), peakGain, start, end)
        )
      }

      chordBeat += chord.durationBeats
    }
  }

  // Extend the cleanup window to cover chord loops (may be longer than melody)
  armCleanup(ctx, lastEndTime)
}
