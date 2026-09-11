import React, { useState, useEffect, useCallback } from "react";
import { Flame, Check } from "lucide-react";

const STORAGE_KEY = "fretboard-program-v1";

const MONTHS = [
  {
    id: "month1",
    roman: "I",
    title: "Full Fretboard Ownership",
    weeks: [
      {
        id: "w1",
        label: "Week 1",
        tasks: [
          "Map major triads (root + inversions), string sets 1-2-3 & 2-3-4, all 12 roots",
          "Metronome technique: alternate picking, 60–70 bpm, 15 min/day",
          "Ear training: major 3rd vs. minor 3rd, 10 min/day",
        ],
      },
      {
        id: "w2",
        label: "Week 2",
        tasks: [
          "Map major triads, string sets 3-4-5 & 4-5-6, all 12 roots",
          "Add minor triads, string sets 1-2-3 & 2-3-4",
          "Ear training: perfect 4th vs. perfect 5th",
        ],
      },
      {
        id: "w3",
        label: "Week 3",
        tasks: [
          "Finish minor triads across remaining string sets",
          "Begin diminished + augmented triads, string sets 1-2-3",
          "Push technique tempo +5–10 bpm once clean",
        ],
      },
      {
        id: "w4",
        label: "Week 4",
        tasks: [
          "Diminished + augmented triads across all string sets",
          "Review: any triad type, any root, any string set, no hesitation",
          "Ear training checkpoint: ID major/minor/dim/aug triads by ear",
        ],
      },
    ],
  },
  {
    id: "month2",
    roman: "II",
    title: "Harmonic Depth",
    weeks: [
      {
        id: "w1",
        label: "Week 1",
        tasks: [
          "Learn Drop 2 voicings for Maj7 chords across string sets",
          "Start ear training: chord quality ID (Maj7 vs. m7)",
          "Begin transcribing a 4-bar phrase (Steely Dan or D'Angelo)",
        ],
      },
      {
        id: "w2",
        label: "Week 2",
        tasks: [
          "Drop 2 voicings for m7 and Dom7",
          "Add Drop 3 voicings for Maj7",
          "Continue the 4-bar transcription",
        ],
      },
      {
        id: "w3",
        label: "Week 3",
        tasks: [
          "Modes as chord-tone extensions: Ionian, Dorian, Mixolydian",
          "Ear training: Dom7 vs. m7b5",
          "Finish and review the transcription",
        ],
      },
      {
        id: "w4",
        label: "Week 4",
        tasks: [
          "Aeolian mode; review all modes tied to chord tones",
          "Full Drop 2 / Drop 3 review across the neck",
          "Pick a new 4–8 bar phrase to transcribe for Month 3",
        ],
      },
    ],
  },
  {
    id: "month3",
    roman: "III",
    title: "Improvisation & Musicianship",
    weeks: [
      {
        id: "w1",
        label: "Week 1",
        tasks: [
          "Improvise over one static chord using arpeggios + modes",
          "Start comping: same 2-chord loop, vary rhythm each pass",
          "Record a baseline clip for comparison",
        ],
      },
      {
        id: "w2",
        label: "Week 2",
        tasks: [
          "Improvise over a 2–4 chord loop",
          "Comping: vary inversions/voicings while holding rhythm",
          "Continue transcribing a full song's chords by ear",
        ],
      },
      {
        id: "w3",
        label: "Week 3",
        tasks: [
          "Extend improv over a full song form (verse/chorus changes)",
          "Technique push: raise tempo aggressively on Month 1 drills",
          "Finish the full-song transcription",
        ],
      },
      {
        id: "w4",
        label: "Week 4",
        tasks: [
          "Perform / record the transcribed song start to finish",
          "Final technique benchmark vs. the Month 1 baseline",
          "Reflect: compare the Month 1 and Month 3 recordings",
        ],
      },
    ],
  },
];

const DAILY_BLOCKS = [
  { id: "technique", label: "Technique & metronome drills", minutes: "15 min" },
  { id: "core", label: "This month's core focus", minutes: "20 min" },
  { id: "ear", label: "Ear training", minutes: "10 min" },
  { id: "repertoire", label: "Repertoire practice", minutes: "15–20 min" },
  { id: "freeplay", label: "Free play / improvisation", minutes: "10 min" },
];

