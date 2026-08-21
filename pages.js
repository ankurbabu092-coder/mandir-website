(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const page = document.body.dataset.page || "features";
  const fallbackDeities = [
    { key: "durga", name: "माता दुर्गा जी", description: "मंदिर में विराजित माता दुर्गा जी के शांत और श्रद्धापूर्ण दर्शन।", imageUrl: "assets/original/IMG_20260819_105150.jpg", likeCount: 0 },
    { key: "ram-janki", name: "श्री राम जानकी परिवार", description: "मंदिर में सजे श्री राम जानकी परिवार का वास्तविक छायाचित्र।", imageUrl: "assets/original/IMG_20260819_105212.jpg", likeCount: 0 },
    { key: "hanuman", name: "श्री हनुमान जी", description: "सेवा, साहस और राम-भक्ति का स्मरण कराते हनुमान जी।", imageUrl: "assets/asset-2.jpg", likeCount: 0 },
    { key: "shiv-family", name: "शिव परिवार", description: "मंदिर परिसर से जुड़ा शिव परिवार दर्शन।", imageUrl: "assets/original/IMG_20260818_185612.jpg", likeCount: 0 },
    { key: "shri-ram", name: "श्री राम जी", description: "मर्यादा, करुणा और धैर्य का शांत स्मरण।", imageUrl: "assets/original/IMG_20260819_105217.jpg", likeCount: 0 },
    { key: "mata-darshan", name: "माता का दर्शन", description: "मंदिर परिसर में माता की प्रतिमा का वास्तविक दर्शन।", imageUrl: "assets/original/IMG_20260819_105229.jpg", likeCount: 0 }
  ];

  function addText(parent, tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text || "";
    parent.appendChild(element);
    return element;
  }

  function addLink(parent, label, href, className = "") {
    const link = document.createElement("a");
    link.className = className;
    link.href = href;
    link.textContent = label;
    parent.appendChild(link);
    return link;
  }

  async function getContent() {
    try {
      const response = await fetch("/api/public/content", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Public content unavailable");
      return await response.json();
    } catch (_error) {
      return { deities: fallbackDeities, timings: [], music: [], notices: [] };
    }
  }

  function renderDeities(items) {
    const grid = $("#deityGrid");
    if (!grid) return;
    grid.replaceChildren();
    (items.length ? items : fallbackDeities).forEach(item => {
      const card = document.createElement("article");
      card.className = "page-card deity-card";
      const image = document.createElement("img");
      image.className = "page-card-image";
      image.src = item.imageUrl;
      image.alt = item.name;
      image.loading = "lazy";
      const copy = document.createElement("div");
      copy.className = "page-card-copy";
      addText(copy, "h3", "", item.name);
      addText(copy, "p", "", item.description);
      const like = document.createElement("button");
      like.className = "deity-like";
      like.type = "button";
      like.textContent = `❤️ दर्शन पसंद · ${Number(item.likeCount) || 0}`;
      like.addEventListener("click", async () => {
        like.disabled = true;
        try {
          const response = await fetch(`/api/public/deities/${encodeURIComponent(item.key)}/like`, { method: "POST", headers: { Accept: "application/json" } });
          if (!response.ok) throw new Error("Like unavailable");
          const result = await response.json();
          like.classList.toggle("is-liked", result.liked);
          like.textContent = `${result.liked ? "❤️ पसंद किया" : "♡ पसंद हटाया"} · ${Number(result.likeCount) || 0}`;
        } catch (_error) {
          like.textContent = "अभी प्रतिक्रिया उपलब्ध नहीं है";
        } finally { like.disabled = false; }
      });
      copy.appendChild(like);
      card.append(image, copy);
      grid.appendChild(card);
    });
  }

  function renderTimings(items) {
    const grid = $("#timingGrid");
    if (!grid) return;
    grid.replaceChildren();
    const featureImage = $("#timingPhoto");
    if (featureImage && items[0]?.photoUrl) featureImage.src = items[0].photoUrl;
    if (!items.length) { addText(grid, "div", "empty-state", "समिति ने अभी आरती और दर्शन का समय website पर दर्ज नहीं किया है। कृपया मंदिर सूचना या समिति से पुष्टि करें।"); return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "schedule-card";
      addText(card, "span", "schedule-icon", "🪔");
      const copy = document.createElement("div");
      addText(copy, "strong", "", item.label);
       addText(copy, "small", "", `${item.time}${item.description || item.note ? ` · ${item.description || item.note}` : ""}`);
       if (item.audioUrl) {
         const audio = document.createElement("audio");
         audio.controls = true;
         audio.preload = "none";
         audio.src = item.audioUrl;
         copy.appendChild(audio);
       }
      card.appendChild(copy);
      grid.appendChild(card);
    });
  }

  function renderNotices(items) {
    const list = $("#noticeGrid");
    if (!list) return;
    list.replaceChildren();
    if (!items.length) { addText(list, "div", "empty-state", "अभी कोई managed मंदिर सूचना प्रकाशित नहीं है।"); return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = `page-card notice-card${item.important ? " is-important" : ""}`;
      addText(card, "span", "notice-meta", `${item.date || "मंदिर सूचना"}${item.important ? " · महत्वपूर्ण" : ""}`);
      addText(card, "h3", "", item.title);
      addText(card, "p", "", item.body);
      list.appendChild(card);
    });
  }

  function renderMusic(items) {
    const grid = $("#musicGrid");
    if (!grid) return;
    grid.replaceChildren();
    if (!items.length) { addText(grid, "div", "empty-state", "समिति ने अभी कोई भक्ति track प्रकाशित नहीं किया है।"); return; }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = `page-card track-card${item.active ? " is-active" : ""}`;
      if (item.thumbnailUrl) {
        const image = document.createElement("img");
        image.className = "page-card-image";
        image.src = item.thumbnailUrl;
        image.alt = item.title;
        image.loading = "lazy";
        card.appendChild(image);
      }
      const copy = document.createElement("div");
      copy.className = "page-card-copy";
      if (item.active) addText(copy, "span", "active-badge", "अभी active");
      addText(copy, "span", "track-meta", item.kind === "audio" ? "Direct audio" : item.kind === "youtube" ? "YouTube" : "Video");
      addText(copy, "h3", "", item.title);
      if (item.kind === "audio") {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "none";
        audio.src = item.url;
        copy.appendChild(audio);
      } else addLink(copy, "बाहरी player में खोलें ↗", item.url, "track-link").target = "_blank";
      card.appendChild(copy);
      grid.appendChild(card);
    });
  }

  function bindPage(content) {
    renderDeities(content.deities || []);
    renderTimings(content.timings || []);
    renderNotices(content.notices || []);
    renderMusic(content.music || []);
    const active = (content.music || []).find(item => item.active);
    const activeTitle = $("#activeTrackTitle");
    if (activeTitle) activeTitle.textContent = active ? `अभी active: ${active.title}` : "अभी कोई active bhakti track नहीं है।";
    const whatsappUrl = content.settings?.whatsappUrl;
    if (whatsappUrl) document.querySelectorAll('a[href*="chat.whatsapp.com"]').forEach(link => { link.href = whatsappUrl; });
  }

  getContent().then(bindPage);
})();
