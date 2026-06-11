import type { Pitch, Chord, ChordQuality } from './types'

export function buildChordIntervals(quality: ChordQuality): number[] {
  switch (quality) {
    case 'maj':   return [0, 4, 7]
    case 'min':   return [0, 3, 7]
    case 'dom7':  return [0, 4, 7, 10]
    case 'maj7':  return [0, 4, 7, 11]
    case 'min7':  return [0, 3, 7, 10]
    case 'dim':   return [0, 3, 6]
    case 'dim7':  return [0, 3, 6, 9]
    case 'hdim7': return [0, 3, 6, 10]
    case 'aug':   return [0, 4, 8]
    case 'sus2':  return [0, 2, 7]
    case 'sus4':  return [0, 5, 7]
    case 'maj9':  return [0, 4, 7, 11, 14]
    case 'min9':  return [0, 3, 7, 10, 14]
  }
}

export function getChordTones(chord: Chord): Pitch[] {
  return chord.intervals.map(interval => chord.root + interval)
}

export function getPassingTones(chord: Chord, nextChord: Chord): Pitch[] {
  const tones = getChordTones(chord)
  const nextTones = getChordTones(nextChord)

  const allChordClasses = new Set([
    ...tones.map(p => ((p % 12) + 12) % 12),
    ...nextTones.map(p => ((p % 12) + 12) % 12),
  ])

  const result = new Set<Pitch>()

  for (const ct of tones) {
    for (const step of [-2, -1, 1, 2]) {
      const candidate = ct + step
      const cls = ((candidate % 12) + 12) % 12
      if (!allChordClasses.has(cls)) {
        result.add(candidate)
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b)
}

export function getApproachNotes(targetPitch: Pitch): Pitch[] {
  return [targetPitch - 1, targetPitch + 1]
}

export function intervalsBetween(a: Pitch, b: Pitch): number {
  return Math.abs(a - b)
}

function pitchClassDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 12
  return Math.min(diff, 12 - diff)
}

export function scoreNote(
  pitch: Pitch,
  chord: Chord,
  beatPosition: number,
  tensionLevel: number
): number {
  const pc = ((pitch - chord.root) % 12 + 12) % 12
  const chordClasses = chord.intervals.map(i => i % 12)
  const isChordTone = chordClasses.includes(pc)
  const isDownbeat = Math.floor(beatPosition) % 2 === 0

  if (isChordTone) {
    return isDownbeat ? 1.0 : 0.8
  }

  // 9th = pc 2, 11th = pc 5, 13th = pc 9
  const tensionClasses = new Set([2, 5, 9])
  if (tensionClasses.has(pc)) {
    if (isDownbeat && tensionLevel < 0.6) return 0.1
    return tensionLevel >= 0.6 ? 0.7 : 0.5
  }

  const isPassingTone = chordClasses.some(ci => pitchClassDistance(pc, ci) <= 2)

  if (isPassingTone) {
    return tensionLevel > 0.6 ? 0.55 : 0.4
  }

  return tensionLevel > 0.6 ? 0.3 : 0.1
}
