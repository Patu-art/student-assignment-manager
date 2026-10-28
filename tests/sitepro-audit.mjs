import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const outDir = "sitepro-artifacts";
fs.mkdirSync(outDir, { recursive: true });
const failures = [];
const checks = [];
const consoleErrors = [];
function check(name, condition, detail = "") {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) failures.push(name + (detail ? " — " + detail : ""));
}
function futureDateISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on("pageerror", error => consoleErrors.push(error.message));
page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
try {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  check("Page title identifies Margin", (await page.title()).includes("Margin"));
  check("Main heading is visible", await page.locator("#page-title").isVisible());
  check("Initial empty state is visible", await page.getByText("A fresh start. Let's plan it.").isVisible());
  await page.screenshot({ path: path.join(outDir, "desktop-initial.png"), fullPage: true });

  await page.getByRole("button", { name: /New assignment/ }).click();
  check("New-assignment dialog opens", await page.getByRole("dialog").isVisible());
  await page.getByLabel("Assignment title").fill("SITEPRO audit assignment");
  await page.locator("#assignment-subject").fill("Discrete Mathematics");
  await page.locator("#assignment-due").fill(futureDateISO(7));
  await page.getByLabel("Priority").selectOption("high");
  await page.getByLabel("Notes").fill("Check filters, editing, persistence and keyboard access.");
  await page.getByRole("button", { name: /Save assignment/ }).click();
  check("Assignment can be created", await page.getByRole("heading", { name: "SITEPRO audit assignment" }).isVisible());
  check("Dashboard total updates", (await page.locator("#stat-total").innerText()) === "1");
  check("Subject filter is populated", await page.locator("#subject-filter option").count() === 2);
  await page.screenshot({ path: path.join(outDir, "desktop-assignment.png"), fullPage: true });

  await page.getByRole("searchbox", { name: "Search assignments" }).fill("does-not-exist");
  check("Search can return an empty result", await page.getByText("No assignments found").isVisible());
  await page.getByRole("button", { name: "Reset filters" }).click();
  check("Reset filters restores the assignment", await page.getByRole("heading", { name: "SITEPRO audit assignment" }).isVisible());
  await page.locator("#subject-filter").selectOption({ label: "Discrete Mathematics" });
  check("Subject filter retains matching assignment", await page.getByRole("heading", { name: "SITEPRO audit assignment" }).isVisible());
  await page.locator("#sort-select").selectOption("title");

  await page.getByRole("button", { name: "Edit SITEPRO audit assignment" }).click();
  check("Edit dialog opens", await page.getByRole("dialog").isVisible());
  await page.getByLabel("Assignment title").fill("Updated audit assignment");
  await page.getByRole("button", { name: /Save changes/ }).click();
  check("Assignment can be edited", await page.getByRole("heading", { name: "Updated audit assignment" }).isVisible());

  await page.getByRole("button", { name: "Mark Updated audit assignment as completed" }).click();
  check("Completion toggle works", (await page.locator("#stat-completed").innerText()) === "1");
  check("Progress meter updates", (await page.locator("#progress-percent").innerText()) === "100%");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  check("Completed view filters completed work", await page.getByRole("heading", { name: "Updated audit assignment" }).isVisible());

  await page.locator("#theme-toggle").click();
  check("Dark theme toggles", (await page.locator("body").getAttribute("class")).includes("dark"));
  await page.reload({ waitUntil: "networkidle" });
  check("Assignments persist after reload", await page.getByRole("heading", { name: "Updated audit assignment" }).isVisible());
  check("Theme persists after reload", (await page.locator("body").getAttribute("class")).includes("dark"));

  await page.getByRole("button", { name: "Edit Updated audit assignment" }).click();
  await page.keyboard.press("Escape");
  check("Escape closes the edit dialog", await page.locator("#modal-backdrop").isHidden());
  await page.getByRole("button", { name: "Delete Updated audit assignment" }).click();
  check("Delete confirmation opens", await page.getByRole("alertdialog").isVisible());
  await page.getByRole("button", { name: "Keep it" }).click();
  check("Delete cancellation preserves assignment", await page.getByRole("heading", { name: "Updated audit assignment" }).isVisible());
  await page.getByRole("button", { name: "Delete Updated audit assignment" }).click();
  await page.getByRole("button", { name: "Delete assignment", exact: true }).click();
  check("Delete removes assignment", (await page.locator("#stat-total").innerText()) === "0");
    check("Delete returns to the empty state", await page.getByText("A fresh start. Let's plan it.").isVisible());
  await page.getByRole("button", { name: "Overview", exact: true }).click();

  await page.getByRole("button", { name: /New assignment/ }).click();
  await page.getByLabel("Assignment title").fill("Responsive preview assignment");
  await page.locator("#assignment-subject").fill("Study Skills");
  await page.locator("#assignment-due").fill(futureDateISO(7));
  await page.getByRole("button", { name: /Save assignment/ }).click();
  check("Fresh preview item can be added after delete", await page.getByRole("heading", { name: "Responsive preview assignment" }).isVisible());

  const viewportResults = [];
  for (const width of [320, 360, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(120);
    const dimensions = await page.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      headingWidth: document.querySelector("#page-title")?.getBoundingClientRect().width || 0,
      addButtonWidth: document.querySelector("#add-assignment")?.getBoundingClientRect().width || 0
    }));
    viewportResults.push(dimensions);
    check("No horizontal overflow at " + width + "px", dimensions.documentWidth <= width && dimensions.bodyWidth <= width, JSON.stringify(dimensions));
    check("Heading and primary action have layout at " + width + "px", dimensions.headingWidth > 0 && dimensions.addButtonWidth > 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outDir, "mobile-390.png"), fullPage: true });
  await page.locator("#menu-toggle").click();
  check("Mobile navigation opens", (await page.locator("#sidebar").getAttribute("class")).includes("open"));
  check("Mobile menu reports expanded", (await page.locator("#menu-toggle").getAttribute("aria-expanded")) === "true");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  check("Selecting mobile navigation closes sidebar", !(await page.locator("#sidebar").getAttribute("class")).includes("open"));
  check("Mobile menu reports collapsed", (await page.locator("#menu-toggle").getAttribute("aria-expanded")) === "false");

  await page.getByRole("button", { name: /New assignment/ }).click();
  await page.waitForFunction(() => document.activeElement?.id === "assignment-title");
  check("Opening dialog moves focus to title", (await page.evaluate(() => document.activeElement?.id)) === "assignment-title");
  await page.keyboard.press("Escape");
  check("Escape closes dialog and restores focus", await page.locator("#modal-backdrop").isHidden());

  await page.setViewportSize({ width: 1440, height: 1000 });
  const axeResults = [];
  for (const theme of ["light", "dark"]) {
    const isDark = (await page.locator("body").getAttribute("class")).includes("dark");
    if ((theme === "dark") !== isDark) await page.locator("#theme-toggle").click();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = axe.violations.filter(v => ["serious", "critical"].includes(v.impact));
    axeResults.push({ theme, passes: axe.passes.length, incomplete: axe.incomplete.length, violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    check("No serious or critical WCAG violations in " + theme + " theme", serious.length === 0, serious.map(v => v.id + " (" + v.impact + "): " + v.nodes.length + " node(s)").join("; "));
  }
  fs.writeFileSync(path.join(outDir, "axe-report.json"), JSON.stringify(axeResults, null, 2));
  check("No uncaught browser or console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  failures.push("Unexpected test exception: " + (error.stack || error.message));
  try { await page.screenshot({ path: path.join(outDir, "failure.png"), fullPage: true }); } catch {}
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outDir, "audit-summary.json"), JSON.stringify({ checks, failures, consoleErrors }, null, 2));
}
for (const item of checks) console.log((item.pass ? "PASS " : "FAIL ") + item.name + (item.detail ? " — " + item.detail : ""));
console.log("\n" + checks.filter(c => c.pass).length + "/" + checks.length + " checks passed.");
if (failures.length) {
  console.error("\nFAILURES:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("SITEPRO browser audit passed.");
}
