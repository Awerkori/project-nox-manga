
import { chromium } from "@playwright/test";
import { ownerCookies } from "../scripts/owner-session.mjs";
import path from "path";
process.loadEnvFile(".env");

const DIR = "/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/global_mentions_homolog";
const PROD_URL = "https://manga.project-nox-awerkori.workers.dev";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const awerkoriCookies = await ownerCookies(PROD_URL);
  const ageCookies = [
    { name: "nox-age-status", value: "ADULT", url: PROD_URL },
    { name: "nox-blur-nsfw", value: "false", url: PROD_URL }
  ];

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([...awerkoriCookies, ...ageCookies]);
  const page = await ctx.newPage();

  await page.goto(`${PROD_URL}/me?tab=notifications`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(DIR, "06_notifications_center_me.png") });
  console.log("Screenshot 06_notifications_center_me.png saved.");
  await browser.close();
}
main();
