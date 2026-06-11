import type { Pitch, Note, Phrase } from './types'
import { getPassingTones, getApproachNotes } from './chords'

const BASS_LO = 36  // C2
const BASS_HI = 55  // G3

function toBassRange(pitch: Pitch): Pitch {
  let p = pitch
  while (p < BASS_LO) p += 12
  while (p > BASS_HI) p -= 12
  return p
}

export function generateBassLine(phrase: Phrase): Note[] {
  const notes: Note[] = []
  const mode = phrase.complexity
  let beat = 0

  for (let ci = 0; ci < phrase.chords.length; ci++) {
    const chord     = phrase.chords[ci]
    const nextChord = phrase.chords[ci + 1] ?? chord
    const duration  = chord.durationBeats
    const root      = toBassRange(chord.root)
    const fifth     = toBassRange(chord.root + 7)
    const nextRoot  = toBassRange(nextChord.root)

    if (mode === 'minimal' || mode === 'balanced') {
      if (duration >= 4) {
        // Root on beat 1, fifth on beat 3
        notes.push({ pitch: root,  startBeat: beat,     durationBeats: 2, velocity: 85 })
        notes.push({ pitch: fifth, startBeat: beat + 2, durationBeats: 2, velocity: 72 })
      } else {
        notes.push({ pitch: root, startBeat: beat, durationBeats: duration, velocity: 85 })
      }
    } else {
      // Dense / Complex / Chaotic: walking bass, one step per beat
      const steps   = Math.max(1, Math.floor(duration))
      const stepDur = duration / steps
      const passing = getPassingTones(chord, nextChord)
        .map(toBassRange)
        .filter(p => p >= BASS_LO && p <= BASS_HI)

      for (let s = 0; s < steps; s++) {
        const globalBeat = beat + s * stepDur
        let pitch: Pitch

        if (s === 0) {
          pitch = root
        } else if (mode === 'chaotic' && s === steps - 1 && steps > 1) {
          // Chromatic approach to next chord's root on final step
          const approaches = getApproachNotes(nextRoot)
            .filter(p => p >= BASS_LO && p <= BASS_HI)
          pitch = approaches.length > 0 ? approaches[0] : toBassRange(nextRoot - 1)
        } else {
          // Stepwise interpolation toward next root, biased by passing tones
          const t      = s / steps
          const target = Math.round(root + t * (nextRoot - root))
          pitch = passing.length > 0
            ? passing.reduce((best, p) =>
                Math.abs(p - target) < Math.abs(best - target) ? p : best
              , passing[0])
            : toBassRange(target)
        }

        notes.push({
          pitch,
          startBeat:     globalBeat,
          durationBeats: stepDur,
          velocity:      s === 0 ? 85 : 72,
        })
      }
    }

    beat += duration
  }

  return notes
}
