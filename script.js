// SP01 / SP02 Purchase Indents -> PDF (runs fully in the browser with jsPDF + autoTable)

const L = 20, R = 190, W = R - L;
const box = on => (on ? "[X]" : "[  ]");
const val = (fd, k) => (fd.get(k) || "").toString().trim();

/* =============================================================== UI */
const picker = document.getElementById("formType");
const forms = { sp01: document.getElementById("sp01"), sp02: document.getElementById("sp02") };
picker.addEventListener("change", () => {
  Object.entries(forms).forEach(([k, f]) => (f.hidden = k !== picker.value));
});

// SP01: infrastructure checklist
const INFRA = ["Power", "Water", "Sound Resistance", "Illumination", "Radiation",
               "Gas", "Temperature", "AC System", "Dust", "Others (Specify)"];
const infraBox = document.getElementById("infra");
INFRA.forEach((name, i) => {
  infraBox.insertAdjacentHTML("beforeend",
    `<label><input type="checkbox" name="infra_${i}"> ${name}</label>
     <input type="text" name="infra_${i}_val" placeholder="Details">`);
});

// SP01: auto-total
const cost = document.getElementById("cost"), tax = document.getElementById("tax"), total = document.getElementById("total");
function updateTotal() {
  const c = parseFloat(cost.value), t = parseFloat(tax.value);
  if (!isNaN(c) || !isNaN(t)) total.value = (isNaN(c) ? 0 : c) + (isNaN(t) ? 0 : t);
}
cost.addEventListener("input", updateTotal);
tax.addEventListener("input", updateTotal);

// SP02: item rows
const itemsBox = document.getElementById("items2");
let itemCount = 0;
function addItemRow() {
  const i = itemCount++;
  itemsBox.insertAdjacentHTML("beforeend",
    `<input type="text" name="item_${i}" data-row="${i}">
     <input type="text" name="qty_${i}" data-row="${i}">
     <input type="text" name="amt_${i}" data-row="${i}">`);
}
function removeItemRow() {
  if (itemCount <= 1) return;
  itemCount--;
  for (let k = 0; k < 3; k++) itemsBox.lastElementChild.remove();
}
for (let i = 0; i < 5; i++) addItemRow();
document.getElementById("addItem").addEventListener("click", addItemRow);
document.getElementById("removeItem").addEventListener("click", removeItemRow);

