import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  CircleHelp,
  Clock3,
  Code2,
  Download,
  FileJson,
  Flag,
  Layers3,
  ListChecks,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import {
  aiPrompt,
  Exam,
  formatTime,
  isCorrect,
  parseExam,
  secondsLeft,
  Session,
  templateJSON,
} from "./exam";
import "./style.css";
import { QuestionTable } from "./QuestionTable";
const STORAGE = "exam-time-session-v1";
function restore(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (!s) return null;
    const exam = parseExam(JSON.stringify(s.exam));
    if (
      !Number.isFinite(s.deadline) ||
      !Number.isFinite(s.duration) ||
      s.duration <= 0 ||
      !Number.isInteger(s.index) ||
      s.index < 0 ||
      s.index >= exam.questions.length ||
      typeof s.finished !== "boolean" ||
      !s.answers ||
      typeof s.answers !== "object" ||
      Array.isArray(s.answers) ||
      !Array.isArray(s.flagged) ||
      !s.flagged.every((v: unknown) => typeof v === "string")
    )
      return null;
    for (const q of exam.questions) {
      const a = s.answers[q.id];
      if (
        a !== undefined &&
        (!Array.isArray(a) ||
          new Set(a).size !== a.length ||
          a.some((id: unknown) => !q.options.some((o) => o.id === id)) ||
          (q.type !== "multiple" && a.length > 1))
      )
        return null;
    }
    return {
      ...s,
      exam,
      finished: s.finished || secondsLeft(s.deadline) === 0,
      autoSubmitted:
        s.autoSubmitted === true ||
        (!s.finished && secondsLeft(s.deadline) === 0),
    };
  } catch {
    return null;
  }
}
function App() {
  const [session, setSession] = useState<Session | null>(restore);
  const [raw, setRaw] = useState("");
  const [duration, setDuration] = useState("30");
  const [tab, setTab] = useState<"paste" | "guide">("paste");
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState<"submit" | "reset" | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const importRef = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<{
    exam: Exam | null;
    error: string;
  }>({ exam: null, error: "" });
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!raw.trim()) setValidation({ exam: null, error: "" });
      else
        try {
          setValidation({ exam: parseExam(raw), error: "" });
        } catch (e) {
          setValidation({ exam: null, error: (e as Error).message });
        }
    }, 250);
    return () => clearTimeout(id);
  }, [raw]);
  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE, JSON.stringify(session));
      else localStorage.removeItem(STORAGE);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [session]);
  useEffect(() => {
    if (!session || session.finished) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= session.deadline) {
        setSession((s) =>
          s ? { ...s, finished: true, autoSubmitted: true } : null,
        );
        setModal(null);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [session?.deadline, session?.finished]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", close);
    const b = document.querySelector<HTMLButtonElement>(".modal .secondary");
    b?.focus();
    return () => window.removeEventListener("keydown", close);
  }, [modal]);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied! You’re ready for the next step.");
    } catch {
      setToast(
        "Could not copy automatically. Select the text and copy it manually.",
      );
    }
  }
  function download(name: string, content: string) {
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function start() {
    setAttempted(true);
    try {
      const exam = parseExam(raw);
      const minutes = Number(duration);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
        setToast("Enter a whole number between 1 and 1440 minutes.");
        return;
      }
      setNow(Date.now());
      setSession({
        exam,
        answers: {},
        flagged: [],
        deadline: Date.now() + minutes * 60000,
        duration: minutes,
        finished: false,
        index: 0,
      });
      setFilter("all");
      window.scrollTo(0, 0);
    } catch (e) {
      setValidation({ exam: null, error: (e as Error).message });
    }
  }
  function choose(id: string) {
    setSession((s) => {
      if (!s || s.finished) return s;
      if (Date.now() >= s.deadline)
        return { ...s, finished: true, autoSubmitted: true };
      const q = s.exam.questions[s.index];
      const previous = s.answers[q.id] || [];
      return {
        ...s,
        answers: {
          ...s.answers,
          [q.id]:
            q.type === "multiple"
              ? previous.includes(id)
                ? previous.filter((a) => a !== id)
                : [...previous, id]
              : [id],
        },
      };
    });
  }
  const exam = validation.exam;
  const answered = session
    ? session.exam.questions.filter((q) => session.answers[q.id]?.length).length
    : 0;
  const correct = session
    ? session.exam.questions.filter((q) => isCorrect(q, session.answers[q.id]))
        .length
    : 0;
  const remaining = session ? secondsLeft(session.deadline, now) : 0;
  const typeLabel = {
    single: "Single choice",
    multiple: "Multiple answers",
    true_false: "True or false",
  };
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (session) setModal("reset");
            }}
            aria-label="Exam Time home"
          >
            <span className="brand-symbol">
              <Layers3 size={24} />
            </span>
            <span dir="ltr">
              exam<span className="brand-light">time</span>
              <span className="brand-dot">.</span>
            </span>
          </a>
          <div className="header-middle">
            A little space. <span>For big progress.</span>
          </div>
          <div className="local-badge">
            <span /> Personal workspace{" "}
            <span className="desktop">• No account needed</span>
          </div>
        </div>
      </header>
      <main>
        {!session ? (
          <>
            <section className="hero">
              <div className="eyebrow">
                <span className="tiny-line" /> A LITTLE PREPARATION. A LOT MORE
                CONFIDENCE.
              </div>
              <h1>
                Your questions. Your pace.
                <br className="mobile" />
                <span> Your exam.</span>
                <span className="hero-asterisk">✳</span>
              </h1>
              <p>
                Turn your questions into a real exam experience.
                <br className="mobile" /> Find your focus, test yourself, and
                see how far you’ve come.
              </p>
              <div className="steps">
                <span className="step-current">
                  <b>1</b> Add questions
                </span>
                <i />
                <span>
                  <b>2</b> Take the exam
                </span>
                <i />
                <span>
                  <b>3</b> Review results
                </span>
              </div>
            </section>
            <div className="setup-layout">
              <section className="card import-card">
                <div className="card-heading">
                  <div className="heading-icon purple">
                    <FileJson size={21} />
                  </div>
                  <div>
                    <h2>It starts with your questions</h2>
                    <p>Everything you need, in one JSON file.</p>
                  </div>
                  <span className="mini-label">STEP 01</span>
                </div>
                <div className="tabs">
                  <button
                    className={tab === "paste" ? "active" : ""}
                    onClick={() => setTab("paste")}
                  >
                    <Code2 size={16} /> Add questions
                  </button>
                  <button
                    className={tab === "guide" ? "active" : ""}
                    onClick={() => setTab("guide")}
                  >
                    <CircleHelp size={16} /> Format guide
                  </button>
                </div>
                {tab === "paste" ? (
                  <div className="import-body">
                    <div className="field-label">
                      <label htmlFor="questions">
                        Paste your questions here
                      </label>
                      <button
                        className="text-button"
                        onClick={() => {
                          setRaw(templateJSON);
                          setAttempted(false);
                        }}
                      >
                        <Sparkles size={14} /> Try an example
                      </button>
                    </div>
                    <div
                      className={
                        "editor " + (validation.error ? "invalid" : "")
                      }
                    >
                      <div className="editor-top">
                        <span>
                          <span className="editor-dot" /> questions.json
                        </span>
                        <span>JSON</span>
                      </div>
                      <textarea
                        id="questions"
                        spellCheck={false}
                        dir="ltr"
                        value={raw}
                        onChange={(e) => setRaw(e.target.value)}
                        placeholder={
                          '{\n  "schemaVersion": 1,\n  "title": "Your exam title",\n  "questions": [\n    // Your questions go here...\n  ]\n}'
                        }
                        aria-describedby="json-status"
                      />
                      <div className="editor-bottom">
                        <span>
                          <Code2 size={13} /> UTF-8
                        </span>
                        <span>
                          {raw.length.toLocaleString("en")} characters
                        </span>
                      </div>
                    </div>
                    <div id="json-status" aria-live="polite">
                      {validation.error ? (
                        <p className="error">
                          <CircleHelp size={16} />
                          {validation.error}
                        </p>
                      ) : exam ? (
                        <p className="valid">
                          <CheckCheck size={16} /> Ready! Validated{" "}
                          {exam.questions.length} questions successfully.
                        </p>
                      ) : attempted ? (
                        <p className="error">
                          Add your questions first, or try the ready-made
                          example.
                        </p>
                      ) : (
                        <p className="field-hint">
                          <ShieldCheck size={15} /> Correct answers stay hidden
                          until you submit your exam.
                        </p>
                      )}
                    </div>
                    <div className="import-actions">
                      <button
                        className="secondary small"
                        onClick={() => importRef.current?.click()}
                      >
                        <Plus size={15} /> Import JSON file
                      </button>
                      <span>or paste your AI response directly</span>
                      <input
                        ref={importRef}
                        hidden
                        type="file"
                        accept=".json,application/json"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.size > 5 * 1024 * 1024)
                              setToast("The file must be 5 MB or smaller.");
                            else
                              try {
                                setRaw(await f.text());
                              } catch {
                                setToast(
                                  "Could not read the file. Try pasting its contents.",
                                );
                              }
                          }
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="guide">
                    <h3>One format. So many possibilities.</h3>
                    <p>
                      Copy the AI instructions, fill in your topic and question
                      count, then paste the response into Add questions.
                    </p>
                    <div className="type-table">
                      <div>
                        <b>single</b>
                        <span>4 options · 1 correct answer</span>
                      </div>
                      <div>
                        <b>multiple</b>
                        <span>5 options · 2+ correct answers</span>
                      </div>
                      <div>
                        <b>true_false</b>
                        <span>True / False · 1 correct answer</span>
                      </div>
                    </div>
                    <p>
                      Each question is worth 1 point. For multiple-answer
                      questions, select every correct option and no incorrect
                      options to earn the point.
                    </p>
                    <h4 className="table-guide-heading">
                      Questions can include a table, too.
                    </h4>
                    <p>
                      Add an optional <code>table</code> with{" "}
                      <code>columns</code>, <code>rows</code>, and an optional{" "}
                      <code>caption</code> to any question type. Every row must
                      match the number of columns. Cells can be text or numbers.
                      Tables appear above the choices and remain visible during
                      review.
                    </p>
                    <pre dir="ltr" tabIndex={0}>
                      {templateJSON}
                    </pre>
                    <div className="guide-actions">
                      <button
                        className="primary small"
                        onClick={() => copy(aiPrompt)}
                      >
                        <Sparkles size={16} /> Copy AI instructions
                      </button>
                      <button
                        className="secondary small"
                        onClick={() =>
                          download("exam-template.json", templateJSON)
                        }
                      >
                        <Download size={16} /> Download template
                      </button>
                    </div>
                    <p className="field-hint">
                      The template explains the structure. Set your exam
                      duration in the settings.
                    </p>
                  </div>
                )}
              </section>
              <aside className="setup-aside">
                <section className="card settings-card">
                  <div className="card-heading">
                    <div className="heading-icon mint">
                      <Clock3 size={21} />
                    </div>
                    <div>
                      <h2>Make it your own</h2>
                      <p>A little structure for your next challenge.</p>
                    </div>
                  </div>
                  <label className="label" htmlFor="duration">
                    Exam duration
                  </label>
                  <div className="duration-input">
                    <Clock3 size={18} />
                    <input
                      id="duration"
                      type="number"
                      min="1"
                      max="1440"
                      step="1"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    />
                    <span>min</span>
                  </div>
                  <div className="presets">
                    {[15, 30, 60, 90].map((m) => (
                      <button
                        key={m}
                        className={duration === String(m) ? "selected" : ""}
                        onClick={() => setDuration(String(m))}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                  <div className="summary-row">
                    <span>
                      <ListChecks size={17} /> Questions
                    </span>
                    <b>
                      {exam ? exam.questions.length : "—"}{" "}
                      <small>
                        {exam?.questions.length === 1
                          ? "question"
                          : "questions"}
                      </small>
                    </b>
                  </div>
                  <div className="summary-row">
                    <span>
                      <Target size={17} /> Total points
                    </span>
                    <b>
                      {exam ? exam.questions.length : "—"} <small>points</small>
                    </b>
                  </div>
                  <div className="quiet-note">
                    <CircleHelp size={16} />
                    <span>
                      Your question count comes from the file.
                      <br />
                      The timer starts when you press Start.
                    </span>
                  </div>
                  <button className="primary start-button" onClick={start}>
                    <Play size={17} fill="currentColor" /> Start exam{" "}
                    <ArrowRight size={18} />
                  </button>
                  <p className="under-button">
                    <ShieldCheck size={13} /> Your progress is saved on this
                    device
                  </p>
                </section>
                <section className="ai-card">
                  <span className="ai-decoration">✧</span>
                  <div className="ai-icon">
                    <Sparkles size={21} />
                  </div>
                  <h3>Let AI help you prepare</h3>
                  <p>
                    Any topic. Any level. Copy the instructions and let AI
                    create questions in the right format.
                  </p>
                  <button onClick={() => copy(aiPrompt)}>
                    Copy AI instructions <ArrowUpRight size={17} />
                  </button>
                </section>
              </aside>
            </div>
            <section className="benefits">
              <div>
                <span>
                  <ShieldCheck size={21} />
                </span>
                <div>
                  <h3>Your own little workspace</h3>
                  <p>Your questions and answers stay on your device.</p>
                </div>
              </div>
              <div>
                <span>
                  <Clock3 size={21} />
                </span>
                <div>
                  <h3>Make practice feel real</h3>
                  <p>
                    A running timer, a clear focus, and automatic submission.
                  </p>
                </div>
              </div>
              <div>
                <span>
                  <BookOpen size={21} />
                </span>
                <div>
                  <h3>Learn with every attempt</h3>
                  <p>Review your answers and understand your mistakes.</p>
                </div>
              </div>
            </section>
          </>
        ) : !session.finished ? (
          <>
            <section className="exam-top">
              <div>
                <div className="eyebrow">TIME TO FOCUS</div>
                <h1>{session.exam.title}</h1>
                <p>Take a deep breath. You’ve got this.</p>
              </div>
              <div className={"timer " + (remaining <= 60 ? "urgent" : "")}>
                <Clock3 size={24} />
                <div>
                  <small>Time remaining</small>
                  <strong dir="ltr" role="timer" aria-label="Time remaining">
                    {formatTime(remaining)}
                  </strong>
                </div>
                <span className="live-dot" />
              </div>
            </section>
            <div className="exam-layout">
              <section className="card question-card" key={session.index}>
                <div className="question-top">
                  <span>
                    Question {session.index + 1}{" "}
                    <span className="muted">
                      of {session.exam.questions.length}
                    </span>
                  </span>
                  <button
                    className={
                      "flag-button " +
                      (session.flagged.includes(
                        session.exam.questions[session.index].id,
                      )
                        ? "flagged"
                        : "")
                    }
                    onClick={() =>
                      setSession((s) => {
                        if (!s || Date.now() >= s.deadline) return s;
                        const id = s.exam.questions[s.index].id;
                        return {
                          ...s,
                          flagged: s.flagged.includes(id)
                            ? s.flagged.filter((v) => v !== id)
                            : [...s.flagged, id],
                        };
                      })
                    }
                  >
                    <Flag size={16} />
                    {session.flagged.includes(
                      session.exam.questions[session.index].id,
                    )
                      ? "Flagged"
                      : "Flag for review"}
                  </button>
                </div>
                <span className="type-pill">
                  {typeLabel[session.exam.questions[session.index].type]}
                </span>
                <h2 className="question-text" dir="auto">
                  {session.exam.questions[session.index].text}
                </h2>
                <QuestionTable
                  table={session.exam.questions[session.index].table}
                />
                <p className="selection-hint">
                  {session.exam.questions[session.index].type === "multiple"
                    ? "Select all the answers you believe are correct."
                    : "Select one answer."}
                </p>
                <div
                  className="options"
                  role="group"
                  aria-label="Answer options"
                >
                  {session.exam.questions[session.index].options.map((o, i) => {
                    const q = session.exam.questions[session.index];
                    const selected = session.answers[q.id]?.includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className={"option " + (selected ? "chosen" : "")}
                      >
                        <input
                          type={q.type === "multiple" ? "checkbox" : "radio"}
                          name={q.id}
                          checked={!!selected}
                          onChange={() => choose(o.id)}
                        />
                        <span className="option-letter">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="option-text" dir="auto">
                          {o.text}
                        </span>
                        <span
                          className={
                            "choice-mark " +
                            (q.type === "multiple" ? "square" : "")
                          }
                        >
                          {selected && <Check size={13} />}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="question-footer">
                  <button
                    className="secondary"
                    disabled={session.index === 0}
                    onClick={() =>
                      setSession((s) => s && { ...s, index: s.index - 1 })
                    }
                  >
                    <ArrowLeft size={16} /> Previous
                  </button>
                  <button
                    className="text-button"
                    disabled={
                      !session.answers[session.exam.questions[session.index].id]
                        ?.length
                    }
                    onClick={() =>
                      setSession((s) =>
                        s && Date.now() < s.deadline
                          ? {
                              ...s,
                              answers: {
                                ...s.answers,
                                [s.exam.questions[s.index].id]: [],
                              },
                            }
                          : s,
                      )
                    }
                  >
                    Clear answer
                  </button>
                  {session.index < session.exam.questions.length - 1 ? (
                    <button
                      className="primary"
                      onClick={() =>
                        setSession((s) => s && { ...s, index: s.index + 1 })
                      }
                    >
                      Next question <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => setModal("submit")}
                    >
                      Submit exam <CheckCheck size={17} />
                    </button>
                  )}
                </div>
              </section>
              <aside className="card navigator">
                <h2>Your exam progress</h2>
                <div className="nav-progress">
                  <span>
                    Answered {answered} of {session.exam.questions.length}
                  </span>
                  <b>
                    {Math.round(
                      (answered / session.exam.questions.length) * 100,
                    )}
                    %
                  </b>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${(answered / session.exam.questions.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="question-grid">
                  {session.exam.questions.map((q, i) => (
                    <button
                      key={q.id}
                      aria-label={`Question ${i + 1}${session.answers[q.id]?.length ? ", answered" : ""}${session.flagged.includes(q.id) ? ", flagged" : ""}`}
                      aria-current={i === session.index ? "step" : undefined}
                      className={
                        (session.answers[q.id]?.length ? "answered " : "") +
                        (i === session.index ? "current " : "") +
                        (session.flagged.includes(q.id) ? "flagged" : "")
                      }
                      onClick={() => setSession((s) => s && { ...s, index: i })}
                    >
                      {i + 1}
                      {session.flagged.includes(q.id) && <span />}
                    </button>
                  ))}
                </div>
                <div className="legend">
                  <span>
                    <i className="done" /> Answered
                  </span>
                  <span>
                    <i className="review" /> Flagged
                  </span>
                </div>
                <p className="quiet-note">
                  You can revisit any question and change your answers before
                  submitting.
                </p>
                <button
                  className="secondary full"
                  onClick={() => setModal("submit")}
                >
                  <CheckCheck size={17} /> Finish & submit
                </button>
              </aside>
            </div>
          </>
        ) : (
          <>
            <section className="results-hero">
              <div className="trophy">
                <Trophy size={30} />
              </div>
              <div className="eyebrow">EVERY ATTEMPT IS A STEP FORWARD</div>
              <h1>
                Exam complete. <span>See how you did.</span>
              </h1>
              <p>{session.exam.title}</p>
              <span className="result-tag">
                {session.autoSubmitted
                  ? "Time’s up · Submitted automatically"
                  : "Your exam was submitted successfully"}
              </span>
            </section>
            <section className="result-stats card">
              <div
                className="score-ring"
                style={
                  {
                    "--score": `${(correct / session.exam.questions.length) * 100}%`,
                  } as React.CSSProperties
                }
              >
                <b>
                  {Math.round((correct / session.exam.questions.length) * 100)}
                  <small>%</small>
                </b>
              </div>
              <div>
                <span>Your final score</span>
                <h2>
                  {correct}{" "}
                  <small>of {session.exam.questions.length} points</small>
                </h2>
              </div>
              <div className="stat">
                <span className="green">{correct}</span>
                <small>Correct</small>
              </div>
              <div className="stat">
                <span className="red">{answered - correct}</span>
                <small>Incorrect</small>
              </div>
              <div className="stat">
                <span>{session.exam.questions.length - answered}</span>
                <small>Unanswered</small>
              </div>
            </section>
            <div className="review-heading">
              <div>
                <h2>A little reflection goes a long way</h2>
                <p>Review the answers. Learn something from every question.</p>
              </div>
              <div className="review-filters">
                <button
                  className={filter === "all" ? "active" : ""}
                  onClick={() => setFilter("all")}
                >
                  All questions
                </button>
                <button
                  className={filter === "wrong" ? "active" : ""}
                  onClick={() => setFilter("wrong")}
                >
                  Needs review ({session.exam.questions.length - correct})
                </button>
              </div>
            </div>
            <div className="review-list">
              {session.exam.questions.map((q, i) => {
                const pass = isCorrect(q, session.answers[q.id]);
                if (filter === "wrong" && pass) return null;
                return (
                  <section className="card review-card" key={q.id}>
                    <div className="question-top">
                      <span>
                        Question {i + 1}{" "}
                        <span className="type-pill">{typeLabel[q.type]}</span>
                      </span>
                      <span
                        className={
                          "status-pill " + (pass ? "success" : "incorrect")
                        }
                      >
                        {pass ? <Check size={14} /> : <X size={14} />}{" "}
                        {pass
                          ? "Correct"
                          : session.answers[q.id]?.length
                            ? "Incorrect"
                            : "Unanswered"}
                      </span>
                    </div>
                    <h3 dir="auto">{q.text}</h3>
                    <QuestionTable table={q.table} />
                    <div className="review-options">
                      {q.options.map((o) => {
                        const right = q.correctAnswers.includes(o.id);
                        const chosen = !!session.answers[q.id]?.includes(o.id);
                        return (
                          <div
                            key={o.id}
                            className={
                              "review-option " +
                              (right ? "right" : chosen ? "wrong" : "")
                            }
                          >
                            <span dir="auto">{o.text}</span>
                            <small>
                              {right && (
                                <>
                                  <Check size={14} /> Correct answer
                                </>
                              )}
                              {chosen && (
                                <span className="your-choice">Your answer</span>
                              )}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div className="explanation">
                        <BookOpen size={17} />
                        <div>
                          <b>The explanation</b>
                          <p dir="auto">{q.explanation}</p>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
              {filter === "wrong" &&
                correct === session.exam.questions.length && (
                  <div className="card perfect">
                    <Sparkles />
                    Every answer is correct. Nicely done!
                  </div>
                )}
            </div>
            <div className="result-actions">
              <button className="primary" onClick={() => setModal("reset")}>
                <Plus size={17} /> New exam
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setRaw(JSON.stringify(session.exam, null, 2));
                  setDuration(String(session.duration));
                  setSession(null);
                  setAttempted(false);
                  window.scrollTo(0, 0);
                }}
              >
                <RotateCcw size={17} /> Retake this exam
              </button>
              <button
                className="secondary"
                onClick={() =>
                  download(
                    "exam-results.json",
                    JSON.stringify(
                      {
                        title: session.exam.title,
                        score: correct,
                        total: session.exam.questions.length,
                        questions: session.exam.questions.map((q) => ({
                          ...q,
                          selectedAnswers: session.answers[q.id] || [],
                          correct: isCorrect(q, session.answers[q.id]),
                        })),
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                <Download size={17} /> Save results
              </button>
            </div>
          </>
        )}
        {storageError && (
          <p className="error" role="alert">
            Local storage is unavailable. Stay on this page until you finish
            your exam.
          </p>
        )}
      </main>
      <footer>
        <span dir="ltr">examtime.</span>
        <p>A little preparation. A little more confidence.</p>
        <span>
          <span className="footer-dot" /> Made for your focus time
        </span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const elements =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                const first = elements[0],
                  last = elements[elements.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <div className="heading-icon purple">
              {modal === "submit" ? <CheckCheck /> : <RotateCcw />}
            </div>
            <h2 id="modal-title">
              {modal === "submit"
                ? "Ready to see your results?"
                : "Start fresh?"}
            </h2>
            <p>
              {modal === "submit"
                ? `You answered ${answered} of ${session?.exam.questions.length} questions. You can’t change your answers after submitting.`
                : "This attempt will be removed from this device. If you have finished, save your results first to keep a copy."}
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setModal(null)}>
                Go back
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (modal === "submit")
                    setSession(
                      (s) =>
                        s && {
                          ...s,
                          finished: true,
                          autoSubmitted: Date.now() >= s.deadline,
                        },
                    );
                  else {
                    setSession(null);
                    setRaw("");
                    setAttempted(false);
                  }
                  setModal(null);
                  window.scrollTo(0, 0);
                }}
              >
                {modal === "submit" ? "Confirm submission" : "Start fresh"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
