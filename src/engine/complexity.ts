import type { ComplexityMode } from './types'

export function getNoteDensity(mode: ComplexityMode): { minNotesPerBar: number; maxNotesPerBar: number } {
  switch (mode) {
    case 'minimal':  return { minNotesPerBar: 2,  maxNotesPerBar: 4  }
    case 'balanced': return { minNotesPerBar: 4,  maxNotesPerBar: 8  }
    case 'dense':    return { minNotesPerBar: 8,  maxNotesPerBar: 12 }
    case 'complex':  return { minNotesPerBar: 12, maxNotesPerBar: 16 }
    case 'chaotic':  return { minNotesPerBar: 16, maxNotesPerBar: 32 }
  }
}

export function getRhythmPool(mode: ComplexityMode): number[] {
  switch (mode) {
    case 'minimal':  return [2, 4]
    case 'balanced': return [0.5, 1, 2]
    case 'dense':    return [0.25, 0.5, 1]
    case 'complex':  return [0.25, 0.5, 0.75, 1]
    case 'chaotic':  return [0.125, 0.25, 0.33, 0.5, 0.75]
  }
}

export function shouldSyncopate(mode: ComplexityMode): boolean {
  return mode === 'dense' || mode === 'complex' || mode === 'chaotic'
}

export function shouldOrnament(mode: ComplexityMode): boolean {
  return mode !== 'minimal'
}
