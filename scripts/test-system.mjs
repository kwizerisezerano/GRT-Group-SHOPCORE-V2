import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Drives the whole platform in a real browser and reports what actually works.
 *
 *   node scripts/test-system.mjs
 *
 * Needs the stack up: backend on :4000, frontend on :5173.
 *
 * ## Why this exists
 *
 * Every serious defect in this feature was invisible from the source and
 * obvious the moment a browser touched it: a signature pad that was dark on
 * dark, `bg-white` silently overridden by a legacy theme rule, a download
 * cancelled by its own cleanup, a JSX comment that 500'd a route. Reading the
 * code found none of them.
 *
 * So the checks here assert on measured facts — a computed background colour,
 * the count of inked pixels, the bytes of a PDF, the row occupancy of a grid —
 * rather than on whether an element exists.
 *
 * ## Why bank transfer
 *
 * The one payment method that never reaches the gateway. This can run as often
 * as you like without charging a real account.
 */

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = require("playwright-core");

const BASE = process.env.SHOPCORE_WEB ?? "http://127.0.0.1:5173";
const API = process.env.SHOPCORE_API ?? "http://127.0.0.1:4000/api";
/*
 * `new URL(...).pathname` keeps the percent-encoding, and "GRT%20GROUP" is not
 * a directory that exists. spawnSync then fails with a bewildering ENOENT on
 * cmd.exe rather than on the path it could not find.
 */
const BACKEND_DIR = fileURLToPath(new URL("../backend/", import.meta.url));

const ADMIN_EMAIL = process.env.SHOPCORE_ADMIN_EMAIL ?? "yumvagusengapatrick14@gmail.com";
const ADMIN_PASSWORD = process.env.SHOPCORE_ADMIN_PASSWORD ?? "Admin@2026";

/* A recognisable 100x50 signature-shaped PNG, for the upload path. */
const UPLOAD_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAA8CAIAAAAiz+n/AAABvUlEQVR4nO2aXU7DMBAGfQQkbsD97wgPlaLKcvyX3dl1+UZ5I11PRqUlDuVXIJRogf+CQkMoNIRCQyg0hEJDKDSEQkMoNIRCQyg0hEJDKDREZOiv75/XEegwyXPVmNCXd3WEyPSx8gwIfVc5W+u+56oqHXpon6T1jOeSKhp60j689bznvCoXeuiXpPWMRt7Q82bhrScFVj2J0KtOgaGXVJdORkO7vuQ5G79M8y9xD72dDG69/ZGVIvSTWPCHtYlq55y8ock39fOFhhMcQ5tkAloznl6hDQN5t7aa359TnC7glNC2wzvTXEKbp/FrbT62F9pjJfMofjOZyy+nvPtO8bybbBz6uM9Tk1HNyXVo7GvXhCO+YJvzi+HCH/M3rwnVKmahT7mLw+7s26GBm31DTlF9X6vc/WBj3MfstBlyrdgO7bEha8vGorGe9V7HUrioytXqSyfzqu3Qfg/NzHkXyK/a3r0bXsP8RbpyiuftNmnl1z9w503VWM/b/egj7F8c4TnY+E9uf5Hfc/yEJa16RebKC4+ysnl3yKmq//iHUGgIhYZQaAiFhlBoCIWGUGgIhYZQaAiFhlBoCIWG+AMH5WnTeGeaBAAAAABJRU5ErkJggg==";

const results = [];
let failures = 0;

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  if (!passed) failures += 1;
  console.log(`${passed ? "  ok  " : "  FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function section(title) {
  console.log(`\n${title}`);
}

/** A verified session: log in, spend the emailed code, hand back the tokens. */
async function session(email, password, signupBody) {
  const start = signupBody
    ? await post("/auth/signup", signupBody)
    : await post("/auth/login", { email, password });

  if (!start.data?.accessToken) throw new Error(`sign-in failed: ${JSON.stringify(start)}`);

  const printed = execFileSync("npx", ["tsx", "scripts/admin_signin_code.ts", email], {
    cwd: BACKEND_DIR,
    encoding: "utf8",
    shell: true,
  });

  const code = printed.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no sign-in code printed for ${email}`);

  const verified = await post("/auth/otp/verify", { code }, start.data.accessToken);

  /*
   * The verify response does not always carry a fresh pair; the token minted at
   * sign-in becomes usable once the code is spent. Falling back to it is what
   * makes this work for both shapes.
   */
  return {
    accessToken: verified.data?.accessToken ?? start.data.accessToken,
    refreshToken: verified.data?.refreshToken ?? start.data.refreshToken ?? null,
  };
}

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  return { status: res.status, ...(await res.json()) };
}

