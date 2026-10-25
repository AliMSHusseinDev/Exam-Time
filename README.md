# Exam Time

A personal exam simulator with an English interface. Import questions as JSON, set a duration, take the exam, and review your score and explanations afterward. The responsive layout supports desktop and mobile, including wide data tables inside questions.

## Development

Requires Node.js 20.19+ (or 22.12+ for Node 22; tested on Node 24) and npm.

```sh
npm ci --cache /tmp/exam-time-npm
npm run dev
```

```sh
npm run build
npm run preview
npm test
```

Browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

With an existing system Chromium installation:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

## Your first exam

1. Copy the AI instructions in the app and fill in your topic, question count, difficulty, and preferred content language. Or use **Try an example**, which includes all three question types and a table.
2. Paste the returned JSON or import a file. Fix any validation errors before starting.
3. Set a whole-number duration between 1 and 1440 minutes and select **Start exam**.
4. Navigate between questions, flag questions for review, and edit your choices before submitting.
5. The exam submits automatically when time runs out. You can also submit early after confirmation. Correct answers and explanations appear only after submission.
6. Review mistakes, save results as JSON, or retake the exam.

Question count is automatic and flexible. No exam begins without imported questions. Every question is worth one point; multiple-answer questions require every correct answer and no incorrect options, with no partial credit.

## Import format

See `src/exam.ts` for the example and AI prompt, and `public/exam.schema.json` for the standard JSON Schema (Draft 2020-12).

- `schemaVersion`: `1`. Existing version-1 files without tables continue to work.
- `title`: a non-empty exam title.
- `questions`: a non-empty array. Each question requires a unique `id`, `text`, `type`, `options`, and `correctAnswers`. `explanation` and `table` are optional.
- `single`: exactly 4 options and 1 correct answer.
- `multiple`: exactly 5 options and at least 2 correct answers.
- `true_false`: exactly 2 options, with ids `true` and `false`, and 1 correct answer.
- Each option needs an `id` unique within its question and non-empty `text`. `correctAnswers` references existing option ids without duplicates.

The app also checks cross-field constraints that standard JSON Schema cannot express by itself: unique question/option ids, answer references, and matching table row lengths.

### Optional tables

Add `table` to any question type. The app renders the question text first, then the table, then the choices. Tables remain visible in result review and are preserved when restoring progress, exporting results, or retaking an exam.

```json
{
  "schemaVersion": 1,
  "title": "Product comparison",
  "questions": [
    {
      "id": "q1",
      "text": "Using the following table, which product has the highest price?",
      "type": "single",
      "table": {
        "caption": "Product prices",
        "columns": ["Product", "Price ($)"],
        "rows": [
          ["Notebook", 15],
          ["Pen", 5],
          ["Backpack", 40]
        ]
      },
      "options": [
        { "id": "A", "text": "Notebook" },
        { "id": "B", "text": "Pen" },
        { "id": "C", "text": "Backpack" },
        { "id": "D", "text": "All have the same price" }
      ],
      "correctAnswers": ["C"],
      "explanation": "The backpack costs $40, the highest price in the table."
    }
  ]
}
```

- `caption`: optional non-empty text.
- `columns`: at least one non-empty heading string.
- `rows`: at least one row. Every row must have exactly as many cells as there are columns.
- Cells accept strings or finite numbers, including zero and decimals. Use `""` for a blank cell. Objects, arrays, booleans, and null cells are rejected.
- Table content is rendered as plain text, not HTML or Markdown. Wide tables scroll horizontally inside the question card and are keyboard focusable.

The interface, validation messages, AI instructions, and built-in examples are English. Imported question content is displayed as supplied, including existing Arabic content.

## Saved progress and privacy

The current attempt, including questions and answers, is saved in this browser's localStorage. Refreshing does not reset the timer: the absolute deadline keeps advancing even when the tab is closed. Returning after the deadline automatically finishes the exam. If browser storage is unavailable, a visible warning asks you to remain on the page. Starting a fresh exam removes the previous attempt; download results first to keep a copy.

This is a personal practice tool, not a proctored or secure assessment platform. Answers are hidden in the exam interface, but remain in the imported data and browser storage. No accounts, backend services, database, or API keys are required. The optional Inter font is loaded from Google Fonts, with a system fallback.

## Validation

Built with React, TypeScript, Vite, and Lucide icons. Unit tests cover schema validation, table validation, backward compatibility, grading, and timer calculations. Playwright tests exercise imports, all answer types, refresh persistence, real timer expiry, review, table export and retake, mobile overflow, and safe text rendering.