const DEFAULT_REPERTOIRE = [
  { id: "g1", instrument: "guitar", title: "Are You Looking Up", artist: "Mk.gee", status: "can-play" },
  { id: "g2", instrument: "guitar", title: "Really Love", artist: "D'Angelo", status: "not-started" },
  { id: "g3", instrument: "guitar", title: "Spanish Joint", artist: "D'Angelo", status: "not-started" },
  { id: "g4", instrument: "guitar", title: "Peg", artist: "Steely Dan", status: "not-started" },
  { id: "g5", instrument: "guitar", title: "Candy", artist: "Mk.gee", status: "not-started" },
  { id: "g6", instrument: "guitar", title: "Slow Dancing in a Burning Room", artist: "John Mayer", status: "not-started" },
  { id: "b1", instrument: "bass", title: "What's the Use", artist: "Mac Miller", status: "can-play" },
  { id: "b2", instrument: "bass", title: "I Was Made to Love Her", artist: "Stevie Wonder", status: "not-started" },
  { id: "b3", instrument: "bass", title: "Dean Town", artist: "Vulfpeck", status: "not-started" },
  { id: "b4", instrument: "bass", title: "Kid Charlemagne", artist: "Steely Dan", status: "not-started" },
  { id: "b5", instrument: "bass", title: "Playa Playa", artist: "D'Angelo", status: "not-started" },
  { id: "b6", instrument: "bass", title: "Them Changes", artist: "Thundercat", status: "not-started" },
];

const STATUS_CYCLE = ["not-started", "learning", "can-play"];
const STATUS_LABEL = {
  "not-started": "Not started",
  learning: "Learning",
  "can-play": "Can play",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildDefaultTaskState() {
  const state = {};
  MONTHS.forEach((m) => {
    state[m.id] = {};
    m.weeks.forEach((w) => {
      state[m.id][w.id] = w.tasks.map(() => false);
    });
  });
  return state;
}

// Reads the whole saved blob once, synchronously. localStorage is
// synchronous, so no async/await belongs anywhere near it.
function readStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read saved progress:", err);
    return null;
  }
}

function writeStorage(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save progress:", err);
    return false;
  }
  return true;
}