/** Widest row of children in any grid on the page. */
const widestRows = () => {
  const out = [];

  for (const grid of document.querySelectorAll("div.grid, section.grid")) {
    const kids = [...grid.children].filter((c) => c.getBoundingClientRect().width > 0);
    if (kids.length < 2) continue;

    const tops = new Map();
    for (const kid of kids) {
      const top = Math.round(kid.getBoundingClientRect().top);
      tops.set(top, (tops.get(top) ?? 0) + 1);
    }

    const widest = Math.max(...tops.values());
    if (widest > 4) out.push(`${widest}-up: ${grid.className.slice(0, 60)}`);
  }

  return out;
};

const stamp = Date.now();
const customerEmail = `sys-${stamp}@example.test`;
const customerPhone = `07${String(stamp).slice(-8)}`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const context = await browser.newContext({
  viewport: { width: 1500, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();

/* Anything the app shouts about, collected per route. */
let route = "(boot)";
const noise = new Map();
const complain = (kind, detail) => {
  const list = noise.get(route) ?? [];
  const line = `${kind}: ${detail}`;
  if (!list.includes(line)) list.push(line);
  noise.set(route, list);
};

/** Every file the browser saved, in order, from the first page load. */
const downloads = [];
page.on("download", (d) => downloads.push(d));

page.on("pageerror", (e) => complain("PAGEERROR", String(e).slice(0, 140)));
page.on("console", (m) => {
  if (m.type() === "error") complain("CONSOLE", m.text().slice(0, 140));
});
page.on("response", (r) => {
  const url = new URL(r.url());
  if (url.pathname.startsWith("/api/") && r.status() >= 400) {
    complain("API", `${r.request().method()} ${url.pathname} -> ${r.status()}`);
  }
});

const goto = async (path) => {
  route = path;
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(700);
};

try {
  // ==================================================================== 1 ===
  section("1. Public pages");

  for (const path of ["/", "/pricing", "/signup", "/auth"]) {
    await goto(path);

    // Not every public page leads with an <h1>; what matters is that something
    // rendered rather than a blank error page.
    const text = (await page.textContent("body").catch(() => "")) ?? "";
    const heading =
      (await page.textContent("h1").catch(() => null)) ??
      (await page.textContent("h2").catch(() => null));

    check(`${path} renders`, text.trim().length > 200, (heading ?? text).trim().slice(0, 48));
  }

  // ==================================================================== 2 ===
  /*
   * Done first, and through the console rather than by seeding the database,
   * because it is the path an operator actually takes — and because everything
   * after it inherits the result: a customer signing later gets a contract
   * countersigned by ShopCore only if this worked.
   */
  section("2. Super admin puts ShopCore's signature on the live template");

  const admin = await session(ADMIN_EMAIL, ADMIN_PASSWORD);
  await goto("/");
  await page.evaluate((t) => localStorage.setItem("shopcore_auth_tokens", JSON.stringify(t)), admin);

  await goto("/platform-admin/contract-templates");

  /*
   * A locator, not `page.click`. The console's rows animate in on a stagger,
   * and a bare click waits for the element to stop moving — which it does, but
   * only after the default timeout has already elapsed.
   */
  await page.locator("button:has-text('Edit')").first().click({ timeout: 15000 });
  await page.waitForTimeout(900);

  const slots = await page.$$("[role=dialog] input[type=file]");
  check("the editor offers signature and stamp uploads", slots.length >= 2, `${slots.length} slots`);

  for (const slot of slots.slice(0, 2)) {
    await slot.setInputFiles({
      name: "mark.png",
      mimeType: "image/png",
      buffer: Buffer.from(UPLOAD_PNG.split(",")[1], "base64"),
    });
    await page.waitForTimeout(400);
  }

  await page.fill("#provider-name", "Patrick Yumvagusenga");
  await page.fill("#provider-title", "Director, ShopCore");
  await page.locator("[role=dialog] button:has-text('Save changes')").click({ timeout: 15000 });
  await page.waitForTimeout(2500);

  const countersigned = await page.$("text=Countersigned");
  check("the template is marked countersigned afterwards", Boolean(countersigned));

  // ==================================================================== 3 ===
  section("3. Signing up, with a TIN");

  await page.evaluate(() => localStorage.removeItem("shopcore_auth_tokens"));
  await goto("/signup");
  await page.fill("#signup-name", "Jean Uwimana");
  await page.fill("#signup-email", customerEmail);
  await page.fill("#signup-password", "DemoPass123!");
  await page.click("button:has-text('Continue')");
  await page.waitForTimeout(800);

  const tinField = await page.$("#signup-tin");
  check("TIN field is on the business step", Boolean(tinField));

  const stepLabel = (await page.textContent("body")).match(/Step \d of \d/i)?.[0] ?? "";
  check("signup shows a 5-step flow", stepLabel.endsWith("of 5"), stepLabel);

  /*
   * The account is created over the API from here. Driving the OTP screen in
   * the browser would test the mail provider, not this system, and the code has
   * to be read out of the database either way.
   */
  const tokens = await session(customerEmail, "DemoPass123!", {
    email: customerEmail,
    password: "DemoPass123!",
    displayName: "Jean Uwimana",
    businessName: "Kigali Fresh Market",
    businessPhone: customerPhone,
    businessLocation: "Kigali, Nyarugenge",
    language: "en",
  });
  check("account created and verification code accepted", Boolean(tokens.accessToken));

  await goto("/");
  await page.evaluate(
    ({ tokens, business }) => {
      localStorage.setItem("shopcore_auth_tokens", JSON.stringify(tokens));
      sessionStorage.setItem("shopcore_onboarding_business", JSON.stringify(business));
    },
    {
      tokens,
      business: {
        businessName: "Kigali Fresh Market",
        businessPhone: customerPhone,
        businessLocation: "Kigali, Nyarugenge",
        businessType: "retail",
        teamSize: "2-5",
        tinNumber: "102938475",
      },
    },
  );

  // ==================================================================== 4 ===
  section("4. Choosing a plan");

  await goto("/onboarding/plan");
  await page.click("text=Starter").catch(() => {});
  await page.waitForTimeout(400);

  const cta = await page
    .textContent("button:has-text('Review contract')")
    .catch(() => "(not found)");
  check("plan button says it leads to the contract", cta.includes("Review contract"), cta.trim());

  await page.click("button:has-text('Review contract')");
  await page.waitForTimeout(2500);
  route = "/onboarding/contract";

  check(
    "continuing lands on the contract step",
    new URL(page.url()).pathname === "/onboarding/contract",
    new URL(page.url()).pathname,
  );

  // ==================================================================== 5 ===
  section("5. The agreement");

  const body = await page.textContent("article").catch(() => "");
  check("contract is rendered", body.length > 400, `${body.length} chars`);

  // Set as a document rather than dumped as text: clause headings are their own
  // elements, which is the difference between a contract and a wall of type.
  const clauseHeadings = await page.locator("article h3").count();
  check("clauses are set as headings", clauseHeadings >= 2, `${clauseHeadings} headings`);
  check("the TIN is filled in", body.includes("102938475"));
  check(
    "no placeholder is left unfilled",
    (body.match(/\{\{[^}]+\}\}/g) ?? []).length === 0,
    (body.match(/\{\{[^}]+\}\}/g) ?? []).join(","),
  );

  const payDisabled = await page.isDisabled("button:has-text('Continue to payment')");
  check("payment is blocked before signing", payDisabled);

  // ---- the upload path -----------------------------------------------------
  await page.click("button:has-text('Upload')");
  await page.waitForTimeout(300);
  await page.setInputFiles(
    "input[type=file][accept='image/png,image/jpeg']",
    {
      name: "signature.png",
      mimeType: "image/png",
      buffer: Buffer.from(UPLOAD_PNG.split(",")[1], "base64"),
    },
  );
  await page.waitForTimeout(700);
  const uploadedShown = await page.$eval("img[alt='Your signature']", (el) => el.naturalWidth > 0)
    .catch(() => false);
  check("an uploaded signature is accepted and shown", uploadedShown);

  // ---- the drawn path ------------------------------------------------------
  await page.click("button:has-text('Draw')");
  await page.waitForTimeout(400);
  await page.click("input[type=checkbox]");

  const pad = await page.$("canvas");
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 14; i += 1) {
    await page.mouse.move(box.x + 40 + i * 15, box.y + box.height / 2 + Math.sin(i / 1.6) * 24);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

/** Inked pixels on the pad, and the paper colour behind it. */
  const readPad = () =>
    page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let inked = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) inked += 1;
      // The paper is the wrapper, so the canvas itself stays transparent and
      // the ruled signature line shows through beneath the ink.
      return { background: getComputedStyle(canvas.parentElement).backgroundColor, inked };
    });

  const padState = await readPad();

  check("the pad is actually white", padState.background === "rgb(255, 255, 255)", padState.background);
  check("the drawn signature leaves ink", padState.inked > 100, `${padState.inked} px`);

  /*
   * Resizing must not erase the signature.
   *
   * Assigning `canvas.width` clears the bitmap, so the first version of the pad
   * wiped somebody's mark the moment they rotated their phone or opened dev
   * tools — and the captured data URL survived, which made it worse: the pad
   * looked blank while the contract had already been generated from a signature
   * the person could no longer see.
   */
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.waitForTimeout(800);
  const afterNarrow = await readPad();

  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.waitForTimeout(800);
  const afterWide = await readPad();

  check(
    "the signature survives a window resize",
    afterNarrow.inked > 100 && afterWide.inked > 100,
    `${afterNarrow.inked} px narrow, ${afterWide.inked} px back wide`,
  );

  // ---- the optional stamp --------------------------------------------------
  const inputs = await page.$$("input[type=file][accept='image/png,image/jpeg']");
  await inputs[inputs.length - 1].setInputFiles({
    name: "stamp.png",
    mimeType: "image/png",
    buffer: Buffer.from(UPLOAD_PNG.split(",")[1], "base64"),
  });
  await page.waitForTimeout(800);
  const stampShown = await page.$eval("img[alt='Your company stamp']", (el) => el.naturalWidth > 0)
    .catch(() => false);
  check("the optional stamp is accepted", stampShown);

  // ==================================================================== 6 ===
  section("6. The contract generates itself");

  await page.waitForSelector("text=Your contract is ready", { timeout: 30000 }).catch(() => {});
  const ready = await page.$("text=Your contract is ready");
  check("the contract is generated without being asked for", Boolean(ready));

  // Collected since the first page load — see the listener at the top.
  const saved = downloads.find((d) => d.suggestedFilename() === "shopcore-service-agreement.pdf");
  check(
    "and downloads itself without being asked",
    Boolean(saved),
    downloads.map((d) => d.suggestedFilename()).join(", ") || "nothing was saved",
  );

  if (saved) {
    const path = await saved.path();
    const head = (await import("node:fs")).readFileSync(path).subarray(0, 5).toString();
    check("the saved file is a real PDF", head === "%PDF-", head);
  }

  const viewHref = await page.getAttribute("a:has-text('View contract')", "href").catch(() => null);
  check("the generated contract is offered", viewHref?.startsWith("blob:") ?? false, viewHref?.slice(0, 20));

  const payEnabled = !(await page.isDisabled("button:has-text('Continue to payment')"));
  check("payment unlocks once the contract exists", payEnabled);

  await page.click("button:has-text('Continue to payment')");
  await page.waitForTimeout(2500);
  route = "/onboarding/checkout";
  check(
    "continuing reaches the payment step",
    new URL(page.url()).pathname === "/onboarding/checkout",
    new URL(page.url()).pathname,
  );

  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("shopcore_onboarding_contract") ?? "null"),
  );
  check("the signature is carried to checkout", Boolean(stored?.signatureImage));
  check("the stamp is carried to checkout", Boolean(stored?.stampImage));

  // ==================================================================== 7 ===
  section("7. Paying, and what is filed");

  await page.click("[role=radio]:has-text('Bank transfer')");
  await page.waitForTimeout(500);

  /*
   * The submit button is labelled per rail — "Pay RWF 15,000" for the gateway
   * rails, "Create my workspace" for a transfer, because no money moves in the
   * click. Waiting for the right one also proves the label follows the choice.
   */
  await page.click("button[type=submit]:has-text('Create my workspace')");
  await page.waitForSelector("text=/transfer details|Workspace reserved/i", { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(2500);

  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("shopcore_auth_tokens") ?? "null"),
  );

  const mine = await fetch(`${API}/contracts/mine`, {
    headers: { Authorization: `Bearer ${after?.accessToken}` },
  }).then((r) => r.json());

  check("a signed contract is on file for the new workspace", mine.success === true, mine.message);
  check("it records who signed", Boolean(mine.data?.signer_name), mine.data?.signer_name);
  check("it keeps the signature image", Boolean(mine.data?.signature_image));
  check("it keeps the stamp", Boolean(mine.data?.stamp_image));
  check(
    "it carries ShopCore's countersignature",
    Boolean(mine.data?.provider_signature_image),
  );
  check(
    "and names who signed for ShopCore",
    mine.data?.provider_signer_name === "Patrick Yumvagusenga",
    mine.data?.provider_signer_name,
  );
  check(
    "the filed wording matches what was displayed",
    typeof mine.data?.body === "string" && mine.data.body.includes("102938475"),
  );

  const pdf = await fetch(`${API}/contracts/mine/pdf`, {
    headers: { Authorization: `Bearer ${after?.accessToken}` },
  });
  const bytes = Buffer.from(await pdf.arrayBuffer());
  check(
    "the contract downloads as a real PDF",
    pdf.status === 200 && bytes.subarray(0, 5).toString() === "%PDF-",
    `${bytes.length} bytes`,
  );

  // ==================================================================== 8 ===
  section("8. The workspace");

  await goto("/billing");
  const contractCard = await page.$("text=Your service agreement");
  check("the tenant can read their agreement on /billing", Boolean(contractCard));

  const parties = await page.$$eval("p", (els) =>
    els.map((e) => e.textContent.trim()).filter((t) => t === "For ShopCore" || t === "For your business"),
  );
  check("both parties are shown", parties.length === 2, parties.join(" / "));

  const signatureImg = await page
    .$eval("img[alt^='Signature of']", (el) => ({
      shown: el.naturalWidth > 0,
      background: getComputedStyle(el).backgroundColor,
    }))
    .catch(() => null);
  check("the signature is visible there", signatureImg?.shown ?? false);
  check(
    "and sits on white, not the dark surface",
    signatureImg?.background === "rgb(255, 255, 255)",
    signatureImg?.background,
  );

  /*
   * Both halves are watched, because they fail for different reasons and the
   * difference is the whole diagnosis: no response means the endpoint or the
   * session is wrong, a response with no download means the browser-side
   * hand-off is (the anchor, the blob URL, the cleanup that once cancelled it).
   */
  const pdfResponse = page
    .waitForResponse((r) => r.url().includes("/contracts/mine/pdf"), { timeout: 25000 })
    .catch(() => null);
  const downloadEvent = page.waitForEvent("download", { timeout: 25000 }).catch(() => null);

  await page.click("button:has-text('Download PDF')");

  const served = await pdfResponse;
  check("the download button asks the server for the PDF", Boolean(served), served ? `${served.status()}` : "");

  const download = await downloadEvent;
  check("and the browser actually saves it", Boolean(download), download?.suggestedFilename());

  // ==================================================================== 9 ===
  section("9. The platform console");

  await goto("/");
  await page.evaluate(
    (t) => localStorage.setItem("shopcore_auth_tokens", JSON.stringify(t)),
    admin,
  );

  const consoleRoutes = [
    "/platform-admin",
    "/platform-admin/organizations",
    "/platform-admin/subscription-plans",
    "/platform-admin/contract-templates",
    "/platform-admin/payment-gateway",
    "/platform-admin/tenants",
    "/platform-admin/subscriptions",
    "/platform-admin/subscription-approvals",
    "/platform-admin/invoices",
    "/platform-admin/payments",
    "/platform-admin/payment-attempts",
    "/platform-admin/users",
  ];

  let wideRows = [];

  for (const path of consoleRoutes) {
    await goto(path);

    const heading = await page.textContent("h1").catch(() => null);
    const wide = await page.evaluate(widestRows);
    if (wide.length) wideRows.push(`${path} ${JSON.stringify(wide)}`);

    check(`${path}`, Boolean(heading) && wide.length === 0, heading?.slice(0, 40));
  }

  check("no console page puts more than four cards on a line", wideRows.length === 0, wideRows.join("; "));

  const links = await page.$$eval("aside a", (as) => as.map((a) => a.getAttribute("href")));
  check(
    "super admin has the contract-template link",
    links.includes("/platform-admin/contract-templates"),
  );

  await goto("/platform-admin/contract-templates");
  await page.click("text=New template");
  await page.waitForTimeout(900);
  const placeholders = await page.$$eval("[role=dialog] button", (bs) =>
    bs.map((b) => b.textContent.trim()).filter((t) => t.startsWith("{{")).length,
  );
  check("the template editor lists the fillable fields", placeholders >= 10, `${placeholders} fields`);
} finally {
  section("Browser noise");

  const noisy = [...noise.entries()].filter(([, list]) => list.length > 0);
  if (noisy.length === 0) {
    console.log("  none");
  } else {
    for (const [where, list] of noisy) {
      console.log(`  ${where}`);
      list.forEach((line) => console.log(`    ${line}`));
    }
  }

  section("Result");
  console.log(`  ${results.length - failures}/${results.length} checks passed`);

  await browser.close();
  process.exitCode = failures > 0 ? 1 : 0;
}
