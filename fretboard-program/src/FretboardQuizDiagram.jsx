import React from "react";

const STRINGS = 6;
const FRETS = 12;
const LEFT_LABEL_WIDTH = 18;
const OPEN_ZONE = 24;
const FRET_WIDTH = 28;
const STRING_GAP = 20;
const TOP_PAD = 12;
const BOTTOM_PAD = 16;

const WIDTH = LEFT_LABEL_WIDTH + OPEN_ZONE + FRET_WIDTH * FRETS + 8;
const HEIGHT = TOP_PAD + STRING_GAP * (STRINGS - 1) + BOTTOM_PAD;
const NECK_TOP = TOP_PAD;
const NECK_BOTTOM = TOP_PAD + STRING_GAP * (STRINGS - 1);
const SINGLE_INLAY_FRETS = [3, 5, 7, 9];
const DOUBLE_INLAY_FRET = 12;

function fretCenterX(fret) {
  if (fret === 0) return LEFT_LABEL_WIDTH + OPEN_ZONE / 2;
  return LEFT_LABEL_WIDTH + OPEN_ZONE + FRET_WIDTH * (fret - 1) + FRET_WIDTH / 2;
}

function fretWireX(fret) {
  return LEFT_LABEL_WIDTH + OPEN_ZONE + FRET_WIDTH * fret;
}

// `status`: null | "correct" | "wrong" — drives the feedback animation
// on the target dot. `dotKey` should change on every new question so
// the animation reliably replays (a fresh element remounts).
export default function FretboardQuizDiagram({
  targetString,
  targetFret,
  status,
  dotKey,
}) {
  const stringY = (s) => NECK_TOP + s * STRING_GAP;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      className="fretboard-quiz-diagram"
    >
      {/* fret wires (0 = nut) */}
      {Array.from({ length: FRETS + 1 }).map((_, f) => (
        <line
          key={`fw-${f}`}
          x1={fretWireX(f)}
          y1={NECK_TOP - 5}
          x2={fretWireX(f)}
          y2={NECK_BOTTOM + 5}
          className="fq-fret-wire"
          strokeWidth={f === 0 ? 4 : 1.25}
        />
      ))}

      {/* inlay dots */}
      {SINGLE_INLAY_FRETS.map((f) => (
        <circle
          key={`inlay-${f}`}
          cx={fretCenterX(f)}
          cy={(NECK_TOP + NECK_BOTTOM) / 2}
          r={2.5}
          className="fq-inlay"
        />
      ))}
      <circle
        cx={fretCenterX(DOUBLE_INLAY_FRET)}
        cy={NECK_TOP + STRING_GAP * 1.5}
        r={2.5}
        className="fq-inlay"
      />
      <circle
        cx={fretCenterX(DOUBLE_INLAY_FRET)}
        cy={NECK_TOP + STRING_GAP * 3.5}
        r={2.5}
        className="fq-inlay"
      />

      {/* strings, thicker toward the low E */}
      {Array.from({ length: STRINGS }).map((_, s) => (
        <line
          key={`str-${s}`}
          x1={LEFT_LABEL_WIDTH}
          y1={stringY(s)}
          x2={WIDTH - 4}
          y2={stringY(s)}
          className="fq-string"
          strokeWidth={0.9 + (STRINGS - s) * 0.22}
        />
      ))}

      {/* string labels */}
      {STRING_LABELS.map((label, s) => (
        <text
          key={`lbl-${s}`}
          x={2}
          y={stringY(s) + 3}
          className="fq-string-label"
        >
          {label}
        </text>
      ))}

      {/* fret number markers */}
      {[3, 5, 7, 9, 12].map((f) => (
        <text
          key={`fn-${f}`}
          x={fretCenterX(f)}
          y={HEIGHT - 3}
          textAnchor="middle"
          className="fq-fret-number"
        >
          {f}
        </text>
      ))}

      {/* target dot */}
      <circle
        key={dotKey}
        cx={fretCenterX(targetFret)}
        cy={stringY(targetString)}
        r={8}
        className={`fq-target-dot ${status ? `is-${status}` : ""}`}
      />
    </svg>
  );
}

const STRING_LABELS = ["E", "A", "D", "G", "B", "e"];
