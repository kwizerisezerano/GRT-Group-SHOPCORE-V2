import { chromium } from "playwright";

/**
 * Drives every main page as a real signed-in owner and reports what actually
 * breaks: failed API calls, page errors, and requests still going to Supabase.
 *
 * Written because "which modules work?" was being answered by reading code.
 * The first run said 0 of 21 routes were clean; most of it was one 400 and one
 * hook still pointing at Supabase, neither of which was visible from the source
 * alone.
 *
 *   cd frontend && node ../scripts/sweep-pages.mjs
 *
 * Needs the stack up (./scripts/dev-up.sh). Blocked external fonts are
 * filtered — see docs/LOCAL-DEV.md section 6.
 */

const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:4000/api";
const email = `sweep-${Date.now()}@shopcore.local`;
const password = "DemoPass123!";

const signup = await (await fetch(`${API}/auth/signup`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email, password, displayName: "Sweep Owner", businessName: "Sweep Shop",
    planCode: "starter", billingCycle: "monthly", language: "en",
  }),
})).json();
const auth = { "Content-Type": "application/json", Authorization: `Bearer ${signup.data.accessToken}` };

// A little data so pages have something to render.
const cat = await (await fetch(`${API}/categories`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Drinks" }) })).json();
await fetch(`${API}/products`, { method: "POST", headers: auth,
  body: JSON.stringify({ name: "Sweep Cola", selling_price: 1000, cost_price: 600, stock_quantity: 25, category_id: cat.data?.id }) });
await fetch(`${API}/customers`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Sweep Customer", phone: "0788111222" }) });
await fetch(`${API}/suppliers`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Sweep Supplier" }) });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

const findings = new Map();
const record = (route, kind, detail) => {
  const list = findings.get(route) ?? [];
  const key = `${kind}: ${detail}`;
  if (!list.includes(key)) list.push(key);
  findings.set(route, list);
};

let current = "(boot)";

page.on("response", (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith("/api/") && r.status() >= 400) {
    record(current, "API", `${r.request().method()} ${u.pathname} -> ${r.status()}`);
  }
});
page.on("requestfailed", (r) => {
  const url = r.url();
  if (url.includes("placeholder.invalid")) record(current, "SUPABASE", new URL(url).pathname.slice(0, 60));
  else if (url.includes("/api/")) record(current, "API", `failed ${new URL(url).pathname}`);
});
page.on("pageerror", (e) => record(current, "PAGEERROR", e.message.slice(0, 120)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("ERR_TUNNEL") || t.includes("ERR_CONNECTION_RESET") || t.includes("fonts.googleapis")) return; // blocked external fonts: sandbox egress, documented in LOCAL-DEV section 6
  if (t.includes("placeholder.invalid")) { record(current, "SUPABASE", "console"); return; }
  record(current, "CONSOLE", t.slice(0, 120));
});

await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("/auth"), { timeout: 30000 });

const ROUTES = [
  "/dashboard", "/pos", "/sales", "/products", "/categories", "/brands", "/units",
  "/inventory", "/stock-movements", "/stock-adjustments", "/purchases", "/suppliers",
  "/customers", "/expenses", "/reports", "/user-management", "/staff", "/settings",
  "/activity-logs", "/branches", "/profile",
];

for (const route of ROUTES) {
  current = route;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1800);
    const landed = new URL(page.url()).pathname;
    if (landed !== route) record(route, "REDIRECT", `-> ${landed}`);
  } catch (e) {
    record(route, "NAV", String(e.message).slice(0, 90));
  }
}

await browser.close();

console.log(`\n${"=".repeat(70)}`);
let clean = 0;
for (const route of ROUTES) {
  const list = findings.get(route);
  if (!list || list.length === 0) { clean++; console.log(`  OK    ${route}`); continue; }
  console.log(`  ISSUE ${route}`);
  for (const item of list.slice(0, 5)) console.log(`          ${item}`);
}
console.log("=".repeat(70));
console.log(`${clean}/${ROUTES.length} routes clean`);
