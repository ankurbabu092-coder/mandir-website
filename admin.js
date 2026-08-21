"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const queryAll = (selector, root = document) => [...root.querySelectorAll(selector)];
  const loginView = $("#loginView");
  const appView = $("#appView");
  const loginMessage = $("#loginMessage");
  const toast = $("#adminToast");
  let csrfToken = readCookie("temple_csrf");
  let currentUser = null;
  let toastTimer;

  function readCookie(name) {
    return document.cookie.split("; ").find(item => item.startsWith(`${name}=`))?.split("=").slice(1).join("=") || "";
  }

  function showMessage(element, message, isError = false) {
    element.textContent = message || "";
    element.classList.toggle("error", isError);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  async function api(url, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    const request = { credentials: "same-origin", ...options, headers };
    if (request.body && !(request.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      request.body = JSON.stringify(request.body);
    }
    if (request.method && request.method !== "GET") headers["x-csrf-token"] = csrfToken || readCookie("temple_csrf");
    const response = await fetch(url, request);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) showLogin();
      throw new Error(data.error || "Request failed");
    }
    if (data.csrfToken) csrfToken = data.csrfToken;
    return data;
  }

  function showLogin() {
    currentUser = null;
    appView.hidden = true;
    loginView.hidden = false;
  }

  function showApp(user) {
    currentUser = user;
    loginView.hidden = true;
    appView.hidden = false;
    $("#userLabel").textContent = `${user.name} · ${user.role === "owner" ? "Main Admin" : "Admin"}`;
    $("#usersTab").hidden = !(user.role === "owner" || user.canManageAdmins);
    loadAll();
  }

  function bindFilePreviews() {
    queryAll('input[type="file"]').forEach(input => {
      const preview = document.createElement("img");
      preview.className = "file-preview";
      preview.alt = "Selected preview";
      preview.hidden = true;
      input.insertAdjacentElement("afterend", preview);
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file || !file.type.startsWith("image/")) { preview.hidden = true; preview.removeAttribute("src"); return; }
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
      });
    });
  }

  function resetForm(formId) {
    const form = document.getElementById(formId);
    form.reset();
    form.elements.id.value = "";
    if (formId === "noticeForm") form.elements.published.checked = true;
    if (formId === "donorForm") form.elements.published.checked = true;
    if (["timingForm", "musicForm", "quizForm"].includes(formId) && form.elements.published) form.elements.published.checked = true;
    if (formId === "musicForm" && form.elements.active) form.elements.active.checked = false;
    if (formId === "galleryForm") {
      form.elements.published.checked = true;
      form.elements.image.required = true;
    }
    showMessage($(`[data-message="${formId}"]`), "");
  }

  function setForm(formId, record) {
    const form = document.getElementById(formId);
    form.elements.id.value = record.id;
    Object.entries(record).forEach(([key, value]) => {
      const field = form.elements[key === "date" ? "date" : key];
      if (!field || key === "id") return;
      if (field.type === "checkbox") field.checked = Boolean(value);
       else if (formId === "quizForm" && key === "options" && Array.isArray(value)) field.value = value.join("\n");
       else if (field.type !== "file") field.value = value || "";
    });
    if (formId === "galleryForm") form.elements.image.required = false;
    window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 20, behavior: "smooth" });
  }

  function actionButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `admin-btn subtle ${className || ""}`;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function renderStats(data) {
     const stats = [["सूचनाएं", data.notices], ["कार्यक्रम", data.events || 0], ["सत्यापित दान", data.donations?.count || 0], ["Digital visitors", data.visitors || 0], ["भक्त परिवार", data.communityMembers || 0], ["Community posts", data.communityPosts || 0], ["Reports", data.communityReports || 0], ["Gallery photos", data.gallery], ["Admins", data.admins]];
    const grid = $("#statsGrid");
    grid.replaceChildren();
    stats.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "stat-card";
      const span = document.createElement("span");
      span.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      card.append(span, strong);
      grid.appendChild(card);
    });
  }

  function renderNotices(items) {
    const list = $("#noticeList");
    list.replaceChildren();
    if (!items.length) {
      list.textContent = "अभी कोई managed notice नहीं है।";
      return;
    }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = item.title;
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = `${item.date || "मंदिर सूचना"} · ${item.published ? "Published" : "Draft"}${item.important ? " · महत्वपूर्ण" : ""}`;
      const body = document.createElement("p");
      body.textContent = item.body;
      copy.append(meta, title, body);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      actions.append(actionButton("Edit", "", () => setForm("noticeForm", { ...item, date: item.date })));
      actions.append(actionButton("Delete", "danger", () => removeRecord("/api/admin/notices/", item.id, loadNotices)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderEvents(items) {
    const list = $("#eventList");
    list.replaceChildren();
    if (!items.length) { list.textContent = "अभी कोई managed event नहीं है।"; return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = `${item.date} · ${item.published ? "Published" : "Draft"}`;
      const title = document.createElement("h3");
      title.textContent = item.title;
      const body = document.createElement("p");
      body.textContent = item.body;
      copy.append(meta, title, body);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      actions.append(actionButton("Edit", "", () => setForm("eventForm", { ...item, date: item.date })));
      actions.append(actionButton("Delete", "danger", () => removeRecord("/api/admin/events/", item.id, loadEvents)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderDonations(items) {
    const list = $("#donationList");
    list.replaceChildren();
    if (!items.length) { list.textContent = "अभी कोई verified donation record नहीं है।"; return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = `${item.date} · ${item.status}`;
      const title = document.createElement("h3");
      title.textContent = `₹${Number(item.amount).toLocaleString("en-IN")}`;
      const body = document.createElement("p");
      body.textContent = item.note || "व्यवस्थापक द्वारा सत्यापित";
      copy.append(meta, title, body);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      actions.append(actionButton("Delete", "danger", () => removeRecord("/api/admin/donations/", item.id, loadDonations)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderMusic(items) {
    const list = $("#musicList");
    list.replaceChildren();
    if (!items.length) { list.textContent = "अभी कोई bhakti track नहीं जोड़ा गया है।"; return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = `${item.kind} · ${item.active ? "ACTIVE" : "Inactive"} · ${item.published ? "Published" : "Draft"}`;
      const title = document.createElement("h3");
      title.textContent = item.title;
      const body = document.createElement("p");
      body.textContent = item.url;
      copy.append(meta, title, body);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      actions.append(actionButton("Edit", "", () => setForm("musicForm", { ...item, thumbnailUrl: item.thumbnailUrl || "", sortOrder: 0 })));
      if (!item.active) actions.append(actionButton("Set active", "", () => updateMusic(item, loadMusic)));
      actions.append(actionButton("Delete", "danger", () => removeRecord("/api/admin/music/", item.id, loadMusic)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderTimings(items) {
    const list = $("#timingList");
    list.replaceChildren();
    if (!items.length) { list.textContent = "समिति ने अभी कोई आरती/दर्शन समय दर्ज नहीं किया है।"; return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = `${item.published ? "Published" : "Draft"} · ${item.time}`;
      const title = document.createElement("h3");
      title.textContent = item.label;
      const body = document.createElement("p");
      body.textContent = item.note || "";
      copy.append(meta, title, body);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      actions.append(actionButton("Edit", "", () => setForm("timingForm", item)));
      actions.append(actionButton("Delete", "danger", () => removeRecord("/api/admin/timings/", item.id, loadTimings)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderQuiz(items) {
    const list = $("#quizList");
    list.replaceChildren();
    if (!items.length) { list.textContent = "अभी Admin ने कोई custom प्रश्न नहीं जोड़ा है। Built-in bank active है।"; return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = `${item.published ? "Published" : "Draft"} · सही उत्तर ${Number(item.answer) + 1}`;
      const title = document.createElement("h3");
      title.textContent = item.question;
      const body = document.createElement("p");
      body.textContent = Array.isArray(item.options) ? item.options.join(" · ") : "";
      copy.append(meta, title, body);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      actions.append(actionButton("Edit", "", () => setForm("quizForm", item)));
      actions.append(actionButton("Delete", "danger", () => removeRecord("/api/admin/quiz/", item.id, loadQuiz)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderEngagement(items) {
    const list = $("#engagementList");
    list.replaceChildren();
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const title = document.createElement("h3");
      title.textContent = item.name;
      const body = document.createElement("p");
      body.textContent = `${item.likeCount} likes`;
      card.append(title, body);
      list.appendChild(card);
    });
    if (!items.length) list.textContent = "अभी कोई deity engagement नहीं है।";
  }

  function renderReports(items) {
    const list = $("#reportList");
    list.replaceChildren();
    if (!items.length) { list.textContent = "अभी कोई community report नहीं है।"; return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const title = document.createElement("h3");
      title.textContent = item.reporterName;
      const body = document.createElement("p");
      body.textContent = `${item.reason} · ${item.postId ? `Post #${item.postId}` : `Comment #${item.commentId}`}`;
      card.append(title, body);
      list.appendChild(card);
    });
  }

  function renderCompanions(items) {
    const list = $("#companionList");
    list.replaceChildren();
    if (!items.length) {
      list.textContent = "अभी कोई साथी नहीं जोड़ा गया है।";
      return;
    }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = item.name;
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = item.role;
      const body = document.createElement("p");
      body.textContent = item.bio;
      copy.append(meta, title, body);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      actions.append(actionButton("Edit", "", () => setForm("companionForm", item)));
      actions.append(actionButton("Remove", "danger", () => removeRecord("/api/admin/companions/", item.id, loadCompanions)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderGallery(items) {
    const list = $("#galleryList");
    list.replaceChildren();
    if (!items.length) {
      list.textContent = "अभी कोई नई photo upload नहीं है।";
      return;
    }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card gallery-record";
      const image = document.createElement("img");
      image.className = "record-thumb";
      image.src = item.imageUrl;
      image.alt = item.caption;
      const copy = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = item.category;
      const title = document.createElement("h3");
      title.textContent = item.caption;
      copy.append(meta, title);
       const actions = document.createElement("div");
       actions.className = "record-actions";
       actions.append(actionButton("Edit", "", () => setForm("galleryForm", item)));
       actions.append(actionButton("Delete", "danger", () => removeRecord("/api/admin/gallery/", item.id, loadGallery)));
      card.append(image, copy, actions);
      list.appendChild(card);
    });
  }

  function renderUsers(items) {
    const list = $("#userList");
    list.replaceChildren();
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = item.role === "owner" ? "Main Admin / Owner" : `Admin${item.canManageAdmins ? " · Admin management" : ""}`;
      const title = document.createElement("h3");
      title.textContent = item.name;
        copy.append(meta, title);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      if (item.role !== "owner" && item.id !== currentUser.id) actions.append(actionButton("Remove", "danger", () => removeRecord("/api/admin/users/", item.id, loadUsers)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderSettings(settings) {
    const form = $("#settingsForm");
    if (!form || !settings) return;
    Object.entries(settings).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field) {
        if (field.type === "checkbox") field.checked = Boolean(value);
        else if (field.type !== "file") field.value = value ?? "";
      }
      if (key.endsWith("ImageUrl")) {
        const input = form.elements[key.replace(/Url$/, "")];
        const preview = input?.nextElementSibling;
        if (preview?.classList.contains("file-preview") && value) { preview.src = value; preview.hidden = false; }
      }
    });
  }

  function renderDonors(items) {
    const list = $("#donorList");
    list.replaceChildren();
    if (!items.length) {
      list.textContent = "अभी कोई donor name प्रकाशित नहीं है।";
      return;
    }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "record-card";
      const copy = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "record-meta";
      meta.textContent = item.published ? "Website पर प्रकाशित" : "Draft";
      const title = document.createElement("h3");
      title.textContent = item.name;
      copy.append(meta, title);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      actions.append(actionButton("Edit", "", () => setForm("donorForm", item)));
      actions.append(actionButton("Delete", "danger", () => removeRecord("/api/admin/donors/", item.id, loadDonors)));
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  async function removeRecord(prefix, id, refresh) {
    if (!window.confirm("क्या आप इसे हटाना चाहते हैं?")) return;
    try {
      await api(`${prefix}${id}`, { method: "DELETE" });
      showToast("हटा दिया गया।");
      await refresh();
      loadDashboard();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function loadDashboard() {
    try {
      renderStats(await api("/api/admin/dashboard"));
    } catch (error) {
      showToast(error.message);
    }
  }

  async function loadNotices() {
    renderNotices((await api("/api/admin/notices")).notices || []);
  }

  async function loadEvents() {
    renderEvents((await api("/api/admin/events")).events || []);
  }

  async function loadDonations() {
    renderDonations((await api("/api/admin/donations")).donations || []);
  }

  async function loadMusic() {
    renderMusic((await api("/api/admin/music")).tracks || []);
  }

  async function loadTimings() {
    renderTimings((await api("/api/admin/timings")).timings || []);
  }

  async function loadQuiz() {
    renderQuiz((await api("/api/admin/quiz")).questions || []);
  }

  async function loadEngagement() {
    const [engagement, reports] = await Promise.all([api("/api/admin/deity-engagement"), api("/api/admin/community/reports")]);
    renderEngagement(engagement.deities || []);
    renderReports(reports.reports || []);
  }

  async function updateMusic(item, refresh) {
    try {
      await api(`/api/admin/music/${item.id}`, { method: "PUT", body: { title: item.title, url: item.url, kind: item.kind, thumbnailUrl: item.thumbnailUrl || "", published: true, active: true, sortOrder: 0 } });
      showToast("Active bhakti track बदल गया।");
      await refresh();
    } catch (error) { showToast(error.message); }
  }

  async function submitJsonEditor(form, endpoint, refresh, successMessage) {
    const id = form.elements.id.value;
    await api(id ? `${endpoint}/${id}` : endpoint, { method: id ? "PUT" : "POST", body: formPayload(form) });
    resetForm(form.id);
    showMessage($(`[data-message="${form.id}"]`), successMessage);
    await refresh();
    loadDashboard();
  }

  async function loadCompanions() {
    renderCompanions((await api("/api/admin/companions")).companions || []);
  }

  async function loadGallery() {
    renderGallery((await api("/api/admin/gallery")).gallery || []);
  }

  async function loadUsers() {
    renderUsers((await api("/api/admin/users")).users || []);
  }

  async function loadSettings() {
    renderSettings((await api("/api/admin/settings")).settings || {});
  }

  async function loadDonors() {
    renderDonors((await api("/api/admin/donors")).donors || []);
  }

  async function loadAll() {
    await loadDashboard();
    await loadSettings();
    await loadNotices();
    await loadEvents();
    await loadTimings();
    await loadMusic();
    await loadQuiz();
    await loadDonations();
    await loadCompanions();
    await loadGallery();
    await loadDonors();
    await loadEngagement();
    if (currentUser.role === "owner" || currentUser.canManageAdmins) await loadUsers();
  }

  function formPayload(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  $("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    showMessage(loginMessage, "Login हो रहा है...");
    try {
      const data = await api("/api/auth/login", { method: "POST", body: formPayload(event.currentTarget) });
      showApp(data.user);
    } catch (error) {
      showMessage(loginMessage, error.message, true);
    }
  });

  $("#logoutButton").addEventListener("click", async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch (_error) { /* Session is already gone. */ }
    showLogin();
  });

  queryAll(".admin-tabs button").forEach(button => button.addEventListener("click", () => {
    queryAll(".admin-tabs button").forEach(item => item.classList.toggle("active", item === button));
    queryAll(".admin-panel").forEach(panel => {
      const active = panel.dataset.panel === button.dataset.tab;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
  }));

  queryAll('[data-reset]').forEach(button => button.addEventListener("click", () => resetForm(button.dataset.reset)));
  bindFilePreviews();

  $("#noticeForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-message="noticeForm"]');
    try {
      const id = form.elements.id.value;
      await api(id ? `/api/admin/notices/${id}` : "/api/admin/notices", { method: id ? "PUT" : "POST", body: formPayload(form) });
      resetForm("noticeForm");
      showMessage(message, "सूचना सुरक्षित हो गई।");
      await loadNotices();
      loadDashboard();
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });

  $("#eventForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-message="eventForm"]');
    try {
      const id = form.elements.id.value;
      await api(id ? `/api/admin/events/${id}` : "/api/admin/events", { method: id ? "PUT" : "POST", body: formPayload(form) });
      resetForm("eventForm");
      showMessage(message, "कार्यक्रम सुरक्षित हो गया।");
      await loadEvents();
      loadDashboard();
    } catch (error) { showMessage(message, error.message, true); }
  });

  $("#donationForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-message="donationForm"]');
    try {
      await api("/api/admin/donations", { method: "POST", body: formPayload(form) });
      resetForm("donationForm");
      showMessage(message, "Verified donation record सुरक्षित हो गया।");
      await loadDonations();
      loadDashboard();
    } catch (error) { showMessage(message, error.message, true); }
  });

  $("#timingForm").addEventListener("submit", async event => {
    event.preventDefault();
    try { await submitMultipart(event.currentTarget, "/api/admin/timings", loadTimings); showMessage($('[data-message="timingForm"]'), "आरती/दर्शन समय सुरक्षित हो गया।"); }
    catch (error) { showMessage($('[data-message="timingForm"]'), error.message, true); }
  });

  $("#musicForm").addEventListener("submit", async event => {
    event.preventDefault();
    try { await submitMultipart(event.currentTarget, "/api/admin/music", loadMusic); showMessage($('[data-message="musicForm"]'), "भक्ति संगीत track सुरक्षित हो गया।"); }
    catch (error) { showMessage($('[data-message="musicForm"]'), error.message, true); }
  });

  $("#quizForm").addEventListener("submit", async event => {
    event.preventDefault();
    try { await submitJsonEditor(event.currentTarget, "/api/admin/quiz", loadQuiz, "Quiz प्रश्न सुरक्षित हो गया।"); }
    catch (error) { showMessage($('[data-message="quizForm"]'), error.message, true); }
  });

  async function submitMultipart(form, endpoint, refresh) {
    const data = new FormData(form);
    const id = data.get("id");
    data.delete("id");
    await api(id ? `${endpoint}/${id}` : endpoint, { method: id ? "PUT" : "POST", body: data });
    form.reset();
    if (form.elements.id) form.elements.id.value = "";
    await refresh();
    loadDashboard();
  }

  $("#companionForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = $('[data-message="companionForm"]');
    try {
      await submitMultipart(event.currentTarget, "/api/admin/companions", loadCompanions);
      showMessage(message, "साथी की जानकारी सुरक्षित हो गई।");
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });

  $("#galleryForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = $('[data-message="galleryForm"]');
    try {
      await submitMultipart(event.currentTarget, "/api/admin/gallery", loadGallery);
      showMessage(message, "Photo upload हो गई।");
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });

  $("#settingsForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-message="settingsForm"]');
    try {
      await api("/api/admin/settings", { method: "PUT", body: new FormData(form) });
      form.querySelectorAll('input[type="file"]').forEach(input => { input.value = ""; });
      showMessage(message, "Public content सुरक्षित हो गया।");
      await loadSettings();
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });

  $("#donorForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-message="donorForm"]');
    try {
      const id = form.elements.id.value;
      await api(id ? `/api/admin/donors/${id}` : "/api/admin/donors", { method: id ? "PUT" : "POST", body: formPayload(form) });
      resetForm("donorForm");
      showMessage(message, "Donor name सुरक्षित हो गया।");
      await loadDonors();
      loadDashboard();
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });

  $("#userForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = $('[data-message="userForm"]');
    try {
      await api("/api/admin/users", { method: "POST", body: formPayload(event.currentTarget) });
      resetForm("userForm");
      showMessage(message, "नया Admin सुरक्षित रूप से जोड़ दिया गया।");
      await loadUsers();
      loadDashboard();
    } catch (error) {
      showMessage(message, error.message, true);
    }
  });

  (async () => {
    try {
      const data = await api("/api/auth/me");
      showApp(data.user);
    } catch (_error) {
      showLogin();
    }
  })();
})();
