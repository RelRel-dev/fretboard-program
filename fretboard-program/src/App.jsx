import React, { useState, useEffect, useCallback } from "react";
import { Flame, Check, Pencil, Plus, X, GripVertical, Star } from "lucide-react";
import guitarChordData from "@tombatossals/chords-db/lib/guitar.json";
import GuitarChordDiagram from "./GuitarChordDiagram";
import PianoChordDiagram from "./PianoChordDiagram";
import FretboardQuizDiagram from "./FretboardQuizDiagram";
import MetronomeWidget from "./MetronomeWidget";
import TabsSection from "./TabsSection";
import {
  ROOTS,
  PIANO_CHORD_TYPES,
  chordSymbol,
  findRoot,
  STRING_OPEN_NOTES,
  ENHARMONIC_ANSWERS,
  randomNoteLabel,
  normalizeNoteInput,
} from "./musicTheory";

const STORAGE_KEY = "fretboard-program-v4";
const PREV_STORAGE_KEY = "fretboard-program-v3";
const LEGACY_STORAGE_KEY = "fretboard-program-v2";

const GUITAR_MONTHS_TEMPLATE = [
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

const PIANO_MONTHS_TEMPLATE = [
  {
    id: "month1",
    roman: "I",
    title: "Hands, Scales & Real Triads",
    weeks: [
      {
        id: "w1",
        label: "Week 1",
        tasks: [
          "Learn C, G, D major scales with correct fingering, hands separately",
          "Root-position triads in all 12 keys, right hand, naming each note aloud",
          "Left hand roots + right hand triads together, slow tempo",
        ],
      },
      {
        id: "w2",
        label: "Week 2",
        tasks: [
          "Add F, Bb, Eb major scales; start A, E, D minor scales, hands separately",
          "1st and 2nd inversions of major triads, right hand, all 12 keys",
          "Left hand plays root + fifth under right-hand triads",
        ],
      },
      {
        id: "w3",
        label: "Week 3",
        tasks: [
          "Minor triad inversions, right hand, all 12 keys",
          "Basic notation: read triads on the treble staff, matching what you already play by ear",
          "Left hand plays a simple walking-root pattern under right-hand chords",
        ],
      },
      {
        id: "w4",
        label: "Week 4",
        tasks: [
          "Review: any major/minor triad, any inversion, any key, hands together, no hesitation",
          "Add bass clef reading for left-hand root notes",
          "Metronome check: steady tempo through a full 12-key triad cycle",
        ],
      },
    ],
  },
  {
    id: "month2",
    roman: "II",
    title: "Gospel & Extended Harmony",
    weeks: [
      {
        id: "w1",
        label: "Week 1",
        tasks: [
          "Formalize Maj7 / m7 / Dom7 construction consciously, all 12 keys, root position",
          "Learn Drop 2 voicing: split a 7th chord across both hands",
          "Left hand: broken/arpeggiated roots instead of static notes",
        ],
      },
      {
        id: "w2",
        label: "Week 2",
        tasks: [
          "Add dim7 and m7b5 (half-diminished) chords, all 12 keys",
          "Practice ii-V-I progressions in 3–4 keys using 7th chords, both hands",
          "Ear training: ID Maj7 vs. m7 vs. Dom7 vs. m7b5, 10 min/day",
        ],
      },
      {
        id: "w3",
        label: "Week 3",
        tasks: [
          "9th chords (Maj9, m9, Dom9) as gospel-style voicings: root/7th left hand, upper structure right hand",
          "Start transcribing one gospel/soul progression by ear",
          "Continue ii-V-I drilling in all 12 keys",
        ],
      },
      {
        id: "w4",
        label: "Week 4",
        tasks: [
          "Review this month's voicings, hands together, steady tempo",
          "Finish the transcription from Week 3, play it start to finish",
          "Practice voice leading: move only the notes that need to move between chords",
        ],
      },
    ],
  },
  {
    id: "month3",
    roman: "III",
    title: "Real Songs, Real Independence",
    weeks: [
      {
        id: "w1",
        label: "Week 1",
        tasks: [
          "Start a new full song (notation + ear together, not just tutorial-following)",
          "Comping: play the same progression with 3 different rhythmic patterns",
          "Left hand plays a moving bassline, not just roots, under static right-hand chords",
        ],
      },
      {
        id: "w2",
        label: "Week 2",
        tasks: [
          "Continue the song, adding melody/fill lines by ear",
          "Improvise a simple right-hand melodic idea over a 2–4 chord gospel progression",
          "Ear training: dictate a 4-chord progression from a song you don't know",
        ],
      },
      {
        id: "w3",
        label: "Week 3",
        tasks: [
          "Hands-together independence drill: distinct rhythms in each hand",
          "Record yourself playing the Week 1 song start to finish",
          "Begin a second transcription with less tutorial-dependence than before",
        ],
      },
      {
        id: "w4",
        label: "Week 4",
        tasks: [
          "Perform / record the full song, hands independent, no hesitation on any chord",
          "Compare this recording to your Month 1 baseline",
          "Reflect: what's automatic now vs. what still needs conscious thought",
        ],
      },
    ],
  },
];

const INSTRUMENT_META = [
  { id: "guitar", label: "Guitar" },
  { id: "piano", label: "Piano" },
];

function findInstrumentMeta(instrumentId) {
  return INSTRUMENT_META.find((i) => i.id === instrumentId);
}

// Turns the plain-string task templates into stable-id task objects so
// tasks can be added/removed/reordered without desyncing completion state.
function materializeMonths(monthsTemplate) {
  return monthsTemplate.map((m) => ({
    ...m,
    weeks: m.weeks.map((w) => ({
      ...w,
      tasks: w.tasks.map((text, idx) => ({
        id: `${m.id}-${w.id}-t${idx + 1}`,
        text,
      })),
    })),
  }));
}

const DEFAULT_MONTHS_DATA = {
  guitar: materializeMonths(GUITAR_MONTHS_TEMPLATE),
  piano: materializeMonths(PIANO_MONTHS_TEMPLATE),
};

function taskKey(instrumentId, monthId, weekId, taskId) {
  return `${instrumentId}:${monthId}:${weekId}:${taskId}`;
}

// Converts the old nested boolean-array taskDone shape (indexed by
// position) into the new flat id-keyed doneMap, using the default
// template to recover each task's id at its original position.
function migrateLegacyTaskDone(legacyTaskDone) {
  const doneMap = {};
  if (!legacyTaskDone) return doneMap;
  Object.keys(legacyTaskDone).forEach((instId) => {
    const months = DEFAULT_MONTHS_DATA[instId];
    if (!months) return;
    Object.keys(legacyTaskDone[instId]).forEach((monthId) => {
      const month = months.find((m) => m.id === monthId);
      if (!month) return;
      Object.keys(legacyTaskDone[instId][monthId]).forEach((weekId) => {
        const week = month.weeks.find((w) => w.id === weekId);
        if (!week) return;
        const arr = legacyTaskDone[instId][monthId][weekId] || [];
        arr.forEach((val, idx) => {
          const task = week.tasks[idx];
          if (task && val) {
            doneMap[taskKey(instId, monthId, weekId, task.id)] = true;
          }
        });
      });
    });
  });
  return doneMap;
}

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
  { id: "p1", instrument: "piano", title: "Rocket Love", artist: "Stevie Wonder", status: "can-play" },
  { id: "p2", instrument: "piano", title: "Easy", artist: "Lionel Richie", status: "can-play" },
  { id: "p3", instrument: "piano", title: "Isn't She Lovely", artist: "Stevie Wonder", status: "not-started" },
  { id: "p4", instrument: "piano", title: "A Song for You", artist: "Donny Hathaway", status: "not-started" },
  { id: "p5", instrument: "piano", title: "Fallin'", artist: "Alicia Keys", status: "not-started" },
  { id: "p6", instrument: "piano", title: "Higher Ground", artist: "Stevie Wonder", status: "not-started" },
];

