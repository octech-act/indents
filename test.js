// Page-count check: renders both forms in Node with stubbed DOM and asserts the layout.
// Run: npm install && npm test
const { jsPDF } = require("jspdf"); require("jspdf-autotable");
const fs = require("fs"), assert = require("assert");

const els = {};
const el = id => els[id] ||= { value: "", handlers: {}, addEventListener(t, f) { this.handlers[t] = f; },
  insertAdjacentHTML() {}, lastElementChild: { remove() {} } };
global.document = { getElementById: el, createElement: () => ({}) };
global.Image = class { set src(_) { this.onerror(); } };
global.FormData = class { get(k) { return k === "f1" || k === "s2_1" ? "Dr Test" : ""; } };
global.window = { jspdf: { jsPDF } };
let doc;
jsPDF.API.save = function () { doc = this; };

const forms = new Function(fs.readFileSync(__dirname + "/script.js", "utf8") + "; return forms;")();
const pages = async id => { await forms[id].handlers.submit({ preventDefault() {}, target: {} }); return doc.internal.getNumberOfPages(); };

(async () => {
  assert.strictEqual(await pages("sp02"), 1, "SP02 must fit on one page");
  assert.strictEqual(await pages("sp01"), 4, "SP01 should be 4 pages");
  console.log("ok");
})().catch(e => { console.error(e.message); process.exit(1); });
