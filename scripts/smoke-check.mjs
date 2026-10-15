import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const required = ["index.html", "cases.html", "login.html", "manifest.webmanifest", "sw.js", "js/core/storage.js", "js/core/backup.js", "js/library/model.js", "js/cases/model.js"];
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

  for (const script of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      new vm.Script(script[1], { filename: file });
    } catch (error) {
      failures.push(file + ": inline JavaScript syntax error: " + error.message);
    }
  }

  for (const match of html.matchAll(/(?:href|src)=["']([^"'#]+)["']/gi)) {
    const ref = match[1].trim();
    if (/^(?:https?:|data:|mailto:|tel:|javascript:|\/\/)/i.test(ref)) continue;
    const path = decodeURIComponent(ref.split("?")[0].split("#")[0]);
    if (!path || path.startsWith("/")) continue;
    if (!existsSync(resolve(path))) failures.push(file + ": local reference not found: " + ref);
  }
}

function checkStaticSelectors(file) {
  if (!existsSync(file)) return;
  const html = readFileSync(file, "utf8");
  const ids = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]));
  const selectors = new Set([...html.matchAll(/(?:querySelector(?:All)?\(\s*["']|\$\(\s*["'])#([\w-]+)/g)].map((match) => match[1]));
  for (const id of selectors) {
    if (!ids.has(id)) failures.push(file + ": selector target not found: #" + id);
  }
}

function checkTabs(file, expectedTabs) {
  if (!existsSync(file)) return;
  const html = readFileSync(file, "utf8");
  const tabs = [...html.matchAll(/\bdata-tab=["']([^"']+)["']/g)].map((match) => match[1]);
  const panes = [...html.matchAll(/\bdata-pane=["']([^"']+)["']/g)].map((match) => match[1]);
  const selected = [...html.matchAll(/<button\b[^>]*\baria-selected=["']true["'][^>]*>/gi)];
  if (JSON.stringify([...new Set(tabs)].sort()) !== JSON.stringify([...expectedTabs].sort())) {
    failures.push(file + ": navigation tabs do not match the expected sections");
  }
  if (JSON.stringify([...new Set(panes)].sort()) !== JSON.stringify([...expectedTabs].sort())) {
    failures.push(file + ": navigation panes do not match the expected sections");
  }
  if (selected.length !== 1) failures.push(file + ": exactly one navigation tab should be selected by default");
}
checkHtml("index.html");
checkHtml("cases.html");
checkHtml("login.html");
checkStaticSelectors("index.html");
checkStaticSelectors("cases.html");
checkTabs("cases.html", ["agenda", "cases"]);
if (/<(?:button|a)[^>]*class=["'][^"']*resource-card/.test(readFileSync("index.html", "utf8"))) {
  failures.push("index.html: duplicate dashboard shortcut cards should not be present");
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

