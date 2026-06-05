const { chromium } = require("playwright");

const targetUrl = process.env.SMOKE_URL || "http://127.0.0.1:5173/";
const screenshotPath = process.env.SMOKE_SCREENSHOT || "screenshots/iteration-0-smoke.png";

async function runSmokeTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator(".app").waitFor({ timeout: 20000 });
  const title = await page.title();
  const rootText = await page.locator("#root").innerText({ timeout: 10000 });
  const apiHealth = await page.evaluate(async () => {
    const response = await fetch("/api/health");
    return response.json();
  });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  const result = {
    targetUrl,
    title,
    hasRootText: rootText.trim().length > 0,
    apiOk: apiHealth.ok === true,
    apiStorage: apiHealth.storage,
    rootPreview: rootText.slice(0, 220),
    consoleMessages,
    pageErrors,
    screenshotPath,
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    !result.hasRootText ||
    !result.apiOk ||
    pageErrors.length > 0 ||
    consoleMessages.some((line) => line.startsWith("error:"))
  ) {
    process.exitCode = 1;
  }
}

runSmokeTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