/* =============================================================== PDF helpers */
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      resolve({ data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function drawHeader(doc, formName) {
  const logo = await loadImage("iitj_logo.png");
  if (logo) {
    const w = 18, h = w * (logo.h / logo.w);
    doc.addImage(logo.data, "PNG", L, 11, w, h);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text("Indian Institute of Technology Jodhpur", R, 17, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("Office of Stores and Purchase", R, 24, { align: "right" });
  doc.setFont("helvetica", "italic"); doc.setFontSize(9);
  doc.text("Form: " + formName, R, 29, { align: "right" });
}

function addPageNumbers(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(String(i), pageW / 2, 289, { align: "center" });
  }
}

// Static "for the use of ..." box: no inputs, printed as on the original form
function officeBox(doc, ctx, title, qs, signL, signR) {
  const pageW = doc.internal.pageSize.getWidth();
  const est = 14 + qs.length * 9 + 22;
  if (ctx.y + est > 280) { doc.addPage(); ctx.y = 20; }
  doc.autoTable({
    startY: ctx.y,
    margin: { left: L, right: pageW - R },
    theme: "grid",
    styles: { font: "times", fontSize: 10, cellPadding: 1.6, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: 0 },
    head: [[{ content: title, colSpan: 2, styles: { halign: "center", fillColor: [255, 255, 153], textColor: 0, fontStyle: "normal" } }]],
    body: [
      ...qs.map(q => [q[0], { content: q[1], styles: { halign: "center" } }]),
      [{ content: "", colSpan: 2, styles: { minCellHeight: 17 } }]
    ],
    columnStyles: { 0: { cellWidth: W - 28 }, 1: { cellWidth: 28 } },
    rowPageBreak: "avoid",
    didDrawCell: d => {
      if (d.section === "body" && d.row.index === qs.length && d.column.index === 0) {
        doc.setFont("times", "bold"); doc.setFontSize(10);
        doc.text(signL, d.cell.x + 2, d.cell.y + d.cell.height - 2);
        doc.text(signR, d.cell.x + d.cell.width - 2, d.cell.y + d.cell.height - 2, { align: "right" });
      }
    }
  });
  ctx.y = doc.lastAutoTable.finalY + 8;
}

const ACCOUNTS_SP01 = [
  ["1. Are all the questions answered by the Head/Professor-in-Charge?", "YES / NO"],
  ["2. Have the hard copies of the relevant documents, if any, been submitted?", "YES / NO"],
  ["3. Are funds available in the budget head suggested?", "YES / NO"]
];
const ACCOUNTS_SP02 = [
  ["1. Is the Unique Approval Number provided by the Department?", "YES / NO"],
  ["2. Is the Prior Administrative Approval valid for the current FY?", "YES / NO"],
  ["3. Are funds available in the budget head suggested?", "YES / NO"]
];
const INFRA_QS = [
  ["1. Is the space sought for the new equipment available? If YES, has it been marked on the building plan?", "YES / NO"],
  ["2. Are the changes in the existing infrastructure feasible without affecting the Master Plan of the Permanent Campus of the Institute?", "YES / NO"],
  ["3. Is it possible to provide the special infrastructure requirements as sought for housing the proposed equipment?", ""],
  ["4. Can the equipment be installed in the requested floor without affecting the structural safety of the building, and without reducing the functional efficiency of the space and the rest of the building?", ""]
];

/* =============================================================== SP01 */
forms.sp01.addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(e.target), v = k => val(fd, k);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  await drawHeader(doc, "SP01");
  doc.setFont("times", "bold"); doc.setFontSize(13);
  doc.text("Purchase Indent for NON-CONSUMABLE ITEMS from Institute Grant", L, 44);
  doc.setFont("times", "italic"); doc.setFontSize(10);
  doc.text("(Use a separate sheet for each of the new Equipments)", L, 50);
  doc.text("Request Number: IITJ/NC/" + (v("request_no") || "____"), L, 58);

  const rows = [];
  const item = (n, q, a) => {
    rows.push([{ content: String(n), rowSpan: 2, styles: { halign: "center", fontStyle: "bold" } },
               { content: q, styles: { fontStyle: "bold" } }]);
    rows.push([{ content: a || " ", styles: { minCellHeight: 10 } }]);
  };

  const modes = ["Direct Purchase", "Limited Tender", "Open Tender", "Global Tender", "Rate Contract", "Repeat Order", "Other"];
  const modeTxt = modes.map(m => `${box(v("f7") === m)} ${m === "Other" ? "Other (Specify)" : m}`).join("    ")
                  + (v("f7_other") ? `\nOther: ${v("f7_other")}` : "");
  const money = k => (v(k) ? "Rs. " + v(k) : "");
  const costTxt = `Cost of Equipment : ${money("f8_cost")}\nCost of ALL Taxes : ${money("f8_tax")}\nTOTAL COST : ${money("f8_total")}`;
  const types = ["Teaching Only", "Research Only", "Teaching and Research", "Others"];
  const justTxt = types.map(t => `${box(v("f15_type") === t)} ${t}${t === "Others" ? " (Specify)" : ""}`).join("    ")
    + `\n\nCourse Number(s): ${v("f15_course")}`
    + `\n\nFaculty Members who will use it, and their signatures:\n${v("f15_faculty")}`
    + `\n\nFaculty Members of the Other Departments who will use it, and their signatures:\n${v("f15_other_faculty")}`
    + `\n\nOthers (Specify): ${v("f15_others")}`;
  const infraTxt = INFRA.map((n, i) => `${box(fd.get("infra_" + i) !== null)} ${n}: ${v("infra_" + i + "_val")}`).join("\n");

  item(1, "Name of Indenter", v("f1"));
  item(2, "Personal File Number of Indenter", v("f2"));
  item(3, "Name of Department", v("f3"));
  item(4, "Name of the Equipment requested", v("f4"));
  item(5, "How many (number) of the said equipment are required to be purchased", v("f5"));
  item(6, "In how much time (Weeks) is the equipment needed?", v("f6"));
  item(7, "Proposed Mode of Purchase", modeTxt);
  item(8, "Estimated Cost (Approximate) (Rs.) of the Equipment, including delivery of the Equipment at site", costTxt);
  item(9, "What is the Annual Running Cost (Rs.), EXCLUDING Taxes?", v("f9"));
  item(10, "What is the Annual Maintenance Cost (Rs.), EXCLUDING Taxes?", v("f10"));
  item(11, "What is Budget Head under which this is being booked?", v("f11"));
  item(12, "What the expected warranty period of the Equipment?", v("f12"));
  item(13, "Is the equipment already available in the Institute, even if of a lower specification? If YES, can that equipment be used instead?", v("f13a"));
  item(13, "If the cost of the Equipment is more than Rs. 50 Lakhs, does any other IIT or IISER have this facility? If yes, please provide the feedback on its functioning and usefulness?", v("f13b"));
  item(14, "Technical Specifications of the Equipment (use only generic technical statements, without any bias towards any specific product or vendor)", v("f14"));
  item(15, "Justification for the purchase of the Equipment requested", justTxt);
  item(16, "What is the expected useful life (in years) of the equipment? How quickly will this equipment become obsolete?", v("f16"));
  item(17, "What are the Spare Parts and ancillary items needed? Is the cost of the Spare Parts and ancillary items included in Response at (11) above?", v("f17"));
  item(18, "Space Required to house the Equipment",
       `Area: ${v("f18_area")}\nLocation: ${v("f18_loc")}\nAlterations: ${v("f18_alt")}\n(ATTACH a Drawing of the Layout at the proposed location of the Equipment.)`);
  item(19, "Basic Details of the Equipment",
       `Dimensions: ${v("f19_dim")}\nWeight: ${v("f19_wt")}\nVibration: ${v("f19_vib")}\n(Indicate level of vibrations along with range of operational frequencies)`);
  item(20, "What are the special infrastructure requirements for this equipment?", infraTxt);

  doc.autoTable({
    startY: 64,
    head: [["S.No.", "Information Sought"]],
    body: rows,
    theme: "grid",
    margin: { left: L, right: pageW - R, bottom: 20 },
    styles: { font: "times", fontSize: 10, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: 0, valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "italic", halign: "left" },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: W - 14 } },
    rowPageBreak: "avoid"
  });

  const ctx = { y: doc.lastAutoTable.finalY + 10 };
  if (ctx.y + 20 > 280) { doc.addPage(); ctx.y = 20; }
  doc.setFont("times", "bold"); doc.setFontSize(10);
  doc.text("Head/Professor In-charge", R, ctx.y, { align: "right" });
  doc.text("Office of Students", R, ctx.y + 5, { align: "right" });
  ctx.y += 12;

  officeBox(doc, ctx, "For the use of Office of Accounts only", ACCOUNTS_SP01,
            "Dealing Assistant (Accounts)", "Superintendent (Accounts)");
  officeBox(doc, ctx, "For the use of Office of Infrastructure Engineering only", INFRA_QS,
            "Dealing Assistant (Accounts)", "Executive Engineer (Civil)");

  if (ctx.y + 40 > 285) { doc.addPage(); ctx.y = 20; }
  doc.setFont("times", "italic"); doc.setFontSize(11);
  doc.text("Approval of Competent Financial Authority", pageW / 2, ctx.y + 6, { align: "center" });
  doc.setFont("times", "bold"); doc.setFontSize(10);
  doc.text("Dean (Student Affairs)", R, ctx.y + 28, { align: "right" });

  addPageNumbers(doc);
  doc.save("SP01_Purchase_Indent.pdf");
});

