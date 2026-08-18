/**
 * Lighthouse against authenticated routes (Doc 11 §8, Doc 22 M8 go-live gate).
 *
 * `lighthouserc.json` only covers `/login` and `/partner/login` — the only
 * pages Lighthouse CI can reach without a session. Every other budgeted
 * route (dashboard, reports, participants — Doc 16 S03/S42/S20, the three
 * heaviest per Doc 11 §8's "chart routes ≤ 450KB" note) sits behind
 * `requirePermission()` (Doc 04), so this script logs in for real through
 * the same `/api/auth/login` contract (Doc 20 §2b) a browser would use,
 * captures the session cookie, and replays it as a Lighthouse request
 * header — no rules/permission bypass, no test-only backdoor.
 *
 * Requires a seeded, real staff account (Founder or Operations Manager, so
 * every budgeted route is reachable) whose credentials are supplied via env,
 * never committed:
 *   PERF_BASE_URL       e.g. https://staging.crm.terranextglobal.com
 *   PERF_TEST_EMAIL      seeded perf-test account email
 *   PERF_TEST_PASSWORD   seeded perf-test account password
 *
 * Usage: npm run perf:lighthouse:auth
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const BASE_URL = process.env.PERF_BASE_URL;
const EMAIL = process.env.PERF_TEST_EMAIL;
const PASSWORD = process.env.PERF_TEST_PASSWORD;

if (!BASE_URL || !EMAIL || !PASSWORD) {
  console.error(
    'Set PERF_BASE_URL, PERF_TEST_EMAIL, PERF_TEST_PASSWORD (a seeded staff account) before running this script.',
  );
  process.exit(1);
}

/** Doc 11 §8 budgets: TTI/LCP ceilings shared everywhere; JS ceiling is per-route class. */
const ROUTES = [
  { path: '/dashboard', label: 'S03 Dashboard', jsBudgetKb: 450 },
  { path: '/reports', label: 'S42 Reports centre', jsBudgetKb: 450 },
  { path: '/participants', label: 'S20 Participants directory', jsBudgetKb: 300 },
];
const TTI_BUDGET_MS = 2000;
const LCP_BUDGET_MS = 2000;

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const setCookie = res.headers.get('set-cookie');
  const match = setCookie?.match(/__session=[^;]+/);
  if (!match) {
    throw new Error('Login succeeded but no __session cookie was returned.');
  }
  return match[0];
}

async function auditRoute(chrome, cookie, route) {
  const result = await lighthouse(
    `${BASE_URL}${route.path}`,
    {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility'],
      extraHeaders: { Cookie: cookie },
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
      throttlingMethod: 'simulate',
    },
    {
      extends: 'lighthouse:default',
    },
  );

  const lhr = result.lhr;
  const tti = lhr.audits['interactive'].numericValue;
  const lcp = lhr.audits['largest-contentful-paint'].numericValue;
  const totalBytes = lhr.audits['total-byte-weight'].numericValue;
  const perfScore = lhr.categories.performance.score * 100;
  const a11yScore = lhr.categories.accessibility.score * 100;
  const totalKb = totalBytes / 1024;

  const failures = [];
  if (tti > TTI_BUDGET_MS) failures.push(`TTI ${Math.round(tti)}ms > ${TTI_BUDGET_MS}ms budget`);
  if (lcp > LCP_BUDGET_MS) failures.push(`LCP ${Math.round(lcp)}ms > ${LCP_BUDGET_MS}ms budget`);
  if (totalKb > route.jsBudgetKb)
    failures.push(`transfer ${Math.round(totalKb)}KB > ${route.jsBudgetKb}KB budget`);
  if (perfScore < 90) failures.push(`performance score ${perfScore} < 90`);
  if (a11yScore < 90) failures.push(`accessibility score ${a11yScore} < 90`);

  return { route, tti, lcp, totalKb, perfScore, a11yScore, failures, raw: result.report };
}

async function main() {
  mkdirSync('.lighthouseci', { recursive: true });
  const cookie = await login();
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });

  const results = [];
  try {
    for (const route of ROUTES) {
      console.log(`Auditing ${route.label} (${route.path})...`);
      results.push(await auditRoute(chrome, cookie, route));
    }
  } finally {
    await chrome.kill();
  }

  console.log('\n--- Lighthouse authenticated-route results (Doc 11 §8) ---\n');
  let anyFailure = false;
  for (const r of results) {
    const status = r.failures.length === 0 ? 'PASS' : 'FAIL';
    if (r.failures.length > 0) anyFailure = true;
    console.log(
      `[${status}] ${r.route.label} — perf ${r.perfScore}, a11y ${r.a11yScore}, ` +
        `TTI ${Math.round(r.tti)}ms, LCP ${Math.round(r.lcp)}ms, transfer ${Math.round(r.totalKb)}KB`,
    );
    r.failures.forEach((f) => console.log(`         ↳ ${f}`));
    writeFileSync(`.lighthouseci/authenticated-${r.route.path.replace(/\//g, '_')}.json`, r.raw);
  }

  if (anyFailure) {
    console.error('\nOne or more authenticated routes missed a Doc 11 §8 budget.');
    process.exit(1);
  }
  console.log('\nAll authenticated routes within budget.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
