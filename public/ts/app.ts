// Interview Tracker - frontend application logic
// Compiled with tsc (see tsconfig.json) to /public/js/app.js

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
  document.querySelectorAll<HTMLElement>(".tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === name);
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
  showToast(`${record.candidateName} added by another user`);
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
  const supportingFilter = document.getElementById("filterSupporting") as HTMLSelectElement;
  const hiredFilter = document.getElementById("filterHired") as HTMLSelectElement;

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

// ---------- Rendering ----------
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
  const search = (document.getElementById("searchBox") as HTMLInputElement).value.trim().toLowerCase();
  const supportingFilter = (document.getElementById("filterSupporting") as HTMLSelectElement).value;
  const hiredFilter = (document.getElementById("filterHired") as HTMLSelectElement).value;

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
  const tbody = document.getElementById("tableBody") as HTMLElement;
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

  (document.getElementById("statTotal") as HTMLElement).textContent = String(total);
  (document.getElementById("statToday") as HTMLElement).textContent = String(addedToday);
  (document.getElementById("statWithAttachment") as HTMLElement).textContent = String(withAttachment);
  (document.getElementById("statSupporters") as HTMLElement).textContent = String(supporters);
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Filters ----------
["searchBox", "filterSupporting", "filterHired"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => renderTable());
});

// ---------- Toast ----------
let toastTimer: number | undefined;
function showToast(message: string): void {
  const toast = document.getElementById("toast") as HTMLElement;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

// ---------- Form submission ----------
const form = document.getElementById("interviewForm") as HTMLFormElement;
const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement;
const formMessage = document.getElementById("formMessage") as HTMLElement;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "";
  formMessage.className = "form__message";
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

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

    // The submitter's own view updates immediately; other clients get it via socket.
    if (!allInterviews.find((iv) => iv.id === data.interview.id)) {
      allInterviews.unshift(data.interview);
    }

    formMessage.textContent = "Interview saved and Excel export updated.";
    formMessage.classList.add("success");
    form.reset();

    renderStats();
    populateFilterOptions();
    showView("dashboard");
    renderTable(data.interview.id);
  } catch (err: any) {
    formMessage.textContent = err.message || "Something went wrong.";
    formMessage.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});

// ---------- Google Sheet link ----------
async function loadConfig(): Promise<void> {
  try {
    const res = await fetch("/api/interviews/config");
    const config = await res.json();
    const sheetBtn = document.getElementById("sheetBtn") as HTMLAnchorElement;
    if (config.googleSheetsConnected && config.googleSheetUrl) {
      sheetBtn.href = config.googleSheetUrl;
      sheetBtn.style.display = "inline-flex";
    }
  } catch {
    // Config endpoint failing shouldn't break the rest of the app.
  }
}

// ---------- Init ----------
loadPeople();
loadInterviews();
loadConfig();
