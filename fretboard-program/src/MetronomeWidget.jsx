import { useState, useRef, useEffect, useCallback } from "react";

/**
 * MetronomeWidget — a floating, collapsible metronome / beat machine.
 *
 * Drop this in once near the root of your app (e.g. in App.jsx, alongside
 * your routes) so it persists across pages:
 *
 *   <MetronomeWidget />
 *
 * Two modes:
 *  - "Click": a standard metronome. Widget stays compact.
 *  - "Beat": an FL-Studio-style step sequencer — 5 instrument rows
 *    (kick, snare, closed hat, open hat, clap) x 16th-note steps across
 *    the bar. The widget widens in place to show the grid. Multiple
 *    patterns can be built and switched between via the tabs.
 *
 * All sounds are synthesized live with the Web Audio API — no audio files
 * to bundle. If you later want real sampled drums, swap out playKick /
 * playSnare / playHihat / playClap for AudioBufferSourceNode playback of
 * loaded samples; scheduleStep() calls them the same way either way.
 *
 * No localStorage is used here (kept as plain component state) — lift the
 * patterns/settings up or wire up your own persistence if you want them
 * remembered between visits.
 */

const INSTRUMENTS = [
  { key: "kick", label: "Kick" },
  { key: "snare", label: "Snare" },
  { key: "hihatClosed", label: "Hat (cl)" },
  { key: "hihatOpen", label: "Hat (op)" },
  { key: "clap", label: "Clap" },
];

const METER_OPTIONS = [
  { value: 2, label: "2/4" },
  { value: 3, label: "3/4" },
  { value: 4, label: "4/4" },
  { value: 5, label: "5/4" },
  { value: 6, label: "6/8" },
];

const VOICE_OPTIONS = [
  { value: "classic", label: "Classic click" },
  { value: "digital", label: "Digital beep" },
  { value: "wood", label: "Woodblock" },
  { value: "cowbell", label: "Cowbell" },
];

