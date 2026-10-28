(() => {
  "use strict";
  const STORAGE_KEY = "taskwise.assignments.v1";
  const THEME_KEY = "taskwise.theme.v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const els = {
    list: $("#assignment-list"), modal: $("#modal-backdrop"), form: $("#assignment-form"),
    confirm: $("#confirm-backdrop"), toast: $("#toast"), search: $("#search-input"),
    subject: $("#subject-filter"), sort: $("#sort-select"), formError: $("#form-error"),
    sidebar: $("#sidebar")
  };
  let assignments = loadAssignments();
  let activeView = "all";
  let pendingDeleteId = null;
  let toastTimer = null;
  let lastFocused = null;
  let lastDeleteFocused = null;

  function loadAssignments() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.subject === "string" && typeof item.dueDate === "string").map(item => ({
        id: item.id, title: item.title.slice(0,100), subject: item.subject.slice(0,60),
        dueDate: item.dueDate, priority: ["low","medium","high"].includes(item.priority) ? item.priority : "medium",
        status: item.status === "completed" ? "completed" : "pending",
        notes: typeof item.notes === "string" ? item.notes.slice(0,1000) : "",
        createdAt: Number(item.createdAt) || Date.now(), completedAt: item.completedAt || null
      }));
    } catch (error) {
      console.warn("Taskwise could not read saved assignments.", error);
      return [];
    }
  }
  function saveAssignments() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
      return true;
    } catch (error) {
      console.error("Taskwise could not save assignments.", error);
      showToast("Couldn't save changes. Check your browser storage settings.");
      return false;
    }
  }
  function todayISO() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth()+1).padStart(2,"0"), String(now.getDate()).padStart(2,"0")].join("-");
  }
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y,m,d] = value.split("-").map(Number);
    const date = new Date(y,m-1,d);
    return date.getFullYear() === y && date.getMonth() === m-1 && date.getDate() === d ? date : null;
  }
  function isOverdue(item) { return item.status !== "completed" && item.dueDate < todayISO(); }
  function dateDiff(item) {
    if (item.status === "completed") return null;
    const due = parseDate(item.dueDate);
    if (!due) return null;
    const today = parseDate(todayISO());
    return Math.round((due - today) / 86400000);
  }
  function formatDate(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat(undefined,{day:"numeric",month:"short",year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined}).format(date) : "No valid date";
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function dueLabel(item) {
    if (item.status === "completed") return {text:"Completed",className:"done"};
    const diff = dateDiff(item);
    if (diff === null) return {text:"Due date unknown",className:""};
    if (diff < 0) return {text:"Overdue · " + formatDate(item.dueDate),className:"overdue"};
    if (diff === 0) return {text:"Due today",className:"urgent"};
    if (diff === 1) return {text:"Due tomorrow",className:"urgent"};
    return {text:"Due " + formatDate(item.dueDate),className: diff <= 3 ? "urgent" : ""};
  }
  function updateStats() {
    const total = assignments.length;
    const completed = assignments.filter(a => a.status === "completed").length;
    const pending = total - completed;
    const overdue = assignments.filter(isOverdue).length;
    $("#stat-total").textContent = total;
    $("#stat-pending").textContent = pending;
    $("#stat-completed").textContent = completed;
    $("#stat-overdue").textContent = overdue;
    $("#nav-pending").textContent = pending;
    const percent = total ? Math.round(completed / total * 100) : 0;
    $("#progress-percent").textContent = percent + "%";
    $("#progress-fill").style.width = percent + "%";
    $("#progress-track").setAttribute("aria-valuenow", String(percent));
    $("#completed-foot").textContent = total ? percent + "% of all assignments" : "Every finish counts";
    $("#progress-message").textContent = total === 0 ? "Your next win is waiting. Add an assignment to get started." :
      percent === 100 ? "Everything is done. Take a breath — you've earned it." :
      overdue ? "You have " + overdue + " overdue " + (overdue === 1 ? "task" : "tasks") + ". Pick one to tackle next." :
      "You're building momentum. Keep going, one task at a time.";
  }
  function updateSubjects() {
    const selected = els.subject.value;
    const subjects = [...new Set(assignments.map(a => a.subject.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    els.subject.innerHTML = '<option value="all">All subjects</option>' + subjects.map(subject => '<option value="' + escapeHTML(subject) + '">' + escapeHTML(subject) + '</option>').join("");
    els.subject.value = subjects.includes(selected) ? selected : "all";
  }
  function getVisibleAssignments() {
    const query = els.search.value.trim().toLocaleLowerCase();
    let list = assignments.filter(item => {
      const matchesView = activeView === "all" ||
        (activeView === "pending" && item.status !== "completed") ||
        (activeView === "completed" && item.status === "completed") ||
        (activeView === "overdue" && isOverdue(item));
      const matchesSubject = els.subject.value === "all" || item.subject === els.subject.value;
      const matchesQuery = !query || [item.title,item.subject,item.notes].some(value => value.toLocaleLowerCase().includes(query));
      return matchesView && matchesSubject && matchesQuery;
    });
    const sort = els.sort.value;
    list.sort((a,b) => {
      if (sort === "due-desc") return b.dueDate.localeCompare(a.dueDate) || b.createdAt-a.createdAt;
      if (sort === "priority") return ({high:0,medium:1,low:2}[a.priority] - {high:0,medium:1,low:2}[b.priority]) || a.dueDate.localeCompare(b.dueDate);
      if (sort === "created") return b.createdAt-a.createdAt;
      if (sort === "title") return a.title.localeCompare(b.title);
      return a.dueDate.localeCompare(b.dueDate) || b.createdAt-a.createdAt;
    });
    return list;
  }
  function renderCard(item) {
    const due = dueLabel(item);
    const completed = item.status === "completed";
    const priorityLabel = item.priority.charAt(0).toUpperCase() + item.priority.slice(1);
    const notes = item.notes ? '<p class="card-description">' + escapeHTML(item.notes) + '</p>' : "";
    return '<article class="assignment-card priority-' + item.priority + (completed ? ' is-completed' : '') + '" data-id="' + escapeHTML(item.id) + '">' +
      '<span class="card-priority-line" aria-hidden="true"></span>' +
      '<div class="card-main"><div class="card-title-row">' +
      '<button class="completion-toggle" type="button" data-action="toggle" aria-label="' + (completed ? "Mark " + escapeHTML(item.title) + " as to do" : "Mark " + escapeHTML(item.title) + " as completed") + '" aria-pressed="' + completed + '">' + (completed ? "✓" : "") + '</button>' +
      '<h3 class="assignment-title" title="' + escapeHTML(item.title) + '">' + escapeHTML(item.title) + '</h3></div>' + notes +
      '<div class="card-meta"><span class="subject-chip" title="' + escapeHTML(item.subject) + '">' + escapeHTML(item.subject) + '</span>' +
      '<span class="due-meta ' + due.className + '"><span aria-hidden="true">◷</span>' + escapeHTML(due.text) + '</span>' +
      '<span class="priority-pill ' + item.priority + '">' + priorityLabel + ' priority</span>' +
      (completed ? '<span class="status-pill complete">Completed</span>' : isOverdue(item) ? '<span class="status-pill">Needs attention</span>' : '') +
      '</div></div><div class="card-actions">' +
      '<button class="small-action" type="button" data-action="edit" aria-label="Edit ' + escapeHTML(item.title) + '" title="Edit assignment">✎</button>' +
      '<button class="small-action delete" type="button" data-action="delete" aria-label="Delete ' + escapeHTML(item.title) + '" title="Delete assignment">⌫</button>' +
      '</div></article>';
  }
  function renderList() {
    const list = getVisibleAssignments();
    if (!list.length) {
      const hasAny = assignments.length > 0;
      const title = hasAny ? "No assignments found" : "A fresh start. Let's plan it.";
      const copy = hasAny ? "Try a different search or filter, or switch to another view." : "Add your first assignment and keep deadlines, subjects, and priorities in one calm place.";
      els.list.innerHTML = '<div class="empty-state"><div class="empty-illustration" aria-hidden="true">' + (hasAny ? "⌕" : "✦") + '</div><h3>' + title + '</h3><p>' + copy + '</p>' +
        (hasAny ? '<button class="secondary-button" type="button" data-action="reset-filters">Reset filters</button>' : '<button class="primary-button" type="button" data-action="add">＋ Add your first assignment</button>') + '</div>';
    } else {
      els.list.innerHTML = list.map(renderCard).join("");
    }
    $("#result-count").textContent = list.length + (list.length === 1 ? " assignment" : " assignments");
    $("#clear-filters").hidden = !(els.search.value || els.subject.value !== "all" || activeView !== "all");
    updateStats();
  }
  function render() {
    updateSubjects();
    renderList();
  }
  function setView(view) {
    activeView = view;
    const titles = {all:["Overview","Your assignments","Your coursework, organized by what needs attention."],pending:["My assignments","Work in progress","The assignments still on your plate."],completed:["Completed","Finished work","A record of what you have already handled."],overdue:["Overdue","Deadlines to recover","Start with one overdue task and make a plan."]};
    $$(".nav-link").forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current","page"); else button.removeAttribute("aria-current");
    });
    $("#breadcrumb-view").textContent = titles[view][0];
    $("#page-title").innerHTML = escapeHTML(({all:"Your coursework, in good order",pending:"One task at a time",completed:"Look what you finished",overdue:"Let's sort the overdue work"})[view]) + '<span class="heading-period">.</span>';
    $("#page-subtitle").textContent = ({all:"A clear view of deadlines, priorities, and the next thing to finish.",pending:"Choose a realistic next step and give it your attention.",completed:"Use the finished list to see how much ground you have covered.",overdue:"No guilt, just a plan. Start with the deadline that matters most."})[view];
    $("#list-title").textContent = titles[view][1];
    $("#list-description").textContent = titles[view][2];
    els.sidebar.classList.remove("open");
    $("#menu-toggle").setAttribute("aria-expanded","false");
    renderList();
  }
  function openModal(item = null) {
    lastFocused = document.activeElement;
    els.form.reset();
    $("#assignment-id").value = item ? item.id : "";
    $("#modal-title").textContent = item ? "Edit assignment" : "New assignment";
    $("#save-assignment").innerHTML = item ? 'Save changes <span aria-hidden="true">→</span>' : 'Save assignment <span aria-hidden="true">→</span>';
    $("#assignment-title").value = item ? item.title : "";
    $("#assignment-subject").value = item ? item.subject : "";
    $("#assignment-due").value = item ? item.dueDate : todayISO();
    $("#assignment-priority").value = item ? item.priority : "medium";
    $("#assignment-status").value = item ? item.status : "pending";
    $("#assignment-notes").value = item ? item.notes : "";
    els.formError.textContent = "";
    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#assignment-title").focus(), 30);
  }
  function closeModal() {
    els.modal.hidden = true;
    document.body.style.overflow = "";
    els.formError.textContent = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2800);
  }
  function resetFilters() {
    els.search.value = "";
    els.subject.value = "all";
    els.sort.value = "due-asc";
    setView("all");
    render();
  }
  function saveFromForm(event) {
    event.preventDefault();
    const id = $("#assignment-id").value;
    const title = $("#assignment-title").value.trim();
    const subject = $("#assignment-subject").value.trim();
    const dueDate = $("#assignment-due").value;
    if (!title || !subject || !dueDate) { els.formError.textContent = "Please fill in the title, subject, and due date."; return; }
    if (!parseDate(dueDate)) { els.formError.textContent = "Please choose a valid due date."; return; }
    const existing = assignments.find(item => item.id === id);
    const item = {
      id: existing ? existing.id : (window.crypto && crypto.randomUUID ? crypto.randomUUID() : "task-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
      title, subject, dueDate, priority: $("#assignment-priority").value,
      status: $("#assignment-status").value, notes: $("#assignment-notes").value.trim().slice(0,1000),
      createdAt: existing ? existing.createdAt : Date.now(),
      completedAt: $("#assignment-status").value === "completed" ? (existing && existing.completedAt ? existing.completedAt : Date.now()) : null
    };
    const previous = assignments;
    assignments = existing ? assignments.map(entry => entry.id === id ? item : entry) : [item, ...assignments];
    if (!saveAssignments()) { assignments = previous; return; }
    closeModal();
    render();
    showToast(existing ? "Assignment updated." : "Assignment added.");
  }
  function toggleCompleted(id) {
    const previous = assignments;
    assignments = assignments.map(item => item.id === id ? {...item, status: item.status === "completed" ? "pending" : "completed", completedAt: item.status === "completed" ? null : Date.now()} : item);
    if (!saveAssignments()) { assignments = previous; return; }
    render();
    const item = assignments.find(entry => entry.id === id);
    if (item) showToast(item.status === "completed" ? "Nice work — marked completed." : "Moved back to your to-do list.");
  }
  function openDelete(id) {
    lastDeleteFocused = document.activeElement;
    pendingDeleteId = id;
    els.confirm.hidden = false;
    document.body.style.overflow = "hidden";
    $("#confirm-cancel").focus();
  }
  function closeDelete(restoreFocus = true) {
    els.confirm.hidden = true;
    pendingDeleteId = null;
    document.body.style.overflow = els.modal.hidden ? "" : "hidden";
    if (restoreFocus && lastDeleteFocused && typeof lastDeleteFocused.focus === "function" && lastDeleteFocused.isConnected) lastDeleteFocused.focus();
  }
  function deleteAssignment() {
    if (!pendingDeleteId) return;
    const item = assignments.find(entry => entry.id === pendingDeleteId);
    const previous = assignments;
    assignments = assignments.filter(entry => entry.id !== pendingDeleteId);
    if (!saveAssignments()) { assignments = previous; return; }
    closeDelete(false);
    render();
    const nextFocus = $("#assignment-list .completion-toggle") || $("#add-assignment");
    if (nextFocus) nextFocus.focus();
    showToast(item ? '"' + item.title + '" deleted.' : "Assignment deleted.");
  }
  function handleListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "add") return openModal();
    if (action === "reset-filters") return resetFilters();
    const card = button.closest("[data-id]");
    if (!card) return;
    const item = assignments.find(entry => entry.id === card.dataset.id);
    if (!item) return;
    if (action === "toggle") toggleCompleted(item.id);
    if (action === "edit") openModal(item);
    if (action === "delete") openDelete(item.id);
  }
  function applyTheme(dark) {
    document.body.classList.toggle("dark", dark);
    $("#theme-toggle").setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    $("#theme-toggle").title = dark ? "Switch to light theme" : "Switch to dark theme";
    $("#theme-toggle").textContent = dark ? "☼" : "◐";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#151f1b" : "#f3f0e7";
  }
  function init() {
    const now = new Date();
    $("#today-label").textContent = new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric"}).format(now);
    $("#greeting").textContent = now.getHours() < 12 ? "GOOD MORNING" : now.getHours() < 17 ? "GOOD AFTERNOON" : "YOUR COURSEWORK DESK";
    let savedTheme = "light";
    try { savedTheme = localStorage.getItem(THEME_KEY) || "light"; } catch (_) {}
    applyTheme(savedTheme === "dark");
    $$(".nav-link").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
    $("#add-assignment").addEventListener("click", () => openModal());
    els.list.addEventListener("click", handleListClick);
    els.form.addEventListener("submit", saveFromForm);
    $("#close-modal").addEventListener("click", closeModal);
    $("#cancel-modal").addEventListener("click", closeModal);
    els.modal.addEventListener("click", event => { if (event.target === els.modal) closeModal(); });
    $("#confirm-cancel").addEventListener("click", closeDelete);
    $("#confirm-delete").addEventListener("click", deleteAssignment);
    els.confirm.addEventListener("click", event => { if (event.target === els.confirm) closeDelete(); });
    els.search.addEventListener("input", renderList);
    els.subject.addEventListener("change", renderList);
    els.sort.addEventListener("change", renderList);
    $("#clear-filters").addEventListener("click", resetFilters);
    $("#theme-toggle").addEventListener("click", () => {
      const dark = !document.body.classList.contains("dark");
      applyTheme(dark);
      try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (_) {}
    });
    $("#profile-button").addEventListener("click", () => showToast("Your assignments are stored in this browser on this device."));
    $("#menu-toggle").addEventListener("click", () => {
      const open = els.sidebar.classList.toggle("open");
      $("#menu-toggle").setAttribute("aria-expanded", String(open));
      $("#menu-toggle").setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });
    document.addEventListener("click", event => {
      if (window.matchMedia("(max-width: 820px)").matches && els.sidebar.classList.contains("open") && (!els.sidebar.contains(event.target) || event.target === els.sidebar) && !$("#menu-toggle").contains(event.target)) {
        els.sidebar.classList.remove("open");
        $("#menu-toggle").setAttribute("aria-expanded", "false");
        $("#menu-toggle").setAttribute("aria-label", "Open navigation");
      }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (!els.confirm.hidden) closeDelete();
        else if (!els.modal.hidden) closeModal();
        else if (els.sidebar.classList.contains("open")) {
          els.sidebar.classList.remove("open");
          $("#menu-toggle").setAttribute("aria-expanded","false");
          $("#menu-toggle").setAttribute("aria-label","Open navigation");
        }
      }
      if (event.key === "Tab" && !els.modal.hidden) {
        const focusable = $$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]', els.modal).filter(el => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (event.key === "Tab" && !els.confirm.hidden) {
        const focusable = $("button:not([disabled])", els.confirm).filter(el => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    render();
  }
  init();
})();