/* =============================================================== SP02 */
forms.sp02.addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(e.target), v = k => val(fd, k);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  await drawHeader(doc, "SP02");
  doc.setFont("times", "bold"); doc.setFontSize(13);
  doc.text("Purchase Indent for CONSUMABLE ITEMS from Institute Grant", L, 42);
  doc.setFont("times", "italic"); doc.setFontSize(10);
  doc.text("(Consumable Items to be bought for purposes other than for Research)", L, 48);
  doc.text(`Unique Number: IITJ/C/${v("uniq1") || "____"}/${v("uniq2") || "_____"}`, L, 56);

  // Budget Head: plain bold text, right-aligned (no box)
  doc.setFont("times", "bold"); doc.setFontSize(11);
  doc.text("Budget Head: " + v("s2_bh_top"), R, 63, { align: "right" });
  doc.text("Academic, Career & Technology Council", R, 69, { align: "right" });

  // Collect item rows (at least 5 shown)
  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const it = v("item_" + i), q = v("qty_" + i), a = v("amt_" + i);
    items.push([it, q, a]);
  }
  while (items.length < 5) items.push(["", "", ""]);
  // drop trailing fully-empty rows beyond 5
  while (items.length > 5 && items[items.length - 1].every(x => !x)) items.pop();

  const span3 = (content, extra) => ({ content, colSpan: 3, styles: Object.assign({ minCellHeight: 7 }, extra || {}) });
  const body = [
    [{ content: "S.No.", styles: { halign: "center", fontStyle: "italic" } },
     { content: "Details", styles: { fontStyle: "italic" } }, span3("")],
    [{ content: "1", styles: { halign: "center" } }, "Name of Indenter", span3(v("s2_1"))],
    [{ content: "2", styles: { halign: "center" } }, "Personal File Number", span3(v("s2_2"))],
    [{ content: "3", styles: { halign: "center" } }, "Name of Department", span3(v("s2_3"))],
    [{ content: "", rowSpan: items.length + 1 }, { content: "", rowSpan: items.length + 1 },
     { content: "Item", styles: { fontStyle: "italic" } },
     { content: "Quantity", styles: { fontStyle: "italic" } },
     { content: "Amount (Rs.)", styles: { fontStyle: "italic" } }],
    ...items.map(r => r.map(c => ({ content: c, styles: { minCellHeight: 7 } }))),
    [{ content: "5", styles: { halign: "center" } }, "Budget Head",
      span3(`${box(v("s2_5") === "Institute Head")} Institute Head                    ${box(v("s2_5") === "Department Head")} Department Head`)],
    [{ content: "6", styles: { halign: "center" } }, "Estimated Cost (Rs.), INCLUDING Taxes and Delivery", span3(v("s2_6"))],
    [{ content: "7", styles: { halign: "center" } }, "Justification for purchase",
      span3(`${box(v("s2_7") === "Teaching Only")} Teaching Only                    Course Number(s): ${v("s2_7_course")}\n`
          + `${box(v("s2_7") === "Other than Research")} Other than Research        Specify: ${v("s2_7_specify") || "_______________________"}`)]
  ];

  doc.autoTable({
    startY: 74,
    body,
    theme: "grid",
    margin: { left: L, right: pageW - R, bottom: 20 },
    styles: { font: "times", fontSize: 10, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: 0, valign: "middle" },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 42 }, 2: { cellWidth: W - 14 - 42 - 24 - 30 }, 3: { cellWidth: 24 }, 4: { cellWidth: 30 } },
    rowPageBreak: "avoid"
  });

  const ctx = { y: doc.lastAutoTable.finalY + 12 };
  if (ctx.y + 75 > 285) { doc.addPage(); ctx.y = 20; }

  // Signatures (static)
  doc.setFont("times", "italic"); doc.setFontSize(9);
  doc.text("Faculty Mentor", L, ctx.y);
  doc.text("Head", R, ctx.y, { align: "right" });
  doc.setFont("times", "normal");
  doc.text("Department of", L, ctx.y + 4.5);
  doc.text("Department of Office of Students", R, ctx.y + 4.5, { align: "right" });

  // Approval line (mixed normal + italic, centred)
  const a1 = "Approval of ", a2 = "Competent Financial Authority (if a Prior Approval is not available)";
  doc.setFontSize(11);
  doc.setFont("times", "normal"); const w1 = doc.getTextWidth(a1);
  doc.setFont("times", "italic");  const w2 = doc.getTextWidth(a2);
  const x0 = (pageW - w1 - w2) / 2, yA = ctx.y + 15;
  doc.setFont("times", "normal"); doc.text(a1, x0, yA);
  doc.setFont("times", "italic"); doc.text(a2, x0 + w1, yA);

  doc.setFont("times", "normal"); doc.setFontSize(11);
  doc.text("Dean (Student Affairs)", pageW / 2, yA + 14, { align: "center" });
  ctx.y = yA + 24;

  officeBox(doc, ctx, "For the use of Office of Accounts only", ACCOUNTS_SP02,
            "Dealing Assistant (Accounts)", "Superintendent (Accounts)");

  addPageNumbers(doc);
  doc.save("SP02_Purchase_Indent.pdf");
});
