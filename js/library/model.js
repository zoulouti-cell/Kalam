/* Library storage contract, kept compatible with kalam_kalam_v1. */
(function (root) {
  "use strict";

  const STORAGE_KEY = "kalam_kalam_v1";

  function empty() {
    return { laws: [], docs: [], saved: [] };
  }

  function normalize(value) {
    const fallback = empty();
    if (!value || typeof value !== "object") return fallback;
    return Object.assign({}, fallback, value, {
      laws: Array.isArray(value.laws) ? value.laws : fallback.laws,
      docs: Array.isArray(value.docs) ? value.docs : fallback.docs,
      saved: Array.isArray(value.saved) ? value.saved : fallback.saved
    });
  }

  root.KalamLibrary = Object.freeze({ storageKey: STORAGE_KEY, empty: empty, normalize: normalize });
})(window);
