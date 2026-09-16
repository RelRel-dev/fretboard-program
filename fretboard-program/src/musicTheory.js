// 12 roots, shared between the guitar (chords-db) and piano (computed)
// chord views so both dropdowns line up. `dataKey` is how chords-db
// names the key internally (it spells out "sharp" instead of "#").
export const ROOTS = [
  { display: "C", dataKey: "C", semitone: 0 },
  { display: "C#", dataKey: "Csharp", semitone: 1 },
  { display: "D", dataKey: "D", semitone: 2 },
  { display: "Eb", dataKey: "Eb", semitone: 3 },
  { display: "E", dataKey: "E", semitone: 4 },
  { display: "F", dataKey: "F", semitone: 5 },
  { display: "F#", dataKey: "Fsharp", semitone: 6 },
  { display: "G", dataKey: "G", semitone: 7 },
  { display: "Ab", dataKey: "Ab", semitone: 8 },
  { display: "A", dataKey: "A", semitone: 9 },
  { display: "Bb", dataKey: "Bb", semitone: 10 },
  { display: "B", dataKey: "B", semitone: 11 },
];

// Used to label individual notes highlighted on the piano keyboard.
export const CHROMATIC_SHARP_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

export const CHROMATIC_FLAT_NAMES = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];

// All display/typed names that should count as correct for a given
// pitch class (0-11). Natural notes have one; the five black-key
// pitch classes have both a sharp and a flat spelling.
export const ENHARMONIC_ANSWERS = CHROMATIC_SHARP_NAMES.map((sharp, i) => {
  const flat = CHROMATIC_FLAT_NAMES[i];
  return flat === sharp ? [sharp] : [sharp, flat];
});

export function randomNoteLabel(pitchClass) {
  const options = ENHARMONIC_ANSWERS[pitchClass];
  return options[Math.floor(Math.random() * options.length)];
}

// Standard tuning, low string (index 0) to high string (index 5),
// as pitch-class semitones — matches the string order used elsewhere
// in the app (chords-db's `frets` arrays run the same direction).
export const STRING_OPEN_NOTES = [
  { label: "E", semitone: 4 },
  { label: "A", semitone: 9 },
  { label: "D", semitone: 2 },
  { label: "G", semitone: 7 },
  { label: "B", semitone: 11 },
  { label: "e", semitone: 4 },
];

// Cleans up free-typed note input ("c#", "Db", "f sharp") into a
// canonical "C#"/"Db"-style string for comparison against
// ENHARMONIC_ANSWERS.
export function normalizeNoteInput(raw) {
  const s = raw.trim();
  if (!s) return "";
  const letter = s[0].toUpperCase();
  const rest = s.slice(1).toLowerCase().replace(/\s/g, "");
  if (rest.startsWith("#") || rest.startsWith("sharp")) return `${letter}#`;
  if (rest.startsWith("b") || rest.startsWith("flat")) return `${letter}b`;
  return letter;
}

// Semitone intervals from the root for each chord type. Covers triads
// through 13th chords — deliberately not identical to guitar's suffix
// list (guitar's includes slash/inversion voicings that don't apply
// the same way on piano), but built with the same abbreviations so
// chordSymbol() works for both.
export const PIANO_CHORD_TYPES = [
  { suffix: "major", intervals: [0, 4, 7] },
  { suffix: "minor", intervals: [0, 3, 7] },
  { suffix: "dim", intervals: [0, 3, 6] },
  { suffix: "dim7", intervals: [0, 3, 6, 9] },
  { suffix: "aug", intervals: [0, 4, 8] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "6", intervals: [0, 4, 7, 9] },
  { suffix: "m6", intervals: [0, 3, 7, 9] },
  { suffix: "69", intervals: [0, 4, 7, 9, 14] },
  { suffix: "m69", intervals: [0, 3, 7, 9, 14] },
  { suffix: "7", intervals: [0, 4, 7, 10] },
  { suffix: "7b5", intervals: [0, 4, 6, 10] },
  { suffix: "7#5", intervals: [0, 4, 8, 10] },
  { suffix: "maj7", intervals: [0, 4, 7, 11] },
  { suffix: "maj7b5", intervals: [0, 4, 6, 11] },
  { suffix: "maj7#5", intervals: [0, 4, 8, 11] },
  { suffix: "m7", intervals: [0, 3, 7, 10] },
  { suffix: "m7b5", intervals: [0, 3, 6, 10] },
  { suffix: "mmaj7", intervals: [0, 3, 7, 11] },
  { suffix: "9", intervals: [0, 4, 7, 10, 14] },
  { suffix: "maj9", intervals: [0, 4, 7, 11, 14] },
  { suffix: "m9", intervals: [0, 3, 7, 10, 14] },
  { suffix: "add9", intervals: [0, 4, 7, 14] },
  { suffix: "madd9", intervals: [0, 3, 7, 14] },
  { suffix: "11", intervals: [0, 4, 7, 10, 14, 17] },
  { suffix: "maj11", intervals: [0, 4, 7, 11, 14, 17] },
  { suffix: "m11", intervals: [0, 3, 7, 10, 14, 17] },
  { suffix: "13", intervals: [0, 4, 7, 10, 14, 17, 21] },
  { suffix: "maj13", intervals: [0, 4, 7, 11, 14, 17, 21] },
  { suffix: "m13", intervals: [0, 3, 7, 10, 14, 17, 21] },
];

// "C" + "major" -> "C", "C" + "minor" -> "Cm", "C" + "maj7" -> "Cmaj7",
// "C" + "/E" -> "C/E" (guitar's slash-chord suffixes already start with "/").
export function chordSymbol(rootDisplay, suffix) {
  if (suffix === "major") return rootDisplay;
  if (suffix === "minor") return `${rootDisplay}m`;
  return `${rootDisplay}${suffix}`;
}

export function findRoot(display) {
  return ROOTS.find((r) => r.display === display) || ROOTS[0];
}
