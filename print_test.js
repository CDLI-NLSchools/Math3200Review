/* Print-format tests for the 3200 app, revised for the practice sheet / exam
   package (Nov 6, 2026): one sheet button driven by Multiple choice and
   No choices counts plus an answer-key checkbox (the worksheet predicate and
   worksheet button are gone); Copy for Word and Copy for Google Docs on both
   sheet and exam views; an Edit control on the exam view; Extra space at the
   2.3 factor driving sheet and Section B box heights. Pre-existing coverage
   kept: exam composition against the PEP blueprint (SR 27 at 10/15/2, CR 23
   with Level 3 at exactly 7, so the paper totals 10/31/9 by level), unit
   tests, the thin Unit 3 fallback, UI wiring, and the rendered output of
   both print modes. */
const fs = require("fs"), vm = require("vm");
const html = fs.readFileSync("/home/hatch/workspace/math-3200-review/index.html", "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const els = {}, listeners = {};
function makeEl(id) {
  return { id, value: "", textContent: "", innerHTML: "", hidden: false, open: false, disabled: false,
    dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(t, fn) { (listeners[id] = listeners[id] || {})[t] = fn; },
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    scrollIntoView() {}, focus() {}, appendChild() {}, removeChild() {} };
}
function parseChks(htmlStr, cls) {
  if (!htmlStr) return [];
  const out = [];
  const re = new RegExp('<input[^>]*class="' + cls + '"[^>]*>', 'g');
  let m; while ((m = re.exec(htmlStr))) {
    const tag = m[0];
    const val = (tag.match(/value="([^"]*)"/) || [])[1];
    out.push({ value: val, checked: / checked/.test(tag), addEventListener() {} });
  }
  return out;
}
const documentStub = {
  getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
  querySelectorAll(sel) {
    if (sel === ".unitChk") return parseChks(els.unitGrid && els.unitGrid.innerHTML, "unitChk");
    if (sel === ".unitChk:checked") return parseChks(els.unitGrid && els.unitGrid.innerHTML, "unitChk").filter(c => c.checked);
    if (sel === ".indChk") return parseChks(els.indBox && els.indBox.innerHTML, "indChk");
    if (sel === ".indChk:checked") return parseChks(els.indBox && els.indBox.innerHTML, "indChk").filter(c => c.checked);
    return [];
  }, querySelector() { return null; },
  createElement() { return makeEl("anon"); },
  createTreeWalker() { return { nextNode() { return null; } }; },
  body: makeEl("body") };
const sandbox = { console, URLSearchParams, document: documentStub,
  location: { search: "", pathname: "/index.html", origin: "http://test", href: "http://test/index.html" },
  history: { replaceState() {} }, navigator: {}, window: {}, setTimeout, clearTimeout, print() {}, NodeFilter: { SHOW_TEXT: 4 } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
blocks.forEach((b, i) => vm.runInContext(b, sandbox, { filename: "block" + i }));
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const S = sandbox;
const el = id => documentStub.getElementById(id);

// 1. type pools and the old worksheet path: every entry probes to exactly one
//    of mc or no-choices; the worksheet predicate and button are gone
const mcN = S.BANK.filter(e => S.probeType(e) === "mc").length;
const ncN = S.BANK.filter(e => S.probeType(e) !== "mc").length;
ok(mcN > 0 && ncN > 0 && mcN + ncN === 140, "type split " + mcN + "/" + ncN + " of 140");
ok(typeof S.worksheetPred === "undefined", "worksheetPred still defined");
ok(typeof S.drawSheetSet === "function", "drawSheetSet missing");
ok(typeof S.wsBox === "function", "wsBox missing");
ok(!html.includes("goWorksheet") && !html.includes("Make a worksheet"), "worksheet button survives in the page");
ok(Object.keys(S.CR_MARKS).length === 115, "CR_MARKS has 115 entries, saw " + Object.keys(S.CR_MARKS).length);
ok(Object.keys(S.CR_MARKS).every(id => S.BANK.some(e => e.id === id)), "a CR_MARKS id is not in the bank");
// 2. sheet draw, direct: exact type counts on the generated questions
//    themselves (mixed-type entries are re-drawn until they fit their part)
const d = S.drawSheetSet({ units: [1, 2, 3, 4, 5], inds: [], midCap: false, mcCount: 4, ncCount: 6, mix: [20, 62, 18], order: "unit" });
ok(d.items.length === 10, "drawSheetSet served " + d.items.length);
ok(d.items.filter(q => q.type === "mc").length === 4, "drawSheetSet mc count " + d.items.filter(q => q.type === "mc").length);
ok(d.items.filter(q => q.type !== "mc").length === 6, "drawSheetSet no-choices count " + d.items.filter(q => q.type !== "mc").length);
const d0 = S.drawSheetSet({ units: [1, 2, 3, 4, 5], inds: [], midCap: false, mcCount: 0, ncCount: 3, mix: [20, 62, 18], order: "unit" });
ok(d0.items.length === 3 && d0.items.every(q => q.type !== "mc"), "zero MC count did not give an all no-choices sheet");
// 3. full exam composition, mid scope
const ex = S.composeExam([1, 2, 3, 4, 5], []);
ok(ex && ex.srItems.length === 27, "exam SR count " + (ex && ex.srItems.length));
const src = { 1: 0, 2: 0, 3: 0 }; ex.srItems.forEach(it => src[it.q._entry.level]++);
ok(src[1] === 10 && src[2] === 15 && src[3] === 2, "exam SR level split " + JSON.stringify(src));
ok(ex.crMarks === 23, "exam CR marks " + ex.crMarks);
ok(ex.l3Marks === 7, "exam CR Level 3 marks " + ex.l3Marks);
ok(ex.total === 50, "exam total " + ex.total);
ok(ex.crItems.every(it => S.CR_MARKS[it.q._entry.id] === it.marks && it.q._entry.level >= 2), "a CR item is untagged or below Level 2");
ok(ex.srItems.every(it => it.q.type === "mc"), "an SR item is not multiple choice");
const canons = new Set(); let dup = false;
ex.srItems.concat(ex.crItems).forEach(it => { const c = S.canonQ(it.q); if (canons.has(c)) dup = true; canons.add(c); });
ok(!dup, "duplicate question inside one exam");
// 4. unit test composition
const ut = S.composeExam([7], []);
ok(ut && ut.total === 25 && ut.srMarks === 11 && ut.crMarks === 14 && ut.short === false, "unit test totals " + (ut && ut.total + "/" + ut.srMarks + "/" + ut.crMarks));
// 5. final-scope exam composition
const exF = S.composeExam([6, 7, 8, 9], []);
ok(exF && exF.total === 50 && exF.srItems.length === 27 && exF.crMarks === 23, "final exam totals " + (exF && exF.total + "/" + exF.srItems.length + "/" + exF.crMarks));
const srcF = { 1: 0, 2: 0, 3: 0 }; if (exF) exF.srItems.forEach(it => srcF[it.q._entry.level]++);
ok(srcF[1] === 10 && srcF[2] === 15 && srcF[3] === 2, "final exam SR level split " + JSON.stringify(srcF));
ok(exF && exF.l3Marks === 7, "final exam CR Level 3 marks " + (exF && exF.l3Marks));
const ut8 = S.composeExam([8], []);
ok(ut8 && ut8.total === 25 && ut8.srMarks === 11 && ut8.crMarks === 14 && ut8.short === false, "unit 8 test totals " + (ut8 && ut8.total + "/" + ut8.srMarks + "/" + ut8.crMarks));
// 5b. thin-unit fallback: a Unit 3 test still builds a Section B and flags short
const ut3 = S.composeExam([3], []);
ok(ut3 && ut3.crItems.length > 0 && ut3.short === true && ut3.crMarks === 9, "Unit 3 test should fall back to its full 9-mark Section B pool, flagged short");
// 6. sheet UI path: two typed draws through the real button, exact counts in
//    the rendered sheet, key present when checked and absent when not
el("countIn").value = "10"; el("lv1").value = "20"; el("lv2").value = "60"; el("lv3").value = "20";
el("wsIn").value = "1"; el("orderIn").value = "unit"; el("chkIn").value = "each";
el("mcCountIn").value = "4"; el("ncCountIn").value = "6"; el("keyChk").checked = true;
(listeners.presetMid || {}).click && listeners.presetMid.click();
let calls = []; const origDraw = S.drawSet;
S.drawSet = function (u, i, n, m, o, c, pr) { calls.push({ n, pred: typeof pr }); return origDraw(u, i, n, m, o, c, pr); };
(listeners.goSheet || {}).click && listeners.goSheet.click();
S.drawSet = origDraw;
ok(calls.length === 2 && calls[0].n === 4 && calls[1].n === 6 && calls.every(x => x.pred === "function"), "sheet UI path did not make two typed draws, saw " + JSON.stringify(calls));
const paperOf = () => els.printArea.innerHTML.split('<div class="keybreak">')[0];
ok(paperOf().includes("Math 3200: Practice Sheet"), "sheet title missing");
ok(!/worksheet/i.test(els.printArea.innerHTML) && !/worksheet/i.test(els.session.innerHTML), "worksheet wording survives in the sheet view");
ok(els.session.innerHTML.includes("Copy for Word") && els.session.innerHTML.includes("Copy for Google Docs"), "sheet view lacks the split copy buttons");
ok(els.session.innerHTML.includes("Edit the sheet"), "sheet view lacks the Edit control");
for (let t = 0; t < 10; t++) {
  (listeners.goSheet || {}).click && listeners.goSheet.click();
  const paper = paperOf();
  ok((paper.match(/class="pq"/g) || []).length === 10, "sheet question count " + (paper.match(/class="pq"/g) || []).length);
  ok((paper.match(/class="opts"/g) || []).length === 4, "sheet option groups " + (paper.match(/class="opts"/g) || []).length);
  ok(els.printArea.innerHTML.includes("Answer Key"), "answer key missing with the checkbox on");
  if (fails.length) break;
}
el("keyChk").checked = false;
(listeners.goSheet || {}).click && listeners.goSheet.click();
ok(!els.printArea.innerHTML.includes("Answer Key"), "answer key printed with the checkbox off");
ok((paperOf().match(/class="pq"/g) || []).length === 10, "key-off sheet question count");
el("keyChk").checked = true;
el("mcCountIn").value = "0"; el("ncCountIn").value = "0";
(listeners.goSheet || {}).click && listeners.goSheet.click();
ok(els.session.innerHTML.includes("Set the Multiple choice and No choices counts"), "zero-count sheet did not explain itself");
el("mcCountIn").value = "4"; el("ncCountIn").value = "6";
// 7. rendered exam: split print buttons and blueprint text, plus the new
//    Edit and copy controls
(listeners.goExam || {}).click && listeners.goExam.click();
ok(els.printArea.innerHTML.includes("Section A: Selected Response (27 marks)"), "exam Section A header");
ok(els.printArea.innerHTML.includes("Section B: Constructed Response (23 marks)"), "exam Section B header");
ok(els.printArea.innerHTML.includes("Total marks: 50"), "exam total line");
ok(els.printArea.innerHTML.includes("Answer record"), "paper answer record heading missing");
ok(els.printArea.innerHTML.includes('class="recGrid"'), "paper record grid missing");
ok((els.printArea.innerHTML.match(/class="lt"/g) || []).length === 27 * 4, "paper record grid should hold 27x4 letters, saw " + (els.printArea.innerHTML.match(/class="lt"/g) || []).length);
ok(els.printArea.innerHTML.includes("<b>A.</b>"), "Section A options are not lettered on the paper");
ok(els.session.innerHTML.includes("Print the exam paper") && els.session.innerHTML.includes("Print the answer key"), "split print buttons");
ok(els.session.innerHTML.includes("Edit the exam"), "exam view lacks the Edit control");
ok(els.session.innerHTML.includes("Copy for Word") && els.session.innerHTML.includes("Copy for Google Docs"), "exam view lacks the split copy buttons");
(listeners.printKeyBtn || {}).click && listeners.printKeyBtn.click();
ok(els.printArea.innerHTML.includes("Answer Key"), "key print does not swap printArea to the key");
ok(els.printArea.innerHTML.includes('class="recGrid"'), "key answer grid missing");
ok((els.printArea.innerHTML.match(/class="lt rk"/g) || []).length === 27, "key grid should mark exactly 27 correct letters, saw " + (els.printArea.innerHTML.match(/class="lt rk"/g) || []).length);
ok(els.printArea.innerHTML.includes("Appendix: Section A worked solutions"), "key appendix heading missing");
ok(els.printArea.innerHTML.includes('class="solAppendix"'), "key appendix container missing");
// 8. Extra space preset: listed first, at 2.3; box heights follow it
const wsIx = html.indexOf('<option value="2.3">Extra space</option>');
const fullIx = html.indexOf('<option value="1">Full space</option>');
ok(wsIx > 0 && wsIx < fullIx, "Extra space option missing or not first in the space list");
ok(S.wsBox(150).includes('height:150px') && S.wsBox(150).includes("wshandle"), "wsBox markup");
ok(S.wsBox(0) === "" && S.wsBox(345).includes("height:345px"), "wsBox zero and Extra heights");
el("wsIn").value = "2.3";
(listeners.goExam || {}).click && listeners.goExam.click();
const secB = els.printArea.innerHTML.split("Section B: Constructed Response")[1] || "";
const bHeights = [...secB.matchAll(/class="ws wsbox" style="height:(\d+)px"/g)].map(m => +m[1]);
ok(bHeights.length >= 3, "Section B box count " + bHeights.length);
bHeights.forEach(h => { const m = Math.round(h / (62 * 2.3)); ok(Math.max(80, Math.round(m * 62 * 2.3)) === h, "Section B box height " + h + " does not follow marks x 62 x 2.3"); });
(listeners.goSheet || {}).click && listeners.goSheet.click();
const sHeights = [...paperOf().matchAll(/class="ws wsbox" style="height:(\d+)px"/g)].map(m => +m[1]);
ok(sHeights.length === 10, "sheet box count at Extra space " + sHeights.length);
ok(sHeights.every(h => [276, 345, 391].includes(h)), "sheet box heights at Extra space: " + sHeights.join(","));
ok(sHeights.includes(345), "no 345px box (the Extra-space no-choices height) on the sheet");
el("wsIn").value = "1";
console.log(fails.length ? "PRINT TEST FAIL: " + fails.join(" | ") : "PRINT TEST PASS: sheet draws exactly 4 MC + 6 no-choices with the key on and none with it off; mid and final exams compose to 50 (SR 27 at 10/15/2, CR 23 with Level 3 at 7, paper levels 10/31/9); unit tests compose to 25 on deep units and fall back flagged on thin ones; paper carries the answer record grid and the key mirrors it with 27 marked letters plus the compact solutions appendix; Extra space at 2.3 drives sheet boxes (276/345/391) and Section B boxes (marks x 62 x 2.3)");
process.exit(fails.length ? 1 : 0);
