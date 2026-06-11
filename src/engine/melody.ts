import type { Note, Phrase } from './types'
import { getChordTones } from './chords'
import { getRhythmPool } from './complexity'

export function generateMelody(phrase: Phrase): Note[] {
  if (phrase.chords.length === 0) return []

  const notes: Note[] = []
  const rhythmPool = getRhythmPool(phrase.complexity)
  let globalBeat = 0

  for (const chord of phrase.chords) {
    const chordTones = getChordTones(chord)
    const chordEnd   = globalBeat + chord.durationBeats
    let beat = globalBeat

    while (beat < chordEnd - 0.001) {
      const remaining = chordEnd - beat
      const valid     = rhythmPool.filter(d => d <= remaining + 0.001)
      const duration  = valid.length > 0
        ? Math.min(valid[Math.floor(Math.random() * valid.length)], remaining)
        : remaining

      const pitch = chordTones[Math.floor(Math.random() * chordTones.length)]

      console.log(`beat ${beat} | chord ${chord.root} ${chord.quality} | tones [${chordTones}] | picked ${pitch}`)

      notes.push({ pitch, startBeat: beat, durationBeats: duration, velocity: 80 })
      beat += duration
    }

    globalBeat = chordEnd
  }

  // Final note: root of last chord (lowest chord tone = chord.root + 0)
  if (notes.length > 0) {
    const lastChord = phrase.chords[phrase.chords.length - 1]
    notes[notes.length - 1] = {
      ...notes[notes.length - 1],
      pitch: Math.min(...getChordTones(lastChord)),
    }
  }

  return notes
}