const STATUS_CYCLE = ["not-started", "learning", "can-play"];
const STATUS_LABEL = {
  "not-started": "Not started",
  learning: "Learning",
  "can-play": "Can play",
};

// Guitar's type list comes straight from chords-db so it stays complete;
// piano's is our own computed formula table (see musicTheory.js).
const GUITAR_TYPES = guitarChordData.suffixes;
const PIANO_TYPES = PIANO_CHORD_TYPES.map((t) => t.suffix);

function guitarPositions(rootDisplay, suffix) {
  const root = findRoot(rootDisplay);
  const entries = guitarChordData.chords[root.dataKey] || [];
  const match = entries.find((c) => c.suffix === suffix);
  return match ? match.positions : [];
}

function pianoIntervals(suffix) {
  const match = PIANO_CHORD_TYPES.find((t) => t.suffix === suffix);
  return match ? match.intervals : [0, 4, 7];
}

const QUIZ_NUM_CHOICES = 6;

// Picks NUM_CHOICES-1 wrong pitch classes plus the correct one, each
// shown once (never both the sharp and flat spelling of the same
// pitch class), then shuffles the order.
function buildQuizChoices(correctPitch) {
  const distractorPool = Array.from({ length: 12 }, (_, i) => i).filter(
    (p) => p !== correctPitch
  );
  for (let i = distractorPool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [distractorPool[i], distractorPool[j]] = [distractorPool[j], distractorPool[i]];
  }
  const pitches = [...distractorPool.slice(0, QUIZ_NUM_CHOICES - 1), correctPitch];
  for (let i = pitches.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pitches[i], pitches[j]] = [pitches[j], pitches[i]];
  }
  return pitches.map((p) => ({ pitch: p, label: randomNoteLabel(p) }));
}

