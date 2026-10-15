/* JSON backup parsing shared by the legal library and case manager. */
(function (root) {
  "use strict";

  function parseJson(input) {
    return typeof input === "string" ? JSON.parse(input) : input;
  }

  function parseLibrary(input) {
    const value = parseJson(input);
    if (!value || !Array.isArray(value.laws) || !Array.isArray(value.docs) || !Array.isArray(value.saved)) {
      throw new Error("invalid-library-backup");
    }
    return value;
  }

  function parseCases(input) {
    const value = parseJson(input);
    const cases = Array.isArray(value) ? value : value && value.cases;
    if (!Array.isArray(cases) || cases.some(function (item) { return !item || typeof item !== "object"; })) {
      throw new Error("invalid-cases-backup");
    }
    return cases;
  }

  function casesPayload(cases) {
    return { version: 2, cases: cases };
  }

  root.KalamBackup = Object.freeze({
    parseLibrary: parseLibrary,
    parseCases: parseCases,
    casesPayload: casesPayload
  });
})(window);
