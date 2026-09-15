import React from "react";
import { CHROMATIC_SHARP_NAMES } from "./musicTheory";

const OCTAVES = 2; // covers intervals up to a 13th (21 semitones)
const WHITE_KEY_WIDTH = 20;
const WHITE_KEY_HEIGHT = 76;
const BLACK_KEY_WIDTH = 12;
const BLACK_KEY_HEIGHT = 46;
const WHITE_KEYS_PER_OCTAVE = 7;

const WHITE_LOCAL_INDEX = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
// Black key sits just after this many white keys into the octave.
const BLACK_AFTER_WHITE_INDEX = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

function keyGeometry(semitoneFromRoot) {
  const octave = Math.floor(semitoneFromRoot / 12);
  const local = ((semitoneFromRoot % 12) + 12) % 12;
  if (local in WHITE_LOCAL_INDEX) {
    const whiteIdx = octave * WHITE_KEYS_PER_OCTAVE + WHITE_LOCAL_INDEX[local];
    return { isBlack: false, x: whiteIdx * WHITE_KEY_WIDTH };
  }
  const whiteIdx =
    octave * WHITE_KEYS_PER_OCTAVE + BLACK_AFTER_WHITE_INDEX[local];
  return {
    isBlack: true,
    x: (whiteIdx + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2,
  };
}

const TOTAL_WHITE_KEYS = OCTAVES * WHITE_KEYS_PER_OCTAVE;
const WIDTH = TOTAL_WHITE_KEYS * WHITE_KEY_WIDTH;
const HEIGHT = WHITE_KEY_HEIGHT + 4;

// `rootSemitone`: 0-11 chromatic index of the root. `intervals`: semitone
// offsets from the root (e.g. [0,4,7] for a major triad).
export default function PianoChordDiagram({ rootSemitone, intervals }) {
  const highlighted = new Set(intervals);
  const whiteKeys = [];
  const blackKeys = [];

  for (let s = 0; s < OCTAVES * 12; s += 1) {
    const { isBlack, x } = keyGeometry(s);
    const isOn = highlighted.has(s);
    const isRoot = isOn && s === 0;
    const noteName = CHROMATIC_SHARP_NAMES[(rootSemitone + s) % 12];
    const key = { s, x, isOn, isRoot, noteName };
    if (isBlack) blackKeys.push(key);
    else whiteKeys.push(key);
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="chord-diagram chord-diagram--piano"
    >
      {whiteKeys.map((k) => (
        <g key={`w-${k.s}`}>
          <rect
            x={k.x}
            y={0}
            width={WHITE_KEY_WIDTH}
            height={WHITE_KEY_HEIGHT}
            rx={2}
            className={`piano-key piano-key--white ${k.isOn ? (k.isRoot ? "is-root" : "is-on") : ""}`}
          />
          {k.isOn && (
            <text
              x={k.x + WHITE_KEY_WIDTH / 2}
              y={WHITE_KEY_HEIGHT - 8}
              textAnchor="middle"
              className="piano-key-label"
            >
              {k.noteName}
            </text>
          )}
        </g>
      ))}
      {blackKeys.map((k) => (
        <g key={`b-${k.s}`}>
          <rect
            x={k.x}
            y={0}
            width={BLACK_KEY_WIDTH}
            height={BLACK_KEY_HEIGHT}
            rx={2}
            className={`piano-key piano-key--black ${k.isOn ? (k.isRoot ? "is-root" : "is-on") : ""}`}
          />
          {k.isOn && (
            <text
              x={k.x + BLACK_KEY_WIDTH / 2}
              y={BLACK_KEY_HEIGHT - 6}
              textAnchor="middle"
              className="piano-key-label piano-key-label--black"
            >
              {k.noteName}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
