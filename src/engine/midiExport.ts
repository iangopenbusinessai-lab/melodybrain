import type { Note, Phrase, GeneratedVoices } from './types'

// Ticks per quarter note — all timing derived from this
const PPQN = 480

// --- Binary helpers ---

// Variable-length quantity: MIDI's compact integer encoding
function vlq(value: number): number[] {
  const bytes: number[] = [value & 0x7f]
  let v = value >>> 7
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80)
    v >>>= 7
  }
  return bytes
}

function u16be(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff]
}

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

function ascii(s: string): number[] {
  return s.split('').map(c => c.charCodeAt(0))
}

// --- MIDI meta events ---

// FF 51 03 tt tt tt  — microseconds per beat
function tempoEvent(bpm: number): number[] {
  const uspb = Math.round(60_000_000 / bpm)
  return [0xff, 0x51, 0x03, (uspb >>> 16) & 0xff, (uspb >>> 8) & 0xff, uspb & 0xff]
}

// FF 58 04 nn dd cc bb  — 4/4 time signature
const TIME_SIG_44 = [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08]

// FF 2F 00  — end of track
const EOT = [0xff, 0x2f, 0x00]

// --- Track encoding ---

type RawEvent = { tick: number; data: number[] }

function noteEvents(notes: Note[], channel: number): RawEvent[] {
  const ch = channel & 0x0f
  const events: RawEvent[] = []
  for (const note of notes) {
    const onTick  = Math.round(note.startBeat * PPQN)
    const offTick = Math.round((note.startBeat + note.durationBeats) * PPQN)
    events.push({ tick: onTick,  data: [0x90 | ch, note.pitch & 0x7f, note.velocity & 0x7f] })
    // Note-off: sort before note-on at identical ticks (0x80 < 0x90)
    events.push({ tick: offTick, data: [0x80 | ch, note.pitch & 0x7f, 0x00] })
  }
  return events
}

function encodeTrack(events: RawEvent[]): number[] {
  // Ascending tick; at equal ticks, note-off (0x8n) before note-on (0x9n)
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.data[0] - b.data[0])
  const body: number[] = []
  let lastTick = 0
  for (const ev of sorted) {
    body.push(...vlq(ev.tick - lastTick), ...ev.data)
    lastTick = ev.tick
  }
  body.push(...vlq(0), ...EOT)
  return body
}

// --- Chunk builders ---

function chunk(tag: string, body: number[]): number[] {
  return [...ascii(tag), ...u32be(body.length), ...body]
}

// MThd: format (2) + num-tracks (2) + PPQN (2) = 6 bytes, always
function header(format: 0 | 1, numTracks: number): number[] {
  return chunk('MThd', [...u16be(format), ...u16be(numTracks), ...u16be(PPQN)])
}

// --- Exported functions ---

// Format 0: single track, melody on channel 1 (index 0)
export function exportMelody(notes: Note[], phrase: Phrase): Uint8Array {
  const trackBody = encodeTrack([
    { tick: 0, data: TIME_SIG_44 },
    { tick: 0, data: tempoEvent(phrase.tempo) },
    ...noteEvents(notes, 0),
  ])
  return new Uint8Array([...header(0, 1), ...chunk('MTrk', trackBody)])
}

// Format 1: tempo track + melody (ch1) + counter-melody (ch2) + bass (ch3)
export function exportAllVoices(voices: GeneratedVoices, phrase: Phrase): Uint8Array {
  const tempoBody = encodeTrack([
    { tick: 0, data: TIME_SIG_44 },
    { tick: 0, data: tempoEvent(phrase.tempo) },
  ])
  const melodyBody  = encodeTrack(noteEvents(voices.melody,        0))
  const counterBody = encodeTrack(noteEvents(voices.counterMelody, 1))
  const bassBody    = encodeTrack(noteEvents(voices.bassLine,       2))

  return new Uint8Array([
    ...header(1, 4),
    ...chunk('MTrk', tempoBody),
    ...chunk('MTrk', melodyBody),
    ...chunk('MTrk', counterBody),
    ...chunk('MTrk', bassBody),
  ])
}

// DOM-touching download trigger — only DOM interaction permitted in engine/
export function downloadMidi(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: 'audio/midi' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
