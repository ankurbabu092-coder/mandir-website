(() => {
      "use strict";

       // Public content is read from the same-origin API; private Admin data stays server-side.
      const templeConfig = {
        name: "श्री राम जानकी",
        place: "मै-राम कुटी, बरपरवा-कुंवरपुरा",
        address: "G7X5+3W9, Harihar Purwa, Uttar Pradesh 273212",
        totalFund: null,
        upiId: null,
        live: { active: false, url: null },
        adminApiBase: null
      };
      window.templeConfig = templeConfig;

      const $ = (selector, root = document) => root.querySelector(selector);
      const queryAll = (selector, root = document) => [...root.querySelectorAll(selector)];
      const site = $("#site");
      const main = $("main");
      const intro = $("#intro");
      const bell = $("#bellButton");
      const bellAudio = $("#bellAudio");
      const bellWrap = $("#bellWrap");
      const ripple = $("#introRipple");
      const heroImage = $(".hero-image");
      let entered = false;

      window.addEventListener("scroll", () => {
        if (heroImage) heroImage.style.setProperty("--parallax-y", `${Math.min(window.scrollY * 0.035, 18)}px`);
      }, { passive: true });

      // Keep visual flow independent of the upload order while preserving a simple single-file deliverable.
      const sectionOrder = ["morning", "todayDarshan", "darshan", "todayMessage", "notices", "sangath", "community", "seva", "gallery", "events", "live", "location", "contact", "closing"];
      sectionOrder.forEach(id => {
        const section = document.getElementById(id);
        if (section) main.appendChild(section);
      });

      function bellSound() {
        if (bellAudio) {
          bellAudio.currentTime = 0;
          const playback = bellAudio.play();
          if (playback && typeof playback.catch === "function") playback.catch(() => {});
          return;
        }
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const audio = new AudioContext();
        const now = audio.currentTime;
        const master = audio.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        master.connect(audio.destination);
        [392, 588, 784].forEach((frequency, index) => {
          const oscillator = audio.createOscillator();
          const partial = audio.createGain();
          oscillator.type = index === 0 ? "sine" : "triangle";
          oscillator.frequency.value = frequency;
          partial.gain.value = index === 0 ? 1 : 0.24;
          oscillator.connect(partial).connect(master);
          oscillator.start(now);
          oscillator.stop(now + 2.5);
        });
        window.setTimeout(() => audio.close().catch(() => {}), 2800);
      }

      function enterTemple(playSound = false) {
        if (entered) return;
        entered = true;
        if (playSound) bellSound();
        bell.classList.remove("is-ringing");
        void bell.offsetWidth;
        bell.classList.add("is-ringing");
        ripple.classList.remove("is-on");
        void ripple.offsetWidth;
        ripple.classList.add("is-on");
        if (navigator.vibrate && playSound) navigator.vibrate([18, 26, 18]);
        window.setTimeout(() => {
          intro.classList.add("is-leaving");
          site.classList.add("is-visible");
          window.setTimeout(() => intro.remove(), 900);
        }, playSound ? 620 : 120);
      }

      bell.addEventListener("click", () => enterTemple(true));
      $("#skipEntry").addEventListener("click", () => enterTemple(false));
      let pointerStart = 0;
      bellWrap.addEventListener("pointerdown", event => {
        pointerStart = event.clientY;
        bellWrap.setPointerCapture?.(event.pointerId);
      });
      bellWrap.addEventListener("pointerup", event => {
        if (Math.abs(event.clientY - pointerStart) > 12) enterTemple(true);
      });
      let dragStartX = 0;
      let draggingBell = false;
      bellWrap.addEventListener("pointerdown", event => {
        dragStartX = event.clientX;
        draggingBell = true;
        bell.classList.add("is-dragging");
      });
      bellWrap.addEventListener("pointermove", event => {
        if (!draggingBell || entered) return;
        const rotation = Math.max(-18, Math.min(18, (event.clientX - dragStartX) / 3));
        bell.style.transform = `rotate(${rotation}deg)`;
      });
      bellWrap.addEventListener("pointercancel", () => {
        draggingBell = false;
        bell.style.transform = "";
        bell.classList.remove("is-dragging");
      });
      bellWrap.addEventListener("pointerup", event => {
        if (!draggingBell) return;
        draggingBell = false;
        bell.style.transform = "";
        bell.classList.remove("is-dragging");
        if (Math.abs(event.clientX - dragStartX) > 14) enterTemple(true);
      });

      const menuBtn = $("#menuBtn");
      const mobileMenu = $("#mobileMenu");
      menuBtn.addEventListener("click", () => {
        const open = mobileMenu.classList.toggle("is-open");
        menuBtn.setAttribute("aria-expanded", String(open));
        menuBtn.setAttribute("aria-label", open ? "मेन्यू बंद करें" : "मेन्यू खोलें");
      });
      queryAll(".mobile-menu a").forEach(link => link.addEventListener("click", () => {
        mobileMenu.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      }));

      const toast = $("#toast");
      let toastTimer;
      function showToast(message) {
        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
      }

      let galleryItems = [];
      const lightbox = $("#lightbox");
      const lightboxImage = $("#lightboxImage");
      const lightboxCaption = $("#lightboxCaption");
      let lightboxIndex = 0;
      function openLightbox(index) {
        lightboxIndex = (index + galleryItems.length) % galleryItems.length;
        const item = galleryItems[lightboxIndex];
        lightboxImage.src = item.dataset.lightbox;
        lightboxImage.alt = item.dataset.caption || "मंदिर का चित्र";
        lightboxCaption.textContent = item.dataset.caption || "";
        lightbox.classList.add("is-open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      }
      function closeLightbox() {
        lightbox.classList.remove("is-open");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }
      function bindGalleryItems() {
        galleryItems = queryAll('[data-lightbox]');
        galleryItems.forEach(item => {
          if (item.dataset.lightboxBound) return;
          item.dataset.lightboxBound = "true";
          item.addEventListener("click", () => openLightbox(galleryItems.indexOf(item)));
        });
      }
      bindGalleryItems();
      $("#lightboxClose").addEventListener("click", closeLightbox);
      $("#lightboxPrev").addEventListener("click", () => openLightbox(lightboxIndex - 1));
      $("#lightboxNext").addEventListener("click", () => openLightbox(lightboxIndex + 1));
      lightbox.addEventListener("click", event => { if (event.target === lightbox) closeLightbox(); });
      document.addEventListener("keydown", event => {
        if (!lightbox.classList.contains("is-open")) return;
        if (event.key === "Escape") closeLightbox();
        if (event.key === "ArrowLeft") openLightbox(lightboxIndex - 1);
        if (event.key === "ArrowRight") openLightbox(lightboxIndex + 1);
      });

      const voteKey = "ram-janki-vote-v1";
      const joinKey = "ram-janki-join-v1";
      const countKey = "ram-janki-join-count-v1";
      const savedVote = localStorage.getItem(voteKey);
      const joined = localStorage.getItem(joinKey) === "true";
      let joinCount = Number(localStorage.getItem(countKey) || 0);
      $("#joinCount").textContent = String(joinCount);
      if (savedVote) {
        const selected = $(`[data-vote="${savedVote}"]`);
        selected?.classList.add("is-selected");
        $("#decisionResult").textContent = "आपकी राय इस डिवाइस पर पहले ही दर्ज है। धन्यवाद।";
      }
      if (joined) $("#joinButton").textContent = "✓ आप सहभागिता सूची में जुड़ चुके हैं";
      queryAll('[data-vote]').forEach(button => button.addEventListener("click", () => {
        if (localStorage.getItem(voteKey)) {
          showToast("आपकी राय इस डिवाइस पर पहले ही दर्ज है।");
          return;
        }
        localStorage.setItem(voteKey, button.dataset.vote);
        button.classList.add("is-selected");
        $("#decisionResult").textContent = "आपकी राय दर्ज हो गई है। धन्यवाद।";
        showToast("आपकी सहभागिता दर्ज हो गई।");
      }));
      $("#joinButton").addEventListener("click", () => {
        if (localStorage.getItem(joinKey)) {
          showToast("आप पहले से सहभागिता सूची में जुड़े हैं।");
          return;
        }
        localStorage.setItem(joinKey, "true");
        joinCount += 1;
        localStorage.setItem(countKey, String(joinCount));
        $("#joinCount").textContent = String(joinCount);
        $("#joinButton").textContent = "✓ आप सहभागिता सूची में जुड़ चुके हैं";
        showToast("आप समुदाय की सहभागिता सूची में जुड़ गए हैं।");
      });

      $("#eventReminder").addEventListener("click", () => showToast("कार्यक्रम की तारीखें जुड़ने पर यह सूचना सक्रिय होगी।"));
      $("#callButton").addEventListener("click", () => showToast("समिति का संपर्क नंबर जल्द जोड़ा जाएगा।"));
      $("#whatsappButton").addEventListener("click", () => showToast("समिति का WhatsApp नंबर जल्द जोड़ा जाएगा।"));
      $("#returnDarshan").addEventListener("click", () => $("#todayDarshan")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      $("#liveButton").addEventListener("click", event => {
        if (event.currentTarget.getAttribute("aria-disabled") === "true") {
          event.preventDefault();
          showToast("Live दर्शन का link जल्द जोड़ा जाएगा।");
        }
      });
      const anonymousToggle = $("#anonymousToggle");
      const anonymousSaved = localStorage.getItem("ram-janki-anonymous") === "true";
      anonymousToggle.checked = anonymousSaved;
      anonymousToggle.addEventListener("change", () => {
        localStorage.setItem("ram-janki-anonymous", String(anonymousToggle.checked));
        $("#anonymousNote").textContent = anonymousToggle.checked ? "आपका नाम सार्वजनिक नहीं दिखेगा।" : "नाम गुप्त रखना चाहें तो समिति को बताएं";
        showToast(anonymousToggle.checked ? "नाम गुप्त रखने की पसंद सुरक्षित है।" : "नाम दिखाने की पसंद सुरक्षित है।");
      });
      if (anonymousSaved) $("#anonymousNote").textContent = "आपका नाम सार्वजनिक नहीं दिखेगा।";

      function addText(parent, tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = text || "";
        parent.appendChild(element);
        return element;
      }

      function renderManagedNotices(notices) {
        if (!notices.length) return;
        const list = $(".notice-list");
        if (!list) return;
        list.replaceChildren();
        notices.forEach(notice => {
          const row = document.createElement("article");
           row.className = `notice-row managed-notice${notice.important ? " is-important" : ""}`;
          addText(row, "span", `notice-symbol${notice.important ? " green" : ""}`, notice.important ? "✦" : "📢");
          const content = document.createElement("div");
          addText(content, "span", "notice-date", notice.date || "मंदिर सूचना");
          addText(content, "h3", "", notice.title);
          addText(content, "p", "", notice.body);
          row.appendChild(content);
          addText(row, "span", "notice-chevron", "›");
          list.appendChild(row);
        });
      }

      function renderManagedCompanions(companions) {
        const grid = $("#companionsGrid");
        if (!grid || !companions.length) return;
        grid.replaceChildren();
        companions.forEach(item => {
          const card = document.createElement("article");
          card.className = "companion-card";
          if (item.photoUrl) {
            const image = document.createElement("img");
            image.src = item.photoUrl;
            image.alt = item.name;
            image.loading = "lazy";
            card.appendChild(image);
          } else {
            addText(card, "span", "companion-placeholder", "ॐ");
          }
          const copy = document.createElement("div");
          addText(copy, "h3", "", item.name);
          addText(copy, "span", "companion-role", item.role);
           addText(copy, "p", "", item.bio);
           card.appendChild(copy);
           card.tabIndex = 0;
           card.setAttribute("role", "button");
           card.setAttribute("aria-expanded", "false");
           const toggleDetails = () => {
             const expanded = card.classList.toggle("is-expanded");
             card.setAttribute("aria-expanded", String(expanded));
           };
           card.addEventListener("click", toggleDetails);
           card.addEventListener("keydown", event => {
             if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleDetails(); }
           });
           grid.appendChild(card);
        });
      }

      function renderManagedSettings(settings) {
        if (!settings) return;
        const darshan = settings.darshan || {};
        const morning = settings.morning || {};
        const message = settings.message || {};
        const donation = settings.donation || {};
        const live = settings.live || {};
        if (darshan.imageUrl) $("#darshanImage").src = darshan.imageUrl;
        if (darshan.message) $("#darshanMessage").textContent = darshan.message;
        if (morning.imageUrl) $("#morningImage").src = morning.imageUrl;
        if (morning.message) $("#morningMessage").textContent = morning.message;
        if (message.body) $("#todayMessageBody").textContent = message.body;
        if (message.author) $("#todayMessageAuthor").textContent = `— ${message.author}`;
        $("#donationTotal").textContent = `₹ ${new Intl.NumberFormat("en-IN").format(Number(donation.total) || 0)}`;
        $("#liveStatusTitle").textContent = live.active ? (live.title || "बाबा अभी LIVE हैं") : (live.title || "बाबा अभी Live नहीं हैं");
        $("#liveMessage").textContent = live.message || "जब live दर्शन उपलब्ध होंगे, समिति यहां link सक्रिय करेगी।";
        $("#liveDot").classList.toggle("is-live", Boolean(live.active));
        const liveButton = $("#liveButton");
        liveButton.textContent = live.active ? "LIVE दर्शन देखें" : "LIVE दर्शन जल्द";
        liveButton.setAttribute("aria-disabled", live.active && live.url ? "false" : "true");
        liveButton.href = live.active && live.url ? live.url : "#";
        liveButton.classList.toggle("live-ready", Boolean(live.active && live.url));
      }

      function renderManagedDonors(donors) {
        const list = $("#supporterList");
        if (!list || !Array.isArray(donors)) return;
        list.replaceChildren();
        if (!donors.length) {
          addText(list, "span", "supporter-chip", "🙏 आपका नाम भी");
          return;
        }
        donors.forEach(donor => addText(list, "span", "supporter-chip", `❤️ ${donor.name}`));
      }

      function renderManagedGallery(items) {
        const grid = $(".gallery-grid");
        if (!grid || !items.length) return;
        items.forEach(item => {
          const card = document.createElement("button");
          card.className = "gallery-card managed-gallery";
          card.type = "button";
          card.dataset.lightbox = item.imageUrl;
          card.dataset.caption = item.caption || "मंदिर की नई झलक";
          const image = document.createElement("img");
          image.src = item.imageUrl;
          image.alt = item.caption || "मंदिर की नई झलक";
          image.loading = "lazy";
          card.appendChild(image);
          addText(card, "span", "", item.caption || item.category || "मंदिर");
          grid.appendChild(card);
        });
        bindGalleryItems();
      }

      async function loadManagedContent() {
        try {
          const response = await fetch("/api/public/content", { headers: { Accept: "application/json" } });
          if (!response.ok) return;
           const content = await response.json();
           renderManagedNotices(Array.isArray(content.notices) ? content.notices : []);
           renderManagedCompanions(Array.isArray(content.companions) ? content.companions : []);
           renderManagedGallery(Array.isArray(content.gallery) ? content.gallery : []);
           renderManagedSettings(content.settings);
           renderManagedDonors(Array.isArray(content.donors) ? content.donors : []);
        } catch (_error) {
          // Static preview mode has no API; the original curated content remains visible.
        }
      }
      loadManagedContent();

      const revealObserver = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: .12 }) : null;
      queryAll('[data-reveal]').forEach((element, index) => {
        element.style.transitionDelay = `${Math.min(index * 45, 180)}ms`;
        if (revealObserver) revealObserver.observe(element); else element.classList.add("is-revealed");
      });
    })();
