# MelodyBrain — CLAUDE.md

A chord-aware melody and arrangement engine. TypeScript prototype (Vite + React + TS),
deployed to GitHub Pages. The long-term target is a VST3 plugin built in C++ + JUCE —
the TypeScript prototype exists to validate the music logic before that port.

---

## Project goals

1. Build a harmonic engine in pure TypeScript that generates melodies, counter-melodies,
   and bass lines from a chord progression input
2. Validate that the output sounds musical (not random) before touching C++
3. Export MIDI files that can be dragged directly into FL Studio for evaluation
4. Eventually port the core `HarmonicEngine` logic to C++ with no JUCE dependency

---

## Stack

- **Vite + React + TypeScript** — standard scaffold, no exceptions
- **GitHub Pages** — deployment target; `vite.config.ts` base path must stay set to
  `/melodybrain/` at all times. Do NOT change this.
- **No audio libraries** — prototype is MIDI-only. No Tone.js, no Web Audio API,
  no Web MIDI API in v1. Output is MIDI file export only.
- **No UI component libraries** — plain React + inline styles only. Keep the UI
  minimal; this is a logic prototype, not a design showcase.
- **No state management libraries** — React useState/useReducer only.

---

## Architecture

### Core separation rule
The `HarmonicEngine` must remain completely decoupled from React and from any UI code.
It is a pure TypeScript module: inputs in, data out. No hooks, no DOM, no side effects.
This is non-negotiable — the engine will be ported to C++ and cannot have React entanglement.

### Directory structure
```
src/
  engine/               # Pure TS music logic — no React imports allowed here
    types.ts            # All shared types (Note, Chord, Phrase, etc.)
    chords.ts           # Chord tone extraction, passing tone logic, tension scoring
    melody.ts           # Core melody generator
    countermelody.ts    # Counter-melody generator
    bassline.ts         # Bass line generator
    variation.ts        # Motif variation engine (inversion, retrograde, sequence)
    phraseArc.ts        # Phrase arc / tension curve logic
    complexity.ts       # Complexity mode definitions and note-density rules
    midiExport.ts       # MIDI file serialization (binary, no libraries)
  components/           # React UI only — imports from engine/, never the other way
    ChordGrid.tsx        # Chord progression input
    ContourDrawer.tsx    # Phrase arc / contour shape UI
    GeneratorControls.tsx # Complexity mode, density, rhythm controls
    PianoRoll.tsx        # Read-only display of generated melody
    ExportButton.tsx     # Triggers MIDI file download
  App.tsx
  main.tsx
```

### Data flow (one direction only)
```
ChordGrid → Phrase → HarmonicEngine.generateMelody() → Note[] → PianoRoll + MIDI export
```
React never mutates engine state. The engine is called as a pure function and returns data.

---

## Core types (source of truth)

These types live in `src/engine/types.ts` and must not be changed without updating
all downstream engine functions.

```typescript
type Pitch = number                        // MIDI note number, 0–127

type Note = {
  pitch: Pitch
  startBeat: number                        // in beats, not ms
  durationBeats: number
  velocity: number                         // 0–127
}

type ChordQuality =
  | 'maj' | 'min' | 'dom7' | 'maj7' | 'min7'
  | 'dim' | 'dim7' | 'hdim7' | 'aug'
  | 'sus2' | 'sus4' | 'maj9' | 'min9'

type Chord = {
  root: Pitch                              // e.g. 60 = C4, but quality is root-relative
  quality: ChordQuality
  durationBeats: number
  intervals: number[]                      // semitones from root, auto-derived from quality
}

type ComplexityMode = 'minimal' | 'balanced' | 'dense' | 'complex' | 'chaotic'

type ContourPoint = { beat: number; tensionLevel: number }  // tensionLevel 0–1

type Phrase = {
  chords: Chord[]
  totalBeats: number
  contour: ContourPoint[]                  // tension arc across the phrase
  complexity: ComplexityMode
  tempo: number                            // BPM, used for MIDI export timing only
}

type GeneratedVoices = {
  melody: Note[]
  counterMelody: Note[]
  bassLine: Note[]
}
```

---

## Music logic rules

These encode the compositional intent of the project. Do not simplify or remove them
without explicit instruction.

### Chord tone weighting
- **Downbeats (beat 1, beat 3)**: must land on a chord tone (root, 3rd, 5th, 7th)
- **Upbeats**: may use passing tones, approach notes, neighbor tones
- **Weak subdivisions**: chromatic passing tones allowed
- A "tension note" (9th, 11th, 13th) may appear on a downbeat only if the phrase
  contour `tensionLevel` is above 0.6 at that point

