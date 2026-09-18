import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Search, Plus, Star, X, Play, Square, Repeat, Zap,
  Trash2, Pencil, ArrowLeft, Music,
} from "lucide-react";

/**
 * TabsSection — a self-contained "Tabs" section for the Fretboard Program.
 *
 * Drop in as a new nav item in App.jsx:
 *   import TabsSection from "./TabsSection";
 *   ...
 *   ) : section.type === "tabs" ? (
 *     <TabsSection />
 *   ) : ...
 *
 * Manages its own state and localStorage (separate key from the main app's
 * STORAGE_KEY, so it doesn't touch the existing save schema). Uses the same
 * CSS custom properties already defined on .tracker-root (--bg, --surface,
 * --accent, etc.) so it looks native rather than bolted on.
 *
 * Scope notes:
 *  - No live Songsterr/tab-site import — that would need a server-side proxy
 *    this static site doesn't have. Entry is manual paste-in instead.
 *  - "Synced playback" is a practice-cursor synced to a BPM clock you set,
 *    not to an audio recording (there's no audio file to analyze). You tell
 *    it how many tab columns equal one beat, and it sweeps through in time.
 *  - "This week's focus" is tracked here as a flag/filter. Surfacing it
 *    inside the existing Repertoire section is a follow-up wiring job once
 *    this is in — the two features don't share state yet.
 */

const STORAGE_KEY = "fretboard-tabs-v1";

const TECHNIQUE_PRESETS = [
  "Alternate picking", "Sweep picking", "Legato", "Tapping",
  "Fingerstyle", "Slap", "Hybrid picking", "Bending", "Rhythm", "Scales",
];

const STATUS_OPTIONS = [
  { value: "want", label: "Want to learn" },
  { value: "progress", label: "In progress" },
  { value: "learned", label: "Learned" },
];

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const MIN_BPM = 40;
const MAX_BPM = 240;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
function uid() {
  return `t${Date.now()}${Math.floor(Math.random() * 1000)}`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parses raw tab text — one block (old-format saved content) or several
 * blocks separated by blank lines (a fresh multi-row paste from a tab site)
 * — into clean per-string labels and pure musical content.
 *
 * For each line, everything before the first "|" is treated as the string
 * label (e.g. "e"), and every "|" after that is stripped entirely, since
 * bar lines are drawn programmatically from tempo/meter, not read from the
 * source text. Multiple blocks for the same string position are
 * concatenated in order, so a song split into several printed rows on the
 * source site is rebuilt as one continuous stream with nothing duplicated
 * or dropped at the seams.
 */
function parseRawTabText(raw) {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").filter((l) => l.trim().length > 0))
    .filter((b) => b.length > 0);
  if (!blocks.length) return { labels: [], lines: [] };

  const stringCount = blocks[0].length;
  const labels = [];
  const lines = Array.from({ length: stringCount }, () => "");

  blocks.forEach((block) => {
    block.forEach((rawLine, li) => {
      if (li >= stringCount) return; // ignore any ragged extra line in a block
      const match = rawLine.match(/^([^|]*)\|(.*)$/);
      let label = "";
      let body = rawLine;
      if (match) {
        label = match[1].trim();
        body = match[2];
      }
      if (!labels[li]) labels[li] = label || `S${li + 1}`;
      lines[li] += body.replace(/\|/g, "");
    });
  });

  return { labels, lines };
}

function loadTabs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [seedTab()];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) && parsed.length ? parsed : [seedTab()];
    // migrate any tab saved before labels were split out of the raw content
    return list.map((t) => {
      if (t.stringLabels) return t;
      const { labels, lines } = parseRawTabText(t.content || "");
      return { ...t, stringLabels: labels.length ? labels : defaultLabels(t.instrument), content: lines.join("\n") };
    });
  } catch {
    return [seedTab()];
  }
}
function saveTabs(tabs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch (err) {
    console.error("Failed to save tabs:", err);
  }
}

function makeTab(overrides = {}) {
  const instrument = overrides.instrument || "guitar";
  return {
    id: uid(),
    title: "",
    artist: "",
    instrument,
    tuning: "Standard",
    stringLabels: defaultLabels(instrument),
    techniques: [],
    difficulty: "Intermediate",
    status: "want",
    targetBpm: 100,
    columnsPerBeat: 4,
    beatsPerMeasure: 4,
    content: "",
    notes: "",
    weeklyFocus: false,
    practiceLog: [],
    createdAt: todayStr(),
    ...overrides,
  };
}

function seedTab() {
  return makeTab({
    title: "3-string minor sweep",
    artist: "Warm-up drill",
    instrument: "guitar",
    tuning: "Standard",
    techniques: ["Sweep picking"],
    difficulty: "Intermediate",
    status: "progress",
    targetBpm: 100,
    columnsPerBeat: 4,
    beatsPerMeasure: 4,
    notes: "Roll the fretting fingers down as the pick sweeps — don't hold the whole shape at once.",
    content:
      "----------------12-----------------\n" +
      "-------------13----13--------------\n" +
      "----------12----------12-----------\n" +
      "-------14-----------------14-------\n" +
      "----14------------------------14---\n" +
      "-12----------------------------12--",
  });
}

/* ---------------- small building blocks ---------------- */

function Sparkline({ points }) {
  if (!points || points.length < 2) return null;
  const w = 120, h = 28, pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = h - pad - ((p - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="ts-spark" aria-hidden="true">
      <polyline points={coords.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      {coords.map((c, i) => {
        const [x, y] = c.split(",");
        return <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 2.4 : 1.6} fill="var(--accent)" />;
      })}
    </svg>
  );
}

function StatusPill({ status, onChange }) {
  const idx = STATUS_OPTIONS.findIndex((s) => s.value === status);
  const cycle = () => onChange(STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length].value);
  const cls = status === "learned" ? "ts-good" : status === "progress" ? "ts-accent" : "ts-muted";
  return (
    <button className={`ts-pill ${cls}`} onClick={cycle} title="Click to change status">
      {STATUS_OPTIONS[idx]?.label ?? "Want to learn"}
    </button>
  );
}

