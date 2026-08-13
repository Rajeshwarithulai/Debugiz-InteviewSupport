// Interview Tracker - frontend application logic
// Compiled with tsc (see tsconfig.json) to /public/js/app.js
//
// NOTE: only the "Add Interview" screen is linked in the UI right now (per current
// requirements). The dashboard view, its rendering functions, and its DOM elements
// are still fully implemented below and simply left unlinked - flip a nav link back
// on and call showView("dashboard") to re-enable it later, no rebuild needed.

interface Interview {
  id: string;
  candidateName: string;
  email: string;
  supportingBy: string;
  hiredBy: string;
  candidateMailAttachment: string | null;
  interviewSnapshot: string | null;
  createdAt: string;
}

interface PeopleLists {
  supporting: string[];
  hiring: string[];
}

declare const io: any;

const socket = io();

let allInterviews: Interview[] = [];

// ---------- View switching ----------
function showView(name: "dashboard" | "add"): void {
  document.querySelectorAll<HTMLElement>(".view").forEach((el) => {
    el.classList.toggle("view--hidden", el.id !== `view-${name}`);
  });
}

document.querySelectorAll<HTMLElement>("[data-view]").forEach((el) => {
  el.addEventListener("click", () => {
    const target = el.dataset.view as "dashboard" | "add";
    showView(target);
    if (target === "dashboard") renderTable();
  });
});

// ---------- Connection status ----------
const connDot = document.getElementById("connDot") as HTMLElement;
const connLabel = document.getElementById("connLabel") as HTMLElement;

socket.on("connect", () => {
  connDot.classList.remove("dot--off");
  connDot.classList.add("dot--on");
  connLabel.textContent = "live";
});

socket.on("disconnect", () => {
  connDot.classList.remove("dot--on");
  connDot.classList.add("dot--off");
  connLabel.textContent = "offline";
});

socket.on("interview:created", (record: Interview) => {
  allInterviews.unshift(record);
  renderTable(record.id);
  renderStats();
  populateFilterOptions();
});

// ---------- Data loading ----------
async function loadInterviews(): Promise<void> {
  const res = await fetch("/api/interviews");
  const data = await res.json();
  allInterviews = data.interviews || [];
  renderTable();
  renderStats();
  populateFilterOptions();
}

async function loadPeople(): Promise<void> {
  const res = await fetch("/api/interviews/people");
  const people: PeopleLists = await res.json();

  const supportingSelect = document.getElementById("supportingBy") as HTMLSelectElement;
  const hiredSelect = document.getElementById("hiredBy") as HTMLSelectElement;

  people.supporting.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    supportingSelect.appendChild(opt);
  });

  people.hiring.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    hiredSelect.appendChild(opt);
  });
}

function populateFilterOptions(): void {
  const supportingFilter = document.getElementById("filterSupporting") as HTMLSelectElement | null;
  const hiredFilter = document.getElementById("filterHired") as HTMLSelectElement | null;
  if (!supportingFilter || !hiredFilter) return;

  const existingSupportingVal = supportingFilter.value;
  const existingHiredVal = hiredFilter.value;

  const supportingSet = Array.from(new Set(allInterviews.map((i) => i.supportingBy))).sort();
  const hiredSet = Array.from(new Set(allInterviews.map((i) => i.hiredBy))).sort();

  supportingFilter.innerHTML = '<option value="">All Supporting By</option>';
  supportingSet.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    supportingFilter.appendChild(opt);
  });
  supportingFilter.value = existingSupportingVal;

  hiredFilter.innerHTML = '<option value="">All Hired By</option>';
  hiredSet.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    hiredFilter.appendChild(opt);
  });
  hiredFilter.value = existingHiredVal;
}

