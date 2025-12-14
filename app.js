// Facturas & Cotizaciones (Vanilla) - app.js
// - Cálculo automático
// - Plantillas
// - Guardar/Cargar en localStorage
// - Imprimir (Exportar PDF desde el diálogo del navegador)

const $ = (id) => document.getElementById(id);

const els = {
  docType: $("docType"),
  template: $("template"),
  docNumber: $("docNumber"),
  docDate: $("docDate"),

  fromName: $("fromName"),
  fromEmail: $("fromEmail"),
  fromPhone: $("fromPhone"),
  fromAddress: $("fromAddress"),

  toName: $("toName"),
  toEmail: $("toEmail"),
  toPhone: $("toPhone"),
  toAddress: $("toAddress"),

  taxRate: $("taxRate"),
  discountType: $("discountType"),
  discountValue: $("discountValue"),
  currency: $("currency"),
  notes: $("notes"),

  btnAddItem: $("btnAddItem"),
  itemsBody: $("itemsBody"),

  btnNew: $("btnNew"),
  btnSave: $("btnSave"),
  btnLoad: $("btnLoad"),
  btnPrint: $("btnPrint"),

  loadDialog: $("loadDialog"),
  confirmLoad: $("confirmLoad"),

  // Preview
  doc: $("doc"),
  docBadge: $("docBadge"),
  docTitle: $("docTitle"),
  brandMark: $("brandMark"),
  pNumber: $("pNumber"),
  pDate: $("pDate"),
  pFromName: $("pFromName"),
  pFromDetails: $("pFromDetails"),
  pToName: $("pToName"),
  pToDetails: $("pToDetails"),
  pItems: $("pItems"),
  pSubtotal: $("pSubtotal"),
  pDiscount: $("pDiscount"),
  pTax: $("pTax"),
  pTotal: $("pTotal"),
  pNotes: $("pNotes"),
};

const STORAGE_KEY = "fq_last_doc_v1";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function currencySymbol(code) {
  switch (code) {
    case "USD": return "$";
    case "EUR": return "€";
    case "MXN": return "$";
    case "DOP": return "RD$";
    default: return "$";
  }
}

function fmtMoney(amount, code) {
  const sym = currencySymbol(code);
  const n = Number.isFinite(amount) ? amount : 0;
  // Formato simple (sin Intl para mantenerlo ultra vanilla y consistente)
  return `${sym} ${n.toFixed(2)}`;
}

function safeText(s) {
  return (s ?? "").toString().trim();
}

