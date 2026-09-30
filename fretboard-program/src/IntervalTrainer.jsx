import React, { useState, useEffect, useCallback, useRef } from "react";
import { CHROMATIC_FLAT_NAMES } from "./musicTheory";

// ---- theory ---------------------------------------------------------------

// Standard tuning as MIDI numbers. Index 0 is the low E, matching
// FretboardQuizDiagram and musicTheory's STRING_OPEN_NOTES.
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const STRING_NAMES = ["low E", "A", "D", "G", "B", "high E"];
const STRING_LABELS = ["E", "A", "D", "G", "B", "e"];
const FRETS = 15;

const INTERVALS = {
  1: ["♭2", "minor 2nd"], 2: ["2", "major 2nd"], 3: ["♭3", "minor 3rd"],
  4: ["3", "major 3rd"], 5: ["4", "perfect 4th"], 6: ["♭5", "tritone"],
  7: ["5", "perfect 5th"], 8: ["♭6", "minor 6th"], 9: ["6", "major 6th"],
  10: ["♭7", "minor 7th"], 11: ["7", "major 7th"], 12: ["8", "octave"],
  13: ["♭9", "minor 9th"], 14: ["9", "major 9th"],
};

const POOLS = {
  major: [2, 4, 5, 7, 9, 11, 12],
  minor: [2, 3, 5, 7, 8, 10, 12],
  all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

const BEST_KEY = "fretboard-interval-best";
const midiAt = (s, f) => OPEN_MIDI[s] + f;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds one round: a root, a target interval above it within a hand's
// reach (same string or higher strings), and nearby distractors that
// never share the answer's pitch class, so only one circle is correct.
function makeRound({ scale, rootString, choices }) {
  const pool = POOLS[scale];
  for (let tries = 0; tries < 300; tries++) {
    const rs = rootString === "any" ? pick([0, 1, 2, 3, 4]) : Number(rootString);
    const rf = Math.floor(Math.random() * 13);
    const semi = pick(pool);
    const rootMidi = midiAt(rs, rf);
    const tm = rootMidi + semi;

    const spots = [];
    for (let s = rs; s < 6; s++)
      for (let f = 0; f <= FRETS; f++)
        if (midiAt(s, f) === tm && Math.abs(f - rf) <= 5) spots.push({ s, f, midi: tm });
    if (!spots.length) continue;
    const target = pick(spots);

    const lo = Math.max(0, Math.min(rf, target.f) - 3);
    const hi = Math.min(FRETS, Math.max(rf, target.f) + 3);
    let cand = [];
    for (let s = rs; s <= Math.min(5, rs + 3); s++)
      for (let f = lo; f <= hi; f++) {
        const m = midiAt(s, f);
        const d = m - rootMidi;
        if (d < 1 || d > 14 || m % 12 === tm % 12) continue;
        if (s === rs && f === rf) continue;
        cand.push({ s, f, midi: m, inPool: pool.includes(d) });
      }
    cand = shuffle(cand).sort((a, b) => b.inPool - a.inPool);

    const used = new Set([tm]);
    const wrong = [];
    for (const c of cand) {
      if (wrong.length >= choices - 1) break;
      if (used.has(c.midi)) continue;
      used.add(c.midi);
      wrong.push(c);
    }
    if (wrong.length < choices - 1) continue;

    const opts = shuffle([
      { ...target, ans: true },
      ...wrong.map((w) => ({ ...w, ans: false })),
    ]).map((o, i) => ({ ...o, id: i, state: null }));

    return { id: Date.now(), rs, rf, rootMidi, semi, opts, done: false, firstTry: true };
  }
  return null;
}

// ---- audio (Karplus-Strong pluck, no samples needed) ----------------------

function useGuitarSynth() {
  const ctxRef = useRef(null);
  return useCallback((midi, delay = 0) => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctxRef.current = new AC();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const sr = ctx.sampleRate;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const len = Math.floor(sr * 1.8);
    const N = Math.max(2, Math.round(sr / freq));
    const buf = ctx.createBuffer(1, len, sr);
    const y = buf.getChannelData(0);
    for (let i = 0; i < N; i++) y[i] = Math.random() * 2 - 1;
    for (let i = N; i < len; i++) y[i] = 0.996 * 0.5 * (y[i - N] + y[i - N + 1]);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(lp).connect(gain).connect(ctx.destination);
    src.start(ctx.currentTime + delay);
  }, []);
}

// ---- fretboard drawing ----------------------------------------------------

