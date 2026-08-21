(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { me: null, profiles: [], posts: [], requests: { incoming: [], outgoing: [] }, connections: [] };
  const toast = $("#communityToast");
  let toastTimer;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request पूरा नहीं हो पाया");
    return data;
  }

  function formPayload(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function dateLabel(value) {
    try { return new Intl.DateTimeFormat("hi-IN", { day: "numeric", month: "short" }).format(new Date(value)); }
    catch (_error) { return "अभी"; }
  }

  function initials(name) {
    return String(name || "ॐ").trim().slice(0, 1) || "ॐ";
  }

  function connectionStatus(id) {
    if (state.connections.some(item => item.id === id)) return "CONNECTED";
    const outgoing = state.requests.outgoing.find(item => item.recipientId === id);
    return outgoing?.status || "NONE";
  }

  function renderStats(counts) {
    $("#memberCount").textContent = Number(counts.members || 0).toLocaleString("en-IN");
    $("#connectedCount").textContent = Number(counts.connected || 0).toLocaleString("en-IN");
    $("#todayVisitorCount").textContent = Number(counts.todayVisitors || 0).toLocaleString("en-IN");
  }

  function renderProfile() {
    const form = $("#profileForm");
    const heading = $("#profilePanel h2");
    const copy = $("#profilePanel .panel-copy");
    if (!state.me) {
      heading.textContent = "पहले अपना public नाम बनाएं";
      copy.textContent = "यहां वही नाम लिखें जिसे आप भक्त परिवार में दिखाना चाहते हैं। आप अपना परिचय बाद में बदल सकते हैं।";
      $("#profileName").value = "";
      $("#profileBio").value = "";
      $("#composerPanel").hidden = true;
      return;
    }
    heading.textContent = "आपका भक्त परिवार profile";
    copy.textContent = `नमस्ते ${state.me.name}। आपका profile केवल चुना हुआ नाम और छोटा परिचय दिखाता है।`;
    $("#profileName").value = state.me.name;
    $("#profileBio").value = state.me.bio || "";
    $("#composerPanel").hidden = false;
    form.querySelector("button").textContent = "Profile सुरक्षित करें";
  }

  function renderMembers() {
    const list = $("#memberList");
    list.replaceChildren();
    if (!state.profiles.length) {
      const empty = document.createElement("p");
      empty.className = "empty-copy";
      empty.textContent = "नए भक्त जुड़ने पर profiles यहां दिखाई देंगे।";
      list.appendChild(empty);
      return;
    }
    state.profiles.forEach(profile => {
      const card = document.createElement("article");
      card.className = "member-card";
      const copy = document.createElement("div");
      copy.className = "member-copy";
      const name = document.createElement("strong");
      name.textContent = profile.name;
      const bio = document.createElement("small");
      bio.innerHTML = `<span class="active-dot ${profile.active ? "active" : ""}"></span>${profile.active ? "अभी active" : "भक्ति संगत"}${profile.bio ? ` · ${escapeText(profile.bio)}` : ""}`;
      copy.append(name, bio);
      const actions = document.createElement("div");
      actions.className = "member-actions";
      const status = connectionStatus(profile.id);
      const connect = document.createElement("button");
      connect.type = "button";
      connect.textContent = status === "CONNECTED" ? "✓ जुड़े हैं" : status === "PENDING" ? "Request भेजा" : "Connect";
      connect.disabled = status !== "NONE" || !state.me;
      connect.addEventListener("click", () => sendRequest(profile.id));
      actions.appendChild(connect);
      const block = document.createElement("button");
      block.type = "button";
      block.textContent = "Block";
      block.addEventListener("click", () => blockProfile(profile.id));
      actions.appendChild(block);
      card.append(copy, actions);
      list.appendChild(card);
    });
  }

  function renderRequests() {
    const list = $("#requestList");
    list.replaceChildren();
    const incoming = state.requests.incoming || [];
    const outgoing = state.requests.outgoing || [];
    if (!incoming.length && !outgoing.length) {
      const empty = document.createElement("p");
      empty.className = "empty-copy";
      empty.textContent = "आपके requests यहां दिखाई देंगे।";
      list.appendChild(empty);
      return;
    }
    incoming.filter(item => item.status === "PENDING").forEach(item => {
      const card = document.createElement("article");
      card.className = "request-card";
      const copy = document.createElement("p");
      copy.textContent = `${item.name} आपसे जुड़ना चाहते हैं।`;
      const actions = document.createElement("div");
      actions.className = "request-actions";
      actions.append(requestButton("स्वीकारें", "accept", () => updateRequest(item.id, "ACCEPTED")), requestButton("अभी नहीं", "", () => updateRequest(item.id, "REJECTED")));
      card.append(copy, actions);
      list.appendChild(card);
    });
    outgoing.filter(item => item.status === "PENDING").forEach(item => {
      const card = document.createElement("article");
      card.className = "request-card";
      const status = document.createElement("span");
      status.className = "request-status";
      status.textContent = `${item.name} को connect request भेजी गई है।`;
      card.appendChild(status);
      list.appendChild(card);
    });
  }

  function requestButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function renderPosts() {
    const feed = $("#postFeed");
    feed.replaceChildren();
    if (!state.posts.length) {
      const empty = document.createElement("div");
      empty.className = "loading-card";
      empty.textContent = state.me ? "आप पहला भक्ति संदेश साझा कर सकते हैं।" : "भक्त परिवार में जुड़ने के बाद पहला संदेश साझा करें।";
      feed.appendChild(empty);
      return;
    }
    state.posts.forEach(post => feed.appendChild(postCard(post)));
  }

  function postCard(post) {
    const card = document.createElement("article");
    card.className = "post-card";
    const top = document.createElement("div");
    top.className = "post-top";
    const author = document.createElement("div");
    author.className = "author-line";
    const avatar = document.createElement("span");
    avatar.className = "author-avatar";
    avatar.textContent = initials(post.author.name);
    const authorCopy = document.createElement("div");
    const authorName = document.createElement("strong");
    authorName.className = "author-name";
    authorName.textContent = post.author.name;
    const meta = document.createElement("small");
    meta.className = "author-meta";
    meta.innerHTML = `<span class="active-dot ${post.author.active ? "active" : ""}"></span>${post.author.active ? "active" : "भक्त परिवार"} · ${dateLabel(post.createdAt)}`;
    authorCopy.append(authorName, meta);
    author.append(avatar, authorCopy);
    const report = document.createElement("button");
    report.type = "button";
    report.className = "post-actions-button";
    report.textContent = "•••";
    report.title = "Report post";
    report.addEventListener("click", () => reportTarget({ postId: post.id }));
    top.append(author, report);
    const body = document.createElement("p");
    body.className = "post-body";
    body.textContent = post.body;
    const actions = document.createElement("div");
    actions.className = "post-actions";
    const like = requestButton(`${post.liked ? "♥" : "♡"} ${post.likeCount}`, post.liked ? "liked" : "", () => toggleLike(post.id));
    like.disabled = !state.me;
    actions.appendChild(like);
    card.append(top, body, actions);
    if (post.comments?.length) {
      const comments = document.createElement("div");
      comments.className = "comment-list";
      post.comments.forEach(item => {
        const comment = document.createElement("div");
        comment.className = "comment";
        const name = document.createElement("strong");
        name.textContent = item.author.name;
        comment.append(name, document.createTextNode(item.body));
        comments.appendChild(comment);
      });
      card.appendChild(comments);
    }
    if (state.me) {
      const form = document.createElement("form");
      form.className = "comment-form";
      const input = document.createElement("input");
      input.maxLength = 300;
      input.placeholder = "सम्मान से comment लिखें…";
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = "↗";
      form.append(input, submit);
      form.addEventListener("submit", event => { event.preventDefault(); addComment(post.id, input.value); });
      card.appendChild(form);
    }
    return card;
  }

  function escapeText(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  async function load() {
    try {
      const data = await api("/api/community/bootstrap");
      Object.assign(state, data);
      if (data.whatsappUrl) document.querySelectorAll('a[href*="chat.whatsapp.com"]').forEach(link => { link.href = data.whatsappUrl; });
      renderStats(data.counts || {});
      renderProfile();
      renderMembers();
      renderRequests();
      renderPosts();
    } catch (error) { showToast(error.message); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const message = $("#profileMessage");
    try {
      const data = await api("/api/community/profile", { method: "POST", body: JSON.stringify(formPayload(event.currentTarget)) });
      state.me = data.profile;
      message.textContent = "Profile सुरक्षित हो गया।";
      message.classList.remove("error");
      await load();
    } catch (error) { message.textContent = error.message; message.classList.add("error"); }
  }

  async function savePost(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#postMessage");
    try {
      await api("/api/community/posts", { method: "POST", body: JSON.stringify(formPayload(form)) });
      form.reset();
      message.textContent = "आपका भक्ति संदेश साझा हो गया।";
      await load();
    } catch (error) { message.textContent = error.message; message.classList.add("error"); }
  }

  async function sendRequest(id) {
    try { await api(`/api/community/connect/${id}`, { method: "POST" }); showToast("Connect request भेज दी गई।"); await load(); }
    catch (error) { showToast(error.message); }
  }

  async function updateRequest(id, action) {
    try { await api(`/api/community/requests/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }); showToast(action === "ACCEPTED" ? "अब आप जुड़े हुए हैं।" : "Request हटाई गई।"); await load(); }
    catch (error) { showToast(error.message); }
  }

  async function toggleLike(id) {
    try { await api(`/api/community/posts/${id}/like`, { method: "POST" }); await load(); }
    catch (error) { showToast(error.message); }
  }

  async function addComment(id, body) {
    if (!body.trim()) return;
    try { await api(`/api/community/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }); await load(); }
    catch (error) { showToast(error.message); }
  }

  async function blockProfile(id) {
    if (!window.confirm("इस profile को block करें? उसके posts और requests आपको नहीं दिखेंगे।")) return;
    try { await api(`/api/community/blocks/${id}`, { method: "POST" }); showToast("Profile block कर दी गई।"); await load(); }
    catch (error) { showToast(error.message); }
  }

  async function reportTarget(target) {
    const reason = window.prompt("कृपया छोटा कारण लिखें:");
    if (!reason) return;
    try { await api("/api/community/reports", { method: "POST", body: JSON.stringify({ ...target, reason }) }); showToast("Report समिति तक भेज दी गई।"); }
    catch (error) { showToast(error.message); }
  }

  $("#profileForm").addEventListener("submit", saveProfile);
  $("#postForm").addEventListener("submit", savePost);
  load();
})();