function parseNum(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function makeItemRow(item = { desc: "", qty: 1, price: 0 }) {
  const tr = document.createElement("tr");

  const tdDesc = document.createElement("td");
  const inpDesc = document.createElement("input");
  inpDesc.type = "text";
  inpDesc.placeholder = "Ej: Diseño de logo";
  inpDesc.value = item.desc ?? "";
  inpDesc.className = "cell-input";
  tdDesc.appendChild(inpDesc);

  const tdQty = document.createElement("td");
  tdQty.className = "num";
  const inpQty = document.createElement("input");
  inpQty.type = "number";
  inpQty.min = "0";
  inpQty.step = "1";
  inpQty.value = item.qty ?? 1;
  inpQty.className = "cell-input num";
  tdQty.appendChild(inpQty);

  const tdPrice = document.createElement("td");
  tdPrice.className = "num";
  const inpPrice = document.createElement("input");
  inpPrice.type = "number";
  inpPrice.min = "0";
  inpPrice.step = "0.01";
  inpPrice.value = item.price ?? 0;
  inpPrice.className = "cell-input num";
  tdPrice.appendChild(inpPrice);

  const tdTotal = document.createElement("td");
  tdTotal.className = "num";
  tdTotal.textContent = fmtMoney(parseNum(item.qty) * parseNum(item.price), els.currency.value);

  const tdActions = document.createElement("td");
  tdActions.className = "num";
  const btnDel = document.createElement("button");
  btnDel.type = "button";
  btnDel.className = "icon-btn danger";
  btnDel.textContent = "Eliminar";
  tdActions.appendChild(btnDel);

  tr.appendChild(tdDesc);
  tr.appendChild(tdQty);
  tr.appendChild(tdPrice);
  tr.appendChild(tdTotal);
  tr.appendChild(tdActions);

  // Events
  const recalcRow = () => {
    const qty = parseNum(inpQty.value);
    const price = parseNum(inpPrice.value);
    tdTotal.textContent = fmtMoney(qty * price, els.currency.value);
    renderPreview();
  };

  inpDesc.addEventListener("input", renderPreview);
  inpQty.addEventListener("input", recalcRow);
  inpPrice.addEventListener("input", recalcRow);

  btnDel.addEventListener("click", () => {
    tr.remove();
    renderPreview();
  });

  return tr;
}

function getItems() {
  const rows = [...els.itemsBody.querySelectorAll("tr")];
  return rows.map((tr) => {
    const inputs = tr.querySelectorAll("input");
    const desc = safeText(inputs[0]?.value);
    const qty = parseNum(inputs[1]?.value);
    const price = parseNum(inputs[2]?.value);
    return { desc, qty, price };
  }).filter(it => it.desc || it.qty || it.price);
}

function calcTotals() {
  const items = getItems();
  const subtotal = items.reduce((sum, it) => sum + (parseNum(it.qty) * parseNum(it.price)), 0);

  const taxRate = Math.max(0, parseNum(els.taxRate.value));
  const discountType = els.discountType.value;
  const discountValue = Math.max(0, parseNum(els.discountValue.value));

  let discount = 0;
  if (discountType === "percent") {
    discount = subtotal * (discountValue / 100);
  } else {
    discount = discountValue;
  }
  discount = Math.min(discount, subtotal);

  const taxableBase = Math.max(0, subtotal - discount);
  const tax = taxableBase * (taxRate / 100);
  const total = taxableBase + tax;

  return { subtotal, discount, tax, total };
}

function setTemplateClass(name) {
  els.doc.classList.remove("template-classic", "template-modern", "template-minimal");
  els.doc.classList.add(`template-${name}`);
}

function renderPreview() {
  const type = els.docType.value;
  const title = type === "FACTURA" ? "Factura" : "Cotización";

  els.docBadge.textContent = type;
  els.docTitle.textContent = title;

  // Marca
  els.brandMark.textContent = "FQ";

  // Número / fecha
  els.pNumber.textContent = safeText(els.docNumber.value) || "—";
  els.pDate.textContent = safeText(els.docDate.value) || "—";

  // Emisor
  els.pFromName.textContent = safeText(els.fromName.value) || "—";
  const fromDetails = [
    safeText(els.fromEmail.value),
    safeText(els.fromPhone.value),
    safeText(els.fromAddress.value),
  ].filter(Boolean).join(" • ");
  els.pFromDetails.textContent = fromDetails || "—";

  // Cliente
  els.pToName.textContent = safeText(els.toName.value) || "—";
  const toDetails = [
    safeText(els.toEmail.value),
    safeText(els.toPhone.value),
    safeText(els.toAddress.value),
  ].filter(Boolean).join(" • ");
  els.pToDetails.textContent = toDetails || "—";

  // Ítems preview
  const currency = els.currency.value;
  const items = getItems();
  els.pItems.innerHTML = "";

  if (items.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="muted" colspan="4">Sin ítems</td>`;
    els.pItems.appendChild(tr);
  } else {
    for (const it of items) {
      const tr = document.createElement("tr");
      const lineTotal = parseNum(it.qty) * parseNum(it.price);
      tr.innerHTML = `
        <td>${escapeHtml(it.desc || "—")}</td>
        <td class="num">${parseNum(it.qty)}</td>
        <td class="num">${fmtMoney(parseNum(it.price), currency)}</td>
        <td class="num">${fmtMoney(lineTotal, currency)}</td>
      `;
      els.pItems.appendChild(tr);
    }
  }

  // Totales
  const { subtotal, discount, tax, total } = calcTotals();
  els.pSubtotal.textContent = fmtMoney(subtotal, currency);
  els.pDiscount.textContent = `- ${fmtMoney(discount, currency)}`;
  els.pTax.textContent = fmtMoney(tax, currency);
  els.pTotal.textContent = fmtMoney(total, currency);

  // Notas
  els.pNotes.textContent = safeText(els.notes.value) || "—";

  // Plantilla
  setTemplateClass(els.template.value);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#39;"
  }[m]));
}

function getState() {
  return {
    docType: els.docType.value,
    template: els.template.value,
    docNumber: safeText(els.docNumber.value),
    docDate: safeText(els.docDate.value),

    fromName: safeText(els.fromName.value),
    fromEmail: safeText(els.fromEmail.value),
    fromPhone: safeText(els.fromPhone.value),
    fromAddress: safeText(els.fromAddress.value),

    toName: safeText(els.toName.value),
    toEmail: safeText(els.toEmail.value),
    toPhone: safeText(els.toPhone.value),
    toAddress: safeText(els.toAddress.value),

    taxRate: parseNum(els.taxRate.value),
    discountType: els.discountType.value,
    discountValue: parseNum(els.discountValue.value),
    currency: els.currency.value,
    notes: safeText(els.notes.value),

    items: getItems(),
  };
}

function setState(s) {
  if (!s) return;

  els.docType.value = s.docType ?? "FACTURA";
  els.template.value = s.template ?? "classic";
  els.docNumber.value = s.docNumber ?? "";
  els.docDate.value = s.docDate ?? todayISO();

  els.fromName.value = s.fromName ?? "";
  els.fromEmail.value = s.fromEmail ?? "";
  els.fromPhone.value = s.fromPhone ?? "";
  els.fromAddress.value = s.fromAddress ?? "";

  els.toName.value = s.toName ?? "";
  els.toEmail.value = s.toEmail ?? "";
  els.toPhone.value = s.toPhone ?? "";
  els.toAddress.value = s.toAddress ?? "";

  els.taxRate.value = String(s.taxRate ?? 0);
  els.discountType.value = s.discountType ?? "percent";
  els.discountValue.value = String(s.discountValue ?? 0);
  els.currency.value = s.currency ?? "USD";
  els.notes.value = s.notes ?? "";

  // Items
  els.itemsBody.innerHTML = "";
  const items = Array.isArray(s.items) ? s.items : [];
  if (items.length === 0) {
    els.itemsBody.appendChild(makeItemRow());
  } else {
    for (const it of items) els.itemsBody.appendChild(makeItemRow(it));
  }

  renderPreview();
}

function newDoc() {
  setState({
    docType: "FACTURA",
    template: "classic",
    docNumber: "",
    docDate: todayISO(),
    fromName: "",
    fromEmail: "",
    fromPhone: "",
    fromAddress: "",
    toName: "",
    toEmail: "",
    toPhone: "",
    toAddress: "",
    taxRate: 0,
    discountType: "percent",
    discountValue: 0,
    currency: "USD",
    notes: "",
    items: [{ desc: "", qty: 1, price: 0 }],
  });
}

function saveDoc() {
  const state = getState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  toast("Guardado ✔");
}

function loadDoc() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    toast("No hay nada guardado todavía.");
    return;
  }
  try {
    const state = JSON.parse(raw);
    setState(state);
    toast("Cargado ✔");
  } catch {
    toast("Error al cargar (datos corruptos).");
  }
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 200);
  }, 1600);
}

// Toast styles injected (para mantenerlo simple sin depender de más CSS)
(function injectToastCSS(){
  const style = document.createElement("style");
  style.textContent = `
    .toast{
      position: fixed; left: 50%; bottom: 18px;
      transform: translateX(-50%) translateY(10px);
      opacity:0;
      padding:10px 12px;
      border-radius: 12px;
      border:1px solid rgba(255,255,255,.14);
      background: rgba(18,26,39,.92);
      color: #e9f1ff;
      box-shadow: 0 12px 30px rgba(0,0,0,.35);
      transition: .18s ease;
      z-index: 9999;
      font-weight: 700;
    }
    .toast.show{opacity:1; transform: translateX(-50%) translateY(0)}
    .cell-input{
      width:100%;
      padding:9px 8px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.10);
      background: rgba(0,0,0,.15);
      color: #e9f1ff;
      outline:none;
    }
    .cell-input.num{ text-align:right; }
  `;
  document.head.appendChild(style);
})();

// Wire events
[
  els.docType, els.template, els.docNumber, els.docDate,
  els.fromName, els.fromEmail, els.fromPhone, els.fromAddress,
  els.toName, els.toEmail, els.toPhone, els.toAddress,
  els.taxRate, els.discountType, els.discountValue, els.currency, els.notes
].forEach(el => el.addEventListener("input", renderPreview));

els.btnAddItem.addEventListener("click", () => {
  els.itemsBody.appendChild(makeItemRow());
  renderPreview();
});

els.btnNew.addEventListener("click", () => {
  newDoc();
  toast("Nuevo documento");
});

els.btnSave.addEventListener("click", saveDoc);

els.btnLoad.addEventListener("click", () => {
  if (typeof els.loadDialog.showModal === "function") {
    els.loadDialog.showModal();
  } else {
    // fallback
    loadDoc();
  }
});

els.confirmLoad.addEventListener("click", () => loadDoc());

els.btnPrint.addEventListener("click", () => window.print());

// Init
(function init(){
  els.docDate.value = todayISO();

  // Por defecto agrega 1 fila
  els.itemsBody.appendChild(makeItemRow());

  // Si hay algo guardado, precárgalo
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { setState(JSON.parse(raw)); }
    catch { renderPreview(); }
  } else {
    renderPreview();
  }
})();