function generateQuizQuestion() {
  const stringIdx = Math.floor(Math.random() * STRING_OPEN_NOTES.length);
  const fret = Math.floor(Math.random() * 13); // 0-12 inclusive
  const pitch = (STRING_OPEN_NOTES[stringIdx].semitone + fret) % 12;
  const mode = Math.random() < 0.5 ? "choice" : "type";
  return {
    stringIdx,
    fret,
    pitch,
    mode,
    choices: mode === "choice" ? buildQuizChoices(pitch) : null,
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// localStorage is synchronous — no async/await belongs anywhere near it.
function readStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { legacy: false, ...JSON.parse(raw) };
    const v3Raw = window.localStorage.getItem(PREV_STORAGE_KEY);
    if (v3Raw) return { legacy: false, ...JSON.parse(v3Raw) };
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) return { legacy: true, ...JSON.parse(legacyRaw) };
    return null;
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

function parseSection(section) {
  if (section === "repertoire") return { type: "repertoire" };
  if (section === "chords") return { type: "chords" };
  if (section === "quiz") return { type: "quiz" };
  if (section === "tabs") return { type: "tabs" };
  const [instrument, monthId] = section.split(":");
  return { type: "month", instrument, monthId };
}

export default function App() {
  const saved = readStorage();

  const [activeSection, setActiveSection] = useState("guitar:month1");
  const [monthsData, setMonthsData] = useState(
    () => saved?.monthsData || DEFAULT_MONTHS_DATA
  );
  const [doneMap, setDoneMap] = useState(() => {
    if (saved?.doneMap) return saved.doneMap;
    if (saved?.legacy && saved?.taskDone) {
      return migrateLegacyTaskDone(saved.taskDone);
    }
    return {};
  });
  const [dailySessions, setDailySessions] = useState(
    () => saved?.dailySessions || {}
  );
  const [repertoire, setRepertoire] = useState(
    () => saved?.repertoire || DEFAULT_REPERTOIRE
  );
  const [savedChords, setSavedChords] = useState(
    () => saved?.savedChords || { guitar: [], piano: [] }
  );
  const [saveError, setSaveError] = useState(false);
  const [editingWeek, setEditingWeek] = useState(null);
  const [draggedTaskIdx, setDraggedTaskIdx] = useState(null);
  const [focusTaskId, setFocusTaskId] = useState(null);
  const [songDraft, setSongDraft] = useState({});
  const [draggedSong, setDraggedSong] = useState(null);
  const [chordInstrument, setChordInstrument] = useState("guitar");
  const [chordRoot, setChordRoot] = useState("C");
  const [chordType, setChordType] = useState("major");
  const [quizQuestion, setQuizQuestion] = useState(() => generateQuizQuestion());
  const [quizStatus, setQuizStatus] = useState(null); // null | "correct" | "wrong"
  const [quizChosenPitch, setQuizChosenPitch] = useState(null);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizHighScore, setQuizHighScore] = useState(
    () => saved?.quizHighScore || 0
  );
  const [quizTyped, setQuizTyped] = useState("");
  const [quizKey, setQuizKey] = useState(0);

  useEffect(() => {
    const ok = writeStorage({
      monthsData,
      doneMap,
      dailySessions,
      repertoire,
      savedChords,
      quizHighScore,
    });
    setSaveError(!ok);
  }, [monthsData, doneMap, dailySessions, repertoire, savedChords, quizHighScore]);

  const toggleTask = useCallback((instrumentId, monthId, weekId, taskId) => {
    const key = taskKey(instrumentId, monthId, weekId, taskId);
    setDoneMap((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updateTaskText = useCallback(
    (instrumentId, monthId, weekId, taskId, text) => {
      setMonthsData((prev) => ({
        ...prev,
        [instrumentId]: prev[instrumentId].map((m) =>
          m.id !== monthId
            ? m
            : {
                ...m,
                weeks: m.weeks.map((w) =>
                  w.id !== weekId
                    ? w
                    : {
                        ...w,
                        tasks: w.tasks.map((t) =>
                          t.id === taskId ? { ...t, text } : t
                        ),
                      }
                ),
              }
        ),
      }));
    },
    []
  );

  const addTask = useCallback((instrumentId, monthId, weekId) => {
    const newId = `${monthId}-${weekId}-custom-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    setMonthsData((prev) => ({
      ...prev,
      [instrumentId]: prev[instrumentId].map((m) =>
        m.id !== monthId
          ? m
          : {
              ...m,
              weeks: m.weeks.map((w) =>
                w.id !== weekId
                  ? w
                  : { ...w, tasks: [...w.tasks, { id: newId, text: "" }] }
              ),
            }
      ),
    }));
    setFocusTaskId(newId);
  }, []);

  const removeTask = useCallback((instrumentId, monthId, weekId, taskId) => {
    setMonthsData((prev) => ({
      ...prev,
      [instrumentId]: prev[instrumentId].map((m) =>
        m.id !== monthId
          ? m
          : {
              ...m,
              weeks: m.weeks.map((w) =>
                w.id !== weekId
                  ? w
                  : { ...w, tasks: w.tasks.filter((t) => t.id !== taskId) }
              ),
            }
      ),
    }));
    setDoneMap((prev) => {
      const key = taskKey(instrumentId, monthId, weekId, taskId);
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const reorderTask = useCallback(
    (instrumentId, monthId, weekId, fromIdx, toIdx) => {
      if (fromIdx === toIdx) return;
      setMonthsData((prev) => ({
        ...prev,
        [instrumentId]: prev[instrumentId].map((m) =>
          m.id !== monthId
            ? m
            : {
                ...m,
                weeks: m.weeks.map((w) => {
                  if (w.id !== weekId) return w;
                  const tasks = [...w.tasks];
                  const [moved] = tasks.splice(fromIdx, 1);
                  tasks.splice(toIdx, 0, moved);
                  return { ...w, tasks };
                }),
              }
        ),
      }));
    },
    []
  );

  function updateSongDraft(instrument, field, value) {
    setSongDraft((prev) => ({
      ...prev,
      [instrument]: { ...(prev[instrument] || {}), [field]: value },
    }));
  }

  const addSong = useCallback(
    (instrument) => {
      const draft = songDraft[instrument] || {};
      const title = (draft.title || "").trim();
      if (!title) return;
      const artist = (draft.artist || "").trim();
      setRepertoire((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          instrument,
          title,
          artist,
          status: "not-started",
        },
      ]);
      setSongDraft((prev) => ({ ...prev, [instrument]: { title: "", artist: "" } }));
    },
    [songDraft]
  );

  const removeSong = useCallback((id) => {
    setRepertoire((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reorderSong = useCallback((instrument, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setRepertoire((prev) => {
      const items = prev.filter((s) => s.instrument === instrument);
      const reordered = [...items];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      let ptr = 0;
      return prev.map((s) =>
        s.instrument === instrument ? reordered[ptr++] : s
      );
    });
  }, []);

  const toggleSavedChord = useCallback((instrument, root, suffix) => {
    const id = `${root}:${suffix}`;
    setSavedChords((prev) => {
      const list = prev[instrument] || [];
      const exists = list.some((c) => c.id === id);
      const nextList = exists
        ? list.filter((c) => c.id !== id)
        : [...list, { id, root, suffix }];
      return { ...prev, [instrument]: nextList };
    });
  }, []);

  const removeSavedChord = useCallback((instrument, id) => {
    setSavedChords((prev) => ({
      ...prev,
      [instrument]: (prev[instrument] || []).filter((c) => c.id !== id),
    }));
  }, []);

  const resolveQuizAnswer = useCallback(
    (isCorrect) => {
      setQuizStatus(isCorrect ? "correct" : "wrong");
      if (isCorrect) {
        setQuizStreak((prev) => {
          const next = prev + 1;
          setQuizHighScore((hs) => Math.max(hs, next));
          return next;
        });
      } else {
        setQuizStreak(0);
      }
      window.setTimeout(() => {
        setQuizStatus(null);
        setQuizChosenPitch(null);
        setQuizTyped("");
        setQuizKey((k) => k + 1);
        setQuizQuestion(generateQuizQuestion());
      }, isCorrect ? 700 : 1500);
    },
    []
  );

  const handleQuizChoice = useCallback(
    (pitch) => {
      if (quizStatus) return;
      setQuizChosenPitch(pitch);
      resolveQuizAnswer(pitch === quizQuestion.pitch);
    },
    [quizStatus, quizQuestion, resolveQuizAnswer]
  );

  const handleQuizTypedSubmit = useCallback(() => {
    if (quizStatus || !quizTyped.trim()) return;
    const normalized = normalizeNoteInput(quizTyped);
    const correct = ENHARMONIC_ANSWERS[quizQuestion.pitch].includes(normalized);
    resolveQuizAnswer(correct);
  }, [quizStatus, quizTyped, quizQuestion, resolveQuizAnswer]);

  const toggleDailyBlock = useCallback((instrumentId, blockId) => {
    const key = todayKey();
    setDailySessions((prev) => {
      const day = { ...(prev[key] || {}) };
      const instDay = { ...(day[instrumentId] || {}) };
      instDay[blockId] = !instDay[blockId];
      day[instrumentId] = instDay;
      return { ...prev, [key]: day };
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

  // Overall streak: a day counts if ANY instrument was practiced at all.
  let streak = 0;
  {
    let cursor = new Date();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      const day = dailySessions[key];
      const hasAny =
        day &&
        Object.values(day).some(
          (instDay) => instDay && Object.values(instDay).some(Boolean)
        );
      if (hasAny) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  const totalPracticeDays = Object.values(dailySessions).filter(
    (day) =>
      day &&
      Object.values(day).some(
        (instDay) => instDay && Object.values(instDay).some(Boolean)
      )
  ).length;

  function monthCompletion(instrumentId, monthId) {
    const months = monthsData[instrumentId];
    const month = months.find((m) => m.id === monthId);
    let total = 0;
    let done = 0;
    month.weeks.forEach((w) => {
      w.tasks.forEach((t) => {
        total += 1;
        if (doneMap[taskKey(instrumentId, monthId, w.id, t.id)]) done += 1;
      });
    });
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }

  const section = parseSection(activeSection);
  const todaysBlocks =
    section.type === "month"
      ? (dailySessions[todayKey()] || {})[section.instrument] || {}
      : {};

  return (
    <div className="tracker-root">
      <MetronomeWidget />
      <header className="tr-header">
        <div>
          <p className="tr-eyebrow">Guitar, Bass &amp; Piano</p>
          <h1 className="tr-title">Fretboard Program</h1>
          <p className="tr-subtitle">
            Three-month plans built off where you're actually starting from.
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
          {INSTRUMENT_META.map((inst) => (
            <React.Fragment key={inst.id}>
              <p className="tr-nav-group-label">{inst.label}</p>
              {monthsData[inst.id].map((m) => {
                const key = `${inst.id}:${m.id}`;
                return (
                  <button
                    key={key}
                    className={`tr-nav-item ${activeSection === key ? "is-active" : ""}`}
                    onClick={() => setActiveSection(key)}
                    aria-pressed={activeSection === key}
                  >
                    <span className="tr-nav-roman">{m.roman}</span>
                    <span className="tr-nav-text">
                      <span className="tr-nav-month">Month {m.roman}</span>
                      <span className="tr-nav-focus">{m.title}</span>
                    </span>
                    <span className="tr-nav-pct">
                      {monthCompletion(inst.id, m.id)}%
                    </span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
          <p className="tr-nav-group-label">&nbsp;</p>
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
          <button
            className={`tr-nav-item ${activeSection === "chords" ? "is-active" : ""}`}
            onClick={() => setActiveSection("chords")}
            aria-pressed={activeSection === "chords"}
          >
            <span className="tr-nav-roman">⚉</span>
            <span className="tr-nav-text">
              <span className="tr-nav-month">Chords</span>
              <span className="tr-nav-focus">Browse &amp; save</span>
            </span>
          </button>
          <button
            className={`tr-nav-item ${activeSection === "quiz" ? "is-active" : ""}`}
            onClick={() => setActiveSection("quiz")}
            aria-pressed={activeSection === "quiz"}
          >
            <span className="tr-nav-roman">?</span>
            <span className="tr-nav-text">
              <span className="tr-nav-month">Note Quiz</span>
              <span className="tr-nav-focus">Name that note</span>
            </span>
          </button>
          <button
            className={`tr-nav-item ${activeSection === "tabs" ? "is-active" : ""}`}
            onClick={() => setActiveSection("tabs")}
            aria-pressed={activeSection === "tabs"}
          >
            <span className="tr-nav-roman">♫</span>
            <span className="tr-nav-text">
              <span className="tr-nav-month">Tabs</span>
              <span className="tr-nav-focus">Practice &amp; drills</span>
            </span>
          </button>
        </nav>

        <main className="tr-main">
          {section.type === "month" && (
            <section className="tr-today">
              <h2 className="tr-section-title">
                Today's session — {findInstrumentMeta(section.instrument).label}
              </h2>
              <div className="tr-today-grid">
                {DAILY_BLOCKS.map((b) => {
                  const on = !!todaysBlocks[b.id];
                  return (
                    <button
                      key={b.id}
                      className={`tr-fret ${on ? "is-done" : ""}`}
                      onClick={() => toggleDailyBlock(section.instrument, b.id)}
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
          )}

          {section.type === "month" ? (
            <section className="tr-month">
              {(() => {
                const instId = section.instrument;
                const months = monthsData[instId];
                const m = months.find((mo) => mo.id === section.monthId);
                return (
                  <div>
                    <div className="tr-month-head">
                      <h2 className="tr-section-title">
                        Month {m.roman} — {m.title}
                      </h2>
                      <span className="tr-month-pct">
                        {monthCompletion(instId, m.id)}% complete
                      </span>
                    </div>
                    <div className="tr-week-grid">
                      {m.weeks.map((w) => {
                        const weekKey = `${instId}:${m.id}:${w.id}`;
                        const isEditing = editingWeek === weekKey;
                        return (
                          <div className="tr-week-card" key={w.id}>
                            <div className="tr-week-head">
                              <h3 className="tr-week-title">{w.label}</h3>
                              <button
                                className="tr-icon-btn"
                                onClick={() =>
                                  setEditingWeek(isEditing ? null : weekKey)
                                }
                                aria-label={
                                  isEditing ? "Done editing week" : "Edit week"
                                }
                              >
                                {isEditing ? (
                                  <Check size={13} strokeWidth={2.5} />
                                ) : (
                                  <Pencil size={13} />
                                )}
                              </button>
                            </div>
                            {isEditing ? (
                              <div className="tr-edit-list">
                                {w.tasks.map((t, idx) => (
                                  <div
                                    className="tr-edit-row"
                                    key={t.id}
                                    draggable
                                    onDragStart={() => setDraggedTaskIdx(idx)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => {
                                      if (
                                        draggedTaskIdx !== null &&
                                        draggedTaskIdx !== idx
                                      ) {
                                        reorderTask(
                                          instId,
                                          m.id,
                                          w.id,
                                          draggedTaskIdx,
                                          idx
                                        );
                                      }
                                      setDraggedTaskIdx(null);
                                    }}
                                  >
                                    <GripVertical
                                      size={14}
                                      className="tr-drag-handle"
                                    />
                                    <input
                                      className="tr-task-input"
                                      value={t.text}
                                      placeholder="New task..."
                                      onChange={(e) =>
                                        updateTaskText(
                                          instId,
                                          m.id,
                                          w.id,
                                          t.id,
                                          e.target.value
                                        )
                                      }
                                      ref={(el) => {
                                        if (el && t.id === focusTaskId) {
                                          el.focus();
                                          setFocusTaskId(null);
                                        }
                                      }}
                                    />
                                    <button
                                      className="tr-icon-btn"
                                      onClick={() =>
                                        removeTask(instId, m.id, w.id, t.id)
                                      }
                                      aria-label="Remove task"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  className="tr-add-btn"
                                  onClick={() => addTask(instId, m.id, w.id)}
                                >
                                  <Plus size={13} /> Add task
                                </button>
                              </div>
                            ) : (
                              <ul className="tr-task-list">
                                {w.tasks.map((t) => {
                                  const done =
                                    !!doneMap[
                                      taskKey(instId, m.id, w.id, t.id)
                                    ];
                                  return (
                                    <li key={t.id}>
                                      <button
                                        className={`tr-fret tr-fret--small ${done ? "is-done" : ""}`}
                                        onClick={() =>
                                          toggleTask(instId, m.id, w.id, t.id)
                                        }
                                        aria-pressed={done}
                                      >
                                        <span className="tr-fret-dot">
                                          {done && (
                                            <Check size={11} strokeWidth={3} />
                                          )}
                                        </span>
                                        <span className="tr-task-text">
                                          {t.text}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </section>
          ) : section.type === "repertoire" ? (
            <section className="tr-repertoire">
              <h2 className="tr-section-title">Repertoire</h2>
              <div className="tr-rep-columns">
                {["guitar", "bass", "piano"].map((inst) => (
                  <div className="tr-rep-col" key={inst}>
                    <h3 className="tr-rep-col-title">
                      {inst.charAt(0).toUpperCase() + inst.slice(1)}
                    </h3>
                    <ul className="tr-rep-list">
                      {repertoire
                        .filter((s) => s.instrument === inst)
                        .map((song, idx) => (
                          <li
                            key={song.id}
                            className="tr-rep-item"
                            draggable
                            onDragStart={() =>
                              setDraggedSong({ instrument: inst, idx })
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (
                                draggedSong &&
                                draggedSong.instrument === inst &&
                                draggedSong.idx !== idx
                              ) {
                                reorderSong(inst, draggedSong.idx, idx);
                              }
                              setDraggedSong(null);
                            }}
                          >
                            <GripVertical size={14} className="tr-drag-handle" />
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
                            <button
                              className="tr-icon-btn"
                              onClick={() => removeSong(song.id)}
                              aria-label="Remove song"
                            >
                              <X size={14} />
                            </button>
                          </li>
                        ))}
                    </ul>
                    <div className="tr-rep-add-form">
                      <input
                        className="tr-rep-add-input"
                        placeholder="Song title"
                        value={songDraft[inst]?.title || ""}
                        onChange={(e) =>
                          updateSongDraft(inst, "title", e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addSong(inst);
                        }}
                      />
                      <input
                        className="tr-rep-add-input"
                        placeholder="Artist"
                        value={songDraft[inst]?.artist || ""}
                        onChange={(e) =>
                          updateSongDraft(inst, "artist", e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addSong(inst);
                        }}
                      />
                      <button
                        className="tr-add-btn"
                        onClick={() => addSong(inst)}
                      >
                        <Plus size={13} /> Add song
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : section.type === "chords" ? (
            <section className="tr-chords">
              <h2 className="tr-section-title">Chords</h2>

              <div className="tr-chord-toggle">
                {["guitar", "piano"].map((inst) => (
                  <button
                    key={inst}
                    className={`tr-toggle-btn ${chordInstrument === inst ? "is-active" : ""}`}
                    onClick={() => {
                      setChordInstrument(inst);
                      setChordType("major");
                    }}
                    aria-pressed={chordInstrument === inst}
                  >
                    {inst.charAt(0).toUpperCase() + inst.slice(1)}
                  </button>
                ))}
              </div>

              <div className="tr-chord-selectors">
                <select
                  className="tr-chord-select"
                  value={chordRoot}
                  onChange={(e) => setChordRoot(e.target.value)}
                  aria-label="Root note"
                >
                  {ROOTS.map((r) => (
                    <option key={r.display} value={r.display}>
                      {r.display}
                    </option>
                  ))}
                </select>
                <select
                  className="tr-chord-select"
                  value={chordType}
                  onChange={(e) => setChordType(e.target.value)}
                  aria-label="Chord type"
                >
                  {(chordInstrument === "guitar" ? GUITAR_TYPES : PIANO_TYPES).map(
                    (suf) => (
                      <option key={suf} value={suf}>
                        {suf}
                      </option>
                    )
                  )}
                </select>
              </div>

              {(() => {
                const symbol = chordSymbol(chordRoot, chordType);
                const isSaved = (savedChords[chordInstrument] || []).some(
                  (c) => c.id === `${chordRoot}:${chordType}`
                );

                if (chordInstrument === "guitar") {
                  const positions = guitarPositions(chordRoot, chordType);
                  return (
                    <div className="tr-chord-browse">
                      <div className="tr-chord-browse-head">
                        <span className="tr-chord-symbol">{symbol}</span>
                        <button
                          className={`tr-icon-btn tr-save-btn ${isSaved ? "is-saved" : ""}`}
                          onClick={() =>
                            toggleSavedChord(chordInstrument, chordRoot, chordType)
                          }
                          aria-label={isSaved ? "Remove from saved chords" : "Save chord"}
                        >
                          <Star
                            size={16}
                            fill={isSaved ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                      {positions.length === 0 ? (
                        <p className="tr-chord-empty">
                          No voicings found for this combination.
                        </p>
                      ) : (
                        <div className="tr-chord-grid">
                          {positions.map((pos, idx) => (
                            <div className="tr-chord-card" key={idx}>
                              <GuitarChordDiagram position={pos} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                const root = findRoot(chordRoot);
                const intervals = pianoIntervals(chordType);
                return (
                  <div className="tr-chord-browse">
                    <div className="tr-chord-browse-head">
                      <span className="tr-chord-symbol">{symbol}</span>
                      <button
                        className={`tr-icon-btn tr-save-btn ${isSaved ? "is-saved" : ""}`}
                        onClick={() =>
                          toggleSavedChord(chordInstrument, chordRoot, chordType)
                        }
                        aria-label={isSaved ? "Remove from saved chords" : "Save chord"}
                      >
                        <Star size={16} fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <div className="tr-chord-grid">
                      <div className="tr-chord-card">
                        <PianoChordDiagram
                          rootSemitone={root.semitone}
                          intervals={intervals}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="tr-saved-chords">
                <h3 className="tr-rep-col-title">
                  Saved — {chordInstrument.charAt(0).toUpperCase() + chordInstrument.slice(1)}
                </h3>
                {(savedChords[chordInstrument] || []).length === 0 ? (
                  <p className="tr-chord-empty">
                    No chords saved yet — star one above to add it.
                  </p>
                ) : (
                  <ul className="tr-saved-chord-list">
                    {(savedChords[chordInstrument] || []).map((c) => (
                      <li className="tr-saved-chord-chip" key={c.id}>
                        <button
                          className="tr-saved-chord-label"
                          onClick={() => {
                            setChordRoot(c.root);
                            setChordType(c.suffix);
                          }}
                        >
                          {chordSymbol(c.root, c.suffix)}
                        </button>
                        <button
                          className="tr-icon-btn"
                          onClick={() => removeSavedChord(chordInstrument, c.id)}
                          aria-label="Remove saved chord"
                        >
                          <X size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : section.type === "quiz" ? (
            <section className="tr-quiz">
              <div className="tr-quiz-head">
                <h2 className="tr-section-title">Note Quiz</h2>
                <div className="tr-quiz-stats">
                  <span>
                    Streak <strong>{quizStreak}</strong>
                  </span>
                  <span>
                    Best <strong>{quizHighScore}</strong>
                  </span>
                </div>
              </div>
              <p className="tr-quiz-prompt">What note is this?</p>

              <FretboardQuizDiagram
                targetString={quizQuestion.stringIdx}
                targetFret={quizQuestion.fret}
                status={quizStatus}
                dotKey={quizKey}
              />

              {quizStatus === "wrong" && (
                <p className="tr-quiz-reveal">
                  That was {ENHARMONIC_ANSWERS[quizQuestion.pitch].join(" / ")}
                </p>
              )}

              {quizQuestion.mode === "choice" ? (
                <div className="tr-quiz-choices">
                  {quizQuestion.choices.map((choice) => {
                    let choiceClass = "";
                    if (quizStatus) {
                      if (choice.pitch === quizQuestion.pitch) {
                        choiceClass = "is-correct";
                      } else if (choice.pitch === quizChosenPitch) {
                        choiceClass = "is-wrong-chosen";
                      }
                    }
                    return (
                      <button
                        key={choice.pitch}
                        className={`tr-quiz-choice-btn ${choiceClass}`}
                        onClick={() => handleQuizChoice(choice.pitch)}
                        disabled={!!quizStatus}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="tr-quiz-type-row">
                  <input
                    className="tr-quiz-input"
                    value={quizTyped}
                    onChange={(e) => setQuizTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleQuizTypedSubmit();
                    }}
                    placeholder="Type the note (e.g. C# or Db)"
                    disabled={!!quizStatus}
                    autoFocus
                  />
                  <button
                    className="tr-add-btn"
                    onClick={handleQuizTypedSubmit}
                    disabled={!!quizStatus}
                  >
                    Check
                  </button>
                </div>
              )}
            </section>
          ) : section.type === "tabs" ? (
            <TabsSection />
          ) : null}
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
