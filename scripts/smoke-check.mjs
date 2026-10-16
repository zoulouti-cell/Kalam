import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const required = ["index.html", "workspace.html", "cases.html", "login.html", "app.html", "portal.html", "apk/index.html", "data/lex/manifest.json", "lib/pdfjs/pdf.min.mjs", "manifest.webmanifest", "sw.js", "assets/qalam-letterhead-emblem.png", "js/core/storage.js", "js/core/backup.js", "js/library/model.js", "js/cases/model.js", "js/letterhead.js"];
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
checkHtml("app.html");
checkHtml("portal.html");

const themeVersion = [];
for (const file of ["index.html", "workspace.html", "cases.html", "login.html", "portal.html"]) {
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
const themeCss = readFileSync("assets/qalam-theme.css", "utf8");
if (!/--qalam-font:\s*Calibri,\s*"Calibri Arabic"/.test(themeCss) ||
    !/body\s*\{[\s\S]*font-family:\s*var\(--qalam-font\)/.test(themeCss) ||
    !/\.qalam-page-title\s*\{[\s\S]*font-family:\s*var\(--qalam-font\)[\s\S]*font-size:\s*clamp\(32px, 3\.2vw, 40px\)/.test(themeCss) ||
    !/:where\(h1, h2, h3, h4, h5, h6\)\s*\{[\s\S]*font-family:\s*var\(--qalam-font\)/.test(themeCss) ||
    !/body h2:not\(\.qalam-page-title\)[\s\S]*font-size:\s*clamp\(23px, 2\.2vw, 28px\)/.test(themeCss) ||
    !/body h3\s*\{[\s\S]*font-size:\s*clamp\(21px, 1\.8vw, 24px\)/.test(themeCss) ||
    !/body h4\s*\{[\s\S]*font-size:\s*21px/.test(themeCss) ||
    !/body h5\s*\{[\s\S]*font-size:\s*18px/.test(themeCss) ||
    !/body h6\s*\{[\s\S]*font-size:\s*16px/.test(themeCss)) {
  failures.push("Shared Calibri Arabic typography hierarchy for all page headings is missing");
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
for (const section of ["bags", "cases", "documents", "archive", "agenda"]) {
  if (!new RegExp(`\\bid=["']${section}["']`, "i").test(casesHtml)) failures.push(`cases.html: missing case-management branch #${section}`);
}
const indexHtml = readFileSync("index.html", "utf8");
const workspaceHtml = readFileSync("workspace.html", "utf8");
const workspaceHomeLinks = [...workspaceHtml.matchAll(/href=["']index\.html["']/gi)].length;
if (workspaceHomeLinks !== 1 || /id=["']brandTitle["']|querySelector\(["']#brandTitle/.test(workspaceHtml)) {
  failures.push("workspace.html: duplicate page title or return-to-home control is present");
}
for (const [file, html] of [["index.html", indexHtml], ["workspace.html", workspaceHtml], ["cases.html", casesHtml], ["login.html", readFileSync("login.html", "utf8")]]) {
  if (file === "index.html" ? !/id=["']homeBack["'][^>]*qalam-back-link/.test(html) : !/qalam-back-link/.test(html)) {
    failures.push(`${file}: shared return navigation style is missing`);
  }
}
if (indexHtml.includes("space-back-inline") || /brandTitle\.innerHTML|brand-title-text/.test(indexHtml)) {
  failures.push("index.html: lawyer overlay should use one title and the shared header return control");
}
if (!/\.qalam-back-link\s*\{(?=[^}]*background:[^;}]+!important)(?=[^}]*border:[^;}]+!important)[^}]*\}/s.test(readFileSync("assets/qalam-theme.css", "utf8"))) {
  failures.push("Shared return navigation should enforce the same background and border on buttons and links");
}
const indexLawyerStart = indexHtml.indexOf(" lawyer:{");
const indexEditorStart = indexHtml.indexOf(" editor:{", indexLawyerStart);
const indexClientStart = indexHtml.indexOf(" client:{", indexEditorStart);
const indexLawyer = indexHtml.slice(indexLawyerStart, indexEditorStart);
const editorWorkspace = indexHtml.slice(indexEditorStart, indexClientStart);
const workspaceLawyerStart = workspaceHtml.indexOf(" lawyer:{");
const workspaceClientStart = workspaceHtml.indexOf(" client:{", workspaceLawyerStart);
const workspaceLawyer = workspaceHtml.slice(workspaceLawyerStart, workspaceClientStart);
if (indexLawyerStart < 0 || indexEditorStart < 0 || /title:'قلم التحرير'|title:'الرأسية المهنية'/.test(indexLawyer)) {
  failures.push("index.html: lawyer space should not contain the editor or letterhead section");
}
if (/فضاء المحامي[\s\S]{0,180}وقلم التحرير/.test(indexHtml)) {
  failures.push("index.html: homepage lawyer-space description should no longer list the editor as a lawyer-space section");
}
if (indexEditorStart < 0 || indexClientStart < 0 || !editorWorkspace.includes("الرأسية المهنية") || !editorWorkspace.includes("مذكرات نموذجية")) {
  failures.push("index.html: the editor section should contain letterhead and sample memos");
}
if (workspaceLawyerStart < 0 || workspaceClientStart < 0 || workspaceLawyer.includes("قلم التحرير") || !workspaceLawyer.includes("archive-open")) {
  failures.push("workspace.html: lawyer section should link to the case archive and omit the editor");
}
if (!casesHtml.includes('href="#archive"') || !casesHtml.includes("c.status==='منتهٍ'") || !casesHtml.includes('id="archiveList"')) {
  failures.push("cases.html: archive should show completed case records as a separate section");
}
if (!/addEventListener\('popstate',restoreNavigation\)/.test(indexHtml) || !indexHtml.includes("history.pushState({qalamSpace:key}")) {
  failures.push("index.html: browser back should restore the previous workspace level");
}
for (const [file, html] of [["index.html", indexHtml], ["workspace.html", workspaceHtml]]) {
  for (const section of ["files", "arch", "agenda"]) if (!html.includes(`app.html#${section}`)) failures.push(`${file}: lawyer destination app.html#${section} is missing`);
}
if (!casesHtml.includes('href="#cases"') || !casesHtml.includes('href="#documents"') || !casesHtml.includes('documents:old.documents||[]')) {
  failures.push("cases.html: case bags should contain file and document branches without dropping documents during case edits");
}
if (!editorWorkspace.includes("مذكرات نموذجية") || editorWorkspace.includes("المذكرات والقرارات")) {
  failures.push("index.html: editor section should contain sample memos and omit the memos-and-decisions card");
}
if (!casesHtml.includes('id="documentForm"') || !casesHtml.includes('data-case-documents=') || !readFileSync("js/cases/model.js", "utf8").includes("documents: Array.isArray(item.documents) ? item.documents : []")) {
  failures.push("cases.html: documents should be attachable to existing cases while legacy cases remain compatible");
}

const letterheadJs = readFileSync("js/letterhead.js", "utf8");
if (!indexHtml.includes("app.html#lh") || !workspaceHtml.includes('id="letterheadApp"') || !workspaceHtml.includes('#letterheadApp [hidden]{display:none!important}') || !letterheadJs.includes("kalam_letterhead_v1") || !letterheadJs.includes("malafati-brand") || !letterheadJs.includes("window.print()") || !letterheadJs.includes("مكتب الزلوطي للمحاماة") || !letterheadJs.includes("01/5192") || !letterheadJs.includes('id="lhEditor"') || !letterheadJs.includes('contenteditable="true"') || !letterheadJs.includes("kalam_letterhead_draft_v1") || !letterheadJs.includes("sanitizeEditorHtml") || !letterheadJs.includes("data-command=\"bold\"") || !letterheadJs.includes("lhPaperHearing") || !letterheadJs.includes("qalam-letterhead-emblem.png")) {
  failures.push("Letterhead: office identity, template emblem and case details, rich-text editing, local draft persistence, and print workflow should be available");
}

for (const file of ["js/core/storage.js", "js/core/backup.js", "js/library/model.js", "js/cases/model.js", "js/letterhead.js"]) {
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
if (!sw.includes("./assets/qalam-letterhead-emblem.png")) failures.push("sw.js: professional letterhead emblem should be precached");
if (!/request\.mode === ["']navigate["']/.test(sw)) failures.push("sw.js: HTML navigation should use network-first strategy");

// The office space and the client portal: no office's identity is published with Qalam, and their salts are Qalam's own.
for (const file of ["app.html", "portal.html", "apk/index.html"]) {
  const html = readFileSync(file, "utf8");
  for (const word of ["الزلوطي", "0661410274", "01/5192", "zoulouti@", "zoulouti-data", "zerktouni"]) if (html.toLowerCase().includes(word.toLowerCase())) failures.push(`${file}: an office's own data is present (${word})`);
}
for (const file of ["app.html", "apk/index.html"]) {
  const html = readFileSync(file, "utf8");
  if (!html.includes("'qalam-portal-v1'") || !html.includes("'qalam-dossier-v1'")) failures.push(`${file}: the client portal keys must use Qalam's salts`);
  if (!html.includes("var QID=")) failures.push(`${file}: office identity and other offices' letterheads are missing`);
}
if (!readFileSync("portal.html", "utf8").includes("'qalam-portal-v1'")) failures.push("portal.html: the client portal keys must use Qalam's salts");

if (failures.length) {
  console.error("Kalam smoke-check failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}
console.log("Kalam smoke-check passed: pages, RTL metadata, JavaScript syntax, local references, manifest and storage module.");