export default function App() {
  const saved = readStorage();

  const [activeSection, setActiveSection] = useState("month1");
  const [taskDone, setTaskDone] = useState(
    () => saved?.taskDone || buildDefaultTaskState()
  );
  const [dailySessions, setDailySessions] = useState(
    () => saved?.dailySessions || {}
  );
  const [repertoire, setRepertoire] = useState(
    () => saved?.repertoire || DEFAULT_REPERTOIRE
  );
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const ok = writeStorage({ taskDone, dailySessions, repertoire });
    setSaveError(!ok);
  }, [taskDone, dailySessions, repertoire]);

  const toggleTask = useCallback((monthId, weekId, idx) => {
    setTaskDone((prev) => {
      const next = { ...prev, [monthId]: { ...prev[monthId] } };
      const arr = [...next[monthId][weekId]];
      arr[idx] = !arr[idx];
      next[monthId][weekId] = arr;
      return next;
    });
  }, []);

  const toggleDailyBlock = useCallback((blockId) => {
    const key = todayKey();
    setDailySessions((prev) => {
      const today = { ...(prev[key] || {}) };
      today[blockId] = !today[blockId];
      return { ...prev, [key]: today };
    });
  }, []);

  const cycleStatus = useCallback((id) => {
    setRepertoire((prev) =>
      prev.map((song) => {
        if (song.id !== id) return song;
        const idx = STATUS_CYCLE.indexOf(song.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        return { ...song, status: next };
      })
    );
  }, []);

  let streak = 0;
  {
    let cursor = new Date();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      const day = dailySessions[key];
      const hasAny = day && Object.values(day).some(Boolean);
      if (hasAny) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  const totalPracticeDays = Object.values(dailySessions).filter((d) =>
    Object.values(d || {}).some(Boolean)
  ).length;

  function monthCompletion(monthId) {
    const month = MONTHS.find((m) => m.id === monthId);
    let total = 0;
    let done = 0;
    month.weeks.forEach((w) => {
      const arr = taskDone[monthId][w.id];
      total += arr.length;
      done += arr.filter(Boolean).length;
    });
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }

  const todaysBlocks = dailySessions[todayKey()] || {};

  return (
    <div className="tracker-root">
      <header className="tr-header">
        <div>
          <p className="tr-eyebrow">Guitar &amp; Bass</p>
          <h1 className="tr-title">Fretboard Program</h1>
          <p className="tr-subtitle">
            A three-month plan built off where you're actually starting from.
          </p>
        </div>
        <div className="tr-streak">
          <Flame size={18} strokeWidth={2} />
          <div>
            <span className="tr-streak-num">{streak}</span>
            <span className="tr-streak-label">day streak</span>
          </div>
        </div>
      </header>

      <div className="tr-body">
        <nav className="tr-nav">
          {MONTHS.map((m) => (
            <button
              key={m.id}
              className={`tr-nav-item ${activeSection === m.id ? "is-active" : ""}`}
              onClick={() => setActiveSection(m.id)}
              aria-pressed={activeSection === m.id}
            >
              <span className="tr-nav-roman">{m.roman}</span>
              <span className="tr-nav-text">
                <span className="tr-nav-month">Month {m.roman}</span>
                <span className="tr-nav-focus">{m.title}</span>
              </span>
              <span className="tr-nav-pct">{monthCompletion(m.id)}%</span>
            </button>
          ))}
          <button
            className={`tr-nav-item ${activeSection === "repertoire" ? "is-active" : ""}`}
            onClick={() => setActiveSection("repertoire")}
            aria-pressed={activeSection === "repertoire"}
          >
            <span className="tr-nav-roman">♪</span>
            <span className="tr-nav-text">
              <span className="tr-nav-month">Repertoire</span>
              <span className="tr-nav-focus">Songs in progress</span>
            </span>
          </button>
        </nav>

        <main className="tr-main">
          <section className="tr-today">
            <h2 className="tr-section-title">Today's session</h2>
            <div className="tr-today-grid">
              {DAILY_BLOCKS.map((b) => {
                const on = !!todaysBlocks[b.id];
                return (
                  <button
                    key={b.id}
                    className={`tr-fret ${on ? "is-done" : ""}`}
                    onClick={() => toggleDailyBlock(b.id)}
                    aria-pressed={on}
                  >
                    <span className="tr-fret-dot">
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="tr-fret-text">
                      <span className="tr-fret-label">{b.label}</span>
                      <span className="tr-fret-minutes">{b.minutes}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {activeSection !== "repertoire" ? (
            <section className="tr-month">
              {MONTHS.filter((m) => m.id === activeSection).map((m) => (
                <div key={m.id}>
                  <div className="tr-month-head">
                    <h2 className="tr-section-title">
                      Month {m.roman} — {m.title}
                    </h2>
                    <span className="tr-month-pct">
                      {monthCompletion(m.id)}% complete
                    </span>
                  </div>
                  <div className="tr-week-grid">
                    {m.weeks.map((w) => (
                      <div className="tr-week-card" key={w.id}>
                        <h3 className="tr-week-title">{w.label}</h3>
                        <ul className="tr-task-list">
                          {w.tasks.map((task, idx) => {
                            const done = taskDone[m.id][w.id][idx];
                            return (
                              <li key={idx}>
                                <button
                                  className={`tr-fret tr-fret--small ${done ? "is-done" : ""}`}
                                  onClick={() => toggleTask(m.id, w.id, idx)}
                                  aria-pressed={done}
                                >
                                  <span className="tr-fret-dot">
                                    {done && <Check size={11} strokeWidth={3} />}
                                  </span>
                                  <span className="tr-task-text">{task}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <section className="tr-repertoire">
              <h2 className="tr-section-title">Repertoire</h2>
              <div className="tr-rep-columns">
                {["guitar", "bass"].map((inst) => (
                  <div className="tr-rep-col" key={inst}>
                    <h3 className="tr-rep-col-title">
                      {inst === "guitar" ? "Guitar" : "Bass"}
                    </h3>
                    <ul className="tr-rep-list">
                      {repertoire
                        .filter((s) => s.instrument === inst)
                        .map((song) => (
                          <li key={song.id} className="tr-rep-item">
                            <div className="tr-rep-info">
                              <span className="tr-rep-song">{song.title}</span>
                              <span className="tr-rep-artist">{song.artist}</span>
                            </div>
                            <button
                              className={`tr-status tr-status--${song.status}`}
                              onClick={() => cycleStatus(song.id)}
                            >
                              {STATUS_LABEL[song.status]}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      <footer className="tr-footer">
        <span>
          {totalPracticeDays} practice day{totalPracticeDays === 1 ? "" : "s"} logged
        </span>
        <span>
          {saveError
            ? "Couldn't save just now — changes will retry"
            : "Saved automatically as you go"}
        </span>
      </footer>
    </div>
  );
}
