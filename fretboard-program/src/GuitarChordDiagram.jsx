import React from "react";

const NUM_STRINGS = 6;
const NUM_FRETS = 4;
const LEFT_PAD = 16;
const TOP_PAD = 26;
const STRING_GAP = 16;
const FRET_GAP = 20;
const WIDTH = LEFT_PAD + STRING_GAP * (NUM_STRINGS - 1) + 16;
const HEIGHT = TOP_PAD + FRET_GAP * NUM_FRETS + 14;

// Renders one voicing from chords-db's `position` shape:
// { frets: [-1|0|n, ...6], fingers: [...6], baseFret, barres: [row,...] }
// `frets`/`barres` values are rows already relative to baseFret (1..4).
export default function GuitarChordDiagram({ position }) {
  const { frets, fingers, baseFret, barres = [] } = position;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="chord-diagram"
    >
      {baseFret > 1 && (
        <text
          x={2}
          y={TOP_PAD + FRET_GAP * 0.5 + 4}
          className="chord-diagram-fret-label"
        >
          {baseFret}fr
        </text>
      )}

      {/* nut or top fret line */}
      <line
        x1={LEFT_PAD}
        y1={TOP_PAD}
        x2={LEFT_PAD + STRING_GAP * (NUM_STRINGS - 1)}
        y2={TOP_PAD}
        className="chord-diagram-line"
        strokeWidth={baseFret === 1 ? 3 : 1.5}
      />

      {/* remaining fret lines */}
      {Array.from({ length: NUM_FRETS }).map((_, i) => (
        <line
          key={`fret-${i}`}
          x1={LEFT_PAD}
          y1={TOP_PAD + FRET_GAP * (i + 1)}
          x2={LEFT_PAD + STRING_GAP * (NUM_STRINGS - 1)}
          y2={TOP_PAD + FRET_GAP * (i + 1)}
          className="chord-diagram-line"
          strokeWidth={1}
        />
      ))}

      {/* strings */}
      {Array.from({ length: NUM_STRINGS }).map((_, s) => (
        <line
          key={`string-${s}`}
          x1={LEFT_PAD + STRING_GAP * s}
          y1={TOP_PAD}
          x2={LEFT_PAD + STRING_GAP * s}
          y2={TOP_PAD + FRET_GAP * NUM_FRETS}
          className="chord-diagram-line"
          strokeWidth={1}
        />
      ))}

      {/* barres, drawn behind the individual dots */}
      {barres.map((row) => {
        const strings = frets
          .map((f, s) => (f === row ? s : null))
          .filter((s) => s !== null);
        if (strings.length < 2) return null;
        const xMin = LEFT_PAD + STRING_GAP * Math.min(...strings);
        const xMax = LEFT_PAD + STRING_GAP * Math.max(...strings);
        const cy = TOP_PAD + FRET_GAP * (row - 0.5);
        return (
          <rect
            key={`barre-${row}`}
            x={xMin - 6}
            y={cy - 6}
            width={xMax - xMin + 12}
            height={12}
            rx={6}
            className="chord-diagram-barre"
          />
        );
      })}

      {/* open/muted markers above the nut, fretted-note dots below */}
      {frets.map((f, s) => {
        const x = LEFT_PAD + STRING_GAP * s;
        if (f === -1) {
          return (
            <text
              key={`marker-${s}`}
              x={x}
              y={TOP_PAD - 10}
              textAnchor="middle"
              className="chord-diagram-marker chord-diagram-marker--mute"
            >
              ×
            </text>
          );
        }
        if (f === 0) {
          return (
            <circle
              key={`marker-${s}`}
              cx={x}
              cy={TOP_PAD - 12}
              r={4}
              className="chord-diagram-open"
            />
          );
        }
        const cy = TOP_PAD + FRET_GAP * (f - 0.5);
        const finger = fingers?.[s];
        return (
          <g key={`dot-${s}`}>
            <circle cx={x} cy={cy} r={7} className="chord-diagram-dot" />
            {finger > 0 && (
              <text
                x={x}
                y={cy + 3.5}
                textAnchor="middle"
                className="chord-diagram-finger"
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
