export type Pitch = number

export type Note = {
  pitch: Pitch
  startBeat: number
  durationBeats: number
  velocity: number
}

export type ChordQuality =
  | 'maj' | 'min' | 'dom7' | 'maj7' | 'min7'
  | 'dim' | 'dim7' | 'hdim7' | 'aug'
  | 'sus2' | 'sus4' | 'maj9' | 'min9'

export type Chord = {
  root: Pitch
  quality: ChordQuality
  durationBeats: number
  intervals: number[]
}

export type ComplexityMode = 'minimal' | 'balanced' | 'dense' | 'complex' | 'chaotic'

export type ContourPoint = { beat: number; tensionLevel: number }

export type Phrase = {
  chords: Chord[]
  totalBeats: number
  contour: ContourPoint[]
  complexity: ComplexityMode
  tempo: number
}

export type GeneratedVoices = {
  melody: Note[]
  counterMelody: Note[]
  bassLine: Note[]
}
