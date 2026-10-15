/* Kalam storage adapter — classic script for static GitHub Pages. */
(function (root) {
  "use strict";
  const VERSION = 1;

  function read(key, fallback, validate) {
    try {
      const raw = root.localStorage.getItem(key);
      if (raw === null) return clone(fallback);
      const value = JSON.parse(raw);
      if (typeof validate === "function" && !validate(value)) {
        return { ok: false, value: clone(fallback), error: "invalid-shape" };
      }
      return { ok: true, value: value, version: VERSION };
    } catch (error) {
      return { ok: false, value: clone(fallback), error: error && error.name === "QuotaExceededError" ? "quota" : "read-failed" };
    }
  }

  function write(key, value, validate) {
    try {
      if (typeof validate === "function" && !validate(value)) return { ok: false, error: "invalid-shape" };
      root.localStorage.setItem(key, JSON.stringify(value));
      return { ok: true, version: VERSION };
    } catch (error) {
      return { ok: false, error: error && error.name === "QuotaExceededError" ? "quota" : "write-failed" };
    }
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function isLibrary(value) {
    return !!value && typeof value === "object" &&
      Array.isArray(value.laws) && Array.isArray(value.docs) && Array.isArray(value.saved);
  }

  function isCases(value) {
    return Array.isArray(value) && value.every(function (item) {
      return !!item && typeof item === "object" && typeof item.id === "string" &&
        (!item.events || Array.isArray(item.events));
    });
  }

  function exportJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  root.KalamStorage = Object.freeze({
    version: VERSION,
    read: read,
    write: write,
    isLibrary: isLibrary,
    isCases: isCases,
    exportJson: exportJson
  });
})(window);
