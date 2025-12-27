#!/usr/bin/env node
/**
 * Debug test - more verbose extension loading
 */

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.resolve(__dirname, "..");

async function run() {
  console.log("=== Extension Debug Test ===");
  console.log("Extension path:", EXTENSION_PATH);

  // Check manifest exists
  const manifestPath = path.join(EXTENSION_PATH, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("ERROR: manifest.json not found!");
    process.exit(1);
  }
  console.log("Manifest exists: YES");

  // Check background.js
  const bgPath = path.join(EXTENSION_PATH, "background.js");
  if (!fs.existsSync(bgPath)) {
    console.error("ERROR: background.js not found!");
    process.exit(1);
  }
  console.log("background.js exists: YES");

  // Check icons
  const icons = ["icons/icon16.png", "icons/icon48.png", "icons/icon128.png"];
  icons.forEach(icon => {
    const exists = fs.existsSync(path.join(EXTENSION_PATH, icon));
    console.log(`${icon}: ${exists ? "YES" : "MISSING"}`);
  });

  console.log("\nLaunching Chrome with extension...");

  const args = [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--disable-background-networking",
    "--enable-logging=stderr",
    "--v=1",
  ];

  console.log("\nChrome args:", args.slice(0, 4).join(" "));

  try {
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: "/usr/bin/google-chrome",
      args: args,
      timeout: 60000,
      dumpio: true, // Log Chrome output
    });

    console.log("\n=== Chrome launched ===");

    // Wait and check targets multiple times
    for (let attempt = 1; attempt <= 30; attempt++) {
      await new Promise(r => setTimeout(r, 1000));

      const targets = await browser.targets();
      const extTargets = targets.filter(t =>
        t.url().startsWith("chrome-extension://")
      );

      console.log(`\nAttempt ${attempt}: ${targets.length} targets, ${extTargets.length} extension targets`);

      if (extTargets.length > 0) {
        console.log("\n=== Extension found! ===");
        extTargets.forEach(t => {
          console.log(`  [${t.type()}] ${t.url()}`);
        });

        // Get extension ID
        const swTarget = extTargets.find(t => t.type() === "service_worker");
        if (swTarget) {
          const extId = new URL(swTarget.url()).hostname;
          console.log(`\nExtension ID: ${extId}`);

          // Try to open popup
          const page = await browser.newPage();
          await page.goto(`chrome-extension://${extId}/popup.html`);
          await new Promise(r => setTimeout(r, 500));
          console.log("Popup opened successfully!");
        }

        await browser.close();
        console.log("\n=== TEST PASSED ===");
        return;
      }

      // Log all targets for debugging
      if (attempt === 5 || attempt === 15 || attempt === 30) {
        console.log("All targets:");
        targets.forEach(t => console.log(`  [${t.type()}] ${t.url()}`));
      }
    }

    console.log("\n=== EXTENSION NOT LOADED ===");
    const targets = await browser.targets();
    console.log("Final targets:");
    targets.forEach(t => console.log(`  [${t.type()}] ${t.url()}`));

    await browser.close();
    process.exit(1);

  } catch (e) {
    console.error("\nError:", e.message);
    process.exit(1);
  }
}

run();
