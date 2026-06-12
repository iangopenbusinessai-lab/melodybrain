import { useState } from 'react'
import { buildChordIntervals, getChordTones } from './engine/chords'
import { buildDefaultContour } from './engine/phraseArc'
import { generateMelody } from './engine/melody'
import { exportMelody, downloadMidi } from './engine/midiExport'
import { previewMelody, previewChords, stopPreview } from './engine/playback'
import type { Phrase, Note, Chord } from './engine/types'

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

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
  const [melodyVol, setMelodyVol] = useState(80)
  const [chordVol,  setChordVol]  = useState(45)

  function handleGenerate() {
    const generated = generateMelody(PHRASE)
    setNotes(generated)

    // Debug: verify each note against the chord active at that beat
    let beatAcc = 0
    const chordStarts = PHRASE.chords.map(c => { const s = beatAcc; beatAcc += c.durationBeats; return s })
    generated.forEach(note => {
      let ci = 0
      for (let i = chordStarts.length - 1; i >= 0; i--) { if (note.startBeat >= chordStarts[i]) { ci = i; break } }
      const chord = PHRASE.chords[ci]
      const tones = getChordTones(chord)
      const isChordTone = tones.some(t => t % 12 === note.pitch % 12)
      console.log(
        `beat ${note.startBeat.toFixed(2)} | chord[${ci}] ${chord.quality} root=${chord.root} | ` +
        `pitch=${note.pitch} | tones=[${tones.join(',')}] | chordTone=${isChordTone}`
      )
    })
  }

  function handlePlay() {
    previewMelody(notes, PHRASE.tempo, melodyVol / 100)   // clears existing, starts melody
    previewChords(PHRASE.chords, PHRASE.tempo, chordVol / 100)  // adds chords on top
  }

  function handleStop() {
    stopPreview()
  }

  function handleDebugChords() {
    const testChords: Chord[] = [
      { root: 60, quality: 'maj7', durationBeats: 4, intervals: buildChordIntervals('maj7') },
      { root: 57, quality: 'min7', durationBeats: 4, intervals: buildChordIntervals('min7') },
      { root: 62, quality: 'min7', durationBeats: 4, intervals: buildChordIntervals('min7') },
      { root: 55, quality: 'dom7', durationBeats: 4, intervals: buildChordIntervals('dom7') },
    ]
    for (const chord of testChords) {
      const intervals = buildChordIntervals(chord.quality)
      const tones     = getChordTones(chord)
      const names     = tones.map(t => NOTE_NAMES[((t % 12) + 12) % 12]).join(' ')
      console.log(`${NOTE_NAMES[chord.root % 12]}${chord.quality} → [${tones.join(', ')}] → ${names}`)
    }
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={handleGenerate}>Generate</button>
        <button onClick={handlePlay}  disabled={notes.length === 0}>Play</button>
        <button onClick={handleStop}>Stop</button>
        <button onClick={handleDownload} disabled={notes.length === 0}>Download MIDI</button>
        <button onClick={handleDebugChords}>Debug Chords</button>
      </div>

      <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Melody volume: {melodyVol}%
          <input type="range" min={0} max={100} value={melodyVol}
            onChange={e => setMelodyVol(+e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Chord volume: {chordVol}%
          <input type="range" min={0} max={100} value={chordVol}
            onChange={e => setChordVol(+e.target.value)} />
        </label>
      </div>

      <pre style={{ background: '#111', color: '#eee', padding: 16, overflowX: 'auto', fontSize: 12 }}>
        {notes.length === 0
          ? '// press Generate'
          : JSON.stringify(notes, null, 2)}
      </pre>
    </div>
  )
}