// ---------- Rendering (dashboard) ----------
function fileLinkHtml(filename: string | null, label: string): string {
  if (!filename) return `<span class="file-none">— none —</span>`;
  return `<a class="file-link" href="/api/interviews/files/${encodeURIComponent(filename)}" target="_blank" rel="noopener">${label}</a>`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getFilteredInterviews(): Interview[] {
  const searchEl = document.getElementById("searchBox") as HTMLInputElement | null;
  const supportingEl = document.getElementById("filterSupporting") as HTMLSelectElement | null;
  const hiredEl = document.getElementById("filterHired") as HTMLSelectElement | null;
  if (!searchEl || !supportingEl || !hiredEl) return allInterviews;

  const search = searchEl.value.trim().toLowerCase();
  const supportingFilter = supportingEl.value;
  const hiredFilter = hiredEl.value;

  return allInterviews.filter((iv) => {
    const matchesSearch =
      !search ||
      iv.candidateName.toLowerCase().includes(search) ||
      iv.email.toLowerCase().includes(search);
    const matchesSupporting = !supportingFilter || iv.supportingBy === supportingFilter;
    const matchesHired = !hiredFilter || iv.hiredBy === hiredFilter;
    return matchesSearch && matchesSupporting && matchesHired;
  });
}

function renderTable(highlightId?: string): void {
  const tbody = document.getElementById("tableBody");
  if (!tbody) return;
  const filtered = getFilteredInterviews();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No interviews match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((iv) => `
      <tr${iv.id === highlightId ? ' class="row--new"' : ""}>
        <td>${escapeHtml(iv.candidateName)}</td>
        <td class="mono">${escapeHtml(iv.email)}</td>
        <td>${escapeHtml(iv.supportingBy)}</td>
        <td>${escapeHtml(iv.hiredBy)}</td>
        <td>${fileLinkHtml(iv.candidateMailAttachment, "view")}</td>
        <td>${fileLinkHtml(iv.interviewSnapshot, "view")}</td>
        <td class="mono">${formatDate(iv.createdAt)}</td>
      </tr>
    `)
    .join("");
}

function renderStats(): void {
  const total = allInterviews.length;
  const today = new Date().toDateString();
  const addedToday = allInterviews.filter((iv) => new Date(iv.createdAt).toDateString() === today).length;
  const withAttachment = allInterviews.filter((iv) => iv.candidateMailAttachment).length;
  const supporters = new Set(allInterviews.map((iv) => iv.supportingBy)).size;

  const totalEl = document.getElementById("statTotal");
  const todayEl = document.getElementById("statToday");
  const attachEl = document.getElementById("statWithAttachment");
  const supportersEl = document.getElementById("statSupporters");
  if (!totalEl || !todayEl || !attachEl || !supportersEl) return;

  totalEl.textContent = String(total);
  todayEl.textContent = String(addedToday);
  attachEl.textContent = String(withAttachment);
  supportersEl.textContent = String(supporters);
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

["searchBox", "filterSupporting", "filterHired"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => renderTable());
});

// ---------- Google Sheet link (dashboard only, unlinked for now) ----------
async function loadConfig(): Promise<void> {
  try {
    const res = await fetch("/api/interviews/config");
    const config = await res.json();
    const sheetBtn = document.getElementById("sheetBtn") as HTMLAnchorElement | null;
    if (sheetBtn && config.googleSheetsConnected && config.googleSheetUrl) {
      sheetBtn.href = config.googleSheetUrl;
      sheetBtn.style.display = "inline-flex";
    }
  } catch {
    // Config endpoint failing shouldn't break the rest of the app.
  }
}

// ---------- Toast ----------
let toastTimer: number | undefined;
function showToast(message: string, variant: "default" | "error" = "default"): void {
  const toast = document.getElementById("toast") as HTMLElement;
  toast.textContent = message;
  toast.classList.add("show");
  toast.classList.toggle("toast--error", variant === "error");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}
document.querySelectorAll<HTMLInputElement>('.file-drop input[type="file"]').forEach((input) => {
  input.addEventListener("change", () => {
    const label = input.closest(".file-drop")?.querySelector<HTMLElement>(".file-drop__text");
    if (!label) return;
    label.textContent = input.files && input.files[0] ? input.files[0].name : (label.dataset.default || "Choose a file");
  });
});

function resetFileLabels(): void {
  document.querySelectorAll<HTMLElement>(".file-drop__text").forEach((label) => {
    label.textContent = label.dataset.default || "Choose a file";
  });
}

// ---------- Form submission ----------
const form = document.getElementById("interviewForm") as HTMLFormElement;
const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement;
const formMessage = document.getElementById("formMessage") as HTMLElement;
const confirmState = document.getElementById("confirmState") as HTMLElement;
const confirmName = document.getElementById("confirmName") as HTMLElement;
const logAnotherBtn = document.getElementById("logAnotherBtn") as HTMLButtonElement;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "";
  formMessage.className = "form__message";
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  try {
    const formData = new FormData(form);
    const res = await fetch("/api/interviews", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Submission failed." }));
      throw new Error(err.error || "Submission failed.");
    }

    const data = await res.json();

    if (!allInterviews.find((iv) => iv.id === data.interview.id)) {
      allInterviews.unshift(data.interview);
    }
    renderStats();
    populateFilterOptions();

    // Swap to the postmark confirmation state
    confirmName.textContent = data.interview.candidateName;
    form.classList.add("view--hidden");
    confirmState.classList.remove("view--hidden");
    // restart the stamp animation each time
    const stamp = confirmState.querySelector(".stamp") as HTMLElement;
    stamp.style.animation = "none";
    void stamp.offsetWidth;
    stamp.style.animation = "";
  } catch (err: any) {
    const message = err.message || "Something went wrong. Please try again.";
    formMessage.textContent = message;
    formMessage.classList.add("error");
    showToast(message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = "<span>Save interview</span>";
  }
});

const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
resetBtn.addEventListener("click", () => {
  // native reset runs first via type="reset"; clear our custom file labels right after
  setTimeout(resetFileLabels, 0);
});

logAnotherBtn.addEventListener("click", () => {
  form.reset();
  resetFileLabels();
  formMessage.textContent = "";
  formMessage.className = "form__message";
  confirmState.classList.add("view--hidden");
  form.classList.remove("view--hidden");
});

// ---------- Init ----------
showView("add");
loadPeople();
loadInterviews();
loadConfig();
