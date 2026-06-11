import type { ContourPoint, Phrase } from './types'

export function interpolateTension(contour: ContourPoint[], beat: number): number {
  if (contour.length === 0) return 0
  if (contour.length === 1) return contour[0].tensionLevel

  const pts = [...contour].sort((a, b) => a.beat - b.beat)

  if (beat <= pts[0].beat) return pts[0].tensionLevel
  if (beat >= pts[pts.length - 1].beat) return pts[pts.length - 1].tensionLevel

  for (let i = 0; i < pts.length - 1; i++) {
    const lo = pts[i]
    const hi = pts[i + 1]
    if (beat >= lo.beat && beat <= hi.beat) {
      const t = (beat - lo.beat) / (hi.beat - lo.beat)
      return lo.tensionLevel + t * (hi.tensionLevel - lo.tensionLevel)
    }
  }

  return pts[pts.length - 1].tensionLevel
}

export function buildDefaultContour(
  totalBeats: number,
  shape: 'arch' | 'rise' | 'fall' | 'flat'
): ContourPoint[] {
  const mid = totalBeats / 2
  switch (shape) {
    case 'arch':
      return [
        { beat: 0, tensionLevel: 0.1 },
        { beat: mid, tensionLevel: 0.8 },
        { beat: totalBeats, tensionLevel: 0.1 },
      ]
    case 'rise':
      return [
        { beat: 0, tensionLevel: 0.1 },
        { beat: totalBeats, tensionLevel: 0.9 },
      ]
    case 'fall':
      return [
        { beat: 0, tensionLevel: 0.9 },
        { beat: totalBeats, tensionLevel: 0.1 },
      ]
    case 'flat':
      return [
        { beat: 0, tensionLevel: 0.4 },
        { beat: totalBeats, tensionLevel: 0.4 },
      ]
  }
}

export function getResolutionBeat(phrase: Phrase): number {
  return phrase.chords
    .slice(0, -1)
    .reduce((acc, chord) => acc + chord.durationBeats, 0)
}