const MIN_BPM = 40;
const MAX_BPM = 240;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// widens the panel exactly enough to fit every step column, so the grid
// never needs its own horizontal scrollbar (n is always a multiple of 4)
function panelWidthForSteps(n) {
  const CELL = 20, GAP = 3, GROUP_MARGIN = 6;
  const boundaries = (n / 4) - 1;
  const gridWidth = n * CELL + (n - 1) * GAP + boundaries * GROUP_MARGIN;
  const PANEL_PADDING = 32, MAIN_WIDTH = 246, MAIN_GAP = 18, LABELS_WIDTH = 74, LABELS_GAP = 8, BUFFER = 4;
  return PANEL_PADDING + MAIN_WIDTH + MAIN_GAP + LABELS_WIDTH + LABELS_GAP + gridWidth + BUFFER;
}
function emptySteps(n) {
  return new Array(n).fill(false);
}
function resizeSteps(arr, n) {
  const out = arr.slice(0, n);
  while (out.length < n) out.push(false);
  return out;
}
function makePattern(name, steps) {
  const cells = {};
  INSTRUMENTS.forEach((inst) => { cells[inst.key] = emptySteps(steps); });
  return { id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`, name, cells };
}

export default function MetronomeWidget() {
  const [bpm, setBpm] = useState(120);
  const [meter, setMeter] = useState(4);
  const [mode, setMode] = useState("click"); // 'click' | 'beat'
  const [voice, setVoice] = useState("classic");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1); // quarter-note LED, click mode
  const [activeStep, setActiveStep] = useState(-1); // 16th-note playhead, beat mode

  const [patterns, setPatterns] = useState(() => [makePattern("Pattern 1", 16)]);
  const [currentPatternId, setCurrentPatternId] = useState(() => patterns[0].id);

  const steps = meter * 4;
  const currentPattern = patterns.find((p) => p.id === currentPatternId) || patterns[0];

  // live values mirrored into refs so the scheduler (running outside
  // React's render cycle) always reads the current settings
  const bpmRef = useRef(bpm);
  const modeRef = useRef(mode);
  const voiceRef = useRef(voice);
  const stepsRef = useRef(steps);
  const patternsRef = useRef(patterns);
  const currentPatternIdRef = useRef(currentPatternId);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  useEffect(() => { currentPatternIdRef.current = currentPatternId; }, [currentPatternId]);

  const audioCtxRef = useRef(null);
  const schedulerTimerRef = useRef(null);
  const nextStepTimeRef = useRef(0);
  const currentStepIdxRef = useRef(0);
  const noteQueueRef = useRef([]);
  const rafRef = useRef(null);
  const tapTimesRef = useRef([]);

  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const noiseBuffer = useCallback((ctx, dur = 0.3) => {
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }, []);

  const playCowbell = useCallback((ctx, time, accent) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(accent ? 0.35 : 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 2;
    gain.connect(filter);
    filter.connect(ctx.destination);
    [800, 540].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(f, time);
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + 0.3);
    });
  }, []);

  const playClickVoice = useCallback((ctx, time, accent) => {
    if (voiceRef.current === "cowbell") {
      playCowbell(ctx, time, accent);
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    let freq, dur, type;
    switch (voiceRef.current) {
      case "digital": type = "square"; freq = accent ? 1500 : 1100; dur = 0.035; break;
      case "wood": type = "triangle"; freq = accent ? 1800 : 1400; dur = 0.045; break;
      default: type = "sine"; freq = accent ? 1000 : 780; dur = 0.03;
    }
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(accent ? 0.5 : 0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }, [playCowbell]);

  const playKick = useCallback((ctx, time) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.24);
  }, []);

  const playSnare = useCallback((ctx, time) => {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 0.2);
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 1800;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    noise.connect(nf).connect(ng).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.15);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(190, time);
    og.gain.setValueAtTime(0.35, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(og).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
  }, [noiseBuffer]);

  const playHihat = useCallback((ctx, time, open) => {
    const dur = open ? 0.28 : 0.05;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, dur + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.22 : 0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + dur + 0.02);
  }, [noiseBuffer]);

  const playClap = useCallback((ctx, time) => {
    [0, 0.012, 0.024].forEach((offset, i) => {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx, 0.08);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500;
      filter.Q.value = 1.2;
      const gain = ctx.createGain();
      const g = i === 2 ? 0.35 : 0.22;
      gain.gain.setValueAtTime(g, time + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, time + offset + (i === 2 ? 0.18 : 0.03));
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(time + offset);
      noise.stop(time + offset + 0.2);
    });
  }, [noiseBuffer]);

  const scheduleStep = useCallback((ctx, stepIdx, time) => {
    if (modeRef.current === "click") {
      if (stepIdx % 4 === 0) {
        const beatIdx = stepIdx / 4;
        playClickVoice(ctx, time, beatIdx === 0);
        noteQueueRef.current.push({ kind: "beat", beat: beatIdx, time });
      }
    } else {
      const pattern = patternsRef.current.find((p) => p.id === currentPatternIdRef.current);
      if (pattern) {
        if (pattern.cells.kick[stepIdx]) playKick(ctx, time);
        if (pattern.cells.snare[stepIdx]) playSnare(ctx, time);
        if (pattern.cells.hihatClosed[stepIdx]) playHihat(ctx, time, false);
        if (pattern.cells.hihatOpen[stepIdx]) playHihat(ctx, time, true);
        if (pattern.cells.clap[stepIdx]) playClap(ctx, time);
      }
      noteQueueRef.current.push({ kind: "step", step: stepIdx, time });
    }
  }, [playClickVoice, playKick, playSnare, playHihat, playClap]);

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const n = stepsRef.current;
    while (nextStepTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
      scheduleStep(ctx, currentStepIdxRef.current, nextStepTimeRef.current);
      const secondsPerStep = 60.0 / bpmRef.current / 4;
      nextStepTimeRef.current += secondsPerStep;
      currentStepIdxRef.current = (currentStepIdxRef.current + 1) % n;
    }
  }, [scheduleStep]);

  const drawLoop = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      while (noteQueueRef.current.length && noteQueueRef.current[0].time < now) {
        const note = noteQueueRef.current.shift();
        if (note.kind === "beat") setActiveBeat(note.beat);
        else setActiveStep(note.step);
      }
    }
    rafRef.current = requestAnimationFrame(drawLoop);
  }, []);

  const start = useCallback(() => {
    const ctx = ensureAudio();
    currentStepIdxRef.current = 0;
    nextStepTimeRef.current = ctx.currentTime + 0.05;
    schedulerTimerRef.current = setInterval(scheduler, LOOKAHEAD_MS);
    rafRef.current = requestAnimationFrame(drawLoop);
    setIsPlaying(true);
  }, [ensureAudio, scheduler, drawLoop]);

  const stop = useCallback(() => {
    clearInterval(schedulerTimerRef.current);
    cancelAnimationFrame(rafRef.current);
    noteQueueRef.current = [];
    setActiveBeat(-1);
    setActiveStep(-1);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(schedulerTimerRef.current);
      cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const handleTap = () => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    if (taps.length && now - taps[taps.length - 1] > 2000) tapTimesRef.current = [];
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 6) tapTimesRef.current.shift();
    if (tapTimesRef.current.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(clamp(Math.round(60000 / avg), MIN_BPM, MAX_BPM));
    }
  };

  const handleMeterChange = (newMeter) => {
    const newSteps = newMeter * 4;
    setPatterns((prev) => prev.map((p) => {
      const cells = {};
      INSTRUMENTS.forEach((inst) => { cells[inst.key] = resizeSteps(p.cells[inst.key], newSteps); });
      return { ...p, cells };
    }));
    setMeter(newMeter);
    currentStepIdxRef.current = 0;
    setActiveStep(-1);
  };

  const toggleCell = (instKey, stepIdx) => {
    setPatterns((prev) => prev.map((p) => {
      if (p.id !== currentPatternId) return p;
      const cells = { ...p.cells, [instKey]: p.cells[instKey].map((v, i) => (i === stepIdx ? !v : v)) };
      return { ...p, cells };
    }));
  };

  const addPattern = () => {
    const p = makePattern(`Pattern ${patterns.length + 1}`, steps);
    setPatterns((prev) => [...prev, p]);
    setCurrentPatternId(p.id);
  };

  const deletePattern = () => {
    if (patterns.length <= 1) return;
    const idx = patterns.findIndex((p) => p.id === currentPatternId);
    const next = patterns.filter((p) => p.id !== currentPatternId);
    setPatterns(next);
    setCurrentPatternId(next[Math.max(0, idx - 1)].id);
  };

  const renamePattern = (name) => {
    setPatterns((prev) => prev.map((p) => (p.id === currentPatternId ? { ...p, name } : p)));
  };

  const togglePlay = () => (isPlaying ? stop() : start());

  return (
    <>
      <style>{WIDGET_CSS}</style>
      <div className="bm-root">
        <div
          className={`bm-panel${isOpen ? " bm-panel-open" : ""}${mode === "beat" ? " bm-panel-wide" : ""}`}
          style={mode === "beat" ? { width: panelWidthForSteps(steps) } : undefined}
        >
          <div className="bm-header">
            <div className="bm-title">
              <span className={`bm-power-dot${isPlaying ? " bm-on" : ""}`} />
              Beat machine
            </div>
            <button className="bm-close" aria-label="Collapse" onClick={() => setIsOpen(false)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="bm-body">
            <div className="bm-main">
              <div className="bm-readout">
                <div>
                  <span className="bm-bpm-num">{bpm}</span>
                  <span className="bm-bpm-suffix">bpm</span>
                </div>
                <div className="bm-stepper">
                  <button aria-label="Increase tempo" onClick={() => setBpm((b) => clamp(b + 1, MIN_BPM, MAX_BPM))}>▲</button>
                  <button aria-label="Decrease tempo" onClick={() => setBpm((b) => clamp(b - 1, MIN_BPM, MAX_BPM))}>▼</button>
                </div>
              </div>

              {mode === "click" && (
                <div className="bm-beat-row">
                  {Array.from({ length: meter }).map((_, i) => (
                    <span
                      key={i}
                      className={`bm-beat-dot${activeBeat === i ? " bm-active" : ""}${i === 0 ? " bm-accent" : ""}`}
                    />
                  ))}
                </div>
              )}

              <div className="bm-slider-row">
                <input
                  type="range"
                  min={MIN_BPM}
                  max={MAX_BPM}
                  step={1}
                  value={bpm}
                  aria-label="Tempo"
                  onChange={(e) => setBpm(clamp(parseInt(e.target.value, 10), MIN_BPM, MAX_BPM))}
                />
              </div>

              <div className="bm-row">
                <div className="bm-field">
                  <label htmlFor="bm-meter">Meter</label>
                  <select id="bm-meter" value={meter} onChange={(e) => handleMeterChange(parseInt(e.target.value, 10))}>
                    {METER_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="bm-field" style={{ opacity: mode === "click" ? 1 : 0.35 }}>
                  <label htmlFor="bm-voice">Voice</label>
                  <select id="bm-voice" value={voice} disabled={mode !== "click"} onChange={(e) => setVoice(e.target.value)}>
                    {VOICE_OPTIONS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bm-field">
                <label>Mode</label>
                <div className="bm-mode-toggle">
                  <button className={`bm-mode-btn${mode === "click" ? " bm-active" : ""}`} onClick={() => setMode("click")}>Click</button>
                  <button className={`bm-mode-btn${mode === "beat" ? " bm-active" : ""}`} onClick={() => setMode("beat")}>Beat</button>
                </div>
              </div>

              <button className="bm-tap-btn" onClick={handleTap}>Tap tempo</button>
              <button className={`bm-play-btn${isPlaying ? " bm-playing" : ""}`} onClick={togglePlay}>
                {isPlaying ? "Stop" : "Start"}
              </button>
            </div>

            {mode === "beat" && (
              <div className="bm-seq">
                <div className="bm-pattern-bar">
                  <button
                    className="bm-pattern-icon-btn"
                    aria-label="Delete pattern"
                    title="Delete pattern"
                    disabled={patterns.length <= 1}
                    onClick={deletePattern}
                  >✕</button>
                  <input
                    className="bm-pattern-name"
                    maxLength={24}
                    aria-label="Pattern name"
                    value={currentPattern.name}
                    onChange={(e) => renamePattern(e.target.value)}
                  />
                  <button className="bm-pattern-icon-btn" aria-label="New pattern" title="New pattern" onClick={addPattern}>＋</button>
                </div>

                <div className="bm-pattern-tabs">
                  {patterns.map((p) => (
                    <button
                      key={p.id}
                      className={`bm-pattern-tab${p.id === currentPatternId ? " bm-active" : ""}`}
                      title={p.name}
                      onClick={() => setCurrentPatternId(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <div className="bm-grid-wrap">
                  <div className="bm-grid-labels">
                    {INSTRUMENTS.map((inst) => (
                      <div key={inst.key} className="bm-grid-label">{inst.label}</div>
                    ))}
                  </div>
                  <div className="bm-grid-scroll">
                    <div className="bm-grid-rows">
                      {INSTRUMENTS.map((inst) => (
                        <div key={inst.key} className="bm-step-row">
                          {Array.from({ length: steps }).map((_, i) => {
                            const on = currentPattern.cells[inst.key]?.[i];
                            const isGroupEnd = (i + 1) % 4 === 0 && i !== steps - 1;
                            const isPlayhead = mode === "beat" && activeStep === i;
                            return (
                              <button
                                key={i}
                                className={`bm-step-cell bm-${inst.key}${on ? " bm-on" : ""}${isGroupEnd ? " bm-grp" : ""}${isPlayhead ? " bm-playhead" : ""}`}
                                aria-label={`${inst.label} step ${i + 1}`}
                                onClick={() => toggleCell(inst.key, i)}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button className="bm-fs-toggle" aria-label="Open beat machine" onClick={() => setIsOpen(true)}>
          <span className={`bm-fs-led${isPlaying ? " bm-on" : ""}`} />
        </button>
      </div>
    </>
  );
}

const WIDGET_CSS = `
.bm-root, .bm-root *, .bm-root *::before, .bm-root *::after { box-sizing: border-box; }
.bm-root {
  position: fixed; right: 22px; bottom: 22px; z-index: 1000;
  display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.bm-fs-toggle {
  width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer; padding: 0;
  background: radial-gradient(circle at 32% 28%, #3A3630, #2B2825 55%, #201E1C 100%);
  box-shadow: 0 6px 14px rgba(0,0,0,0.35), 0 0 0 3px #7A6440, inset 0 1px 1px rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center; transition: transform 0.12s ease;
}
.bm-fs-toggle:active { transform: scale(0.94); }
.bm-fs-led { width: 10px; height: 10px; border-radius: 50%; background: #5A4423; box-shadow: inset 0 1px 1px rgba(0,0,0,0.4); }
.bm-fs-led.bm-on { background: #E8A33D; box-shadow: 0 0 8px 2px rgba(232,163,61,0.75), inset 0 1px 1px rgba(0,0,0,0.2); }

.bm-panel {
  width: 278px;
  border-radius: 16px;
  background: linear-gradient(160deg, #3A3630, #2B2825 45%, #201E1C 100%);
  box-shadow: 0 18px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
  padding: 16px 16px 14px;
  display: none;
  color: #EDE7DD;
  transition: width 0.22s cubic-bezier(.3,.8,.4,1);
  overflow: hidden;
}
.bm-panel-open { display: block; }
.bm-panel-wide { width: 604px; }

.bm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.bm-title { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #9C948A; }
.bm-power-dot { width: 7px; height: 7px; border-radius: 50%; background: #4A2A23; box-shadow: inset 0 1px 1px rgba(0,0,0,0.4); }
.bm-power-dot.bm-on { background: #D9553F; box-shadow: 0 0 6px 1px rgba(217,85,63,0.7), inset 0 1px 1px rgba(0,0,0,0.2); }
.bm-close { background: none; border: none; color: #9C948A; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 6px; }
.bm-close:hover { background: rgba(255,255,255,0.06); color: #EDE7DD; }

.bm-body { display: flex; gap: 18px; align-items: flex-start; }
.bm-main { width: 246px; flex-shrink: 0; }

.bm-readout { background: #131211; border-radius: 10px; padding: 12px 14px; display: flex; align-items: baseline; justify-content: space-between; box-shadow: inset 0 2px 6px rgba(0,0,0,0.5); margin-bottom: 10px; }
.bm-bpm-num { font-family: 'SF Mono', Consolas, monospace; font-size: 34px; font-weight: 700; color: #E8A33D; text-shadow: 0 0 10px rgba(232,163,61,0.35); line-height: 1; min-width: 68px; display: inline-block; }
.bm-bpm-suffix { font-family: 'SF Mono', Consolas, monospace; font-size: 12px; color: #9C948A; margin-left: 4px; }
.bm-stepper { display: flex; flex-direction: column; gap: 4px; }
.bm-stepper button { width: 22px; height: 18px; background: #2B2825; border: 1px solid rgba(255,255,255,0.08); color: #9C948A; border-radius: 4px; cursor: pointer; font-size: 11px; line-height: 1; display: flex; align-items: center; justify-content: center; }
.bm-stepper button:hover { color: #EDE7DD; border-color: #7A6440; }

.bm-beat-row { display: flex; gap: 6px; justify-content: center; margin-bottom: 12px; min-height: 12px; }
.bm-beat-dot { width: 10px; height: 10px; border-radius: 50%; background: #201E1C; box-shadow: inset 0 1px 2px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04); }
.bm-beat-dot.bm-active { background: #E8A33D; box-shadow: 0 0 7px 2px rgba(232,163,61,0.7); }
.bm-beat-dot.bm-active.bm-accent { background: #D9553F; box-shadow: 0 0 8px 2px rgba(217,85,63,0.75); }

.bm-slider-row { margin-bottom: 12px; }
.bm-slider-row input[type="range"] { width: 100%; height: 4px; border-radius: 3px; background: #201E1C; }
.bm-row { display: flex; gap: 8px; margin-bottom: 8px; }
.bm-field { flex: 1; min-width: 0; }
.bm-field label { display: block; font-size: 10.5px; color: #9C948A; margin-bottom: 4px; }
.bm-field select { width: 100%; background: #201E1C; color: #EDE7DD; border: 1px solid rgba(255,255,255,0.08); border-radius: 7px; padding: 7px 8px; font-size: 12.5px; cursor: pointer; }
.bm-field select:disabled { cursor: default; }

.bm-mode-toggle { display: flex; background: #201E1C; border-radius: 7px; padding: 2px; gap: 2px; }
.bm-mode-btn { flex: 1; background: none; border: none; color: #9C948A; font-size: 12px; font-weight: 600; padding: 7px 0; border-radius: 5px; cursor: pointer; }
.bm-mode-btn.bm-active { background: #3A3630; color: #E8A33D; box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }

.bm-tap-btn { width: 100%; margin-top: 4px; background: #2B2825; border: 1px solid rgba(255,255,255,0.08); color: #EDE7DD; border-radius: 8px; padding: 8px 0; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.bm-tap-btn:hover { border-color: #7A6440; }
.bm-play-btn { width: 100%; margin-top: 10px; border: none; border-radius: 9px; padding: 11px 0; font-size: 13.5px; font-weight: 700; cursor: pointer; background: linear-gradient(180deg, #3d3a35, #2a2724); color: #EDE7DD; box-shadow: 0 2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06); }
.bm-play-btn.bm-playing { background: linear-gradient(180deg, #5f7a68, #3e5348); color: #eafff3; }
.bm-play-btn:active { transform: translateY(1px); }

/* step sequencer */
.bm-seq { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bm-pattern-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.bm-pattern-name { flex: 1; min-width: 0; background: #131211; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #E8A33D; font-family: 'SF Mono', Consolas, monospace; font-size: 12px; padding: 6px 8px; }
.bm-pattern-icon-btn { width: 26px; height: 26px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: #2B2825; color: #9C948A; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.bm-pattern-icon-btn:hover { color: #EDE7DD; border-color: #7A6440; }
.bm-pattern-icon-btn:disabled { opacity: 0.3; cursor: default; }

.bm-pattern-tabs { display: flex; gap: 4px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 2px; }
.bm-pattern-tab { flex-shrink: 0; font-family: 'SF Mono', Consolas, monospace; font-size: 10.5px; color: #9C948A; background: #201E1C; border: 1px solid rgba(255,255,255,0.06); border-radius: 5px; padding: 4px 8px; cursor: pointer; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bm-pattern-tab.bm-active { color: #E8A33D; border-color: #7A6440; background: #2B2825; }

.bm-grid-wrap { display: flex; gap: 8px; }
.bm-grid-labels { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; width: 74px; padding-top: 1px; }
.bm-grid-label { height: 20px; display: flex; align-items: center; font-size: 10.5px; color: #9C948A; }
.bm-grid-scroll { overflow-x: auto; flex: 1; min-width: 0; padding-bottom: 4px; }
.bm-grid-rows { display: flex; flex-direction: column; gap: 5px; width: max-content; }
.bm-step-row { display: flex; gap: 3px; }
.bm-step-cell { width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0; background: #201E1C; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; padding: 0; box-shadow: inset 0 1px 2px rgba(0,0,0,0.5); }
.bm-step-cell.bm-grp { margin-right: 6px; }
.bm-step-cell.bm-playhead { box-shadow: inset 0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.3); }
.bm-step-cell.bm-on.bm-kick { background: #E8A33D; box-shadow: 0 0 6px 1px rgba(232,163,61,0.6); }
.bm-step-cell.bm-on.bm-snare { background: #D9553F; box-shadow: 0 0 6px 1px rgba(217,85,63,0.6); }
.bm-step-cell.bm-on.bm-hihatClosed { background: #7FAE8E; box-shadow: 0 0 6px 1px rgba(127,174,142,0.6); }
.bm-step-cell.bm-on.bm-hihatOpen { background: #A9CDB6; box-shadow: 0 0 6px 1px rgba(169,205,182,0.6); }
.bm-step-cell.bm-on.bm-clap { background: #B58FCC; box-shadow: 0 0 6px 1px rgba(181,143,204,0.6); }
`;