/* ---------------- library ---------------- */

function TabCard({ tab, onOpen, onEdit, onDelete, onToggleFocus }) {
  const lastBpm = tab.practiceLog.length ? tab.practiceLog[tab.practiceLog.length - 1].bpm : null;
  return (
    <div className="ts-card">
      <button className="ts-card-main" onClick={() => onOpen(tab.id)}>
        <div className="ts-card-top">
          <span className="ts-card-title">{tab.title || "Untitled"}</span>
          <button
            className={`ts-star ${tab.weeklyFocus ? "is-on" : ""}`}
            onClick={(e) => { e.stopPropagation(); onToggleFocus(tab.id); }}
            aria-label={tab.weeklyFocus ? "Remove from this week's focus" : "Mark as this week's focus"}
            title="This week's focus"
          >
            <Star size={15} fill={tab.weeklyFocus ? "currentColor" : "none"} />
          </button>
        </div>
        <p className="ts-card-sub">
          {tab.artist || "—"} · {tab.instrument} · {tab.tuning}
        </p>
        <div className="ts-tag-row">
          {tab.techniques.slice(0, 3).map((t) => (
            <span key={t} className="ts-tag">{t}</span>
          ))}
        </div>
        <div className="ts-card-foot">
          <StatusPill status={tab.status} onChange={() => {}} />
          <span className="ts-bpm-chip">
            {lastBpm ? `${lastBpm} bpm last` : `target ${tab.targetBpm}`}
          </span>
        </div>
      </button>
      <div className="ts-card-actions">
        <button className="ts-icon-btn" onClick={() => onEdit(tab.id)} aria-label="Edit tab"><Pencil size={13} /></button>
        <button className="ts-icon-btn ts-danger" onClick={() => onDelete(tab.id)} aria-label="Delete tab"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function Library({ tabs, onOpen, onEdit, onDelete, onToggleFocus, onNew }) {
  const [search, setSearch] = useState("");
  const [filterInstrument, setFilterInstrument] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTechnique, setFilterTechnique] = useState("all");
  const [focusOnly, setFocusOnly] = useState(false);

  const allTechniques = useMemo(() => {
    const s = new Set();
    tabs.forEach((t) => t.techniques.forEach((tech) => s.add(tech)));
    return Array.from(s).sort();
  }, [tabs]);

  const filtered = tabs.filter((t) => {
    const q = search.trim().toLowerCase();
    if (q && !`${t.title} ${t.artist}`.toLowerCase().includes(q)) return false;
    if (filterInstrument !== "all" && t.instrument !== filterInstrument) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterTechnique !== "all" && !t.techniques.includes(filterTechnique)) return false;
    if (focusOnly && !t.weeklyFocus) return false;
    return true;
  });

  return (
    <div className="ts-library">
      <div className="ts-toolbar">
        <div className="ts-search">
          <Search size={14} />
          <input
            placeholder="Search title or artist"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={filterInstrument} onChange={(e) => setFilterInstrument(e.target.value)}>
          <option value="all">All instruments</option>
          <option value="guitar">Guitar</option>
          <option value="bass">Bass</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterTechnique} onChange={(e) => setFilterTechnique(e.target.value)}>
          <option value="all">All techniques</option>
          {allTechniques.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="ts-checkbox">
          <input type="checkbox" checked={focusOnly} onChange={(e) => setFocusOnly(e.target.checked)} />
          This week's focus only
        </label>
        <button className="ts-new-btn" onClick={onNew}><Plus size={14} /> New tab</button>
      </div>

      {filtered.length === 0 ? (
        <p className="ts-empty">
          {tabs.length === 0
            ? "Nothing here yet. Add a tab or an exercise to get started."
            : "Nothing matches those filters."}
        </p>
      ) : (
        <div className="ts-grid">
          {filtered.map((t) => (
            <TabCard key={t.id} tab={t} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} onToggleFocus={onToggleFocus} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- editor ---------------- */

const CELL_WIDTH = 3; // raw characters reserved per grid column (fits a 2-digit fret + separator)

function defaultLabels(instrument) {
  return instrument === "bass" ? ["G", "D", "A", "E"] : ["e", "B", "G", "D", "A", "E"];
}

function TabGridBuilder({ instrument, onInsert, onClose }) {
  const [labels, setLabels] = useState(() => defaultLabels(instrument));
  const [cols, setCols] = useState(32);
  const [stepsPerBeat, setStepsPerBeat] = useState(4);
  const [cells, setCells] = useState(() => defaultLabels(instrument).map(() => Array(32).fill("")));
  const inputRefs = useRef({});

  const setCell = (row, col, value) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
    setCells((prev) => {
      const next = prev.map((r) => r.slice());
      next[row][col] = digits;
      return next;
    });
  };

  const addColumns = () => {
    setCols((c) => c + 16);
    setCells((prev) => prev.map((r) => [...r, ...Array(16).fill("")]));
  };
  const clearGrid = () => setCells((prev) => prev.map((r) => r.map(() => "")));

  const focusCell = (row, col) => {
    const el = inputRefs.current[`${row}-${col}`];
    if (el) el.focus();
  };
  const handleKeyDown = (e, row, col) => {
    if (e.key === "ArrowRight") { e.preventDefault(); focusCell(row, Math.min(col + 1, cols - 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusCell(row, Math.max(col - 1, 0)); }
    else if (e.key === "ArrowDown") { e.preventDefault(); focusCell(Math.min(row + 1, labels.length - 1), col); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusCell(Math.max(row - 1, 0), col); }
  };

  const generate = () => {
    const text = cells
      .map((row) => row.map((v) => (v ? v.padEnd(CELL_WIDTH, "-") : "-".repeat(CELL_WIDTH))).join(""))
      .join("\n");
    onInsert(text, stepsPerBeat * CELL_WIDTH, labels);
  };

  return (
    <div className="ts-builder">
      <div className="ts-builder-head">
        <span className="ts-field-label">Build visually — type a fret number in a cell, arrow keys move around</span>
        <div className="ts-builder-actions">
          <label className="ts-checkbox">
            Steps/beat
            <input
              type="number" min={1} max={8} value={stepsPerBeat} className="ts-steps-input"
              onChange={(e) => setStepsPerBeat(clamp(parseInt(e.target.value, 10) || 1, 1, 8))}
            />
          </label>
          <button type="button" onClick={addColumns}>+16 columns</button>
          <button type="button" onClick={clearGrid}>Clear</button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="ts-builder-grid-wrap">
        <div className="ts-builder-grid">
          {labels.map((label, row) => (
            <div key={row} className="ts-builder-row">
              <input
                className="ts-builder-label"
                value={label}
                maxLength={3}
                onChange={(e) => setLabels((prev) => prev.map((l, i) => (i === row ? e.target.value : l)))}
              />
              {Array.from({ length: cols }).map((_, col) => (
                <input
                  key={col}
                  ref={(el) => { inputRefs.current[`${row}-${col}`] = el; }}
                  className={`ts-builder-cell${(col + 1) % stepsPerBeat === 0 ? " ts-builder-beat" : ""}`}
                  value={cells[row][col]}
                  onChange={(e) => setCell(row, col, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, row, col)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <button type="button" className="ts-save-btn ts-builder-insert" onClick={generate}>
        Insert into tab content
      </button>
    </div>
  );
}

/**
 * Tesseract is trained on dark text on a light background — a dark-mode
 * screenshot (light text on dark, common on tab sites and this app alike)
 * often reads far worse, sometimes as empty or garbled output. This
 * samples the image's average brightness and inverts it first if it looks
 * like a dark theme, entirely in-browser via canvas, before handing it to
 * the OCR engine.
 */
function prepareImageForOcr(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let total = 0;
      let sampled = 0;
      const step = 4 * 37; // sample sparsely across the image for speed
      for (let i = 0; i < data.length; i += step) {
        total += (data[i] + data[i + 1] + data[i + 2]) / 3;
        sampled++;
      }
      const avgBrightness = sampled ? total / sampled : 255;
      if (avgBrightness < 128) {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        ctx.putImageData(imageData, 0, 0);
      }
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function Editor({ initial, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteScratch, setPasteScratch] = useState("");
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState("");
  const fileInputRef = useRef(null);

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file again still fires onChange
    if (!file) return;
    setOcrError("");
    setOcrBusy(true);
    setOcrProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") setOcrProgress(Math.round((m.progress || 0) * 100));
        },
      });
      // Tab notation isn't English prose — the default language model can bias
      // toward dictionary-like corrections. Treating the image as one uniform
      // block (rather than guessing at multi-column document layout) is a
      // low-risk improvement; a character whitelist was also tried but caused
      // its own regressions (it can't recognize section headers like
      // "[Intro]" at all), so that's been backed out.
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
      });
      const ocrInput = await prepareImageForOcr(file);
      const { data } = await worker.recognize(ocrInput);
      await worker.terminate();
      const text = (data.text || "").replace(/\s+$/, "");
      const dashRatio = text.length ? (text.match(/-/g) || []).length / text.length : 0;
      if (!text) {
        setOcrError("Didn't find any readable text in that image — try a clearer or higher-res screenshot.");
      } else if (dashRatio < 0.15) {
        setOcrError(
          "This doesn't look like a plain-text tab — it reads like a graphical notation renderer " +
          "(Songsterr, Guitar Pro, MuseScore, etc.), which OCR can't reconstruct since the notes aren't laid " +
          "out as text. This works best on plain ASCII tabs. Try the visual builder instead for this one."
        );
      } else {
        set({ content: draft.content ? `${draft.content}\n${text}` : text });
      }
    } catch (err) {
      console.error("OCR failed:", err);
      setOcrError("Couldn't process that image. Check your connection (the recognition model downloads on first use) and try again.");
    } finally {
      setOcrBusy(false);
    }
  };

  const toggleTechnique = (t) => {
    set({
      techniques: draft.techniques.includes(t)
        ? draft.techniques.filter((x) => x !== t)
        : [...draft.techniques, t],
    });
  };

  const [customTech, setCustomTech] = useState("");
  const addCustomTech = () => {
    const t = customTech.trim();
    if (t && !draft.techniques.includes(t)) set({ techniques: [...draft.techniques, t] });
    setCustomTech("");
  };

  return (
    <div className="ts-editor">
      <div className="ts-editor-head">
        <button className="ts-back" onClick={onCancel}><ArrowLeft size={15} /> Back</button>
        <h2 className="ts-section-title">{initial.title ? "Edit tab" : "New tab"}</h2>
      </div>

      <div className="ts-form-row">
        <label>Title
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Blackbird intro" />
        </label>
        <label>Artist
          <input value={draft.artist} onChange={(e) => set({ artist: e.target.value })} placeholder="e.g. The Beatles" />
        </label>
      </div>

      <div className="ts-form-row">
        <label>Instrument
          <select value={draft.instrument} onChange={(e) => set({ instrument: e.target.value })}>
            <option value="guitar">Guitar</option>
            <option value="bass">Bass</option>
          </select>
        </label>
        <label>Tuning
          <input value={draft.tuning} onChange={(e) => set({ tuning: e.target.value })} placeholder="e.g. Drop D" />
        </label>
        <label>Difficulty
          <select value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
            {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      <div className="ts-form-row">
        <label>Target tempo (bpm)
          <input
            type="number" min={MIN_BPM} max={MAX_BPM} value={draft.targetBpm}
            onChange={(e) => set({ targetBpm: clamp(parseInt(e.target.value, 10) || MIN_BPM, MIN_BPM, MAX_BPM) })}
          />
        </label>
        <label title="How many tab columns equal one quarter-note beat — used to drive the practice cursor">
          Columns per beat
          <input
            type="number" min={1} max={16} value={draft.columnsPerBeat}
            onChange={(e) => set({ columnsPerBeat: clamp(parseInt(e.target.value, 10) || 1, 1, 16) })}
          />
        </label>
        <label title="Beats per bar — 4 for 4/4, 3 for 3/4, etc. Used to draw bar lines.">
          Beats per measure
          <input
            type="number" min={1} max={12} value={draft.beatsPerMeasure}
            onChange={(e) => set({ beatsPerMeasure: clamp(parseInt(e.target.value, 10) || 1, 1, 12) })}
          />
        </label>
        <label>Status
          <select value={draft.status} onChange={(e) => set({ status: e.target.value })}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="ts-field-block">
        <span className="ts-field-label">Techniques</span>
        <div className="ts-tag-row ts-tag-row-wrap">
          {TECHNIQUE_PRESETS.map((t) => (
            <button
              key={t}
              className={`ts-tag-btn ${draft.techniques.includes(t) ? "is-active" : ""}`}
              onClick={() => toggleTechnique(t)}
              type="button"
            >
              {t}
            </button>
          ))}
          {draft.techniques.filter((t) => !TECHNIQUE_PRESETS.includes(t)).map((t) => (
            <button key={t} className="ts-tag-btn is-active" onClick={() => toggleTechnique(t)} type="button">
              {t} <X size={11} />
            </button>
          ))}
        </div>
        <div className="ts-custom-tag">
          <input
            placeholder="Add a custom tag"
            value={customTech}
            onChange={(e) => setCustomTech(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTech(); } }}
          />
          <button type="button" onClick={addCustomTech}>Add</button>
        </div>
      </div>

      <label className="ts-field-block">
        <div className="ts-field-label-row">
          <span className="ts-field-label">Tab content</span>
          <div className="ts-content-actions">
            <button
              type="button"
              className="ts-builder-toggle"
              disabled={ocrBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {ocrBusy ? `Reading image… ${ocrProgress}%` : "Import from screenshot"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="ts-hidden-file-input"
              onChange={handleScreenshot}
            />
            <button type="button" className="ts-builder-toggle" onClick={() => setShowPaste((v) => !v)}>
              {showPaste ? "Hide paste importer" : "Paste from site"}
            </button>
            <button type="button" className="ts-builder-toggle" onClick={() => setShowBuilder((v) => !v)}>
              {showBuilder ? "Hide visual builder" : "Build visually"}
            </button>
          </div>
        </div>
        {ocrError && <p className="ts-ocr-error">{ocrError}</p>}
        {showPaste && (
          <div className="ts-builder">
            <div className="ts-builder-head">
              <span className="ts-field-label">
                Paste the raw tab text copied from the site below, then Parse — labels and bar
                dividers are stripped and detected automatically, and multiple rows are merged
                into one continuous tab.
              </span>
              <div className="ts-builder-actions">
                <button type="button" onClick={() => { setShowPaste(false); setPasteScratch(""); }}>Close</button>
              </div>
            </div>
            <textarea
              className="ts-tab-textarea ts-paste-scratch"
              rows={6}
              value={pasteScratch}
              onChange={(e) => setPasteScratch(e.target.value)}
              placeholder={"Paste the full copied tab here, including all its rows..."}
            />
            <button
              type="button"
              className="ts-save-btn ts-builder-insert"
              disabled={!pasteScratch.trim()}
              onClick={() => {
                const { labels, lines } = parseRawTabText(pasteScratch);
                if (!lines.length) return;
                set({ content: lines.join("\n"), stringLabels: labels });
                setShowPaste(false);
                setPasteScratch("");
              }}
            >
              Parse &amp; insert
            </button>
          </div>
        )}
        {showBuilder && (
          <TabGridBuilder
            instrument={draft.instrument}
            onClose={() => setShowBuilder(false)}
            onInsert={(text, columnsPerBeat, labels) => {
              set({ content: text, columnsPerBeat, stringLabels: labels });
              setShowBuilder(false);
            }}
          />
        )}
        <textarea
          className="ts-tab-textarea"
          rows={8}
          value={draft.content}
          onChange={(e) => set({ content: e.target.value })}
          placeholder={"----------------\n----------------\n----------------\n----------------\n----------------\n----------------\n\nString labels are added automatically. Pasting text copied from a tab site? Use \"Paste from site\" above instead so labels and bar dividers get stripped and merged correctly."}
        />
      </label>

      <label className="ts-field-block">
        <span className="ts-field-label">Notes</span>
        <textarea
          rows={3}
          value={draft.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Fingering reminders, things to watch for..."
        />
      </label>

      <div className="ts-editor-actions">
        <button className="ts-cancel-btn" onClick={onCancel}>Cancel</button>
        <button
          className="ts-save-btn"
          disabled={!draft.title.trim() || !draft.content.trim()}
          onClick={() => onSave(draft)}
        >
          Save tab
        </button>
      </div>
    </div>
  );
}

/* ---------------- viewer / practice player ---------------- */

function TabViewer({ tab, onUpdate, onBack, onEdit, onDelete, onToggleFocus }) {
  const lines = useMemo(() => tab.content.split("\n"), [tab.content]);
  const maxLen = useMemo(
    () => Math.max(1, ...lines.map((l) => l.replace(/\s+$/, "").length)),
    [lines]
  );

  const beatsPerMeasure = tab.beatsPerMeasure || 4;
  const stringLabels = tab.stringLabels || defaultLabels(tab.instrument);
  const labelWidth = Math.max(1, ...stringLabels.map((l) => l.length));
  const measureLength = Math.max(1, tab.columnsPerBeat * beatsPerMeasure);
  const wrapRef = useRef(null);
  const [autoFit, setAutoFit] = useState(false);
  const [measuresPerLine, setMeasuresPerLineState] = useState(2);
  const systemLength = measureLength * measuresPerLine;
  const systemCount = Math.max(1, Math.ceil(maxLen / systemLength));

  useEffect(() => {
    if (!autoFit) return;
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.font = '13px "IBM Plex Mono", monospace';
      const charW = ctx.measureText("0").width || 7.8;
      const available = el.clientWidth - 32; // minus the sheet's own padding
      const fitCols = Math.max(measureLength, Math.floor(available / charW));
      setMeasuresPerLineState(Math.max(1, Math.floor(fitCols / measureLength)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFit, measureLength]);

  const setMeasuresPerLine = (n) => {
    setAutoFit(false);
    setMeasuresPerLineState(n);
  };
  const systemRefs = useRef([]);
  const lastSystemRef = useRef(-1);

  const [practiceBpm, setPracticeBpm] = useState(tab.targetBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeCol, setActiveCol] = useState(-1);
  // loopEnd === null means "loop the whole tab"; dragging across the tab
  // sets both to a sub-range. Reset returns to the full-tab default.
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragAnchorRef = useRef(null);
  const [clickAlong, setClickAlong] = useState(true);
  const [autoSpeedUp, setAutoSpeedUp] = useState(false);
  const [speedIncrement, setSpeedIncrement] = useState(2);

  const snapDownToBeat = (col) => Math.floor(col / tab.columnsPerBeat) * tab.columnsPerBeat;
  const snapUpToBeatEnd = (col) =>
    Math.min(Math.ceil((col + 1) / tab.columnsPerBeat) * tab.columnsPerBeat - 1, maxLen - 1);

  // the default full-tab loop is trimmed to the last complete beat too —
  // a trailing partial beat is what caused the wrap to land early/late
  const alignedMaxLen = Math.max(tab.columnsPerBeat, snapDownToBeat(maxLen));
  const effectiveLoopEnd = loopEnd === null ? alignedMaxLen - 1 : loopEnd;
  const hasSubRange = loopStart > 0 || loopEnd !== null;

  const colRef = useRef(0);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const practiceBpmRef = useRef(practiceBpm);
  const loopRef = useRef({ start: loopStart, end: effectiveLoopEnd });
  const clickRef = useRef(clickAlong);
  const speedRef = useRef({ auto: autoSpeedUp, inc: speedIncrement });
  const colsPerBeatRef = useRef(tab.columnsPerBeat);

  useEffect(() => { practiceBpmRef.current = practiceBpm; }, [practiceBpm]);
  useEffect(() => { loopRef.current = { start: loopStart, end: effectiveLoopEnd }; }, [loopStart, effectiveLoopEnd]);
  useEffect(() => { clickRef.current = clickAlong; }, [clickAlong]);
  useEffect(() => { speedRef.current = { auto: autoSpeedUp, inc: speedIncrement }; }, [autoSpeedUp, speedIncrement]);
  useEffect(() => { colsPerBeatRef.current = tab.columnsPerBeat; }, [tab.columnsPerBeat]);

  // finalize a drag selection no matter where the mouse is released
  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [isDragging]);

  const beginDrag = (ci) => {
    dragAnchorRef.current = ci;
    setLoopStart(snapDownToBeat(ci));
    setLoopEnd(snapUpToBeatEnd(ci));
    setIsDragging(true);
  };
  const extendDrag = (ci) => {
    if (!isDragging || dragAnchorRef.current === null) return;
    const anchor = dragAnchorRef.current;
    setLoopStart(snapDownToBeat(Math.min(anchor, ci)));
    setLoopEnd(snapUpToBeatEnd(Math.max(anchor, ci)));
  };
  const resetLoop = () => {
    setLoopStart(0);
    setLoopEnd(null);
  };

  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const playClick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }, []);

  const tick = useCallback(() => {
    const { start: rangeStart, end: rangeEnd } = loopRef.current;

    let next = colRef.current + 1;
    let wrapped = false;
    if (next > rangeEnd) {
      next = rangeStart;
      wrapped = true;
    }
    colRef.current = next;
    setActiveCol(next);

    const sys = Math.floor(next / systemLength);
    if (sys !== lastSystemRef.current) {
      lastSystemRef.current = sys;
      systemRefs.current[sys]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (clickRef.current && next % colsPerBeatRef.current === 0) playClick();

    if (wrapped && speedRef.current.auto) {
      const bumped = clamp(practiceBpmRef.current + speedRef.current.inc, MIN_BPM, MAX_BPM);
      practiceBpmRef.current = bumped;
      setPracticeBpm(bumped);
      restartTimer(bumped);
    }
  }, [playClick, systemLength]);

  const restartTimer = useCallback((bpm) => {
    clearInterval(timerRef.current);
    const intervalMs = (60000 / bpm) / colsPerBeatRef.current;
    timerRef.current = setInterval(tick, intervalMs);
  }, [tick]);

  const start = () => {
    ensureAudio();
    colRef.current = loopRef.current.start;
    setActiveCol(colRef.current);
    const sys = Math.floor(colRef.current / systemLength);
    lastSystemRef.current = sys;
    systemRefs.current[sys]?.scrollIntoView({ behavior: "smooth", block: "center" });
    restartTimer(practiceBpmRef.current);
    setIsPlaying(true);
  };
  const stop = () => {
    clearInterval(timerRef.current);
    setIsPlaying(false);
    setActiveCol(-1);
    colRef.current = -1;
  };
  useEffect(() => () => clearInterval(timerRef.current), []);

  // live tempo changes while playing should reschedule at the new rate
  useEffect(() => {
    if (isPlaying) restartTimer(practiceBpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceBpm]);

  const logTempo = () => {
    const entry = { date: todayStr(), bpm: practiceBpm };
    onUpdate({ ...tab, practiceLog: [...tab.practiceLog, entry] });
  };

  const sparkPoints = tab.practiceLog.slice(-10).map((e) => e.bpm);
  const lastEntries = tab.practiceLog.slice(-4).reverse();

  return (
    <div className="ts-viewer">
      <div className="ts-editor-head">
        <button className="ts-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <div className="ts-viewer-actions">
          <button className="ts-icon-btn" onClick={() => onEdit(tab.id)} aria-label="Edit tab"><Pencil size={14} /></button>
          <button className="ts-icon-btn ts-danger" onClick={() => onDelete(tab.id)} aria-label="Delete tab"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="ts-viewer-title-row">
        <div>
          <h2 className="ts-section-title">{tab.title}</h2>
          <p className="ts-card-sub">{tab.artist || "—"} · {tab.instrument} · {tab.tuning} · {tab.difficulty}</p>
        </div>
        <button
          className={`ts-star ts-star-lg ${tab.weeklyFocus ? "is-on" : ""}`}
          onClick={() => onToggleFocus(tab.id)}
          title="This week's focus"
        >
          <Star size={18} fill={tab.weeklyFocus ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="ts-tag-row">
        <StatusPill status={tab.status} onChange={(status) => onUpdate({ ...tab, status })} />
        {tab.techniques.map((t) => <span key={t} className="ts-tag">{t}</span>)}
      </div>

      <div className="ts-display-controls">
        <p className="ts-drag-hint">Click and drag across the tab to loop a section.</p>
        <div className="ts-fit-controls">
          <label className="ts-checkbox">
            <input type="checkbox" checked={autoFit} onChange={(e) => setAutoFit(e.target.checked)} />
            Fit to width
          </label>
          <label className="ts-checkbox">
            Measures per line
            <input
              type="number" min={1} max={16} value={measuresPerLine} className="ts-steps-input"
              onChange={(e) => setMeasuresPerLine(clamp(parseInt(e.target.value, 10) || 1, 1, 16))}
            />
          </label>
        </div>
      </div>
      <div ref={wrapRef} className={`ts-tab-display-wrap${isDragging ? " ts-no-select" : ""}`}>
        {Array.from({ length: systemCount }).map((_, si) => {
          const colStart = si * systemLength;
          const colEnd = Math.min(colStart + systemLength, maxLen);
          return (
            <div key={si} className="ts-system" ref={(el) => { systemRefs.current[si] = el; }}>
              {lines.map((line, li) => {
                const cells = [
                  <span key="label" className="ts-row-label">{(stringLabels[li] || "").padEnd(labelWidth)}</span>,
                  <span key="bar-0" className="ts-barline" />,
                ];
                for (let ci = colStart; ci < colEnd; ci++) {
                  const ch = line[ci] || " ";
                  const isCursor = ci === activeCol;
                  const inLoop = hasSubRange && ci >= loopStart && ci <= effectiveLoopEnd;
                  cells.push(
                    <span
                      key={ci}
                      className={`ts-ch${isCursor ? " ts-cursor" : ""}${inLoop ? " ts-in-loop" : ""}`}
                      onMouseDown={() => beginDrag(ci)}
                      onMouseEnter={() => extendDrag(ci)}
                    >
                      {ch}
                    </span>
                  );
                  const posInSystem = ci - colStart + 1;
                  if (posInSystem % measureLength === 0) {
                    cells.push(<span key={`bar-${ci}`} className="ts-barline" />);
                  }
                }
                if ((colEnd - colStart) % measureLength !== 0) {
                  cells.push(<span key="bar-end" className="ts-barline" />);
                }
                return <div key={li} className="ts-tab-line">{cells}</div>;
              })}
            </div>
          );
        })}
      </div>

      <div className="ts-player">
        <div className="ts-player-row">
          <button className={`ts-play-btn ${isPlaying ? "is-playing" : ""}`} onClick={() => (isPlaying ? stop() : start())}>
            {isPlaying ? <Square size={14} /> : <Play size={14} />}
            {isPlaying ? "Stop" : "Play"}
          </button>
          <div className="ts-bpm-inline">
            <input
              type="range" min={MIN_BPM} max={MAX_BPM} value={practiceBpm}
              onChange={(e) => setPracticeBpm(clamp(parseInt(e.target.value, 10), MIN_BPM, MAX_BPM))}
            />
            <span className="ts-bpm-num">{practiceBpm}</span>
            <span className="ts-bpm-suffix">bpm · target {tab.targetBpm}</span>
          </div>
          <button className="ts-log-btn" onClick={logTempo}>Log this tempo</button>
        </div>

        <div className="ts-player-row ts-player-row-wrap">
          <label className="ts-checkbox">
            <input type="checkbox" checked={clickAlong} onChange={(e) => setClickAlong(e.target.checked)} />
            Click along
          </label>
          <span className="ts-loop-controls">
            <Repeat size={13} />
            <span className="ts-loop-range">
              {hasSubRange ? `Looping cols ${loopStart}–${effectiveLoopEnd}` : "Looping the whole tab"}
            </span>
            {hasSubRange && <button onClick={resetLoop}>Reset loop</button>}
          </span>
          <label className="ts-checkbox">
            <input type="checkbox" checked={autoSpeedUp} onChange={(e) => setAutoSpeedUp(e.target.checked)} />
            <Zap size={13} /> Auto speed-up
          </label>
          {autoSpeedUp && (
            <span className="ts-speed-inc">
              +<input
                type="number" min={1} max={20} value={speedIncrement}
                onChange={(e) => setSpeedIncrement(clamp(parseInt(e.target.value, 10) || 1, 1, 20))}
              /> bpm per pass
            </span>
          )}
        </div>

        {tab.practiceLog.length > 0 && (
          <div className="ts-progress-row">
            <Sparkline points={sparkPoints} />
            <div className="ts-progress-list">
              {lastEntries.map((e, i) => (
                <span key={i} className="ts-progress-entry">{e.date}: {e.bpm} bpm</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <label className="ts-field-block">
        <span className="ts-field-label">Notes</span>
        <textarea
          rows={3}
          value={tab.notes}
          onChange={(e) => onUpdate({ ...tab, notes: e.target.value })}
          placeholder="Fingering reminders, things to watch for..."
        />
      </label>
    </div>
  );
}

/* ---------------- root ---------------- */

export default function TabsSection() {
  const [tabs, setTabs] = useState(loadTabs);
  const [view, setView] = useState("library"); // 'library' | 'editor' | 'viewer'
  const [activeId, setActiveId] = useState(null);
  const [editingId, setEditingId] = useState(null); // null while creating new

  useEffect(() => { saveTabs(tabs); }, [tabs]);

  const updateTab = (updated) => setTabs((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  const deleteTab = (id) => {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) { setView("library"); setActiveId(null); }
  };
  const toggleFocus = (id) => setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, weeklyFocus: !t.weeklyFocus } : t)));

  const openTab = (id) => { setActiveId(id); setView("viewer"); };
  const editTab = (id) => { setEditingId(id); setView("editor"); };
  const newTab = () => { setEditingId(null); setView("editor"); };

  const saveEditor = (draft) => {
    if (editingId) {
      updateTab(draft);
    } else {
      setTabs((prev) => [...prev, draft]);
    }
    setActiveId(draft.id);
    setView("viewer");
  };

  const activeTab = tabs.find((t) => t.id === activeId);
  const editingTab = editingId ? tabs.find((t) => t.id === editingId) : makeTab();

  return (
    <section className="tr-section ts-root">
      <style>{TABS_CSS}</style>
      {!activeTab && view !== "editor" && (
        <>
          <h2 className="ts-section-title ts-with-icon"><Music size={20} /> Tabs</h2>
          <Library
            tabs={tabs}
            onOpen={openTab}
            onEdit={editTab}
            onDelete={deleteTab}
            onToggleFocus={toggleFocus}
            onNew={newTab}
          />
        </>
      )}
      {view === "editor" && (
        <Editor
          key={editingId || "new"}
          initial={editingTab}
          onSave={saveEditor}
          onCancel={() => setView(activeTab ? "viewer" : "library")}
        />
      )}
      {view === "viewer" && activeTab && (
        <TabViewer
          key={activeTab.id}
          tab={activeTab}
          onUpdate={updateTab}
          onBack={() => { setView("library"); setActiveId(null); }}
          onEdit={editTab}
          onDelete={deleteTab}
          onToggleFocus={toggleFocus}
        />
      )}
    </section>
  );
}

const TABS_CSS = `
.ts-root { max-width: 1100px; margin: 0 auto; }
.ts-section-title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 24px; margin: 0 0 18px; display: flex; align-items: center; gap: 8px; }
.ts-with-icon svg { color: var(--accent); }

.ts-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 18px; }
.ts-search { display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; flex: 1; min-width: 180px; color: var(--text-muted); }
.ts-search input { background: none; border: none; outline: none; color: var(--text); font-size: 14px; width: 100%; }
.ts-toolbar select { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--text); font-size: 13px; }
.ts-checkbox { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-muted); white-space: nowrap; }
.ts-new-btn { display: flex; align-items: center; gap: 6px; background: var(--accent); color: var(--bg); border: none; border-radius: 8px; padding: 9px 14px; font-weight: 600; font-size: 13px; cursor: pointer; margin-left: auto; }
.ts-new-btn:hover { opacity: 0.9; }

.ts-empty { color: var(--text-muted); padding: 32px 0; text-align: center; }

.ts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.ts-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; position: relative; overflow: hidden; }
.ts-card-main { display: block; width: 100%; text-align: left; background: none; border: none; padding: 14px 14px 12px; cursor: pointer; color: inherit; }
.ts-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.ts-card-title { font-weight: 600; font-size: 15px; }
.ts-card-sub { color: var(--text-muted); font-size: 12.5px; margin: 4px 0 8px; }
.ts-star { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; flex-shrink: 0; }
.ts-star.is-on, .ts-star:hover { color: var(--accent); }
.ts-star-lg { padding: 4px; }

.ts-tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.ts-tag-row-wrap { margin-bottom: 8px; }
.ts-tag { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; background: var(--accent-soft); color: var(--accent); border-radius: 20px; padding: 3px 9px; }
.ts-card-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ts-pill { font-size: 11.5px; border-radius: 20px; padding: 4px 10px; border: 1px solid var(--border); background: none; cursor: pointer; white-space: nowrap; }
.ts-pill.ts-good { color: var(--good); border-color: var(--good); background: var(--good-soft); }
.ts-pill.ts-accent { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.ts-pill.ts-muted { color: var(--text-muted); }
.ts-bpm-chip { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-muted); }

.ts-card-actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.ts-card:hover .ts-card-actions { opacity: 1; }
.ts-icon-btn { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 6px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); cursor: pointer; }
.ts-icon-btn:hover { color: var(--text); }
.ts-icon-btn.ts-danger:hover { color: var(--bad); border-color: var(--bad); }

.ts-editor-head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.ts-back { display: flex; align-items: center; gap: 5px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px; }
.ts-back:hover { color: var(--text); }

.ts-form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.ts-form-row label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); flex: 1; min-width: 140px; }
.ts-form-row input, .ts-form-row select { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--text); font-size: 14px; }

.ts-field-block { display: block; margin-bottom: 14px; }
.ts-field-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.ts-tag-btn { font-size: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 20px; padding: 5px 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
.ts-tag-btn.is-active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
.ts-custom-tag { display: flex; gap: 6px; margin-top: 8px; max-width: 260px; }
.ts-custom-tag input { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; color: var(--text); font-size: 13px; }
.ts-custom-tag button { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; color: var(--text); cursor: pointer; font-size: 12px; }

.ts-tab-textarea { font-family: 'IBM Plex Mono', monospace; font-size: 13px; }
.ts-paste-scratch { margin-bottom: 4px; }
.ts-field-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px; }
.ts-field-label-row .ts-field-label { margin-bottom: 0; }
.ts-content-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ts-hidden-file-input { display: none; }
.ts-builder-toggle:disabled { opacity: 0.6; cursor: default; }
.ts-ocr-error { font-size: 12px; color: var(--bad); margin: -2px 0 8px; }
.ts-builder-toggle { background: none; border: 1px solid var(--border); color: var(--accent); border-radius: 8px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.ts-builder { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
.ts-builder-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.ts-builder-head .ts-field-label { margin: 0; }
.ts-builder-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ts-builder-actions button { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 5px 9px; color: var(--text); cursor: pointer; font-size: 11.5px; }
.ts-steps-input { width: 38px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 3px 5px; color: var(--text); margin-left: 4px; }
.ts-builder-grid-wrap { overflow-x: auto; padding-bottom: 4px; }
.ts-builder-grid { display: flex; flex-direction: column; gap: 3px; width: max-content; }
.ts-builder-row { display: flex; gap: 2px; }
.ts-builder-label { width: 28px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-muted); padding: 3px 0; }
.ts-builder-cell { width: 22px; height: 22px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 3px; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text); padding: 0; }
.ts-builder-cell.ts-builder-beat { border-right: 2px solid var(--accent-soft); }
.ts-builder-cell:focus { outline: 1px solid var(--accent); }
.ts-builder-insert { margin-top: 10px; }
.ts-field-block textarea { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: var(--text); resize: vertical; }

.ts-editor-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.ts-cancel-btn { background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: 8px; padding: 9px 16px; cursor: pointer; }
.ts-save-btn { background: var(--accent); color: var(--bg); border: none; border-radius: 8px; padding: 9px 18px; font-weight: 600; cursor: pointer; }
.ts-save-btn:disabled { opacity: 0.4; cursor: default; }

.ts-viewer-title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.ts-viewer-actions { display: flex; gap: 6px; margin-left: auto; }

.ts-display-controls { display: flex; justify-content: space-between; align-items: center; margin: 10px 0 8px; flex-wrap: wrap; gap: 8px; }
.ts-drag-hint { font-size: 11.5px; color: var(--text-muted); margin: 0; }
.ts-tab-display-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin: 0 0 14px; overflow-x: auto; }
.ts-tab-display-wrap.ts-no-select { user-select: none; }
.ts-fit-controls { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.ts-system { padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px dashed var(--border); }
.ts-system:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: none; }
.ts-tab-line { white-space: pre; font-family: 'IBM Plex Mono', monospace; font-size: 13px; line-height: 1.7; }
.ts-row-label { display: inline-block; color: var(--text-muted); font-weight: 600; }
.ts-ch { display: inline-block; cursor: pointer; }
.ts-ch.ts-in-loop { background: var(--accent-soft); }
.ts-ch.ts-cursor { background: var(--accent); color: var(--bg); border-radius: 2px; }
.ts-barline { display: inline-block; width: 2px; height: 1.1em; background: var(--border); vertical-align: middle; margin: 0 1px; }

.ts-player { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-bottom: 14px; }
.ts-player-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }
.ts-player-row:last-child { margin-bottom: 0; }
.ts-player-row-wrap { row-gap: 10px; }
.ts-play-btn { display: flex; align-items: center; gap: 6px; background: var(--accent); color: var(--bg); border: none; border-radius: 8px; padding: 9px 16px; font-weight: 600; cursor: pointer; }
.ts-play-btn.is-playing { background: var(--bad); }
.ts-bpm-inline { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; }
.ts-bpm-inline input[type="range"] { flex: 1; }
.ts-bpm-num { font-family: 'IBM Plex Mono', monospace; font-weight: 700; color: var(--accent); font-size: 16px; min-width: 30px; }
.ts-bpm-suffix { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }
.ts-log-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 9px 14px; color: var(--text); cursor: pointer; font-size: 13px; }
.ts-log-btn:hover { border-color: var(--accent); color: var(--accent); }
.ts-loop-controls { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.ts-loop-controls button { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; color: var(--text); cursor: pointer; font-size: 11.5px; }
.ts-loop-range { color: var(--text-muted); font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
.ts-speed-inc { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); }
.ts-speed-inc input { width: 44px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 3px 5px; color: var(--text); }

.ts-progress-row { display: flex; align-items: center; gap: 14px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); flex-wrap: wrap; }
.ts-progress-list { display: flex; gap: 12px; flex-wrap: wrap; }
.ts-progress-entry { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-muted); }
`;