const LEFT = 18, OPEN_ZONE = 26, FRET_W = 30, GAP = 22, TOP = 14, BOTTOM = 18;
const WIDTH = LEFT + OPEN_ZONE + FRET_W * FRETS + 8;
const HEIGHT = TOP + GAP * 5 + BOTTOM;
const NECK_BOTTOM = TOP + GAP * 5;
const fretWireX = (f) => LEFT + OPEN_ZONE + FRET_W * f;
const fretCenterX = (f) =>
  f === 0 ? LEFT + OPEN_ZONE / 2 : LEFT + OPEN_ZONE + FRET_W * (f - 1) + FRET_W / 2;
const stringY = (s) => TOP + s * GAP;

function IntervalBoard({ round, revealLabels, onChoose }) {
  return (
    <div className="iv-board-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="fretboard-quiz-diagram iv-board">
        {Array.from({ length: FRETS + 1 }).map((_, f) => (
          <line key={`fw-${f}`} x1={fretWireX(f)} x2={fretWireX(f)} y1={TOP - 5} y2={NECK_BOTTOM + 5}
            className="fq-fret-wire" strokeWidth={f === 0 ? 4 : 1.25} />
        ))}
        {[3, 5, 7, 9, 15].map((f) => (
          <circle key={`in-${f}`} cx={fretCenterX(f)} cy={(TOP + NECK_BOTTOM) / 2} r={2.5} className="fq-inlay" />
        ))}
        <circle cx={fretCenterX(12)} cy={TOP + GAP * 1.5} r={2.5} className="fq-inlay" />
        <circle cx={fretCenterX(12)} cy={TOP + GAP * 3.5} r={2.5} className="fq-inlay" />
        {STRING_LABELS.map((label, s) => (
          <React.Fragment key={`s-${s}`}>
            <line x1={LEFT} x2={WIDTH - 4} y1={stringY(s)} y2={stringY(s)}
              className="fq-string" strokeWidth={0.9 + (6 - s) * 0.22} />
            <text x={2} y={stringY(s) + 3} className="fq-string-label">{label}</text>
          </React.Fragment>
        ))}
        {[3, 5, 7, 9, 12, 15].map((f) => (
          <text key={`fn-${f}`} x={fretCenterX(f)} y={HEIGHT - 3} textAnchor="middle" className="fq-fret-number">{f}</text>
        ))}

        {round && (
          <g className="iv-root">
            <circle cx={fretCenterX(round.rf)} cy={stringY(round.rs)} r={9} />
            <text x={fretCenterX(round.rf)} y={stringY(round.rs)}>R</text>
          </g>
        )}

        {round && round.opts.map((o) => {
          let cls = "iv-cand";
          if (o.state) cls += ` is-${o.state}`;
          if (round.done && o.ans && o.state !== "right") cls += " is-reveal";
          const label = o.state || revealLabels ? INTERVALS[o.midi - round.rootMidi][0] : "";
          return (
            <g key={`${round.id}-${o.id}`} className={cls} role="button" tabIndex={0}
              aria-label={`${STRING_NAMES[o.s]} string, fret ${o.f}`}
              onClick={() => onChoose(o)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChoose(o); }
              }}>
              <circle cx={fretCenterX(o.f)} cy={stringY(o.s)} r={9} />
              {label && <text x={fretCenterX(o.f)} y={stringY(o.s)}>{label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- section --------------------------------------------------------------

function Toggle({ options, value, onChange }) {
  return (
    <div className="tr-chord-toggle iv-toggle">
      {options.map(([v, label]) => (
        <button key={v} className={`tr-toggle-btn ${value === v ? "is-active" : ""}`}
          aria-pressed={value === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function IntervalTrainer() {
  const [mode, setMode] = useState("named");
  const [scale, setScale] = useState("major");
  const [playback, setPlayback] = useState("melodic");
  const [rootString, setRootString] = useState("any");
  const [choices, setChoices] = useState(4);
  const [round, setRound] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => {
    try { return Number(window.localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  });
  const pluck = useGuitarSynth();
  const heardFirst = useRef(false);

  const playRound = useCallback((r = round) => {
    if (!r) return;
    const target = r.opts.find((o) => o.ans);
    pluck(r.rootMidi, 0);
    pluck(target.midi, playback === "harmonic" ? 0 : 0.75);
  }, [round, playback, pluck]);

  const next = useCallback(() => {
    const r = makeRound({ scale, rootString, choices });
    setRound(r);
    setFeedback(null);
    // Browsers block audio until the first tap, so the very first round stays silent.
    if (r && heardFirst.current) playRound(r);
  }, [scale, rootString, choices, playRound]);

  // New round whenever a setting that changes the question changes.
  useEffect(() => { next(); }, [scale, rootString, choices]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (streak > best) {
      setBest(streak);
      try { window.localStorage.setItem(BEST_KEY, String(streak)); } catch { /* ignore */ }
    }
  }, [streak, best]);

  const choose = (o) => {
    heardFirst.current = true;
    if (!round || round.done || o.state) return;
    pluck(round.rootMidi, 0);
    pluck(o.midi, playback === "harmonic" ? 0 : 0.6);
    const name = INTERVALS[o.midi - round.rootMidi][1];
    if (o.ans) {
      setTotal((t) => t + 1);
      if (round.firstTry) { setScore((s) => s + 1); setStreak((s) => s + 1); }
      else setStreak(0);
      setFeedback({ good: true, text: round.firstTry ? `Yes, that's the ${name}.` : `Got it. That's the ${name}.` });
      setRound({ ...round, done: true, opts: round.opts.map((x) => (x.id === o.id ? { ...x, state: "right" } : x)) });
    } else {
      setFeedback({ good: false, text: `That one's a ${name}. Try another.` });
      setRound({ ...round, firstTry: false, opts: round.opts.map((x) => (x.id === o.id ? { ...x, state: "wrong" } : x)) });
    }
  };

  // Space replays, Enter moves on (ignored while a button or select has focus).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest("button, select, input, textarea, [role=button]")) return;
      if (e.code === "Space") { e.preventDefault(); heardFirst.current = true; playRound(); }
      if (e.key === "Enter") { heardFirst.current = true; next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playRound, next]);

  const prompt = (() => {
    if (!round) return "";
    const root = CHROMATIC_FLAT_NAMES[round.rootMidi % 12];
    const [short, long] = INTERVALS[round.semi];
    return mode === "named" || round.done
      ? <>Find the <strong>{short}</strong> ({long}) above {root} on the {STRING_NAMES[round.rs]} string</>
      : <>Root is {root} on the {STRING_NAMES[round.rs]} string. Listen, then find the note</>;
  })();

  return (
    <section className="tr-quiz iv-trainer">
      <div className="tr-quiz-head">
        <h2 className="tr-section-title">Interval Trainer</h2>
        <div className="tr-quiz-stats">
          <span>Score <strong>{score}/{total}</strong></span>
          <span>Streak <strong>{streak}</strong></span>
          <span>Best <strong>{best}</strong></span>
        </div>
      </div>

      <div className="iv-controls">
        <div className="iv-control">
          <span className="iv-label">Mode</span>
          <Toggle value={mode} onChange={setMode}
            options={[["named", "Show interval"], ["blind", "Blind"]]} />
        </div>
        <div className="iv-control">
          <span className="iv-label">Scale</span>
          <Toggle value={scale} onChange={setScale}
            options={[["major", "Major"], ["minor", "Minor"], ["all", "All 12"]]} />
        </div>
        <div className="iv-control">
          <span className="iv-label">Playback</span>
          <Toggle value={playback} onChange={setPlayback}
            options={[["melodic", "One then other"], ["harmonic", "Together"]]} />
        </div>
        <div className="iv-control">
          <span className="iv-label">Choices</span>
          <Toggle value={choices} onChange={setChoices} options={[[3, "3"], [4, "4"], [6, "6"]]} />
        </div>
        <div className="iv-control">
          <span className="iv-label">Root string</span>
          <select className="tr-chord-select iv-select" value={rootString}
            onChange={(e) => setRootString(e.target.value)}>
            <option value="any">Any string</option>
            {[0, 1, 2, 3, 4].map((s) => (
              <option key={s} value={s}>{STRING_NAMES[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="iv-prompt-row">
        <p className="iv-prompt">{prompt}</p>
        <div className="iv-actions">
          <button className="tr-toggle-btn" onClick={() => { heardFirst.current = true; playRound(); }}>Play again</button>
          <button className="tr-toggle-btn" onClick={() => { heardFirst.current = true; round && pluck(round.rootMidi); }}>Root only</button>
        </div>
      </div>

      <IntervalBoard round={round} revealLabels={round?.done} onChoose={choose} />

      <div className="iv-foot">
        <p className={`iv-feedback ${feedback ? (feedback.good ? "is-good" : "is-bad") : ""}`} aria-live="polite">
          {feedback?.text || "\u00a0"}
        </p>
        <button className="tr-toggle-btn is-active" onClick={() => { heardFirst.current = true; next(); }}>Next</button>
      </div>
      <p className="tr-quiz-prompt">
        Space replays the sound, Enter moves to the next one. Wrong picks play their own note so you can hear the difference.
      </p>
    </section>
  );
}
