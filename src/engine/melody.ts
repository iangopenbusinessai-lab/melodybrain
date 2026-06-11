import type { Pitch, Note, Phrase, Chord } from './types'
import { getChordTones, getPassingTones, getApproachNotes, scoreNote } from './chords'
import { interpolateTension } from './phraseArc'
import { getRhythmPool, getNoteDensity } from './complexity'
import { weightedPick } from './utils'

const MELODY_LO = 60  // C4
const MELODY_HI = 84  // C6

function toMelodyRange(pitch: Pitch): Pitch {
  let p = pitch
  while (p < MELODY_LO) p += 12
  while (p > MELODY_HI) p -= 12
  return p
}

function pitched(
  pitches: Pitch[],
  chord: Chord,
  beat: number,
  tension: number
): { value: Pitch; weight: number }[] {
  return pitches.map(p => ({
    value: p,
    weight: Math.max(0.01, scoreNote(p, chord, beat, tension)),
  }))
}

export function generateMelody(phrase: Phrase): Note[] {
  if (phrase.chords.length === 0) return []

  const notes: Note[] = []
  const rhythmPool = getRhythmPool(phrase.complexity)
  const density = getNoteDensity(phrase.complexity)
  const avgNotesPerBar = (density.minNotesPerBar + density.maxNotesPerBar) / 2
  const targetDur = 4 / avgNotesPerBar

  // Precompute chord start beats
  const chordStarts: number[] = []
  let acc = 0
  for (const chord of phrase.chords) {
    chordStarts.push(acc)
    acc += chord.durationBeats
  }

  for (let ci = 0; ci < phrase.chords.length; ci++) {
    const chord = phrase.chords[ci]
    const chordStart = chordStarts[ci]
    const chordEnd = chordStart + chord.durationBeats
    const nextChord = phrase.chords[ci + 1] ?? chord

    const chordTones = [...new Set(getChordTones(chord).map(toMelodyRange))]
    const passingTones = [...new Set(
      getPassingTones(chord, nextChord)
        .map(toMelodyRange)
        .filter(p => p >= MELODY_LO && p <= MELODY_HI),
    )]
    const approachPitches = [...new Set(
      getChordTones(nextChord)
        .map(toMelodyRange)
        .flatMap(getApproachNotes)
        .filter(p => p >= MELODY_LO && p <= MELODY_HI),
    )]

    let beat = chordStart

    while (beat < chordEnd - 0.001) {
      const beatInChord = beat - chordStart
      const tension = interpolateTension(phrase.contour, beat)
      const remaining = chordEnd - beat

      let pitch: Pitch

      if (beatInChord < 0.001) {
        // Beat 1 of chord: always a chord tone
        pitch = weightedPick(pitched(chordTones, chord, beat, tension))
      } else if (Math.abs(beatInChord - 2) < 0.001) {
        // Beat 3: chord tones preferred; passing tones allowed when tension > 0.4
        const pool =
          tension > 0.4 && passingTones.length > 0
            ? [...chordTones, ...passingTones]
            : chordTones
        pitch = weightedPick(pitched(pool, chord, beat, tension))
      } else {
        // Upbeat: chord tones always in pool; scoreNote weights them ~2× over passing tones.
        // Excluding them was the bug — every non-downbeat ended up a non-chord tone.
        const pool = [...new Set([...chordTones, ...passingTones, ...approachPitches])]
        pitch = weightedPick(pitched(pool, chord, beat, tension))
      }

      // Duration: weight pool toward targetDur; high tension biases shorter
      const durationCandidates = rhythmPool
        .filter(d => d <= remaining + 0.001)
        .map(d => {
          const dist = Math.abs(d - targetDur) + 0.5
          const tensionBias = tension > 0.6 ? (d <= targetDur ? 1.4 : 0.6) : 1.0
          return { value: d, weight: tensionBias / dist }
        })

      const duration = durationCandidates.length > 0
        ? Math.min(weightedPick(durationCandidates), remaining)
        : remaining

      notes.push({
        pitch,
        startBeat: beat,
        durationBeats: duration,
        velocity: Math.round(64 + tension * 40),
      })

      beat += duration
    }
  }

  // Final note: chord tone of last chord, tension forced to 0.1
  if (notes.length > 0) {
    const lastChord = phrase.chords[phrase.chords.length - 1]
    const lastChordStart = chordStarts[chordStarts.length - 1]
    const lastChordTones = [...new Set(getChordTones(lastChord).map(toMelodyRange))]
    notes[notes.length - 1] = {
      ...notes[notes.length - 1],
      pitch: weightedPick(pitched(lastChordTones, lastChord, lastChordStart, 0.1)),
      velocity: 72,
    }
  }

  return notes
}
