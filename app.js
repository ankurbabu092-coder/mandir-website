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
       const meditationAudio = $("#meditationAudio");
      const bellWrap = $("#bellWrap");
      const ripple = $("#introRipple");
       const heroImage = $(".hero-image");
       let entered = false;
       const visitorNameKey = "ram-janki-visitor-name-v1";
       const visitorShowNameKey = "ram-janki-visitor-show-name-v1";
       const welcomeModal = $("#welcomeModal");

       function savedVisitorProfile() {
         const name = localStorage.getItem(visitorNameKey) || "";
         return name && name !== "__skipped__" ? { name, showPublic: localStorage.getItem(visitorShowNameKey) !== "false" } : null;
       }

       function closeWelcome() {
         if (welcomeModal?.open) welcomeModal.close();
       }

       function openWelcome(changeName = false) {
         if (!welcomeModal) return;
          const copy = $("#welcomeCopy");
          const savedName = localStorage.getItem(visitorNameKey);
          if (changeName || !savedName || savedName === "__skipped__") {
            const checked = localStorage.getItem(visitorShowNameKey) !== "false";
            copy.innerHTML = `<span class="eyebrow">डिजिटल दर्शन में प्रवेश</span><h2 id="welcomeTitle">🙏 आपका स्वागत है</h2><p>डिजिटल दर्शन में प्रवेश करने से पहले अपना नाम लिखें। भक्त परिवार सूची में नाम दिखाना वैकल्पिक है।</p><form id="welcomeForm"><label for="visitorName">आपका नाम<input id="visitorName" name="visitorName" maxlength="60" autocomplete="name" required placeholder="जैसे: आरती शर्मा"></label><label class="welcome-public-choice"><input type="checkbox" name="showPublic" ${checked ? "checked" : ""}> भक्त परिवार सूची में मेरा नाम दिखाएं <small>वैकल्पिक</small></label><button class="btn btn-primary" type="submit">आगे बढ़ें <span>↗</span></button></form><button class="welcome-skip" id="welcomeSkip" type="button">अभी नहीं, बिना नाम के आगे बढ़ें</button>`;
            bindWelcomeControls();
          }
         welcomeModal.showModal();
         $("#visitorName")?.focus();
       }

       function bindWelcomeControls() {
         const form = $("#welcomeForm");
         const skip = $("#welcomeSkip");
         if (!form || form.dataset.bound) return;
         form.dataset.bound = "true";
          form.addEventListener("submit", async event => {
            event.preventDefault();
            const name = String(new FormData(form).get("visitorName") || "").trim().slice(0, 60);
            if (!name) return;
            const showPublic = new FormData(form).get("showPublic") === "on";
            localStorage.setItem(visitorNameKey, name);
            localStorage.setItem(visitorShowNameKey, String(showPublic));
            await registerVisitor(name, showPublic).catch(() => {});
            $("#welcomeCopy").innerHTML = `<span class="eyebrow">प्रवेश की अनुमति</span><h2 id="welcomeTitle">🙏 स्वागत है, ${escapeText(name)}</h2><p>श्री राम जानकी मंदिर माई राम कुटी न्यास के डिजिटल दर्शन में आपका हार्दिक स्वागत है।</p><button class="btn btn-primary" id="welcomeContinue" type="button">मंदिर में प्रवेश करें <span>↗</span></button>`;
            $("#welcomeContinue").addEventListener("click", () => { closeWelcome(); enterTemple(false); });
          });
         skip?.addEventListener("click", () => { localStorage.setItem(visitorNameKey, "__skipped__"); closeWelcome(); });
       }

       function escapeText(value) {
         return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
       }

       bindWelcomeControls();
       window.setTimeout(() => { if (!localStorage.getItem(visitorNameKey)) openWelcome(); }, 160);
       $("#changeVisitorName")?.addEventListener("click", () => openWelcome(true));

       window.addEventListener("scroll", () => {
         if (heroImage) heroImage.style.setProperty("--parallax-y", `${Math.min(window.scrollY * 0.012, 6)}px`);
       }, { passive: true });

      // Keep visual flow independent of the upload order while preserving a simple single-file deliverable.
        const sectionOrder = ["digitalDarshan", "meditation", "shiva", "baba", "bhaktiTools", "quiz", "bhaktiSahayak", "morning", "todayDarshan", "darshan", "todayMessage", "notices", "sangath", "community", "seva", "gallery", "memories", "events", "live", "location", "contact", "closing"];
      sectionOrder.forEach(id => {
        const section = document.getElementById(id);
        if (section) main.appendChild(section);
      });

       function bellSound() {
         if (!bellAudio) return;
         bellAudio.currentTime = 0;
         const playback = bellAudio.play();
         if (playback && typeof playback.catch === "function") playback.catch(() => {});
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

        let meditationInterval;
        let meditationRemaining = 60;
        const meditationStart = $("#meditationStart");
         const meditationAudioButton = $("#meditationAudioButton");
         const meditationTimer = $("#meditationTimer");
         const meditationStatus = $("#meditationStatus");
         let meditationAudioConfigured = false;
         function renderMeditationTimer() {
           if (meditationTimer) meditationTimer.textContent = `00:${String(meditationRemaining).padStart(2, "0")}`;
         }
         function playMeditationAudio() {
           if (!meditationAudioConfigured || !meditationAudio) {
             meditationStatus.textContent = "भक्ति संगीत अभी configured नहीं है। कृपया शांत होकर दृश्य का अनुभव करें।";
             return;
           }
           meditationAudio.currentTime = 0;
           const playback = meditationAudio.play();
           if (playback && typeof playback.catch === "function") playback.catch(() => { meditationStatus.textContent = "🔊 भक्ति संगीत शुरू करने के लिए नीचे का button दबाएं।"; });
           if (meditationAudioButton) meditationAudioButton.textContent = "🔇 संगीत रोकें";
         }
         meditationAudioButton?.addEventListener("click", () => {
           if (!meditationAudioConfigured || !meditationAudio) {
             meditationStatus.textContent = "भक्ति संगीत link अभी जोड़ा नहीं गया है।";
             return;
           }
           if (meditationAudio.paused) playMeditationAudio();
           else { meditationAudio.pause(); meditationAudioButton.textContent = "🔊 भक्ति संगीत शुरू करें"; }
         });
         meditationStart?.addEventListener("click", () => {
          window.clearInterval(meditationInterval);
           meditationRemaining = 60;
           renderMeditationTimer();
           bellSound();
           playMeditationAudio();
          meditationStart.textContent = "एक मिनट फिर शुरू करें ↺";
          meditationStatus.textContent = "घंटी के बाद बस शांत रहें। सांस को सहज रहने दें।";
          meditationStart.closest(".meditation-card")?.classList.add("is-running");
          meditationInterval = window.setInterval(() => {
            meditationRemaining -= 1;
            renderMeditationTimer();
            if (meditationRemaining <= 0) {
              window.clearInterval(meditationInterval);
              meditationStatus.textContent = "🙏 एक मिनट पूरा हुआ। मन में शांति रखें।";
              meditationStart.closest(".meditation-card")?.classList.remove("is-running");
            }
          }, 1000);
        });

        const journeyNames = ["gate", "bell", "diya", "flower", "darshan"];
       const journeyTabs = queryAll("[data-journey]");
       const journeyScenes = queryAll("[data-scene]");
       let flameFrame = 0;
       let flameRunning = false;

       function activateJourney(name) {
         const index = journeyNames.indexOf(name);
         if (index < 0) return;
         journeyTabs.forEach(tab => {
           const active = tab.dataset.journey === name;
           tab.classList.toggle("is-active", active);
           tab.setAttribute("aria-selected", String(active));
         });
         journeyScenes.forEach(scene => {
           const active = scene.dataset.scene === name;
           scene.hidden = !active;
           scene.classList.toggle("is-active", active);
         });
         $("#journeyCount").textContent = `${String(index + 1).padStart(2, "0")} / 05`;
         if (name === "diya") startFlame();
         else stopFlame();
       }

       function advanceJourney(current) {
         const next = journeyNames[journeyNames.indexOf(current) + 1];
         if (!next) return;
         window.setTimeout(() => activateJourney(next), current === "gate" ? 900 : 450);
         $("#journeyNote").textContent = next === "darshan" ? "दर्शन के लिए कुछ क्षण शांत रहें।" : "अगले पड़ाव के लिए तैयार हैं।";
       }

       function offerPetals() {
         const field = $(".petal-field");
         if (!field) return;
         field.replaceChildren();
         ["#e88b42", "#d84b32", "#f0bd63", "#eaa5a5", "#efdf92"].forEach((color, index) => {
           const petal = document.createElement("i");
           petal.className = "real-petal";
           petal.style.setProperty("--petal-color", color);
           petal.style.setProperty("--petal-x", `${22 + Math.random() * 56}%`);
           petal.style.setProperty("--petal-y", `${58 + Math.random() * 20}%`);
           petal.style.setProperty("--petal-rotate", `${Math.round(Math.random() * 140)}deg`);
           petal.style.animationDelay = `${index * 60}ms`;
           field.append(petal);
         });
       }

       function startFlame() {
         if (flameRunning || !$("#diyaCanvas")) return;
         flameRunning = true;
         const canvas = $("#diyaCanvas");
         const context = canvas.getContext("2d");
         if (!context) return;
         const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
         const draw = time => {
           if (!flameRunning) return;
           const width = canvas.width;
           const height = canvas.height;
           context.clearRect(0, 0, width, height);
           const pulse = reduced ? 0 : Math.sin(time / 170) * 5 + Math.sin(time / 91) * 2;
           const glow = context.createRadialGradient(width / 2, height * .48, 10, width / 2, height * .48, 160 + pulse);
           glow.addColorStop(0, "rgba(255, 212, 109, .25)");
           glow.addColorStop(1, "rgba(255, 112, 25, 0)");
           context.fillStyle = glow;
           context.fillRect(0, 0, width, height);
           const flame = context.createRadialGradient(width / 2, height * .47, 4, width / 2, height * .47, 74);
           flame.addColorStop(0, "rgba(255, 255, 217, .98)");
           flame.addColorStop(.22, "rgba(255, 205, 74, .96)");
           flame.addColorStop(.62, "rgba(239, 91, 23, .8)");
           flame.addColorStop(1, "rgba(195, 40, 17, 0)");
           context.fillStyle = flame;
           context.beginPath();
           context.moveTo(width / 2, height * .18 + pulse / 5);
           context.bezierCurveTo(width / 2 - 44, height * .36, width / 2 - 38 - pulse / 4, height * .52, width / 2, height * .7);
           context.bezierCurveTo(width / 2 + 43, height * .52, width / 2 + 34 + pulse / 3, height * .34, width / 2, height * .18 + pulse / 5);
           context.fill();
           flameFrame = window.requestAnimationFrame(draw);
         };
         flameFrame = window.requestAnimationFrame(draw);
       }

       function stopFlame() {
         flameRunning = false;
         if (flameFrame) window.cancelAnimationFrame(flameFrame);
       }

       journeyTabs.forEach(tab => tab.addEventListener("click", () => activateJourney(tab.dataset.journey)));
       queryAll("[data-journey-action]").forEach(button => button.addEventListener("click", () => {
         const action = button.dataset.journeyAction;
         if (action === "reset") {
           $("[data-scene=gate]").classList.remove("gate-open");
           activateJourney("gate");
           $("#journeyNote").textContent = "द्वार खोलने के लिए बटन दबाएँ। ध्वनि आपकी अनुमति के बाद ही चलेगी।";
           return;
         }
         const scene = $(`[data-scene="${action}"]`);
         if (action === "gate") scene.classList.add("gate-open");
         if (action === "bell") { scene.classList.add("bell-sway"); bellSound(); window.setTimeout(() => scene.classList.remove("bell-sway"), 1400); }
         if (action === "diya") scene.classList.add("diya-lit");
         if (action === "flower") offerPetals();
         $("#journeyNote").textContent = action === "flower" ? "पुष्पांजलि अर्पित हुई। अब शांत होकर दर्शन करें।" : "आपके स्पर्श से यह पड़ाव सक्रिय हुआ।";
         advanceJourney(action);
       }));

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

       $("#eventReminder").addEventListener("click", () => showToast("कार्यक्रम की तारीखें जुड़ने पर यह सूचना सक्रिय होगी।"));
       $("#callButton").addEventListener("click", () => showToast("समिति का संपर्क नंबर जल्द जोड़ा जाएगा।"));
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

       function animateVisitorCounter(target) {
         const counter = $("#visitorCounter");
         if (!counter) return;
         const start = Number(counter.dataset.value || 0);
         const started = performance.now();
         const tick = nowTime => {
           const progress = Math.min((nowTime - started) / 700, 1);
           counter.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - progress, 3))).toLocaleString("en-IN");
           if (progress < 1) window.requestAnimationFrame(tick); else counter.dataset.value = String(target);
         };
         window.requestAnimationFrame(tick);
       }

       function formatJoinedDate(value) {
         if (!value) return "अभी जुड़े";
         try { return `जुड़े: ${new Intl.DateTimeFormat("hi-IN", { day: "numeric", month: "short" }).format(new Date(value))}`; }
         catch (_error) { return "अभी जुड़े"; }
       }

       function renderManagedDevotees(devotees, total) {
         const list = $("#devoteeList");
         if (!list) return;
         $("#devoteeCount").textContent = String(Number(total) || 0);
         list.replaceChildren();
         if (!Array.isArray(devotees) || !devotees.length) {
           addText(list, "span", "devotee-empty", "आप भी नाम से जुड़ सकते हैं।");
           return;
         }
         devotees.forEach(devotee => {
           const card = document.createElement("article");
           card.className = "devotee-chip";
           addText(card, "strong", "", devotee.name);
           addText(card, "small", "", formatJoinedDate(devotee.joinedAt));
           list.appendChild(card);
         });
       }

       async function registerVisitor(name, showPublic) {
         const response = await fetch("/api/public/visit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ displayName: name, showPublic }) });
         if (!response.ok) throw new Error("Visitor registration unavailable");
         const data = await response.json();
         animateVisitorCounter(Number(data.visitors) || 0);
         renderManagedDevotees(data.devotees, data.visitors);
         return data;
       }

      function renderManagedNotices(notices) {
         const indicators = [$("#noticeIndicator"), $("#noticeIndicatorHome")].filter(Boolean);
         indicators.forEach(indicator => { indicator.hidden = !notices.some(notice => notice.important); });
         const list = $(".notice-list");
         if (!list) return;
         list.replaceChildren();
         if (!notices.length) {
           const row = document.createElement("article");
           row.className = "notice-row empty-managed-notice";
           addText(row, "span", "notice-symbol", "✦");
           const content = document.createElement("div");
           addText(content, "span", "notice-date", "मंदिर सूचना");
           addText(content, "h3", "", "अभी कोई managed सूचना प्रकाशित नहीं है");
           addText(content, "p", "", "समिति द्वारा सूचना जोड़े जाने पर यह स्थान अपडेट होगा।");
           row.appendChild(content);
           list.appendChild(row);
           return;
         }
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
         const meditation = settings.meditation || {};
         const live = settings.live || {};
         if (settings.heroImageUrl) $(".hero-image").src = settings.heroImageUrl;
         if (darshan.imageUrl) $("#darshanImage").src = darshan.imageUrl;
         if (darshan.message) $("#darshanMessage").textContent = darshan.message;
         if (morning.imageUrl) $("#morningImage").src = morning.imageUrl;
         if (morning.message) $("#morningMessage").textContent = morning.message;
         if (settings.babaImageUrl) $("#babaImage").src = settings.babaImageUrl;
         if (settings.qrImageUrl) $(".qr-frame img").src = settings.qrImageUrl;
         if (settings.whatsappUrl) queryAll('a[href*="chat.whatsapp.com"]').forEach(link => { link.href = settings.whatsappUrl; });
        if (message.body) $("#todayMessageBody").textContent = message.body;
        if (message.author) $("#todayMessageAuthor").textContent = `— ${message.author}`;
         const verified = donation.verified;
          $("#donationTotal").textContent = verified ? `₹ ${new Intl.NumberFormat("en-IN").format(Number(verified.total) || 0)}` : "दान के लिए QR स्कैन करें";
          $("#donationCount").textContent = verified ? `${verified.count} सत्यापित सहयोग` : "सत्यापित कुल राशि उपलब्ध होने पर ही दिखाई जाएगी";
         if (meditation.audioUrl && meditationAudio) {
           meditationAudio.src = meditation.audioUrl;
           meditationAudioConfigured = true;
           if (meditationAudioButton) meditationAudioButton.disabled = false;
         } else if (meditationAudioButton) {
           meditationAudioButton.disabled = false;
         }
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

        function renderManagedEvents(events) {
          const list = $("#managedEventList");
          if (!list || !Array.isArray(events) || !events.length) return;
          queryAll(".empty-event").forEach(card => { card.hidden = true; });
          list.replaceChildren();
         events.forEach(event => {
           const card = document.createElement("article");
           card.className = "managed-event-card";
           addText(card, "span", "event-date", event.date || "मंदिर कार्यक्रम");
           addText(card, "h3", "", event.title);
           addText(card, "p", "", event.body);
           list.appendChild(card);
         });
       }

        function renderManagedTimings(timings) {
          const grid = $(".schedule-grid");
          if (!grid) return;
          grid.replaceChildren();
          if (!Array.isArray(timings) || !timings.length) {
            const empty = document.createElement("article");
            empty.className = "schedule-empty";
            addText(empty, "span", "schedule-icon", "🕰️");
            const copy = document.createElement("div");
            addText(copy, "b", "", "समय समिति द्वारा दर्ज किया जाएगा");
            addText(copy, "small", "", "सही आरती और दर्शन समय के लिए मंदिर सूचना या समिति से पुष्टि करें।");
            empty.appendChild(copy);
            grid.appendChild(empty);
            return;
          }
          timings.forEach(item => {
           const card = document.createElement("article");
           card.className = "schedule-card";
           addText(card, "span", "schedule-icon", "🪔");
           const copy = document.createElement("div");
           addText(copy, "b", "", item.label);
           addText(copy, "small", "", `${item.time}${item.note ? ` · ${item.note}` : ""}`);
           addText(card, "span", "schedule-arrow", "↗");
           card.appendChild(copy);
           grid.appendChild(card);
         });
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
            const visitor = savedVisitorProfile();
            if (visitor) await registerVisitor(visitor.name, visitor.showPublic);
            const response = await fetch("/api/public/content", { headers: { Accept: "application/json" } });
           if (!response.ok) return;
            const content = await response.json();
            animateVisitorCounter(Number(content.visitors) || 0);
            renderManagedDevotees(content.devotees, content.visitors);
             const memberCount = $("#communityMemberCount");
             if (memberCount) memberCount.textContent = Number(content.communityMembers || 0).toLocaleString("en-IN");
             renderManagedNotices(Array.isArray(content.notices) ? content.notices : []);
             renderManagedTimings(Array.isArray(content.timings) ? content.timings : []);
            renderManagedCompanions(Array.isArray(content.companions) ? content.companions : []);
           renderManagedGallery(Array.isArray(content.gallery) ? content.gallery : []);
            renderManagedSettings(content.settings);
            renderManagedDonors(Array.isArray(content.donors) ? content.donors : []);
             renderManagedEvents(Array.isArray(content.events) ? content.events : []);
             if (Array.isArray(content.quiz) && content.quiz.length > 0) {
               quizBank.splice(0, quizBank.length, ...content.quiz);
               quizQuestions = buildQuizSession();
               quizIndex = 0;
               quizScore = 0;
               renderQuiz();
             }
            const message = content.settings?.message;
            if (message?.body) $("#dailyBhaktiMessage").textContent = message.body;
            if (message?.author) $("#dailyBhaktiAuthor").textContent = `— ${message.author}`;
            if (content.donationSummary) {
               $("#donationTotal").textContent = `₹ ${new Intl.NumberFormat("en-IN").format(Number(content.donationSummary.total) || 0)}`;
               $("#donationCount").textContent = `${content.donationSummary.count} सत्यापित सहयोग`;
            }
        } catch (_error) {
          // Static preview mode has no API; the original curated content remains visible.
        }
      }
       loadManagedContent();

        const quizBank = [
          { question: "भगवान राम की जीवनसंगिनी कौन हैं?", options: ["माता सीता", "माता राधा", "माता सरस्वती", "माता गंगा"], answer: 0, explanation: "रामायण परंपरा में माता सीता भगवान राम की जीवनसंगिनी हैं।" },
          { question: "भगवान राम के पिता का नाम क्या था?", options: ["राजा दशरथ", "राजा जनक", "राजा शांतनु", "राजा द्रुपद"], answer: 0, explanation: "अयोध्या के राजा दशरथ भगवान राम के पिता के रूप में रामायण में वर्णित हैं।" },
          { question: "भगवान राम की माता का नाम क्या था?", options: ["माता कौशल्या", "माता कैकेयी", "माता सुमित्रा", "माता देवकी"], answer: 0, explanation: "माता कौशल्या भगवान राम की माता के रूप में पूजनीय हैं।" },
          { question: "भगवान राम के छोटे भाई और वनवास में साथ चलने वाले कौन थे?", options: ["लक्ष्मण", "भरत", "शत्रुघ्न", "नकुल"], answer: 0, explanation: "लक्ष्मण जी ने वनवास के समय भगवान राम और माता सीता के साथ सेवा की।" },
          { question: "भरत जी किस गुण के लिए विशेष रूप से स्मरण किए जाते हैं?", options: ["भाई-भक्ति और त्याग", "समुद्र यात्रा", "संगीत रचना", "वन्य जीवन"], answer: 0, explanation: "भरत जी का जीवन भाई-भक्ति, त्याग और मर्यादा का सुंदर उदाहरण माना जाता है।" },
          { question: "शत्रुघ्न जी किसके भाई थे?", options: ["भगवान राम", "भगवान कृष्ण", "भगवान शिव", "भगवान गणेश"], answer: 0, explanation: "शत्रुघ्न जी भगवान राम, लक्ष्मण और भरत के भाई थे।" },
          { question: "भगवान राम की जन्मभूमि की परंपरागत पहचान क्या है?", options: ["अयोध्या", "मथुरा", "द्वारका", "उज्जैन"], answer: 0, explanation: "अयोध्या को भगवान राम की जन्मभूमि के रूप में श्रद्धा से स्मरण किया जाता है।" },
          { question: "भगवान राम का प्रमुख आयुध क्या माना जाता है?", options: ["धनुष-बाण", "त्रिशूल", "चक्र", "वज्र"], answer: 0, explanation: "रामायण में भगवान राम धनुष-बाण धारण करने वाले मर्यादा पुरुषोत्तम के रूप में वर्णित हैं।" },
          { question: "रामायण परंपरा में वनवास की अवधि कितने वर्ष बताई जाती है?", options: ["चौदह वर्ष", "पांच वर्ष", "दस वर्ष", "इक्कीस वर्ष"], answer: 0, explanation: "रामायण कथा में भगवान राम का वनवास चौदह वर्ष का बताया गया है।" },
          { question: "माता सीता के पिता का नाम क्या था?", options: ["राजा जनक", "राजा दशरथ", "राजा ययाति", "राजा नल"], answer: 0, explanation: "माता सीता को जनकनंदिनी कहा जाता है, क्योंकि उनके पिता राजा जनक थे।" },
          { question: "हनुमान जी किस भाव के लिए सबसे अधिक स्मरण किए जाते हैं?", options: ["सेवा और भक्ति", "व्यापार", "राजसिंहासन", "विलास"], answer: 0, explanation: "हनुमान जी की कथा निःस्वार्थ सेवा, साहस और राम-भक्ति का स्मरण कराती है।" },
          { question: "हनुमान जी की माता का नाम क्या बताया जाता है?", options: ["अंजना", "कौशल्या", "सुमित्रा", "गौरी"], answer: 0, explanation: "परंपरा में हनुमान जी की माता का नाम अंजना बताया जाता है।" },
          { question: "हनुमान जी को किस देवता का अंश या पुत्र कहा जाता है?", options: ["वायु देव", "सूर्य देव", "अग्नि देव", "वरुण देव"], answer: 0, explanation: "हनुमान जी को पवनपुत्र और वायु देव से जुड़े रूप में श्रद्धा से स्मरण किया जाता है।" },
          { question: "हनुमान जी ने समुद्र पार करके किस स्थान की यात्रा की?", options: ["लंका", "अयोध्या", "द्वारका", "काशी"], answer: 0, explanation: "रामायण कथा में हनुमान जी समुद्र पार करके लंका पहुंचे थे।" },
          { question: "हनुमान जी ने संजीवनी किसके लिए लाई थी?", options: ["लक्ष्मण जी", "भरत जी", "सुग्रीव जी", "जाम्बवान जी"], answer: 0, explanation: "रामायण परंपरा में हनुमान जी लक्ष्मण जी के उपचार के लिए संजीवनी लाए थे।" },
          { question: "सुंदरकांड में मुख्य रूप से किसकी भक्ति और यात्रा का वर्णन है?", options: ["हनुमान जी", "भरत जी", "विभीषण जी", "जनक जी"], answer: 0, explanation: "सुंदरकांड हनुमान जी के साहस, सेवा और लंका-यात्रा से विशेष रूप से जुड़ा है।" },
          { question: "जाम्बवान जी ने हनुमान जी को क्या स्मरण कराया था?", options: ["उनकी शक्ति", "उनका राज्य", "उनका धन", "उनकी आयु"], answer: 0, explanation: "कथा में जाम्बवान जी हनुमान जी को उनकी सुप्त शक्ति का स्मरण कराते हैं।" },
          { question: "रामायण में भगवान राम की सहायता करने वाली सेना किस नाम से जानी जाती है?", options: ["वानर सेना", "नाग सेना", "गंधर्व सेना", "यक्ष सेना"], answer: 0, explanation: "भगवान राम की लंका यात्रा में वानर सेना ने सेवा और सहयोग किया।" },
          { question: "रामसेतु किस यात्रा से जुड़ा है?", options: ["राम की लंका यात्रा", "कृष्ण की द्वारका यात्रा", "शिव की कैलास यात्रा", "गंगा की यात्रा"], answer: 0, explanation: "रामसेतु को भगवान राम की सेना द्वारा लंका पहुंचने की कथा से जोड़ा जाता है।" },
          { question: "विभीषण जी किसके भाई थे?", options: ["रावण", "सुग्रीव", "जाम्बवान", "जनक"], answer: 0, explanation: "रामायण में विभीषण जी रावण के भाई और धर्म के पक्षधर के रूप में वर्णित हैं।" },
          { question: "माता सीता को लंका में किस वन में रखा गया था?", options: ["अशोक वाटिका", "नंदन वन", "वृंदावन", "पंचवटी"], answer: 0, explanation: "रामायण कथा में माता सीता अशोक वाटिका में थीं।" },
          { question: "लंका का राजा किसे बताया गया है?", options: ["रावण", "कंस", "जरासंध", "शिशुपाल"], answer: 0, explanation: "रामायण परंपरा में रावण लंका का राजा और भगवान राम का विरोधी था।" },
          { question: "कुंभकर्ण किसका भाई था?", options: ["रावण", "हनुमान", "सुग्रीव", "लक्ष्मण"], answer: 0, explanation: "कुंभकर्ण रावण का भाई था और लंका की कथा में उसका उल्लेख आता है।" },
          { question: "दीपक का सबसे सरल आध्यात्मिक भाव क्या है?", options: ["प्रकाश और आशा", "प्रतिस्पर्धा", "शोर", "विश्राम"], answer: 0, explanation: "दीपक भीतर और बाहर प्रकाश, आशा और जागरूकता का प्रतीक माना जाता है।" },
          { question: "प्रार्थना का एक शांत उद्देश्य क्या हो सकता है?", options: ["मन को स्थिर करना", "दूसरों से जीतना", "धन दिखाना", "शोर बढ़ाना"], answer: 0, explanation: "प्रार्थना मन को ठहराने और कृतज्ञता जगाने का अवसर देती है।" },
          { question: "मंत्र जप में किस भाव की आवश्यकता होती है?", options: ["एकाग्रता और श्रद्धा", "जल्दबाजी", "क्रोध", "उदासीनता"], answer: 0, explanation: "मंत्र जप को शांत एकाग्रता और श्रद्धा के साथ करना मनन का सरल तरीका है।" },
          { question: "निःस्वार्थ सेवा का अर्थ क्या है?", options: ["बिना स्वार्थ सहायता", "केवल प्रसिद्धि", "दूसरों से दूरी", "प्रतियोगिता"], answer: 0, explanation: "सेवा का भाव किसी लाभ की अपेक्षा के बिना सहायता करने से जुड़ा है।" },
          { question: "सत्संग शब्द किस संगति की ओर संकेत करता है?", options: ["सत्य और सद्भाव की संगति", "केवल व्यापारिक संगति", "एकांत", "खेल"], answer: 0, explanation: "सत्संग को सत्य, सद्विचार और अच्छे लोगों की संगति के रूप में समझा जाता है।" },
          { question: "पूजा का सामान्य अर्थ क्या है?", options: ["श्रद्धा से उपासना", "यात्रा", "भोजन बनाना", "व्यायाम"], answer: 0, explanation: "पूजा श्रद्धा, स्मरण और उपासना का विनम्र रूप है।" },
          { question: "आरती में सामान्यतः क्या घुमाया जाता है?", options: ["दीप या प्रकाश", "धनुष", "फूलों का पेड़", "जलता हुआ कपड़ा"], answer: 0, explanation: "आरती में दीप या प्रकाश को श्रद्धा से घुमाने की परंपरा है।" },
          { question: "प्रसाद किस भाव का प्रतीक है?", options: ["कृपा और साझा कृतज्ञता", "प्रतिस्पर्धा", "संग्रह", "दिखावा"], answer: 0, explanation: "प्रसाद को कृपा मानकर विनम्रता और कृतज्ञता से ग्रहण किया जाता है।" },
          { question: "नमस्कार का भाव क्या व्यक्त करता है?", options: ["सम्मान और विनम्रता", "क्रोध", "उपेक्षा", "भय"], answer: 0, explanation: "नमस्कार भारतीय परंपरा में सम्मान, विनम्रता और शुभकामना का भाव है।" },
          { question: "भजन किस प्रकार का गीत होता है?", options: ["भक्ति गीत", "यात्रा गीत", "खेल गीत", "विज्ञापन"], answer: 0, explanation: "भजन ईश्वर-स्मरण और भक्ति का गीत होता है।" },
          { question: "कीर्तन का संबंध किससे है?", options: ["सामूहिक भक्ति-गायन", "कृषि", "व्यापार", "चित्रकला"], answer: 0, explanation: "कीर्तन में भक्त मिलकर नाम-स्मरण और भक्ति-गायन करते हैं।" },
          { question: "ध्यान का एक सरल अभ्यास क्या है?", options: ["श्वास पर शांत ध्यान", "लगातार बोलना", "जल्दबाजी", "शोर सुनना"], answer: 0, explanation: "श्वास पर शांत ध्यान मन को वर्तमान क्षण में लौटाने का सरल अभ्यास है।" },
          { question: "करुणा का अर्थ क्या है?", options: ["दूसरों के दुख को समझकर सहायता", "दूसरों को हराना", "अपमान करना", "दूरी बनाना"], answer: 0, explanation: "करुणा में दूसरों के दुख को समझना और संभव सहायता करना शामिल है।" },
          { question: "सत्य का सरल अर्थ क्या है?", options: ["सच्चाई", "दिखावा", "चालाकी", "भ्रम"], answer: 0, explanation: "सत्य का अर्थ सच्चाई और ईमानदार आचरण से है।" },
          { question: "श्रद्धा किस भाव से जुड़ी है?", options: ["विश्वास और सम्मान", "अवमानना", "अधीरता", "उपहास"], answer: 0, explanation: "श्रद्धा में विश्वास, सम्मान और विनम्रता का भाव होता है।" },
          { question: "मंदिर का सामान्य उद्देश्य क्या है?", options: ["उपासना और मनन का स्थान", "केवल बाजार", "खेल का मैदान", "कार्यालय"], answer: 0, explanation: "मंदिर उपासना, शांति, सेवा और मनन के लिए पवित्र स्थान माना जाता है।" },
          { question: "मंदिर की घंटी बजाने का एक सामान्य भाव क्या है?", options: ["ध्यान को ईश्वर-स्मरण की ओर लाना", "शोर की प्रतियोगिता", "समय बताना", "खेल शुरू करना"], answer: 0, explanation: "घंटी की ध्वनि मन को एकाग्र करके प्रार्थना के भाव में लाने का संकेत मानी जाती है।" },
          { question: "पुष्प अर्पण किस भाव का शांत संकेत है?", options: ["श्रद्धा और विनम्रता", "क्रोध", "जल्दबाजी", "व्यापार"], answer: 0, explanation: "फूल अर्पित करना श्रद्धा, सुंदरता और विनम्रता का सरल भाव है।" },
          { question: "शंख की ध्वनि को सामान्यतः किस भाव से जोड़ा जाता है?", options: ["शुभ आरंभ", "शोक", "प्रतियोगिता", "मौन"], answer: 0, explanation: "शंख की ध्वनि को कई पूजा परंपराओं में शुभ आरंभ और पवित्रता से जोड़ा जाता है।" },
          { question: "कमल किस आध्यात्मिक प्रतीक से जुड़ा माना जाता है?", options: ["पवित्रता", "क्रोध", "आलस्य", "भ्रम"], answer: 0, explanation: "कमल कीचड़ में खिलकर भी निर्मल रहने के कारण पवित्रता का प्रतीक माना जाता है।" },
          { question: "भगवान शिव का प्रमुख आयुध क्या है?", options: ["त्रिशूल", "धनुष-बाण", "चक्र", "गदा"], answer: 0, explanation: "भगवान शिव को त्रिशूल धारण करने वाले देवता के रूप में श्रद्धा से स्मरण किया जाता है।" },
          { question: "भगवान शिव का वाहन कौन है?", options: ["नंदी", "गरुड़", "मयूर", "मूषक"], answer: 0, explanation: "नंदी को भगवान शिव का वाहन और भक्त रूप में स्मरण किया जाता है।" },
          { question: "माता पार्वती किसकी अर्धांगिनी मानी जाती हैं?", options: ["भगवान शिव", "भगवान राम", "भगवान विष्णु", "भगवान सूर्य"], answer: 0, explanation: "माता पार्वती भगवान शिव की अर्धांगिनी के रूप में पूजनीय हैं।" },
          { question: "परंपरा में गंगा किस देवता की जटाओं से जुड़ी हैं?", options: ["भगवान शिव", "भगवान राम", "हनुमान जी", "भगवान गणेश"], answer: 0, explanation: "गंगा अवतरण की कथा में भगवान शिव की जटाओं का स्मरण किया जाता है।" },
          { question: "भगवान शिव का तीसरा नेत्र किसका प्रतीक माना जाता है?", options: ["ज्ञान और अंतर्दृष्टि", "धन", "यात्रा", "भोजन"], answer: 0, explanation: "तीसरा नेत्र ज्ञान, विवेक और गहरी अंतर्दृष्टि का प्रतीक माना जाता है।" },
          { question: "डमरू किस देवता से जुड़ा वाद्य है?", options: ["भगवान शिव", "भगवान राम", "इंद्र देव", "सूर्य देव"], answer: 0, explanation: "डमरू भगवान शिव के रूप और नाद से जुड़ा पवित्र वाद्य माना जाता है।" },
          { question: "महाशिवरात्रि किस देवता की आराधना का प्रमुख पर्व है?", options: ["भगवान शिव", "भगवान राम", "हनुमान जी", "भगवान कृष्ण"], answer: 0, explanation: "महाशिवरात्रि भगवान शिव की आराधना और जागरण से जुड़ा प्रमुख पर्व है।" },
          { question: "राम नवमी किसके जन्मोत्सव से जुड़ी है?", options: ["भगवान राम", "भगवान शिव", "माता सीता", "हनुमान जी"], answer: 0, explanation: "राम नवमी भगवान राम के जन्मोत्सव के रूप में मनाई जाती है।" },
          { question: "हनुमान जयंती किसकी स्मृति में मनाई जाती है?", options: ["हनुमान जी", "लक्ष्मण जी", "भरत जी", "सुग्रीव जी"], answer: 0, explanation: "हनुमान जयंती हनुमान जी के प्राकट्य और भक्ति का स्मरण करने का अवसर है।" },
          { question: "दीपावली की रामायण परंपरा किस घटना से जुड़ी है?", options: ["राम का अयोध्या लौटना", "राम का जन्म", "हनुमान का जन्म", "शिव का विवाह"], answer: 0, explanation: "दीपावली को भगवान राम के अयोध्या लौटने की परंपरागत कथा से जोड़ा जाता है।" },
          { question: "भगवद्गीता का संवाद किस युद्धभूमि से जुड़ा है?", options: ["कुरुक्षेत्र", "लंका", "अयोध्या", "मथुरा"], answer: 0, explanation: "भगवद्गीता का संवाद कुरुक्षेत्र की युद्धभूमि में अर्जुन और श्रीकृष्ण के बीच बताया गया है।" },
          { question: "श्री राम जानकी मंदिर माई राम कुटी न्यास किस स्थान पर है?", options: ["बरपारवा, हरिहरपुर, गोरखपुर", "अयोध्या, उत्तर प्रदेश", "वाराणसी, उत्तर प्रदेश", "जयपुर, राजस्थान"], answer: 0, explanation: "वेबसाइट पर दिए गए आधिकारिक परिचय के अनुसार मंदिर बरपारवा, हरिहरपुर, गोरखपुर, उत्तर प्रदेश में है।" },
          { question: "डिजिटल पुष्पांजलि में फूलों का भाव क्या है?", options: ["श्रद्धा अर्पित करना", "दौड़ लगाना", "उत्सव की घोषणा", "खेल शुरू करना"], answer: 0, explanation: "पुष्प अर्पण श्रद्धा, विनम्रता और प्रेम का शांत संकेत है।" }
        ];
        let quizQuestions = [];
        function shuffle(items) {
          const result = [...items];
          for (let index = result.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.random() * (index + 1));
            [result[index], result[swap]] = [result[swap], result[index]];
          }
          return result;
        }
        function buildQuizSession() {
          const historyKey = "ram-janki-quiz-sequence-v2";
          const previous = localStorage.getItem(historyKey) || "";
          let selected = [];
          let signature = previous;
          for (let attempt = 0; attempt < 8 && signature === previous; attempt += 1) {
            selected = shuffle(quizBank).slice(0, 5);
            signature = selected.map(item => item.question).join("|");
          }
          localStorage.setItem(historyKey, signature);
          return selected.map(item => {
            const options = shuffle(item.options.map((text, index) => ({ text, correct: index === item.answer })));
            return { ...item, options: options.map(option => option.text), answer: options.findIndex(option => option.correct) };
          });
        }
       let quizIndex = 0;
       let quizScore = 0;
       let quizAnswered = false;
       const quizQuestion = $("#quizQuestion");
       const quizOptions = $("#quizOptions");
       const quizFeedback = $("#quizFeedback");
       const quizNext = $("#quizNext");

       function renderQuiz() {
         const item = quizQuestions[quizIndex];
         quizAnswered = false;
          $("#quizProgress").textContent = `प्रश्न ${quizIndex + 1} / 5`;
         $("#quizScore").textContent = `${quizScore} अंक`;
         quizQuestion.textContent = item.question;
         quizFeedback.textContent = "";
         quizNext.hidden = true;
         quizNext.textContent = quizIndex === quizQuestions.length - 1 ? "परिणाम देखें ↗" : "अगला प्रश्न ↗";
         quizOptions.replaceChildren();
         item.options.forEach((option, optionIndex) => {
           const button = document.createElement("button");
           button.type = "button";
           button.className = "quiz-option";
           button.textContent = option;
           button.addEventListener("click", () => answerQuiz(optionIndex, button));
           quizOptions.appendChild(button);
         });
       }

       function answerQuiz(optionIndex, selected) {
         if (quizAnswered) return;
         quizAnswered = true;
         const item = quizQuestions[quizIndex];
         const options = queryAll(".quiz-option", quizOptions);
         options.forEach((button, index) => {
           button.disabled = true;
           if (index === item.answer) button.classList.add("is-correct");
         });
         if (optionIndex === item.answer) {
           quizScore += 1;
           selected.classList.add("is-correct");
            quizFeedback.textContent = `✅ सही उत्तर\n${item.explanation}`;
          } else {
            selected.classList.add("is-wrong");
            quizFeedback.textContent = `❌ सही उत्तर: ${item.options[item.answer]}\n${item.explanation}`;
         }
         $("#quizScore").textContent = `${quizScore} अंक`;
         quizNext.hidden = false;
       }

       quizNext.addEventListener("click", () => {
          if (quizNext.dataset.restart === "true") {
            quizNext.dataset.restart = "";
            quizIndex = 0;
            quizScore = 0;
            quizQuestions = buildQuizSession();
            renderQuiz();
           return;
         }
         if (quizIndex === quizQuestions.length - 1) {
            quizQuestion.textContent = `🙏 आपका स्कोर: ${quizScore}/5`;
           quizOptions.replaceChildren();
           quizFeedback.textContent = quizScore === quizQuestions.length ? "बहुत सुंदर। आपका मनन पूरा हुआ।" : "फिर से खेलकर कुछ और सीखें, या आज का संदेश पढ़ें।";
           quizNext.textContent = "फिर से खेलें ↺";
            quizNext.dataset.restart = "true";
            return;
         }
             quizIndex += 1;
          renderQuiz();
        });
        quizQuestions = buildQuizSession();
        renderQuiz();

        const aiForm = $("#aiForm");
        const aiMic = $("#aiMic");
        const aiLanguage = $("#aiLanguage");
        const aiReplay = $("#aiReplay");
        const aiStop = $("#aiStop");
        const aiVoiceStatus = $("#aiVoiceStatus");
         let lastAiAnswer = "";
         const aiHistory = [];
        let recognition = null;
        let speechLanguage = "hi-IN";
        let speaking = false;
        function speakAiAnswer(text = lastAiAnswer) {
          if (!text || !("speechSynthesis" in window)) {
            if (aiVoiceStatus) aiVoiceStatus.textContent = "इस browser में voice output उपलब्ध नहीं है।";
            return;
          }
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
           utterance.lang = speechLanguage;
          utterance.rate = 0.92;
          utterance.onstart = () => { speaking = true; if (aiVoiceStatus) aiVoiceStatus.textContent = "🔊 सुनाया जा रहा है…"; if (aiStop) aiStop.disabled = false; };
          utterance.onend = () => { speaking = false; if (aiVoiceStatus) aiVoiceStatus.textContent = ""; if (aiStop) aiStop.disabled = true; };
          window.speechSynthesis.speak(utterance);
        }
        async function askBhakti(message) {
         const responseBox = $("#aiResponse");
         const status = $("#aiStatus");
         responseBox.textContent = "भक्ति सहायक उत्तर तैयार कर रहा है…";
         status.textContent = "कृपया एक क्षण प्रतीक्षा करें।";
         try {
            const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ message, history: aiHistory.slice(-8) }) });
            const data = await response.json();
            lastAiAnswer = data.answer || "आज का भक्ति संदेश: मन को शांत करके श्रद्धा से एक दीप जलाइए।";
             aiHistory.push({ role: "user", text: message }, { role: "model", text: lastAiAnswer });
             if (aiHistory.length > 8) aiHistory.splice(0, aiHistory.length - 8);
            responseBox.textContent = lastAiAnswer;
            status.textContent = data.available ? "Gemini से सुरक्षित server-side उत्तर" : "स्थानीय भक्ति उत्तर • Gemini अभी कॉन्फ़िगर नहीं है";
            if (aiReplay) aiReplay.disabled = false;
            speakAiAnswer(lastAiAnswer);
         } catch (_error) {
            lastAiAnswer = "आज का भक्ति संदेश: मन को शांत करके श्रद्धा से एक दीप जलाइए।";
            responseBox.textContent = lastAiAnswer;
            status.textContent = "भक्ति सहायक अभी उपलब्ध नहीं है। बाकी साइट सामान्य रूप से चल रही है।";
         }
       }
       aiForm?.addEventListener("submit", event => {
         event.preventDefault();
         const input = $("#aiInput");
         askBhakti(input.value.trim() || "आज का भक्ति संदेश");
         input.value = "";
       });
        queryAll("[data-ai-question]").forEach(button => button.addEventListener("click", () => askBhakti(button.dataset.aiQuestion)));
        aiReplay?.addEventListener("click", () => speakAiAnswer());
        aiStop?.addEventListener("click", () => { window.speechSynthesis?.cancel(); speaking = false; aiStop.disabled = true; if (aiVoiceStatus) aiVoiceStatus.textContent = ""; });
        aiLanguage?.addEventListener("click", () => {
          speechLanguage = speechLanguage === "hi-IN" ? "en-IN" : "hi-IN";
          aiLanguage.textContent = speechLanguage === "hi-IN" ? "हिंदी" : "English";
          if (recognition) recognition.lang = speechLanguage;
        });
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (Recognition) {
          recognition = new Recognition();
          recognition.lang = speechLanguage;
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          recognition.onstart = () => { if (aiMic) aiMic.classList.add("is-listening"); if (aiVoiceStatus) aiVoiceStatus.textContent = "🎙️ सुन रहा हूँ…"; };
          recognition.onresult = event => {
            const text = event.results[0]?.[0]?.transcript?.trim();
            if (text) { $("#aiInput").value = text; askBhakti(text); }
          };
           recognition.onerror = event => { if (aiVoiceStatus) aiVoiceStatus.textContent = event.error === "not-allowed" ? "Mic permission नहीं मिली। नीचे लिखकर पूछें।" : "Mic input उपलब्ध नहीं हो पाया। फिर प्रयास करें।"; };
          recognition.onend = () => { aiMic?.classList.remove("is-listening"); };
           aiMic?.addEventListener("click", () => { if (speaking) window.speechSynthesis.cancel(); try { recognition.start(); } catch (_error) { if (aiVoiceStatus) aiVoiceStatus.textContent = "🎙️ पहले से सुन रहा हूँ…"; } });
         } else if (aiMic) {
           aiMic.disabled = true;
           aiMic.title = "इस browser में Speech Recognition उपलब्ध नहीं है";
           if (aiVoiceStatus) aiVoiceStatus.textContent = "Voice input इस browser में उपलब्ध नहीं है। नीचे लिखकर पूछें।";
         }

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
