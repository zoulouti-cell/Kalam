/* Case and event defaults, preserving legacy kalam_cases_v1 records. */
(function (root) {
  "use strict";

  const STORAGE_KEY = "kalam_cases_v1";

  function normalize(cases) {
    if (!Array.isArray(cases)) return [];
    return cases.map(function (item) {
      return Object.assign({}, item, {
        events: Array.isArray(item.events) ? item.events : [],
        documents: Array.isArray(item.documents) ? item.documents : []
      });
    });
  }

  root.KalamCases = Object.freeze({ storageKey: STORAGE_KEY, normalize: normalize });
})(window);
