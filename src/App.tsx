import { useState } from 'react'
import { buildChordIntervals } from './engine/chords'
import { buildDefaultContour } from './engine/phraseArc'
import { generateMelody } from './engine/melody'
import { exportMelody, downloadMidi } from './engine/midiExport'
import { previewMelody, stopPreview } from './engine/playback'
import type { Phrase, Note } from './engine/types'

const PHRASE: Phrase = {
  chords: [
    { root: 60, quality: 'maj7', durationBeats: 4, intervals: buildChordIntervals('maj7') },
    { root: 57, quality: 'min7', durationBeats: 4, intervals: buildChordIntervals('min7') },
    { root: 62, quality: 'min7', durationBeats: 4, intervals: buildChordIntervals('min7') },
    { root: 55, quality: 'dom7', durationBeats: 4, intervals: buildChordIntervals('dom7') },
  ],
  totalBeats: 16,
  contour: buildDefaultContour(16, 'arch'),
  complexity: 'balanced',
  tempo: 120,
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([])

  function handleGenerate() {
    setNotes(generateMelody(PHRASE))
  }

  function handlePlay() {
    previewMelody(notes, PHRASE.tempo)
  }

  function handleStop() {
    stopPreview()
  }

  function handleDownload() {
    if (notes.length === 0) return
    downloadMidi(exportMelody(notes, PHRASE), 'melody.mid')
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: 24 }}>
      <h2>MelodyBrain — dev harness</h2>
      <p style={{ marginBottom: 16 }}>
        Phrase: Cmaj7 → Am7 → Dm7 → G7 · 4 beats each · 120 BPM · balanced · arch contour
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button onClick={handleGenerate}>Generate</button>
        <button onClick={handlePlay}  disabled={notes.length === 0}>Play</button>
        <button onClick={handleStop}>Stop</button>
        <button onClick={handleDownload} disabled={notes.length === 0}>Download MIDI</button>
      </div>

      <pre style={{ background: '#111', color: '#eee', padding: 16, overflowX: 'auto', fontSize: 12 }}>
        {notes.length === 0
          ? '// press Generate'
          : JSON.stringify(notes, null, 2)}
      </pre>
    </div>
  )
}
