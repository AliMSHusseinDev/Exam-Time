import { describe, expect, it } from "vitest";
import {
  parseExam,
  template,
  templateJSON,
  isCorrect,
  secondsLeft,
  formatTime,
} from "./exam";
describe("exam schema", () => {
  it("accepts all three types and AI markdown fences", () => {
    expect(
      parseExam("```json\n" + templateJSON + "\n```").questions,
    ).toHaveLength(3);
  });
  it.each(["single", "multiple", "true_false"])(
    "rejects wrong option counts for %s",
    (type) => {
      const e = structuredClone(template);
      const q = e.questions.find((q) => q.type === type)!;
      q.options.pop();
      expect(() => parseExam(JSON.stringify(e))).toThrow("options");
    },
  );
  it("rejects malformed JSON and empty exams", () => {
    expect(() => parseExam("{")).toThrow("JSON");
    expect(() =>
      parseExam('{"schemaVersion":1,"title":"x","questions":[]}'),
    ).toThrow();
  });
  it("rejects duplicate question ids", () => {
    const e = structuredClone(template);
    e.questions[1].id = e.questions[0].id;
    expect(() => parseExam(JSON.stringify(e))).toThrow("duplicated");
  });
  it("rejects absent, invalid and duplicated answer ids", () => {
    for (const answer of [[], ["Z"], ["B", "B"]]) {
      const e = structuredClone(template);
      e.questions[0].correctAnswers = answer;
      expect(() => parseExam(JSON.stringify(e))).toThrow();
    }
  });
  it("enforces multiple-answer and true/false rules", () => {
    const e = structuredClone(template);
    e.questions[1].correctAnswers = ["A"];
    expect(() => parseExam(JSON.stringify(e))).toThrow("at least two");
    e.questions[1].correctAnswers = ["A", "C"];
    e.questions[2].options[0].id = "A";
    expect(() => parseExam(JSON.stringify(e))).toThrow("true");
  });
  it("rejects reserved object keys as ids", () => {
    const e = structuredClone(template);
    e.questions[0].id = "__proto__";
    expect(() => parseExam(JSON.stringify(e))).toThrow("reserved");
  });
  it("allows arbitrary numbers of questions", () => {
    const e = structuredClone(template);
    e.questions = [e.questions[0]];
    expect(parseExam(JSON.stringify(e)).questions).toHaveLength(1);
  });
});
describe("grading and timer", () => {
  it("grades multiple choice by exact set independent of order", () => {
    const q = template.questions[1];
    expect(isCorrect(q, ["E", "A", "C"])).toBe(true);
    expect(isCorrect(q, ["A"])).toBe(false);
    expect(isCorrect(q, ["A", "C", "E", "B"])).toBe(false);
    expect(isCorrect(q)).toBe(false);
  });
  it("grades single and true/false answers", () => {
    expect(isCorrect(template.questions[0], ["C"])).toBe(true);
    expect(isCorrect(template.questions[2], ["false"])).toBe(false);
    expect(isCorrect(template.questions[2], ["true"])).toBe(true);
  });
  it("uses an absolute deadline, clamps at zero, and rounds up", () => {
    expect(secondsLeft(60000, 1000)).toBe(59);
    expect(secondsLeft(60000, 59001)).toBe(1);
    expect(secondsLeft(60000, 60001)).toBe(0);
  });
  it("formats durations including hours", () => {
    expect(formatTime(90)).toBe("01:30");
    expect(formatTime(3600)).toBe("01:00:00");
    expect(formatTime(0)).toBe("00:00");
  });
});

describe("optional question tables", () => {
  it("preserves numeric and text cells, blank cells, zero and negative values", () => {
    const exam = structuredClone(template);
    exam.questions[0].table = {
      columns: ["Name", "Value"],
      rows: [
        ["Zero", 0],
        ["Negative", -2.5],
        ["", "N/A"],
      ],
    };
    const result = parseExam(JSON.stringify(exam));
    expect(result.questions[0].table).toEqual(exam.questions[0].table);
  });
  it.each(["single", "multiple", "true_false"])(
    "accepts a table with %s",
    (type) => {
      const exam = structuredClone(template);
      const question = exam.questions.find((q) => q.type === type)!;
      question.table = structuredClone(template.questions[0].table!);
      expect(
        parseExam(JSON.stringify(exam)).questions.find((q) => q.type === type)
          ?.table,
      ).toEqual(question.table);
    },
  );
  it("retains backward compatibility with files without tables", () => {
    const exam = structuredClone(template);
    exam.questions.forEach((q) => delete q.table);
    expect(parseExam(JSON.stringify(exam))).toEqual(exam);
  });
  it.each([
    null,
    [],
    "not a table",
    {},
    { columns: [], rows: [["x"]] },
    { columns: [" "], rows: [["x"]] },
    { columns: [4], rows: [["x"]] },
    { columns: ["A"], rows: [] },
    { columns: ["A"], rows: "x" },
    { columns: ["A"], rows: [null] },
    { columns: ["A"], rows: [["x", "y"]] },
    { columns: ["A", "B"], rows: [["x"]] },
    { columns: ["A"], rows: [[null]] },
    { columns: ["A"], rows: [[true]] },
    { columns: ["A"], rows: [[{}]] },
    { columns: ["A"], rows: [[[]]] },
    { columns: ["A"], rows: [[1]], caption: " " },
    { columns: ["A"], rows: [[1]], caption: 3 },
  ])("rejects invalid table data: %j", (table) => {
    const exam = JSON.parse(templateJSON);
    exam.questions[0].table = table;
    expect(() => parseExam(JSON.stringify(exam))).toThrow(/Question 1: table/);
  });
  it("rejects overflowing numeric values", () => {
    const raw = templateJSON.replace("15", "1e400");
    expect(() => parseExam(raw)).toThrow("finite numbers");
  });
  it("reports the specific row with the wrong cell count", () => {
    const exam = structuredClone(template);
    exam.questions[0].table!.rows[1].pop();
    expect(() => parseExam(JSON.stringify(exam))).toThrow(
      "Question 1: table row 2 must have exactly 2 cells",
    );
  });
  it("copies table fields without retaining unsupported imported properties", () => {
    const exam = JSON.parse(templateJSON);
    exam.questions[0].table.html = "<script>alert(1)</script>";
    expect(
      parseExam(JSON.stringify(exam)).questions[0].table,
    ).not.toHaveProperty("html");
  });
});