### Passing tone logic
- Passing tones connect chord tones by step (whole or half step)
- Approach notes are always a half step below the target chord tone
- Neighbor tones return to the same pitch (upper or lower neighbor, then back)

### Phrase arc (tension curve)
- `contour` is an array of `{beat, tensionLevel}` points, interpolated across the phrase
- High tension (>0.7): favor 7ths, 9ths, tritones, chromatic movement
- Low tension (<0.3): favor root, 3rd, 5th; stepwise motion; longer note durations
- The phrase must resolve: the final note should land on a chord tone with
  tensionLevel ≤ 0.2

### Complexity modes
Each mode controls note density, rhythmic placement, and ornamentation:

| Mode | Notes/bar (approx) | Rhythm feel | Ornamentation |
|---|---|---|---|
| Minimal | 2–4 | Whole/half notes, few rests | None |
| Balanced | 4–8 | Quarter + eighth notes | Light passing tones |
| Dense | 8–12 | Eighth + sixteenth notes | Approach notes, neighbors |
| Complex | 12–16 | Mixed, syncopated | Full chromatic vocabulary |
| Chaotic | 16–32 | Irregular, cross-rhythm | Anything harmonically valid |

"Chaotic" is not random — it still respects chord tone placement on downbeats.
It just maximizes rhythmic unpredictability and note density within harmonic rules.

Chaotic upper bound is 32 — melody generator may use minNotesPerBar to push density without exceeding this.

`shouldOrnament` is false only for Minimal; Balanced and above all return true (light passing tones in Balanced count as ornamentation).

### Voice leading (counter-melody)
- Counter-melody moves in contrary motion to the main melody where possible
- Avoid parallel 5ths and parallel octaves between melody and counter-melody
- Prefer 3rds and 6ths as harmonic intervals between the two voices

### Bass line rules
- Bass always plays the chord root on beat 1
- In Minimal/Balanced: root on beat 1, fifth on beat 3
- In Dense/Complex: walking bass — stepwise motion connecting chord roots
- In Chaotic: walking bass with chromatic approach notes

---

## MIDI export

MIDI export is implemented manually in `src/engine/midiExport.ts` using raw binary.
Do NOT introduce any MIDI library (midi-writer-js, jsmidgen, etc.) — the manual
implementation exists so the serialization logic is fully understood before the C++ port.

MIDI file structure to produce:
- Format 0 (single track) for melody-only export
- Format 1 (multi-track) when exporting all three voices
- Tempo set from `phrase.tempo`
- Time signature: 4/4 always in v1
- One MIDI channel per voice: melody = ch1, counter-melody = ch2, bass = ch3
- Velocity from `note.velocity` directly

---

## GitHub Pages deployment

The Vite config must always have:
```typescript
base: '/melodybrain/'
```

Do NOT remove or change this. Removing it breaks all asset paths on GitHub Pages.
The repo name is `melodybrain` and the Pages deployment is from the `gh-pages` branch.

Deploy command: `npm run build && npx gh-pages -d dist`

---

## What NOT to do

- Do not import anything from `components/` inside `engine/` — ever
- Do not use `Math.random()` alone for note selection — always weight by harmonic
  function and contour tension
- Do not quantize everything to the beat grid — subtle timing variation is intentional
  in Dense/Complex/Chaotic modes
- Do not add audio playback in the prototype — MIDI export only
- Do not change `vite.config.ts` base path
- Do not install Tone.js, Tonal.js, or any music theory library — the engine logic
  is hand-rolled intentionally so it can be ported to C++
- Do not use a CSS framework or component library
- Do not add a backend — this is a fully static site

---

## Future VST3 port notes

The TypeScript engine is designed to mirror the C++ port structure:
- `HarmonicEngine` → `HarmonicEngine.cpp/.h` (pure C++, no JUCE)
- `PluginProcessor` (JUCE) will call `HarmonicEngine::generateMelody()` on demand
- MIDI output in the VST will use JUCE's `MidiBuffer` — no manual binary serialization
- The complexity modes map directly to a VST parameter (enum, 0–4)
- The contour curve maps to a drawable JUCE component (custom `Component` subclass)

When porting, translate types first (`types.ts` → `Types.h`), then chord logic,
then the generator, then the arc system. Do not start with the JUCE wrapper.
