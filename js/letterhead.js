(function (root) {
  "use strict";

  const KEY = "kalam_letterhead_v1";
  const DEFAULTS = {
    firm: "مكتب الزلوطي للمحاماة", firm_fr: "Cabinet d'Avocat Zoulouti",
    name_ar: "الزلوطي عبد الحكيـم", name_fr: "ZOULOUTI ABDELHAKIM",
    lawyer: "الأستاذ عبد الحكيم الزلوطي", sign: "ذ/ عبد الحكيـم الزلوطـــي",
    title_ar: "محـــام", title_fr: "AVOCAT", bar_ar: "بـهـيـئــة الـــدار البـيـــضــــــــــــاء",
    bar_fr: "AU BARREAU DE CASABLANCA", pro: "01/5192", city_ar: "الدار البيضاء",
    city_fr: "Casablanca", addr_ar: "72 شارع محمد الزرقطوني الطابق الثامن الرقم 23 الدار البيضاء",
    addr_fr: "72 BOULEVARD MOHAMED ZERKTOUNI 8ème ÉTAGE N°23 CASABLANCA",
    email: "zoulouti@gmail.com", tel: "0661410274", c1: "#0b5a4a", c2: "#4a3306", c3: "#6b572f", logo: "assets/qalam-letterhead-emblem.png"
  };
  const DRAFT_KEY = "kalam_letterhead_draft_v1";
  const FIELDS = [
    ["firm", "اسم المكتب"], ["firm_fr", "اسم المكتب بالفرنسية"],
    ["name_ar", "اسم المحامي في الرأسية (عربي)"], ["name_fr", "اسم المحامي في الرأسية (فرنسي)"],
    ["lawyer", "اسم المحامي في الوثائق"], ["sign", "صيغة التوقيع"],
    ["title_ar", "الصفة (عربي)"], ["title_fr", "الصفة (فرنسي)"],
    ["bar_ar", "الهيئة (عربي)"], ["bar_fr", "الهيئة (فرنسي)"], ["pro", "الرقم المهني"],
    ["city_ar", "المدينة"], ["city_fr", "المدينة بالفرنسية"], ["addr_ar", "العنوان"],
    ["addr_fr", "العنوان بالفرنسية"], ["email", "البريد الإلكتروني"], ["tel", "الهاتف"]
  ];
  const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function sanitizeEditorHtml(html) {
    const source = new DOMParser().parseFromString(String(html || ""), "text/html");
    const allowed = new Set(["P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "SPAN", "H1", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE"]);
    const colorPattern = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;
    const fontNames = new Set(["Calibri", "Arial", "Tahoma", "Georgia", "Times New Roman"]);
    function appendSafe(parent, node) {
      const safe = copy(node);
      if ((safe.nodeType === Node.TEXT_NODE && !safe.nodeValue) || (safe.nodeType === Node.DOCUMENT_FRAGMENT_NODE && !safe.childNodes.length)) return;
      parent.append(safe);
    }
    function copy(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue.replace(/\u200B/g, ""));
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const name = node.tagName === "FONT" ? "SPAN" : node.tagName;
      if (!allowed.has(name)) {
        const fragment = document.createDocumentFragment();
        Array.from(node.childNodes).forEach(child => appendSafe(fragment, child));
        return fragment;
      }
      const out = document.createElement(name.toLowerCase());
      const styles = new Map();
      if (node.hasAttribute("style")) {
        const raw = node.style;
        const family = raw.getPropertyValue("font-family").replace(/["']/g, "").split(",")[0].trim();
        const size = raw.getPropertyValue("font-size").trim();
        const color = raw.getPropertyValue("color").trim();
        const background = raw.getPropertyValue("background-color").trim();
        const align = raw.getPropertyValue("text-align").trim();
        const weight = raw.getPropertyValue("font-weight").trim();
        const fontStyle = raw.getPropertyValue("font-style").trim();
        const decoration = raw.getPropertyValue("text-decoration-line").trim() || raw.getPropertyValue("text-decoration").trim();
        if (fontNames.has(family)) styles.set("font-family", family);
        if (/^(?:8|9|[1-4]\d|48)(?:\.\d+)?(?:pt|px)$/.test(size)) styles.set("font-size", size);
        if (colorPattern.test(color)) styles.set("color", color);
        if (colorPattern.test(background)) styles.set("background-color", background);
        if (["left", "right", "center", "justify"].includes(align)) styles.set("text-align", align);
        if (["normal", "bold", "600", "700", "800", "900"].includes(weight)) styles.set("font-weight", weight);
        if (["normal", "italic", "oblique"].includes(fontStyle)) styles.set("font-style", fontStyle);
        if (["none", "underline", "line-through", "overline", "underline line-through"].includes(decoration)) styles.set("text-decoration", decoration);
      }
      if (node.tagName === "FONT") {
        const color = node.getAttribute("color") || "";
        if (colorPattern.test(color)) styles.set("color", color);
      }
      styles.forEach((value, key) => out.style.setProperty(key, value));
      Array.from(node.childNodes).forEach(child => appendSafe(out, child));
      if (!out.childNodes.length && ["STRONG", "B", "EM", "I", "U", "SPAN"].includes(name)) return document.createDocumentFragment();
      return out;
    }
    const fragment = document.createDocumentFragment();
    Array.from(source.body.childNodes).forEach(child => appendSafe(fragment, child));
    const wrapper = document.createElement("div");
    wrapper.append(fragment);
    return wrapper.innerHTML;
  }
  const readIdentity = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      const value = JSON.parse(raw);
      return value && value.version === 1 && value.identity && typeof value.identity === "object"
        ? { ...DEFAULTS, ...value.identity, logo: value.identity.logo || DEFAULTS.logo } : { ...DEFAULTS };
    } catch (_) { return { ...DEFAULTS }; }
  };

  function template() {
    const identityFields = FIELDS.map(([key, label]) => `<label><span>${label}</span><input data-brand="${key}" ${["firm_fr", "name_fr", "title_fr", "bar_fr", "city_fr", "addr_fr", "email", "tel", "pro"].includes(key) ? 'dir="ltr"' : ""} maxlength="160"></label>`).join("");
    return `<style>
      .lh-app{--lh-green:#234c3d;--lh-gold:#b18b37;display:grid;gap:18px}.lh-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.lh-panel{background:#fff;border:1px solid var(--line,#e8eee9);border-radius:18px;padding:clamp(16px,3vw,26px);box-shadow:var(--shadow,0 12px 35px rgba(28,65,47,.055))}.lh-panel h2{margin:0 0 8px;color:var(--brand,#234c3d);font-size:20px}.lh-panel>p{margin:0 0 14px;color:var(--muted,#7d8d84)}.lh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}.lh-grid label,.lh-field{display:grid;gap:4px;font-weight:700;color:#40564c;font-size:14px}.lh-grid input,.lh-field input,.lh-field select,.lh-field textarea{width:100%;min-height:44px;border:1px solid #dce6df;border-radius:10px;padding:9px 11px;background:#fff;color:#203d33;font:inherit}.lh-field textarea{min-height:110px;resize:vertical}.lh-split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.lh-brandbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}.lh-brandbar img{width:76px;height:68px;object-fit:contain;background:#f4f6f3;border:1px solid #e1eae3;border-radius:12px;padding:5px}.lh-help{color:#718178;font-size:13px}.lh-msg{min-height:24px;margin:8px 0 0!important;color:#236548!important;font-weight:700}.lh-check{display:flex;align-items:center;gap:8px;font-weight:600;color:#40564c}.lh-check input{width:20px;height:20px}.lh-paper-wrap{background:#e8ece9;padding:16px;border-radius:16px;overflow:auto}.lh-paper{width:min(100%,800px);min-height:650px;margin:auto;background:white;color:#202c27;padding:46px 50px;box-shadow:0 8px 26px #203d3324;direction:rtl;--lh-ink:#234c3d;--lh-accent:#b18b37;font-family:Calibri,"Noto Naskh Arabic",Tahoma,Arial,sans-serif;line-height:1.9}.lh-paper.landscape{width:100%;min-height:500px;aspect-ratio:1.414}.lh-paper.fr{direction:ltr;text-align:left}.lh-ph{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;border-bottom:3px solid var(--lh-accent);padding-bottom:12px;color:var(--lh-ink)}.lh-ph div{display:grid;gap:2px}.lh-ph .lh-latin{text-align:left;direction:ltr}.lh-ph img{width:78px;height:66px;object-fit:contain}.lh-ph b{font-size:19px}.lh-ph small{font-size:12px}.lh-place-date{display:flex;justify-content:space-between;gap:12px;margin:20px 0}.lh-ref{display:flex;justify-content:space-between;gap:14px;padding:10px 12px;border:1px solid #d8d1bb;border-inline-start:4px solid var(--lh-accent);margin:12px 0}.lh-to{text-align:center;font-weight:700;margin:22px auto;white-space:pre-line}.lh-paper h3{text-align:center;color:var(--lh-ink);margin:18px 0}.lh-parties{white-space:pre-line;margin:14px 0}.lh-body{min-height:110px;white-space:pre-wrap}.lh-sign{text-align:left;margin:28px 0 0;white-space:pre-line}.lh-foot{border-top:1px solid #bca765;margin-top:34px;padding-top:8px;text-align:center;font-size:11px;color:#58665f;white-space:pre-line}.lh-paper[dir=ltr] .lh-sign{text-align:right}.lh-paper input{border:0}.lh-filemeta{background:#f1f6f2;border-inline-start:4px solid #73977f;padding:10px 13px;border-radius:8px;margin-top:12px}.lh-section-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:12px}.lh-logo-input{max-width:320px}.lh-buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.lh-buttons .btn{min-height:42px}.lh-draft-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}.lh-draft-grid .full{grid-column:1/-1}.lh-case-tools{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.lh-case-tools>*{flex:1 1 220px}.lh-subtitle{font-size:13px;color:#75857c}@media(max-width:720px){.lh-split{grid-template-columns:1fr}.lh-paper{padding:28px 22px}.lh-ph img{width:58px}.lh-ph b{font-size:16px}}@media(max-width:540px){.lh-grid,.lh-draft-grid{grid-template-columns:1fr}.lh-draft-grid .full{grid-column:auto}.lh-paper{padding:24px 18px;min-height:560px}.lh-ph{grid-template-columns:1fr auto}.lh-ph .lh-latin{display:none}.lh-place-date{flex-direction:column}.lh-paper.landscape{min-height:480px;aspect-ratio:auto}}
      @media print{@page{size:A4;margin:0}body{background:#fff!important}.top,.hero,.section-title,#grid,#notice,.lh-panel:not(.lh-preview-panel),.footer{display:none!important}.wrap{max-width:none!important;margin:0!important;padding:0!important}.lh-app{display:block!important}.lh-preview-panel{display:block!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}.lh-preview-panel>h2,.lh-preview-panel>p{display:none!important}.lh-paper-wrap{background:none!important;padding:0!important;overflow:visible!important}.lh-paper{width:210mm!important;min-height:297mm!important;padding:24mm 22mm!important;margin:0!important;box-shadow:none!important;border-radius:0!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.lh-paper.landscape{width:297mm!important;min-height:210mm!important}.lh-ph{break-inside:avoid}.lh-paper.fr{direction:ltr}}
    </style>
    <style>
      .lh-model-mark{display:flex;align-items:center;justify-content:center;gap:12px;margin:0 0 18px;padding:10px 14px;border:1px solid #e9e4d6;border-radius:14px;background:linear-gradient(120deg,#fff,#fbfaf6);color:#60512f}.lh-model-mark img{width:46px;height:38px;object-fit:contain}.lh-model-mark span{font-size:12px;font-weight:700}.lh-toolbar{display:grid;gap:9px;padding:12px;background:#f2f4f7;border:1px solid #dfe4ec;border-radius:14px;margin:10px 0 8px;color:#293346}.lh-toolbar-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.lh-toolbar label{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700}.lh-toolbar select{min-height:36px;border:1px solid #d9dee6;border-radius:9px;background:#fff;padding:5px 8px;color:#273446;font:inherit}.lh-toolbar button{width:36px;height:36px;min-height:36px;padding:0;border-radius:9px;background:#fff;border:1px solid #dce2ea;color:#23354a;font-weight:800}.lh-toolbar button[aria-pressed=true]{background:#dce7ff;border-color:#9bb6fb;color:#173c8f}.lh-toolbar .lh-size-readout{min-width:38px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums}.lh-color-tool{position:relative;display:inline-flex!important;align-items:center;gap:7px;padding:5px 8px;border-radius:20px;background:#fff;border:1px solid #dce2ea;cursor:pointer}.lh-color-tool input{width:28px!important;height:28px!important;min-height:28px!important;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;cursor:pointer}.lh-editor{min-height:240px;padding:18px 20px;border:1px solid #cfd9d2;border-radius:12px;background:#fff;color:#202c27;font-family:Calibri,"Noto Naskh Arabic",Tahoma,Arial,sans-serif;font-size:16pt;line-height:1.9;white-space:normal;outline:none}.lh-editor:focus{border-color:#6c9c7f;box-shadow:0 0 0 3px #6c9c7f22}.lh-editor:empty:before{content:attr(data-placeholder);color:#89958e;pointer-events:none}.lh-editor h1,.lh-editor h2,.lh-editor h3{color:#234c3d;line-height:1.5}.lh-editor h1{font-size:24pt}.lh-editor h2{font-size:20pt}.lh-editor h3{font-size:17pt}.lh-editor ul,.lh-editor ol{padding-inline-start:28px}.lh-editor blockquote{margin-inline:0;padding-inline:14px;border-inline-start:3px solid #b18b37;color:#58665f}.lh-editor p{margin:0 0 10px}.lh-place-date{font-weight:700;color:#39483f}.lh-case-row{margin:8px 0 14px;padding:10px 12px;background:#fbfaf6;border-inline-start:3px solid var(--lh-accent);white-space:pre-line}.lh-hearing{display:flex;gap:16px;flex-wrap:wrap;margin:8px 0;color:#46534b;font-size:13px}.lh-body{min-height:90px;white-space:normal}.lh-body p{margin:0 0 10px}.lh-body h1,.lh-body h2,.lh-body h3{color:var(--lh-ink)}
    </style>
    <section class="lh-panel"><div class="lh-section-title"><div><h2>هوية المكتب</h2><div class="lh-subtitle">بيانات الرأسية والوثائق المطبوعة، تُحفظ على هذا الجهاز.</div></div><a class="btn" href="workspace.html?section=editor">قلم التحرير</a></div><div class="lh-grid">${identityFields}</div><div class="lh-brandbar"><img id="lhLogoPreview" alt="شعار المكتب"><label class="lh-field lh-logo-input">شعار المكتب<input id="lhLogo" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="lh-field">لون العناوين<input data-brand="c1" type="color"></label><label class="lh-field">لون الإطارات والخطوط<input data-brand="c2" type="color"></label><label class="lh-field">لون خط الرأسية<input data-brand="c3" type="color"></label></div><div class="lh-buttons"><button class="btn" type="button" data-action="save-brand">حفظ الهوية</button><button class="btn" type="button" data-action="export-brand">تصدير الهوية</button><label class="btn">استيراد هوية<input id="lhImport" type="file" accept=".json,application/json" hidden></label><button class="btn" type="button" data-action="reset-brand">الرجوع إلى البيانات الأصلية</button></div><p id="lhBrandMsg" class="lh-msg" aria-live="polite"></p></section>
    <section class="lh-panel"><h2>إنشاء وثيقة برأسية المكتب</h2><p>يعكس القالب نموذج المكتب المرفق. املأ بيانات القضية، ثم انقر داخل مساحة النص لتنسيق المذكرة. تُحفظ مسودة النص محليًا لكل ملف.</p><div class="lh-case-tools"><label class="lh-field">ربط بملف قضية<select id="lhCase"><option value="">— دون ملف —</option></select></label><label class="lh-field">نموذج الصفحة<select id="lhModel"><option value="v">عربي عمودي</option><option value="h">عربي أفقي</option><option value="f">فرنسي</option></select></label><label class="lh-field">نوع الوثيقة<input id="lhType" list="lhTypes" value="مذكرة دفاعية" maxlength="120"><datalist id="lhTypes"><option>مذكرة دفاعية</option><option>مذكرة جوابية</option><option>مقال افتتاحي</option><option>طلب</option><option>إنذار</option><option>رسالة</option><option>استشارة</option></datalist></label></div><div class="lh-draft-grid" style="margin-top:12px"><label class="lh-field">التاريخ<select id="lhDateMode"><option value="today">تاريخ اليوم</option><option value="pick">تاريخ محدد</option><option value="blank">دون تاريخ</option></select></label><label class="lh-field" id="lhDateWrap">تاريخ الوثيقة<input id="lhDate" type="date"></label><label class="lh-field">المكان<input id="lhPlace" value="الدار البيضاء"></label><label class="lh-check"><input id="lhShowPlace" type="checkbox" checked> إظهار المكان</label><label class="lh-field">الجهة الموجهة إليها<input id="lhRecipient" placeholder="السيد رئيس المحكمة الابتدائية …"></label><label class="lh-field">صيغة التوجيه<select id="lhAddressing"><option>إلى</option><option>مرفوع إلى</option><option>مرفوعة إلى</option></select></label><label class="lh-field">رقم الملف<input id="lhFileNumber" dir="ltr"></label><label class="lh-field">مرجع المكتب<input id="lhReference" dir="ltr"></label><label class="lh-field">المحكمة<input id="lhCourt" placeholder="المحكمة الابتدائية …"></label><label class="lh-field">تاريخ الجلسة<input id="lhHearingDate" type="date"></label><label class="lh-field">القاعة / التوقيت<input id="lhSession" placeholder="القاعة 8 · زوالًا"></label><label class="lh-field">اسم الموكل<input id="lhClient"></label><label class="lh-field">الخصم<input id="lhOpponent"></label><div class="lh-field full"><span id="lhEditorLabel">مضمون الوثيقة</span><div class="lh-toolbar" id="lhEditorToolbar" role="toolbar" aria-label="أدوات تنسيق النص"><div class="lh-toolbar-row"><label>نمط الفقرة<select id="lhBlockStyle" aria-label="نمط الفقرة"><option value="p">عادي</option><option value="h1">عنوان رئيسي</option><option value="h2">عنوان فرعي</option><option value="h3">عنوان صغير</option></select></label><label>الخط<select id="lhFontFamily" aria-label="نوع الخط"><option>Calibri</option><option>Arial</option><option>Tahoma</option><option>Georgia</option><option>Times New Roman</option></select></label><button type="button" data-action="size-down" aria-label="تصغير حجم الخط" title="تصغير">−</button><output id="lhFontSize" class="lh-size-readout" aria-live="polite">16</output><button type="button" data-action="size-up" aria-label="تكبير حجم الخط" title="تكبير">＋</button></div><div class="lh-toolbar-row"><button type="button" data-command="bold" aria-label="عريض" title="عريض"><b>B</b></button><button type="button" data-command="italic" aria-label="مائل" title="مائل"><i>I</i></button><button type="button" data-command="underline" aria-label="تحته خط" title="تحته خط"><u>U</u></button><button type="button" data-command="justifyRight" aria-label="محاذاة لليمين" title="محاذاة لليمين">⇤</button><button type="button" data-command="justifyCenter" aria-label="توسيط" title="توسيط">≡</button><button type="button" data-command="justifyLeft" aria-label="محاذاة لليسار" title="محاذاة لليسار">⇥</button><button type="button" data-command="justifyFull" aria-label="ضبط النص" title="ضبط النص">☷</button><label class="lh-color-tool">لون النص<input id="lhTextColor" type="color" value="#203d33" aria-label="لون النص"></label><label class="lh-color-tool">تمييز<input id="lhHighlightColor" type="color" value="#fff2a8" aria-label="لون التمييز"></label></div></div><div id="lhEditor" class="lh-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="lhEditorLabel" dir="rtl" data-placeholder="اكتب مضمون الوثيقة هنا…"></div><textarea id="lhBody" hidden aria-hidden="true" tabindex="-1"></textarea></div><label class="lh-field full">المرفقات<textarea id="lhAttachments" rows="2" placeholder="عنصر واحد في كل سطر"></textarea></label><label class="lh-field">التوقيع<input id="lhSignature"></label></div><p id="lhDraftMsg" class="lh-help" aria-live="polite"></p><div class="lh-buttons"><button class="btn" type="button" data-action="preview">تحديث المعاينة</button><button class="btn" type="button" data-action="print">طباعة / حفظ PDF</button></div></section>
    <section class="lh-panel lh-preview-panel"><h2>معاينة الوثيقة</h2><p>راجع بيانات الرأسية والمذكرة قبل الطباعة أو الحفظ بصيغة PDF.</p><div class="lh-paper-wrap"><article id="lhPaper" class="lh-paper"><header class="lh-ph"><div><b data-preview="name_ar"></b><small><span data-preview="title_ar"></span> · <span data-preview="bar_ar"></span></small></div><img id="lhPaperLogo" alt="شعار المكتب"><div class="lh-latin"><b data-preview="name_fr"></b><small><span data-preview="title_fr"></span> · <span data-preview="bar_fr"></span></small></div></header><div class="lh-place-date"><span id="lhPaperPlace"></span><span id="lhPaperDate"></span></div><div class="lh-ref"><span id="lhPaperNumber"></span><span id="lhPaperOurRef"></span></div><div id="lhPaperCourt" class="lh-case-row"></div><div id="lhPaperHearing" class="lh-hearing"></div><div id="lhPaperRecipient" class="lh-to"></div><h3 id="lhPaperType"></h3><div id="lhPaperParties" class="lh-parties"></div><div id="lhPaperBody" class="lh-body"></div><div id="lhPaperAttachments" class="lh-parties"></div><div id="lhPaperSign" class="lh-sign"></div><footer class="lh-foot"><b id="lhPaperFirm"></b><div id="lhPaperAddress"></div><div id="lhPaperContact"></div><div id="lhPaperPro"></div></footer></article></div></section>`;
  }

  function init(rootEl) {
    if (!rootEl || rootEl.dataset.ready) return;
    rootEl.dataset.ready = "1";
    const $ = selector => rootEl.querySelector(selector);
    const brandInputs = Array.from(rootEl.querySelectorAll("[data-brand]"));
    let brand = readIdentity();
    let logo = brand.logo || "";
    const editor = $("#lhEditor");
    let savedRange = null;
    let fontSize = 16;
    const dateInput = $("#lhDate");
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    dateInput.value = today();
    $("#lhPlace").value = brand.city_ar || "";
    $("#lhSignature").value = brand.sign || brand.lawyer || "";

    function rememberSelection() {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
      const node = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
      if (node && editor.contains(node)) {
        const computed = window.getComputedStyle(node);
        const points = Math.round(parseFloat(computed.fontSize) * 0.75);
        if (Number.isFinite(points)) fontSize = Math.max(8, Math.min(48, points));
        $("#lhFontSize").value = String(fontSize);
        $("#lhFontSize").textContent = String(fontSize);
        const family = computed.fontFamily.replace(/["']/g, "").split(",")[0].trim();
        if (["Calibri", "Arial", "Tahoma", "Georgia", "Times New Roman"].includes(family)) $("#lhFontFamily").value = family;
      }
    }
    function restoreSelection() {
      editor.focus();
      const selection = window.getSelection();
      if (!selection) return null;
      selection.removeAllRanges();
      if (savedRange && editor.contains(savedRange.commonAncestorContainer)) selection.addRange(savedRange);
      else {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.addRange(range);
      }
      return selection;
    }
    function persistEditorDraft() {
      const richBody = sanitizeEditorHtml(editor.innerHTML);
      $("#lhBody").value = richBody;
      try { localStorage.setItem(draftStorageKey(), richBody); $("#lhDraftMsg").textContent = "تُحفظ مسودة هذا الملف تلقائيًا على هذا الجهاز."; }
      catch (_) { $("#lhDraftMsg").textContent = "تعذر حفظ المسودة تلقائيًا؛ انسخ نصك قبل مغادرة الصفحة."; }
      return richBody;
    }
    function draftStorageKey() { return `${DRAFT_KEY}:${$("#lhCase").value || "general"}`; }
    function restoreEditorDraft() {
      try { editor.innerHTML = sanitizeEditorHtml(localStorage.getItem(draftStorageKey()) || ""); }
      catch (_) { editor.innerHTML = ""; }
      $("#lhBody").value = sanitizeEditorHtml(editor.innerHTML);
    }
    function removeEmptyMarks() {
      editor.querySelectorAll("strong,b,em,i,u,span").forEach(mark => {
        if (!mark.textContent.replace(/\u200B/g, "") && !mark.querySelector("br")) mark.remove();
      });
    }
    function applyInlineStyle(property, value) {
      const selection = restoreSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const span = document.createElement("span");
      span.style.setProperty(property, value);
      if (range.collapsed) {
        span.appendChild(document.createTextNode("\u200B"));
        range.insertNode(span);
        range.setStart(span.firstChild, 1);
        range.collapse(true);
      } else {
        span.appendChild(range.extractContents());
        range.insertNode(span);
        range.selectNodeContents(span);
        removeEmptyMarks();
      }
      selection.removeAllRanges();
      selection.addRange(range);
      rememberSelection();
      persistEditorDraft();
      renderPreview();
    }
    function runCommand(command, value) {
      restoreSelection();
      document.execCommand(command, false, value || null);
      rememberSelection();
      persistEditorDraft();
      renderPreview();
    }
    function toggleMark(tag) {
      const selection = restoreSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        const common = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
        const existing = common && common.closest(tag);
        if (existing && editor.contains(existing)) {
          const startNode = range.startContainer;
          const startOffset = range.startOffset;
          const endNode = range.endContainer;
          const endOffset = range.endOffset;
          existing.replaceWith(...Array.from(existing.childNodes));
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
        } else {
          const mark = document.createElement(tag);
          mark.appendChild(range.extractContents());
          range.insertNode(mark);
          range.selectNodeContents(mark);
        }
      if (!range.collapsed) removeEmptyMarks();
      } else {
        const mark = document.createElement(tag);
        mark.appendChild(document.createTextNode("\u200B"));
        range.insertNode(mark);
        range.setStart(mark.firstChild, 1);
        range.collapse(true);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      rememberSelection();
      persistEditorDraft();
      renderPreview();
    }
    function alignSelection(command) {
      const selection = restoreSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const alignment = { justifyRight: "right", justifyCenter: "center", justifyLeft: "left", justifyFull: "justify" }[command];
      const blocks = Array.from(editor.querySelectorAll("p,div,h1,h2,h3,blockquote,li"));
      let affected = blocks.filter(block => {
        try { return range.collapsed ? block.contains(range.startContainer) : range.intersectsNode(block); }
        catch (_) { return false; }
      });
      if (!affected.length) {
        const paragraph = document.createElement("p");
        while (editor.firstChild) paragraph.appendChild(editor.firstChild);
        editor.appendChild(paragraph);
        affected = [paragraph];
      }
      affected.forEach(block => { block.style.textAlign = alignment; });
      rememberSelection();
      persistEditorDraft();
      renderPreview();
    }
    function adjustFontSize(delta) {
      fontSize = Math.max(8, Math.min(48, fontSize + delta));
      $("#lhFontSize").value = String(fontSize);
      $("#lhFontSize").textContent = String(fontSize);
      applyInlineStyle("font-size", `${fontSize}pt`);
    }
    $("#lhEditorToolbar").addEventListener("mousedown", event => {
      rememberSelection();
      if (event.target.closest("button")) event.preventDefault();
    });
    editor.addEventListener("keyup", rememberSelection);
    editor.addEventListener("mouseup", rememberSelection);
    editor.addEventListener("focus", rememberSelection);
    document.addEventListener("selectionchange", rememberSelection);
    editor.addEventListener("paste", event => {
      event.preventDefault();
      const text = event.clipboardData && event.clipboardData.getData("text/plain");
      if (text) runCommand("insertText", text);
    });

    function setBrandForm(value) {
      brand = { ...DEFAULTS, ...value };
      brandInputs.forEach(input => { input.value = brand[input.dataset.brand] || (input.type === "color" ? DEFAULTS[input.dataset.brand] : ""); });
      logo = brand.logo || "";
      $("#lhLogoPreview").src = logo;
      $("#lhLogoPreview").hidden = !logo;
      $("#lhLogo").value = "";
      $("#lhBrandMsg").textContent = "";
      renderPreview();
    }
    function collectBrand() {
      const value = {};
      brandInputs.forEach(input => { value[input.dataset.brand] = input.value.trim(); });
      value.logo = logo;
      return value;
    }
    function writeMessage(message) { $("#lhBrandMsg").textContent = message; }
    function caseRecords() {
      try {
        const records = JSON.parse(localStorage.getItem("kalam_cases_v1") || "[]");
        return Array.isArray(records) ? records : [];
      } catch (_) { return []; }
    }
    function fillCaseList(selected) {
      const select = $("#lhCase");
      const current = selected === undefined ? select.value : selected;
      select.innerHTML = '<option value="">— دون ملف —</option>';
      caseRecords().filter(item => item && item.id).forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.title || "ملف"}${item.number ? ` · ${item.number}` : ""}${item.court ? ` · ${item.court}` : ""}`;
        select.appendChild(option);
      });
      select.value = current;
    }
    function syncCase() {
      const item = caseRecords().find(row => row.id === $("#lhCase").value);
      if (!item) return;
      $("#lhFileNumber").value = [item.number, item.type].filter(Boolean).join(" · ");
      $("#lhReference").value = item.officeReference || "";
      $("#lhCourt").value = item.court || "";
      $("#lhClient").value = item.parties || "";
      $("#lhOpponent").value = item.opponent || "";
      if (!$("#lhRecipient").value && item.court) $("#lhRecipient").value = `السيد رئيس ${item.court}`;
      renderPreview();
    }
    function fmtDate(iso, french) {
      if (!iso) return "";
      const p = iso.split("-");
      const date = new Date(+p[0], +p[1] - 1, +p[2]);
      try { return new Intl.DateTimeFormat(french ? "fr-FR" : "ar-MA", { year: "numeric", month: "long", day: "numeric" }).format(date); }
      catch (_) { return iso; }
    }
    function renderPreview() {
      const b = collectBrand();
      const model = $("#lhModel").value;
      const fr = model === "f";
      const paper = $("#lhPaper");
      paper.classList.toggle("landscape", model === "h");
      paper.classList.toggle("fr", fr);
      paper.dir = fr ? "ltr" : "rtl";
      paper.style.setProperty("--lh-ink", b.c1 || DEFAULTS.c1);
      paper.style.setProperty("--lh-accent", b.c3 || DEFAULTS.c3);
      paper.style.setProperty("--lh-frame", b.c2 || DEFAULTS.c2);
      $("#lhPaperNumber").closest(".lh-ref").style.borderColor = b.c2 || DEFAULTS.c2;
      $("#lhPaperFirm").closest(".lh-foot").style.borderTopColor = b.c2 || DEFAULTS.c2;
      rootEl.querySelectorAll("[data-preview]").forEach(el => { el.textContent = b[el.dataset.preview] || ""; });
      $("#lhPaperLogo").src = b.logo || "";
      $("#lhPaperLogo").hidden = !b.logo;
      const selectedDate = $("#lhDateMode").value === "today" ? today() : $("#lhDateMode").value === "pick" ? dateInput.value : "";
      $("#lhDateWrap").hidden = $("#lhDateMode").value !== "pick";
      const place = $("#lhShowPlace").checked ? $("#lhPlace").value.trim() : "";
      const date = fmtDate(selectedDate, fr);
      $(".lh-place-date").hidden = !place && !date;
      $("#lhPaperPlace").textContent = place;
      $("#lhPaperDate").textContent = date ? `${place ? (fr ? "le :" : "في:") : ""} ${date}`.trim() : "";
      const fileNumber = $("#lhFileNumber").value.trim();
      const officeReference = $("#lhReference").value.trim();
      $("#lhPaperNumber").textContent = fileNumber ? `${fr ? "Dossier" : "الملف"}: ${fileNumber}` : "";
      $("#lhPaperOurRef").textContent = officeReference ? `${fr ? "Réf." : "مرجع المكتب"}: ${officeReference}` : "";
      $("#lhPaperNumber").closest(".lh-ref").hidden = !fileNumber && !officeReference;
      const court = $("#lhCourt").value.trim();
      $("#lhPaperCourt").textContent = court ? `${fr ? "Juridiction" : "المحكمة"}: ${court}` : "";
      $("#lhPaperCourt").hidden = !court;
      const hearingDate = $("#lhHearingDate").value ? fmtDate($("#lhHearingDate").value, fr) : "";
      const session = $("#lhSession").value.trim();
      $("#lhPaperHearing").textContent = [hearingDate && `${fr ? "Audience" : "الجلسة"}: ${hearingDate}`, session && `${fr ? "Salle / horaire" : "القاعة / التوقيت"}: ${session}`].filter(Boolean).join(" · ");
      $("#lhPaperHearing").hidden = !hearingDate && !session;
      const recipient = $("#lhRecipient").value.trim();
      $("#lhPaperRecipient").textContent = [$("#lhAddressing").value, recipient].filter(Boolean).join("\n");
      $("#lhPaperRecipient").hidden = !recipient;
      $("#lhPaperType").textContent = $("#lhType").value.trim();
      const client = $("#lhClient").value.trim();
      const opponent = $("#lhOpponent").value.trim();
      $("#lhPaperParties").textContent = [client && `${fr ? "Pour" : "لفائدة"}: ${client}`, opponent && `${fr ? "Contre" : "ضد"}: ${opponent}`].filter(Boolean).join("\n");
      $("#lhPaperParties").hidden = !client && !opponent;
      const richBody = sanitizeEditorHtml(editor.innerHTML).trim();
      $("#lhBody").value = richBody;
      $("#lhPaperBody").innerHTML = richBody;
      $("#lhPaperBody").hidden = !richBody;
      const attachments = $("#lhAttachments").value.trim();
      $("#lhPaperAttachments").textContent = attachments ? `${fr ? "Pièces jointes" : "المرفقات"}:\n${attachments}` : "";
      $("#lhPaperAttachments").hidden = !attachments;
      $("#lhPaperSign").textContent = $("#lhSignature").value.trim();
      $("#lhPaperSign").hidden = !$("#lhPaperSign").textContent;
      $("#lhPaperFirm").textContent = fr ? b.firm_fr || b.firm : b.firm;
      $("#lhPaperAddress").textContent = [fr ? b.addr_fr : b.addr_ar, fr ? b.city_fr : b.city_ar].filter(Boolean).join(" · ");
      $("#lhPaperContact").textContent = [b.tel, b.email].filter(Boolean).join(" · ");
      $("#lhPaperPro").textContent = [fr ? b.title_fr : b.title_ar, fr ? b.bar_fr : b.bar_ar, b.pro].filter(Boolean).join(" · ");
    }
    function download(name, content, type) {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function saveBrand() {
      const identity = collectBrand();
      if (identity.email && !/^\S+@\S+\.\S+$/.test(identity.email)) { writeMessage("تحقق من صيغة البريد الإلكتروني."); return; }
      try { localStorage.setItem(KEY, JSON.stringify({ app: "kalam-letterhead", version: 1, updatedAt: new Date().toISOString(), identity })); brand = identity; writeMessage("حُفظت هوية المكتب على هذا الجهاز."); }
      catch (_) { writeMessage("تعذر الحفظ المحلي. تحقق من مساحة التخزين قبل المحاولة."); }
      renderPreview();
    }
    function normalizeImported(data) {
      if (data && data.app === "kalam-letterhead" && data.version === 1 && data.identity) return data.identity;
      if (data && data.app === "malafati-brand" && data.d) return data.d;
      throw new Error("invalid");
    }
    rootEl.addEventListener("input", event => {
      if (event.target === editor) {
        persistEditorDraft();
        rememberSelection();
        renderPreview();
        return;
      }
      if (event.target.matches("[data-brand]")) brand[event.target.dataset.brand] = event.target.value;
      if (event.target.id === "lhLogo") {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) { writeMessage("اختر صورة شعار أصغر من 4 ميغابايت."); event.target.value = ""; return; }
        const reader = new FileReader();
        reader.onload = () => { logo = String(reader.result); $("#lhLogoPreview").src = logo; $("#lhLogoPreview").hidden = false; renderPreview(); writeMessage("تم تحميل الشعار للمعاينة؛ اضغط حفظ الهوية لاعتماده."); };
        reader.readAsDataURL(file);
      }
      if (event.target.id.startsWith("lh")) renderPreview();
    });
    rootEl.addEventListener("change", event => {
      if (event.target.id === "lhCase") { restoreEditorDraft(); syncCase(); }
      if (event.target.id === "lhImport") {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        file.text().then(text => { const imported = normalizeImported(JSON.parse(text)); const next = {}; FIELDS.forEach(([key]) => { next[key] = imported[key] || ""; }); ["c1", "c2", "c3", "logo"].forEach(key => { next[key] = imported[key] || DEFAULTS[key]; }); setBrandForm(next); writeMessage("قُرئت الهوية. راجع الحقول ثم اضغط حفظ الهوية."); }).catch(() => writeMessage("تعذر قراءة الملف؛ اختر ملف هوية Kalam أو malafati-brand صالحًا."));
        event.target.value = "";
      }
      if (event.target.id === "lhFontFamily") applyInlineStyle("font-family", event.target.value);
      if (event.target.id === "lhBlockStyle") runCommand("formatBlock", event.target.value);
      if (event.target.id === "lhTextColor") applyInlineStyle("color", event.target.value);
      if (event.target.id === "lhHighlightColor") applyInlineStyle("background-color", event.target.value);
      renderPreview();
    });
    rootEl.addEventListener("click", event => {
      const command = event.target.closest("[data-command]");
      if (command) {
        const name = command.dataset.command;
        if (name === "bold") toggleMark("strong");
        else if (name === "italic") toggleMark("em");
        else if (name === "underline") toggleMark("u");
        else if (name.startsWith("justify")) alignSelection(name);
        command.setAttribute("aria-pressed", String(document.queryCommandState(name)));
        return;
      }
      const button = event.target.closest("[data-action]"); if (!button) return;
      if (button.dataset.action === "save-brand") saveBrand();
      if (button.dataset.action === "export-brand") download("kalam-letterhead.json", JSON.stringify({ app: "kalam-letterhead", version: 1, exportedAt: new Date().toISOString(), identity: collectBrand() }, null, 2), "application/json");
      if (button.dataset.action === "reset-brand") {
        if (!window.confirm("ستُستبدل الهوية الحالية ببيانات رأسية المكتب المرجعية. هل تريد المتابعة؟")) return;
        setBrandForm(DEFAULTS); saveBrand();
      }
      if (button.dataset.action === "preview") renderPreview();
      if (button.dataset.action === "print") { renderPreview(); window.print(); }
      if (button.dataset.action === "size-down") adjustFontSize(-1);
      if (button.dataset.action === "size-up") adjustFontSize(1);
    });
    rootEl.querySelectorAll("input,select,textarea").forEach(input => input.addEventListener("input", renderPreview));
    setBrandForm(brand);
    fillCaseList(new URLSearchParams(location.search).get("case") || "");
    restoreEditorDraft();
    renderPreview();
  }

  root.KalamLetterhead = Object.freeze({ template, init, storageKey: KEY, draftStorageKey: DRAFT_KEY, sanitizeEditorHtml });
})(window);
