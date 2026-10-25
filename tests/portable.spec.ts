import { test, expect, type Page } from "@playwright/test";
import { copyFile, mkdtemp, rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { templateJSON } from "../src/exam";

let directory: string;
let portableURL: string;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "exam-time standalone "));
  const destination = join(directory, "index.html");
  // Only this single file is copied, with no assets, node_modules, or sources.
  await copyFile(resolve("index.html"), destination);
  portableURL = pathToFileURL(destination).href;
});
test.afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function openPortable(page: Page) {
  // The managed cloud Chromium blocks file:// by policy. Test the exact copied
  // artifact as an HTTP document, fulfilling only this one file locally. No
  // source files, asset server, or network responses are available to the app.
  const url = "http://portable.exam.test/index.html";
  await page.route("**/*", async (route) => {
    if (route.request().url() === url)
      await route.fulfill({
        contentType: "text/html",
        body: await readFile(join(directory, "index.html"), "utf8"),
      });
    else await route.abort();
  });
  await page.goto(url);
}

test("direct file URL loads the portable HTML when browser policy permits it", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  try {
    await page.goto(portableURL);
  } catch (error) {
    if (String(error).includes("ERR_BLOCKED_BY_ADMINISTRATOR"))
      test.skip(
        true,
        "Cloud Chromium administrator policy blocks file:// navigation. The exact artifact is tested separately offline.",
      );
    else throw error;
  }
  await expect(
    page.getByRole("heading", { name: /Your questions/ }),
  ).toBeVisible();
});

test("standalone HTML works offline with no assets or source files", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const network: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && request.resourceType() !== "document")
      network.push(request.url());
  });
  await context.setOffline(true);
  await openPortable(page);
  await expect(
    page.getByRole("heading", { name: /Your questions/ }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(page.getByRole("table")).toContainText("Product prices");
  await page.getByRole("radio", { name: /Backpack/ }).check();
  await page.reload();
  await expect(page.locator("input:checked")).toHaveCount(1);
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Next question" }).click();
  for (const i of [0, 2, 4]) await page.getByRole("checkbox").nth(i).check();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("radio", { name: /True$/ }).check();
  await page.getByRole("button", { name: "Submit exam", exact: true }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.locator(".score-ring")).toHaveText("100%");
  await expect(page.getByRole("table")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save results" }).click();
  expect((await download).suggestedFilename()).toBe("exam-results.json");
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});

test("local file imports and template downloads work on mobile offline", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPortable(page);
  await page.getByRole("button", { name: "Format guide" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download template" }).click();
  expect((await download).suggestedFilename()).toBe("exam-template.json");
  await page.getByRole("button", { name: "Add questions" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "exam.json",
    mimeType: "application/json",
    buffer: Buffer.from(templateJSON),
  });
  await expect(page.locator(".valid")).toBeVisible();
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("local browser clipboard restrictions still allow copying the full AI prompt", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await openPortable(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    document.execCommand = () => false;
  });
  await page.getByRole("button", { name: "Copy AI instructions" }).click();
  const dialog = page.getByRole("dialog", { name: "Your AI instructions" });
  await expect(dialog).toBeVisible();
  const text = page.getByRole("textbox", { name: "AI instructions to copy" });
  await expect(text).toContainText("Create an exam about [TOPIC]");
  await expect(text).toBeFocused();
  expect(
    await text.evaluate(
      (el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart,
    ),
  ).toBeGreaterThan(100);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
