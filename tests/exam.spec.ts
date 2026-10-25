import { test, expect } from "@playwright/test";
import { template, templateJSON } from "../src/exam";

test("import, answer all types, restore progress, grade and review", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(
    page.getByText("Add your questions first, or try the ready-made example."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(
    page.getByText("Ready! Validated 3 questions successfully."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(
    page.getByText("The backpack costs", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: /Backpack/ }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText([
    "Product",
    "Price ($)",
  ]);
  await page.getByRole("button", { name: "Flag for review" }).click();
  await page.reload();
  await expect(page.locator("input:checked")).toHaveCount(1);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator(".flag-button")).toHaveText("Flagged");
  await page.getByRole("button", { name: "Next question" }).click();
  for (const text of ["2", "5", "11"])
    await page
      .getByRole("checkbox", { name: new RegExp(`\\b${text}\\b`) })
      .click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByText("True", { exact: true }).click();
  await page.getByRole("button", { name: "Submit exam", exact: true }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.locator(".score-ring")).toHaveText("100%");
  await expect(page.locator(".status-pill.success")).toHaveCount(3);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Product prices");
  await expect(page.locator("body")).not.toContainText(/[\u0600-\u06ff]/);
  await page.reload();
  await expect(page.locator(".score-ring")).toHaveText("100%");
  await page.getByRole("button", { name: "Needs review (0)" }).click();
  await expect(
    page.getByText("Every answer is correct. Nicely done!"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("live deadline submits unanswered exam without refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByRole("button", { name: "Start exam" }).click();
  await page.evaluate(() => {
    const key = "exam-time-session-v1";
    const s = JSON.parse(localStorage.getItem(key)!);
    s.deadline = Date.now() + 1500;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(
    page.getByText("Time’s up · Submitted automatically"),
  ).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".score-ring")).toHaveText("0%");
  await expect(page.locator(".status-pill.incorrect")).toHaveCount(3);
});

test("mobile import file, invalid schema, guide, and exam fit the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const fits = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  await fits();
  await page.getByRole("button", { name: "Format guide" }).click();
  await fits();
  await page.getByRole("button", { name: "Add questions" }).click();
  await page.locator("#questions").fill('{"schemaVersion":1}');
  await expect(page.locator(".error")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "exam.json",
    mimeType: "application/json",
    buffer: Buffer.from(templateJSON),
  });
  await expect(page.locator(".valid")).toBeVisible();
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await fits();
});

test("tables on every type remain available in review, retake and results export", async ({
  page,
}) => {
  const exam = structuredClone(template);
  exam.questions.forEach((q) => {
    q.table = structuredClone(exam.questions[0].table!);
  });
  await page.goto("/");
  await page.locator("#questions").fill(JSON.stringify(exam));
  await expect(page.locator(".valid")).toBeVisible();
  await page.getByRole("button", { name: "Start exam" }).click();
  for (let i = 0; i < 3; i++) {
    await expect(page.getByRole("table")).toContainText("Product prices");
    if (i < 2)
      await page.getByRole("button", { name: "Next question" }).click();
  }
  await page.getByRole("button", { name: "Submit exam", exact: true }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByRole("table")).toHaveCount(3);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save results" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  const results = JSON.parse(text);
  expect(results.questions.map((q: { table: unknown }) => q.table)).toEqual(
    exam.questions.map((q) => q.table),
  );
  await page.getByRole("button", { name: "Retake this exam" }).click();
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(page.getByRole("table")).toContainText("Product prices");
});

test("wide tables scroll inside mobile cards and imported HTML stays text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const exam = structuredClone(template);
  const literal = '<img src=x onerror="window.tableInjected=true">';
  exam.questions[0].table = {
    caption: "Quarterly product report",
    columns: ["Product", "January", "February", "March", "April", "Notes"],
    rows: [
      [literal, 10, 20, 30, 40, "A very long note ".repeat(12)],
      ["Notebook", 1, 2, 3, 4, "Regular stock"],
    ],
  };
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.locator("#questions").fill(JSON.stringify(exam));
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(page.getByRole("table")).toContainText(literal);
  await expect(page.locator(".question-table img")).toHaveCount(0);
  const sizes = await page
    .locator(".question-table-scroll")
    .evaluate((el) => ({ scroll: el.scrollWidth, width: el.clientWidth }));
  expect(sizes.scroll).toBeGreaterThan(sizes.width);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".question-table-scroll").evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  expect(
    await page
      .locator(".question-table-scroll")
      .evaluate((el) => el.scrollLeft),
  ).toBeGreaterThan(0);
});

test("bad table row blocks start with an English error identifying its row", async ({
  page,
}) => {
  await page.goto("/");
  const exam = structuredClone(template);
  exam.questions[0].table!.rows[1].pop();
  await page.locator("#questions").fill(JSON.stringify(exam));
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(page.locator(".error")).toContainText(
    "Question 1: table row 2 must have exactly 2 cells",
  );
  await expect(page.getByRole("timer")).toHaveCount(0);
});
