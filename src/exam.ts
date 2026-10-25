export type QuestionTable = {
  caption?: string;
  columns: string[];
  rows: (string | number)[][];
};
export type Question = {
  id: string;
  text: string;
  type: "single" | "multiple" | "true_false";
  options: { id: string; text: string }[];
  correctAnswers: string[];
  explanation?: string;
  table?: QuestionTable;
};
export type Exam = { schemaVersion: 1; title: string; questions: Question[] };
export type Session = {
  exam: Exam;
  answers: Record<string, string[]>;
  flagged: string[];
  deadline: number;
  duration: number;
  finished: boolean;
  autoSubmitted?: boolean;
  index: number;
};
export function parseExam(raw: string): Exam {
  let data: any;
  try {
    data = JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new Error(
      "Invalid JSON. Check the brackets and commas, or copy the ready-made template.",
    );
  }
  const validText = (v: unknown) =>
    typeof v === "string" && v.trim().length > 0;
  if (
    !data ||
    data.schemaVersion !== 1 ||
    !validText(data.title) ||
    !Array.isArray(data.questions) ||
    !data.questions.length
  )
    throw new Error(
      "Provide schemaVersion: 1, a non-empty title, and a questions array with at least one question.",
    );
  const ids = new Set<string>();
  data.questions.forEach((q: any, i: number) => {
    const fail = (msg: string): never => {
      throw new Error(`Question ${i + 1}: ${msg}`);
    };
    if (!q || !validText(q.id) || !validText(q.text))
      fail("Provide a non-empty id and text.");
    if (Object.hasOwn(Object.prototype, q.id) || q.id === "prototype")
      fail("Choose a different question id; this id is reserved.");
    if (ids.has(q.id)) fail("The question id is duplicated.");
    ids.add(q.id);
    const count =
      q.type === "single"
        ? 4
        : q.type === "multiple"
          ? 5
          : q.type === "true_false"
            ? 2
            : 0;
    if (!count) fail("Type must be single, multiple, or true_false.");
    if (!Array.isArray(q.options) || q.options.length !== count)
      fail(`This type requires exactly ${count} options.`);
    const opts = new Set<string>();
    q.options.forEach((o: any) => {
      if (!o || !validText(o.id) || !validText(o.text) || opts.has(o.id))
        fail("Each option needs a unique id and non-empty text.");
      opts.add(o.id);
    });
    if (
      q.type === "true_false" &&
      !(
        q.options.every((o: any) => ["true", "false"].includes(o.id)) &&
        opts.has("true") &&
        opts.has("false")
      )
    )
      fail("Use the option ids true and false.");
    if (
      !Array.isArray(q.correctAnswers) ||
      !q.correctAnswers.length ||
      q.correctAnswers.some(
        (a: unknown) => typeof a !== "string" || !opts.has(a),
      ) ||
      new Set(q.correctAnswers).size !== q.correctAnswers.length
    )
      fail("correctAnswers must contain valid, non-duplicate option ids.");
    if (q.type !== "multiple" && q.correctAnswers.length !== 1)
      fail("This type requires exactly one correct answer.");
    if (q.type === "multiple" && q.correctAnswers.length < 2)
      fail("multiple requires at least two correct answers.");
    if (q.table !== undefined) {
      const t = q.table;
      if (!t || typeof t !== "object" || Array.isArray(t))
        fail("table must be an object with columns and rows.");
      if (t.caption !== undefined && !validText(t.caption))
        fail("table.caption must be a non-empty string when provided.");
      if (
        !Array.isArray(t.columns) ||
        !t.columns.length ||
        !t.columns.every(validText)
      )
        fail(
          "table.columns must be a non-empty array of column heading strings.",
        );
      if (!Array.isArray(t.rows) || !t.rows.length)
        fail("table.rows must contain at least one row.");
      t.rows.forEach((row: unknown, rowIndex: number) => {
        if (!Array.isArray(row) || row.length !== t.columns.length)
          fail(
            `table row ${rowIndex + 1} must have exactly ${t.columns.length} cells, matching the columns.`,
          );
        if (
          (row as unknown[]).some(
            (cell) =>
              typeof cell !== "string" &&
              !(typeof cell === "number" && Number.isFinite(cell)),
          )
        )
          fail(
            `table row ${rowIndex + 1} cells must be strings or finite numbers.`,
          );
      });
    }
    if (q.explanation !== undefined && typeof q.explanation !== "string")
      fail("explanation must be a string.");
  });
  // Keep only the public schema fields; arbitrary imported properties are discarded.
  return {
    schemaVersion: 1,
    title: data.title.trim(),
    questions: data.questions.map((q: Question) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      correctAnswers: [...q.correctAnswers],
      ...(q.table !== undefined
        ? {
            table: {
              ...(q.table.caption !== undefined
                ? { caption: q.table.caption }
                : {}),
              columns: [...q.table.columns],
              rows: q.table.rows.map((row) => [...row]),
            },
          }
        : {}),
      ...(q.explanation !== undefined ? { explanation: q.explanation } : {}),
    })),
  };
}
export function isCorrect(q: Question, selected: string[] = []) {
  return (
    selected.length === q.correctAnswers.length &&
    q.correctAnswers.every((a) => selected.includes(a))
  );
}
export function secondsLeft(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function formatTime(seconds: number) {
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .filter((_, i) => i > 0 || seconds >= 3600)
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
export const template: Exam = {
  schemaVersion: 1,
  title: "The Everyday Knowledge Challenge",
  questions: [
    {
      id: "q1",
      text: "Using the following table, which product has the highest price?",
      type: "single",
      table: {
        caption: "Product prices",
        columns: ["Product", "Price ($)"],
        rows: [
          ["Notebook", 15],
          ["Pen", 5],
          ["Backpack", 40],
        ],
      },
      options: [
        { id: "A", text: "Notebook" },
        { id: "B", text: "Pen" },
        { id: "C", text: "Backpack" },
        { id: "D", text: "All have the same price" },
      ],
      correctAnswers: ["C"],
      explanation:
        "The backpack costs $40, which is more than the notebook ($15) and the pen ($5).",
    },
    {
      id: "q2",
      text: "Which of the following numbers are prime? Select all correct answers.",
      type: "multiple",
      options: [
        { id: "A", text: "2" },
        { id: "B", text: "4" },
        { id: "C", text: "5" },
        { id: "D", text: "9" },
        { id: "E", text: "11" },
      ],
      correctAnswers: ["A", "C", "E"],
      explanation:
        "A prime number is greater than 1 and has exactly two positive divisors: 1 and itself.",
    },
    {
      id: "q3",
      text: "The Earth orbits the Sun.",
      type: "true_false",
      options: [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ],
      correctAnswers: ["true"],
      explanation:
        "The Earth completes one orbit around the Sun in approximately 365.25 days.",
    },
  ],
};
export const templateJSON = JSON.stringify(template, null, 2);
export const aiPrompt = `Create an exam about [TOPIC] with [NUMBER OF QUESTIONS] questions at [DIFFICULTY] level, written in [LANGUAGE, default English].
Return JSON only, with no commentary. Follow the template below using schemaVersion: 1. Replace the examples with real questions.
Each question needs a unique non-empty id, text, type, options, and correctAnswers. Each option needs a unique id within the question and non-empty text.
- single: exactly 4 options and 1 correct answer.
- multiple: exactly 5 options and 2 or more correct answers, with no duplicates.
- true_false: exactly 2 options with ids true and false, and 1 correct answer.
correctAnswers is an array of existing option ids. explanation is an optional string. Do not reveal the correct answer in the question or options.
For questions involving tabular data, add an optional table object to any question type:
{ "caption": "Descriptive title (optional)", "columns": ["Column 1", "Column 2"], "rows": [["Example item", 10], ["Another item", 20]] }
columns must contain at least one non-empty heading string. rows must contain at least one row. Every row must have exactly as many cells as columns. Cells must be strings or finite numbers; use an empty string for a blank cell. Do not use HTML or Markdown tables in text; use this structured table field. Omit table for questions that do not need one.
The question text appears above the table and the choices below it. Include the task in text. Keep table data factual without answer labels. The number of questions is flexible; duration is set separately in the app.

${templateJSON}`;
