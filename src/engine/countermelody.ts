import type { Pitch, Note, Phrase, Chord } from './types'
import { scoreNote } from './chords'
import { interpolateTension } from './phraseArc'

const CM_LO = 60  // C4
const CM_HI = 79  // G5

function toCmRange(pitch: Pitch): Pitch {
  let p = pitch
  while (p < CM_LO) p += 12
  while (p > CM_HI) p -= 12
  return p
}

function weightedPick<T>(candidates: { value: T; weight: number }[]): T {
  const total = candidates.reduce((s, c) => s + c.weight, 0)
  if (total === 0) return candidates[Math.floor(Math.random() * candidates.length)].value
  let r = Math.random() * total
  for (const c of candidates) {
    r -= c.weight
    if (r <= 0) return c.value
  }
  return candidates[candidates.length - 1].value
}

// Returns true if moving from (prevMel→prevCm) to (curMel→curCm) creates
// parallel perfect 5ths or parallel octaves/unisons.
function isParallelProblem(
  prevMel: Pitch, prevCm: Pitch,
  curMel:  Pitch, curCm:  Pitch,
): boolean {
  const prev = ((prevCm - prevMel) % 12 + 12) % 12
  const cur  = ((curCm  - curMel)  % 12 + 12) % 12
  return (prev === 7 && cur === 7) || (prev === 0 && cur === 0)
}

function chordAt(phrase: Phrase, chordStarts: number[], beat: number): Chord {
  for (let i = chordStarts.length - 1; i >= 0; i--) {
    if (beat >= chordStarts[i]) return phrase.chords[i]
  }
  return phrase.chords[0]
}

export function generateCounterMelody(phrase: Phrase, melody: Note[]): Note[] {
  if (melody.length === 0) return []

  const chordStarts: number[] = []
  let acc = 0
  for (const chord of phrase.chords) {
    chordStarts.push(acc)
    acc += chord.durationBeats
  }

  const notes: Note[] = []
  let prevMelPitch = melody[0].pitch
  let prevCmPitch  = toCmRange(melody[0].pitch - 4)  // warm-up; not used for i=0 check

  for (let i = 0; i < melody.length; i++) {
    const melNote  = melody[i]
    const melPitch = melNote.pitch
    const tension  = interpolateTension(phrase.contour, melNote.startBeat)
    const chord    = chordAt(phrase, chordStarts, melNote.startBeat)

    // Positive = melody moving up, negative = down, 0 = first note
    const melDir = i === 0 ? 0 : melPitch - melody[i - 1].pitch

    // Interval offsets: 3rds (3, 4) and 6ths (8, 9) in both directions.
    // Contrary motion: melody up → prefer below (negative offsets first).
    const offsets = melDir >= 0
      ? [-3, -4, -8, -9,  3,  4,  8,  9]
      : [ 3,  4,  8,  9, -3, -4, -8, -9]

    const candidates: { value: Pitch; weight: number }[] = []

    for (let idx = 0; idx < offsets.length; idx++) {
      const offset    = offsets[idx]
      const candidate = melPitch + offset
      if (candidate < CM_LO || candidate > CM_HI) continue
      if (i > 0 && isParallelProblem(prevMelPitch, prevCmPitch, melPitch, candidate)) continue

      // Position in the array encodes direction preference (earlier = more preferred)
      const posWeight   = 1.0 - idx * 0.05
      // Boost when candidate actually moves contrary to melody
      const contrary    = (melDir > 0 && offset < 0) || (melDir < 0 && offset > 0) ? 1.5 : 0.8
      const chordScore  = scoreNote(candidate, chord, melNote.startBeat, tension)

      candidates.push({
        value:  candidate,
        weight: Math.max(0.01, posWeight * contrary * (0.5 + chordScore)),
      })
    }

    const cmPitch = candidates.length > 0
      ? weightedPick(candidates)
      : toCmRange(melPitch - 4)  // fallback: major 3rd below, octave-adjusted

    notes.push({
      pitch:         cmPitch,
      startBeat:     melNote.startBeat,
      durationBeats: melNote.durationBeats,
      velocity:      Math.round(58 + tension * 28),
    })

    prevMelPitch = melPitch
    prevCmPitch  = cmPitch
  }

  return notes
}
