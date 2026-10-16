import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const required = ["index.html", "workspace.html", "cases.html", "login.html", "manifest.webmanifest", "sw.js", "js/core/storage.js", "js/core/backup.js", "js/library/model.js", "js/cases/model.js"];
const failures = [];
for (const file of required) {
  if (!existsSync(resolve(file))) failures.push("Missing required file: " + file);
}

function checkHtml(file) {
  if (!existsSync(file)) return;
  const html = readFileSync(file, "utf8");
  if (!/<html\b[^>]*lang=["']ar["']/i.test(html)) failures.push(file + ": expected Arabic document language");
  if (!/<html\b[^>]*dir=["']rtl["']/i.test(html)) failures.push(file + ": expected RTL document direction");
  if (!/<title>[^<]+<\/title>/i.test(html)) failures.push(file + ": missing page title");
  if (!/<meta\s+charset=["']utf-8["']/i.test(html)) failures.push(file + ": missing UTF-8 charset");

  // Inline script extraction with a regular expression can truncate valid HTML strings.
  // External JavaScript modules are syntax-checked below; keep HTML checks focused on structure and references.
  for (const match of html.matchAll(/(?:href|src)=["']([^"'#]+)["']/gi)) {
    const ref = match[1].trim();
    if (/^(?:https?:|data:|mailto:|tel:|javascript:|\/\/)/i.test(ref)) continue;
    const path = decodeURIComponent(ref.split("?")[0].split("#")[0]);
    if (!path || path.startsWith("/")) continue;
    if (!existsSync(resolve(path))) failures.push(file + ": local reference not found: " + ref);
  }

  // Inline scripts run as one unit in the browser. Catch syntax errors here so an
  // otherwise valid page cannot silently lose all of its click handlers.
  for (const [index, match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].entries()) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    try {
      new vm.Script(match[2], { filename: `${file} inline script ${index + 1}` });
    } catch (error) {
      failures.push(`${file}: inline JavaScript syntax error: ${error.message}`);
    }
  }

  // querySelector(...).addEventListener() throws before the rest of page setup if
  // the target was removed from the markup. Require statically named targets.
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]));
  for (const match of html.matchAll(/querySelector\(["']#([\w-]+)["']\)\.addEventListener/gi)) {
    if (!ids.has(match[1])) failures.push(`${file}: event listener target is missing: #${match[1]}`);
  }
}
checkHtml("index.html");
checkHtml("workspace.html");
checkHtml("cases.html");
checkHtml("login.html");

const themeVersion = [];
for (const file of ["index.html", "workspace.html", "cases.html", "login.html"]) {
  if (!existsSync(file)) continue;
  const html = readFileSync(file, "utf8");
  const themeLink = html.match(/href=["']assets\/qalam-theme\.css\?v=([^"']+)["']/i);
  if (!themeLink) failures.push(`${file}: shared Qalam theme stylesheet is missing`);
  else themeVersion.push(`${file}:${themeLink[1]}`);
}
if (new Set(themeVersion.map(item => item.split(":")[1])).size > 1) {
  failures.push("Pages use different cached versions of the shared Qalam theme");
}

// Lawyer workspace links must land on their distinct sections in the unified
// case-management page, rather than both opening it at the top.
const casesHtml = readFileSync("cases.html", "utf8");
if (!/id=["']pageSectionTitle["']/.test(casesHtml)) failures.push("cases.html: visible lawyer section title is missing");
if (!/class=["'][^"']*qalam-page-title/.test(casesHtml) || /قَلَم\s*<small[^>]*id=["']pageSectionTitle/.test(casesHtml)) {
  failures.push("cases.html: lawyer section title should be prominent without a Qalam label above it");
}
for (const [file, id] of [["workspace.html", "title"], ["login.html", "loginTitle"]]) {
  const html = readFileSync(file, "utf8");
  const titleTag = html.match(new RegExp(`<h1\\b[^>]*id=["']${id}["'][^>]*>`));
  if (!titleTag || !/class=["'][^"']*qalam-page-title/.test(titleTag[0])) failures.push(`${file}: page title is missing the shared Qalam title style`);
}
if (!/\.qalam-page-title\s*\{[\s\S]*font-family:\s*"Aref Ruqaa"[\s\S]*font-size:\s*clamp\(32px, 3\.2vw, 40px\)/.test(readFileSync("assets/qalam-theme.css", "utf8"))) {
  failures.push("Shared Qalam page title style or responsive title size is missing");
}
if (!/class=["'][^"']*main-home-link[^"']*["'][^>]*href=["']\.\/index\.html["']/.test(casesHtml) || !casesHtml.includes("العودة إلى الصفحة الرئيسية")) {
  failures.push("cases.html: visible return-to-home link is missing");
}
const backupDockAt = casesHtml.indexOf('class="backup-dock');
const exportAt = casesHtml.indexOf('id="export"');
const importAt = casesHtml.indexOf('id="importBtn"');
const mainEndAt = casesHtml.indexOf("</main>");
if (backupDockAt < 0 || exportAt < backupDockAt || importAt < backupDockAt || exportAt > mainEndAt || importAt > mainEndAt) {
  failures.push("cases.html: backup export/import controls should be grouped at the bottom of the page");
}
for (const section of ["cases", "agenda"]) {
  if (!new RegExp(`\\bid=["']${section}["']`, "i").test(casesHtml)) {
    failures.push(`cases.html: missing lawyer workspace destination #${section}`);
  }
}
const indexHtml = readFileSync("index.html", "utf8");
const workspaceHtml = readFileSync("workspace.html", "utf8");
for (const [file, html] of [["index.html", indexHtml], ["workspace.html", workspaceHtml]]) {
  for (const section of ["cases", "agenda"]) {
    if (!html.includes(`cases.html#${section}`)) {
      failures.push(`${file}: lawyer destination cases.html#${section} is missing`);
    }
  }
}

for (const file of ["js/core/storage.js", "js/core/backup.js", "js/library/model.js", "js/cases/model.js"]) {
  if (!existsSync(file)) continue;
  try {
    new vm.Script(readFileSync(file, "utf8"), { filename: file });
  } catch (error) {
    failures.push(file + ": JavaScript syntax error: " + error.message);
  }
}

try {
  const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
  if (!manifest.name || !manifest.start_url || manifest.dir !== "rtl") failures.push("manifest.webmanifest: missing required PWA fields");
} catch (error) {
  failures.push("manifest.webmanifest: invalid JSON (" + error.message + ")");
}

const sw = existsSync("sw.js") ? readFileSync("sw.js", "utf8") : "";
if (!/kalam-static-v\d+/.test(sw)) failures.push("sw.js: cache version is missing");
if (!/request\.mode === ["']navigate["']/.test(sw)) failures.push("sw.js: HTML navigation should use network-first strategy");

if (failures.length) {
  console.error("Kalam smoke-check failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}
console.log("Kalam smoke-check passed: pages, RTL metadata, JavaScript syntax, local references, manifest and storage module.");

