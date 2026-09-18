/* SkillSwap — shared frontend interactions.
   Backend intentionally absent: this layer keeps every UI control functional
   (navigation, dropdowns, filtering, form UX) with client-only behaviour. */
(function () {
  "use strict";

  /* ---------- Toast ---------- */
  function ensureToastHost() {
    var host = document.getElementById("ss-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "ss-toast-host";
      host.style.cssText =
        "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;";
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(msg, kind) {
    var host = ensureToastHost();
    var el = document.createElement("div");
    var bg = kind === "success" ? "#22c55e" : kind === "error" ? "#ef4444" : "#0a0a0a";
    el.textContent = msg;
    el.style.cssText =
      "pointer-events:auto;background:" +
      bg +
      ";color:#fff;font:600 14px/1.3 Inter,sans-serif;padding:10px 18px;border-radius:9999px;box-shadow:0 6px 20px rgba(10,10,10,.18);opacity:0;transform:translateY(8px);transition:all .25s ease;max-width:90vw;text-align:center;";
    host.appendChild(el);
    requestAnimationFrame(function () {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(function () {
        el.remove();
      }, 260);
    }, 2600);
  }
  window.ssToast = toast;

  function go(url) {
    window.location.href = url;
  }

  function closeAllMenus(except) {
    document.querySelectorAll("[data-ss-menu]").forEach(function (m) {
      if (m !== except) m.classList.add("hidden");
    });
  }

  document.addEventListener("click", function () {
    closeAllMenus(null);
  });

  /* ---------- Dropdown builder ---------- */
  function attachDropdown(triggerBtn, buildContent, align) {
    if (!triggerBtn) return;
    var panel = document.createElement("div");
    panel.setAttribute("data-ss-menu", "");
    panel.className =
      "hidden absolute mt-2 w-72 bg-canvas rounded-2xl shadow-[0_12px_40px_rgba(10,10,10,0.18)] ring-1 ring-hairline z-[120] overflow-hidden";
    panel.style.top = "100%";
    if (align === "left") {
      panel.style.left = "0";
    } else {
      panel.style.right = "0";
    }
    panel.innerHTML = buildContent();
    // trigger's parent may not be positioned; wrap
    var host = triggerBtn.parentElement;
    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }
    host.appendChild(panel);
    triggerBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willOpen = panel.classList.contains("hidden");
      closeAllMenus(panel);
      panel.classList.toggle("hidden", !willOpen);
    });
    panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    return panel;
  }

  /* ---------- Header: notifications ---------- */
  function initNotifications() {
    var btn = document.querySelector('button[aria-label="Notifications"]');
    if (!btn) return;
    attachDropdown(
      btn,
      function () {
        return (
          '<div class="px-4 py-3 border-b border-hairline flex items-center justify-between">' +
          '<span class="font-title-sm text-title-sm text-ink font-bold">Notifications</span>' +
          '<span class="px-2 py-0.5 rounded-full bg-brand-pink/20 text-brand-pink font-caption text-[11px] font-bold">3 new</span></div>' +
          '<div class="max-h-80 overflow-y-auto">' +
          notifRow("swap_horiz", "brand-mint", "Mila accepted your swap", "3D clay rig ⇄ Next.js build · 2m ago") +
          notifRow("rate_review", "brand-ochre", "Review needed on #SWAP-8921", "Approve to release escrow · 1h ago") +
          notifRow("payments", "brand-lavender", "Payout of $3,410 is ready", "Withdraw to your account · 4h ago") +
          "</div>" +
          '<a href="bookings.html" class="block text-center px-4 py-3 border-t border-hairline font-button text-button text-ink hover:bg-surface-soft transition-colors">View all activity</a>'
        );
      },
      "right"
    );
    function notifRow(icon, color, title, sub) {
      return (
        '<div class="flex items-start gap-3 px-4 py-3 hover:bg-surface-soft transition-colors cursor-pointer">' +
        '<span class="w-9 h-9 rounded-full bg-' +
        color +
        '/30 text-ink flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[18px]">' +
        icon +
        "</span></span>" +
        '<div class="min-w-0"><p class="font-caption text-caption text-ink font-semibold">' +
        title +
        '</p><p class="font-caption text-[11px] text-muted">' +
        sub +
        "</p></div></div>"
      );
    }
  }

  /* ---------- Header: user menu ---------- */
  function initUserMenu() {
    var btn = document.querySelector('button[aria-label="User menu"]');
    if (!btn) return;
    attachDropdown(
      btn,
      function () {
        return (
          '<div class="px-4 py-3 border-b border-hairline"><p class="font-title-sm text-title-sm text-ink font-bold">Maya Rivera</p>' +
          '<p class="font-caption text-[11px] text-muted">Tier 2 Verified Creator</p></div>' +
          '<div class="py-1">' +
          menuLink("dashboard.html", "grid_view", "Creator Dashboard") +
          menuLink("bookings.html", "calendar_today", "My Bookings") +
          menuLink("post-gig.html", "add_circle", "Post a Gig") +
          menuLink("#", "settings", "Account Settings") +
          "</div>" +
          '<div class="py-1 border-t border-hairline">' +
          '<button type="button" data-ss-signout class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-soft transition-colors text-error">' +
          '<span class="material-symbols-outlined text-[20px]">logout</span><span class="font-nav-link text-nav-link">Sign out</span></button></div>'
        );
      },
      "right"
    );
    function menuLink(href, icon, label) {
      return (
        '<a href="' +
        href +
        '" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-soft transition-colors text-ink">' +
        '<span class="material-symbols-outlined text-[20px] text-muted">' +
        icon +
        '</span><span class="font-nav-link text-nav-link">' +
        label +
        "</span></a>"
      );
    }
    var so = btn.parentElement.querySelector("[data-ss-signout]");
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-ss-signout]")) {
        toast("Signed out (demo)", "success");
      }
    });
  }

  /* ---------- Header: mobile nav drawer ---------- */
  function initMobileNav() {
    var headerRow = document.querySelector(
      "header .h-16.max-w-7xl"
    );
    // Dashboard has its own aside; skip when no header row here.
    if (!headerRow) return;

    // Build hamburger, fixed on the left at mobile widths.
    var burger = document.createElement("button");
    burger.type = "button";
    burger.setAttribute("aria-label", "Open menu");
    burger.className =
      "xl:hidden fixed top-3 left-3 z-[60] flex items-center justify-center w-10 h-10 rounded-full bg-canvas text-ink shadow-md transition-colors";
    burger.innerHTML = '<span class="material-symbols-outlined text-[22px]">menu</span>';
    document.body.appendChild(burger);

    var overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 z-[130] bg-ink/50 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-200 xl:hidden";
    var drawer = document.createElement("aside");
    drawer.className =
      "fixed top-0 left-0 h-full w-72 max-w-[80vw] bg-canvas z-[140] shadow-2xl -translate-x-full transition-transform duration-200 xl:hidden flex flex-col p-space-md gap-space-md";

    var links = [
      ["index.html", "storefront", "Explore Marketplace"],
      ["post-gig.html", "add_circle", "Post a Gig"],
      ["dashboard.html", "grid_view", "Creator Dashboard"],
      ["bookings.html", "calendar_today", "My Bookings"]
    ];
    var current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var linksHtml = links
      .map(function (l) {
        var active = l[0] === current;
        return (
          '<a href="' +
          l[0] +
          '" class="flex items-center gap-3 px-space-md py-3 rounded-xl font-nav-link text-nav-link transition-colors ' +
          (active ? "bg-ink text-on-primary font-semibold" : "text-ink hover:bg-surface-soft") +
          '"><span class="material-symbols-outlined text-[20px]">' +
          l[1] +
          "</span>" +
          l[2] +
          "</a>"
        );
      })
      .join("");

    drawer.innerHTML =
      '<div class="flex items-center justify-between px-space-xs pt-space-xs">' +
      '<span class="font-display-sm text-title-md text-ink font-bold tracking-tight">SkillSwap</span>' +
      '<button type="button" aria-label="Close menu" data-ss-close class="w-9 h-9 rounded-full bg-surface-soft hover:bg-surface-strong text-ink flex items-center justify-center"><span class="material-symbols-outlined text-[20px]">close</span></button></div>' +
      '<nav class="flex flex-col gap-1">' +
      linksHtml +
      "</nav>";

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    function open() {
      overlay.classList.remove("opacity-0", "pointer-events-none");
      drawer.classList.remove("-translate-x-full");
      document.body.style.overflow = "hidden";
    }
    function close() {
      overlay.classList.add("opacity-0", "pointer-events-none");
      drawer.classList.add("-translate-x-full");
      document.body.style.overflow = "";
    }
    burger.addEventListener("click", open);
    overlay.addEventListener("click", close);
    drawer.querySelector("[data-ss-close]").addEventListener("click", close);
  }

  /* ---------- Header search (deprecated; header no longer has search pill) ---------- */
  function initHeaderSearch() {
    /* Search pill removed from header per design. No-op. */
  }

  /* ---------- Global: dead links + favourites ---------- */
  function initGlobalLinks() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href="#"]');
      if (a) {
        e.preventDefault();
        toast("This section is coming soon");
      }
    });

    // Favourite / bookmark toggles
    var favSelectors =
      'button[aria-label="Save to bookmarks"], button[aria-label="Save gig"]';
    document.querySelectorAll(favSelectors).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var icon = btn.querySelector(".material-symbols-outlined");
        if (!icon) return;
        var active = icon.style.fontVariationSettings === "'FILL' 1";
        if (active) {
          icon.style.fontVariationSettings = "";
          icon.classList.remove("text-brand-pink");
          if (icon.textContent === "favorite") icon.textContent = "favorite";
          toast("Removed from saved");
        } else {
          icon.style.fontVariationSettings = "'FILL' 1";
          icon.classList.add("text-brand-pink");
          icon.textContent = "favorite";
          toast("Saved to your list", "success");
        }
      });
    });
  }

  /* Visible label of an element, excluding material-symbol icon ligatures. */
  function labelOf(el) {
    var c = el.cloneNode(true);
    c.querySelectorAll(".material-symbols-outlined").forEach(function (s) {
      s.remove();
    });
    return (c.textContent || "").trim().replace(/\s+/g, " ");
  }

  /* Wire buttons/links by their visible label to a destination or handler. */
  function wireByText(labels, handler, root) {
    (root || document).querySelectorAll("button, a").forEach(function (el) {
      var t = labelOf(el);
      if (!t) return;
      for (var i = 0; i < labels.length; i++) {
        if (t === labels[i] || t.indexOf(labels[i]) !== -1) {
          el.addEventListener("click", function (e) {
            handler(e, el);
          });
          break;
        }
      }
    });
  }

  /* ================= Page: Marketplace (index) ================= */
  function initIndex() {
    var hero = document.getElementById("hero-search-input");
    if (!hero) return;

    var gigSection = document.querySelector("#gig-filter-tabs");
    var gigGrid = gigSection
      ? gigSection.closest("section").querySelector(".grid.grid-cols-1")
      : null;
    var cards = gigGrid ? Array.prototype.slice.call(gigGrid.children) : [];

    // Empty-state element
    var emptyState = document.createElement("div");
    emptyState.className =
      "hidden col-span-full flex flex-col items-center text-center py-space-xl gap-space-sm";
    emptyState.innerHTML =
      '<span class="material-symbols-outlined text-[40px] text-muted-soft">search_off</span>' +
      '<p class="font-title-sm text-title-sm text-ink font-semibold">No gigs match your search</p>' +
      '<p class="font-caption text-caption text-muted">Try a different keyword or category.</p>';
    if (gigGrid) gigGrid.appendChild(emptyState);

    var activeCategory = "all";

    function applyFilter() {
      var q = (hero.value || "").trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (c) {
        if (c === emptyState) return;
        var text = (c.innerText || "").toLowerCase();
        var cat = c.getAttribute("data-category") || "all";
        var matchQ = !q || text.indexOf(q) !== -1;
        var matchCat = activeCategory === "all" || cat === activeCategory;
        var vis = matchQ && matchCat;
        c.style.display = vis ? "" : "none";
        if (vis) shown++;
      });
      emptyState.classList.toggle("hidden", shown !== 0);
    }

    // Hero search
    hero.addEventListener("input", applyFilter);
    hero.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        applyFilter();
        if (gigGrid) gigGrid.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    // "Find Talent" button (next to hero input)
    var findBtn = hero.parentElement.querySelector("button");
    if (findBtn) {
      findBtn.addEventListener("click", function () {
        applyFilter();
        if (gigGrid) gigGrid.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    // Trending pills -> set search
    var pillWrap = hero.closest("section");
    if (pillWrap) {
      pillWrap.querySelectorAll(".flex-wrap button").forEach(function (pill) {
        pill.addEventListener("click", function () {
          hero.value = pill.textContent.trim();
          applyFilter();
          if (gigGrid) gigGrid.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }

    // Category filter tabs
    document.querySelectorAll("#gig-filter-tabs .filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeCategory = btn.getAttribute("data-category") || "all";
        applyFilter();
      });
    });

    // View Gig / profile navigation
    wireByText(["View Profile"], function (e, el) {
      if (el.tagName !== "A") go("gig-details.html");
    });
    wireByText(["Propose Swap", "Direct Hire", "Start a Skill Trade Today"], function () {
      go("gig-details.html");
    });

    // Load more
    wireByText(["Load 24 More Community Gigs", "Load"], function (e, el) {
      el.disabled = true;
      el.classList.add("opacity-60");
      el.innerHTML =
        '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span> Loading...';
      setTimeout(function () {
        toast("You're all caught up for now", "success");
        el.disabled = false;
        el.classList.remove("opacity-60");
        el.innerHTML =
          '<span class="material-symbols-outlined text-[18px]">sync</span> Load 24 More Community Gigs';
      }, 900);
    });
  }

  /* ================= Page: Gig details ================= */
  function initGigDetails() {
    var cta = document.getElementById("primaryCtaBtn");
    if (!cta) return;

    var swapContainer = document.getElementById("swapProposalContainer");
    cta.addEventListener("click", function () {
      var inSwap = swapContainer && !swapContainer.classList.contains("hidden");
      if (inSwap) {
        toast("Swap proposal sent to Mila", "success");
      } else {
        go("checkout.html");
      }
    });

    // Thumbnail -> swap main image
    var main = document.getElementById("mainGalleryImage");
    var thumbs = document.getElementById("galleryThumbnails");
    if (main && thumbs) {
      Array.prototype.forEach.call(thumbs.children, function (btn) {
        btn.addEventListener("click", function () {
          var img = btn.querySelector("img");
          if (img) {
            main.src = img.src;
            if (img.getAttribute("data-alt"))
              main.setAttribute("data-alt", img.getAttribute("data-alt"));
          }
        });
      });
    }

    wireByText(["Contact Mila", "Message Mila"], function () {
      toast("Chat with Mila opening soon");
    });

    // Similar gig cards -> gig details
    document
      .querySelectorAll(".grid .rounded-xl.overflow-hidden.shadow-sm")
      .forEach(function (card) {
        if (card.querySelector("h4")) {
          card.style.cursor = "pointer";
          card.addEventListener("click", function () {
            go("gig-details.html");
          });
        }
      });
  }

  /* ================= Page: Post a gig ================= */
  function initPostGig() {
    var title = document.getElementById("gigTitle");
    if (!title) return;

    // Skill tag input
    var tagsWrap = document.querySelector(".flex-wrap.items-center.gap-2.p-2");
    var tagInput = tagsWrap ? tagsWrap.querySelector('input[type="text"]') : null;
    var colors = ["brand-mint", "brand-peach", "brand-lavender", "brand-ochre"];
    var colorIdx = 0;

    function bindRemove(btn) {
      btn.addEventListener("click", function () {
        var chip = btn.closest("span");
        if (chip) chip.remove();
      });
    }
    if (tagsWrap) {
      tagsWrap.querySelectorAll("span > button").forEach(bindRemove);
    }
    if (tagInput) {
      tagInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && tagInput.value.trim()) {
          e.preventDefault();
          var val = tagInput.value.trim();
          var color = colors[colorIdx % colors.length];
          colorIdx++;
          var chip = document.createElement("span");
          chip.className =
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-" +
            color +
            " text-ink font-caption text-xs font-semibold";
          chip.innerHTML =
            "<span></span><button type='button' class='hover:opacity-75 text-ink flex items-center'><span class='material-symbols-outlined text-[14px]'>close</span></button>";
          chip.querySelector("span").textContent = val;
          bindRemove(chip.querySelector("button"));
          tagsWrap.insertBefore(chip, tagInput);
          tagInput.value = "";
        }
      });
    }

    // Publish (validation) / Save draft / Back
    wireByText(["Publish Gig"], function () {
      var t = title.value.trim();
      var price = document.getElementById("basePrice");
      if (!t) {
        toast("Add a gig title first", "error");
        title.focus();
        return;
      }
      if (price && (!price.value || Number(price.value) <= 0)) {
        toast("Set a base cash rate", "error");
        price.focus();
        return;
      }
      toast("Gig published! Redirecting...", "success");
      setTimeout(function () {
        go("dashboard.html");
      }, 900);
    });
    wireByText(["Save Draft"], function () {
      toast("Draft saved", "success");
    });
    wireByText(["Back"], function () {
      go("index.html");
    });

    // Markdown toolbar (functional)
    var mdTa = document.getElementById("gigDescription");
    if (mdTa) {
      var wrap = { bold: ["**", "**"], italic: ["*", "*"], code: ["`", "`"] };
      document.querySelectorAll("button[data-md]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.preventDefault();
          var kind = b.getAttribute("data-md");
          var start = mdTa.selectionStart;
          var end = mdTa.selectionEnd;
          var val = mdTa.value;
          var sel = val.substring(start, end);
          var before = val.substring(0, start);
          var after = val.substring(end);
          var insert, caretStart, caretEnd;
          if (kind === "list") {
            var lines = (sel || "list item").split(/\r?\n/);
            insert = lines.map(function (l) { return "- " + l; }).join("\n");
            // Ensure preceding newline if not at line start
            var lead = before.length && before[before.length - 1] !== "\n" ? "\n" : "";
            insert = lead + insert;
            caretStart = before.length + insert.length;
            caretEnd = caretStart;
          } else {
            var w = wrap[kind] || ["", ""];
            var body = sel || (kind === "code" ? "code" : kind === "italic" ? "italic" : "bold");
            insert = w[0] + body + w[1];
            caretStart = before.length + w[0].length;
            caretEnd = caretStart + body.length;
          }
          mdTa.value = before + insert + after;
          mdTa.focus();
          mdTa.setSelectionRange(caretStart, caretEnd);
          mdTa.dispatchEvent(new Event("input", { bubbles: true }));
        });
      });
    }
  }

  /* ================= Page: Checkout ================= */
  function initCheckout() {
    var fundBtn = document.getElementById("btnFundEscrow");
    if (!fundBtn) return;

    var agree = document.getElementById("agreementCheck");

    function syncAgree() {
      if (!agree) return;
      fundBtn.disabled = !agree.checked;
      fundBtn.classList.toggle("opacity-50", !agree.checked);
      fundBtn.classList.toggle("cursor-not-allowed", !agree.checked);
    }
    if (agree) {
      agree.addEventListener("change", syncAgree);
      syncAgree();
      // Guard the existing open-modal handler
      fundBtn.addEventListener(
        "click",
        function (e) {
          if (!agree.checked) {
            e.stopImmediatePropagation();
            e.preventDefault();
            toast("Please accept the Escrow Charter to continue", "error");
          }
        },
        true
      );
    }

    // Hidden file input for dropzone
    var dropzone = document.getElementById("dropzoneArea");
    if (dropzone) {
      var fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = true;
      fileInput.className = "hidden";
      fileInput.accept = ".png,.jpg,.jpeg,.glb,.obj,.zip,.pdf";
      dropzone.parentElement.insertBefore(fileInput, dropzone.nextSibling);
      dropzone.addEventListener("click", function () {
        fileInput.click();
      });
      fileInput.addEventListener("change", function () {
        if (fileInput.files.length) {
          toast(fileInput.files.length + " file(s) attached", "success");
        }
      });
      ["dragover", "dragenter"].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) {
          e.preventDefault();
          dropzone.classList.add("ring-2", "ring-ink");
        });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) {
          e.preventDefault();
          dropzone.classList.remove("ring-2", "ring-ink");
          if (ev === "drop" && e.dataTransfer && e.dataTransfer.files.length) {
            toast(e.dataTransfer.files.length + " file(s) attached", "success");
          }
        });
      });
    }

    // Remove-file buttons
    document.querySelectorAll('button[title="Remove file"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest(".flex.items-center.justify-between");
        if (row) row.remove();
      });
    });

    // Modal action -> bookings
    wireByText(["View in My Bookings"], function () {
      go("bookings.html");
    });
    wireByText(["Open Creator Chat"], function () {
      toast("Creator chat opening soon");
    });
  }

  /* ================= Page: Dashboard ================= */
  function initDashboard() {
    var aside = document.querySelector("aside.fixed.w-64.bg-surface-card");
    if (!aside) return;

    // Studio / Client view toggle
    var toggleWrap = document.querySelector(".inline-flex.items-center.bg-surface-card.p-1.rounded-full");
    if (toggleWrap) {
      var btns = toggleWrap.querySelectorAll("button");
      btns.forEach(function (b) {
        b.addEventListener("click", function () {
          btns.forEach(function (x) {
            x.className =
              "px-4 py-1.5 rounded-full text-muted hover:text-ink font-button text-button transition-all duration-150";
          });
          b.className =
            "px-4 py-1.5 rounded-full bg-ink text-on-primary font-button text-button shadow-sm transition-all duration-150";
          toast(b.textContent.trim() + " active");
        });
      });
    }

    // Mobile sidebar drawer (floating burger since header removed)
    var burger = document.createElement("button");
    burger.type = "button";
    burger.setAttribute("aria-label", "Open menu");
    burger.className =
      "lg:hidden fixed top-space-md left-space-md z-40 flex items-center justify-center w-11 h-11 rounded-full bg-canvas text-ink shadow-md transition-colors";
    burger.innerHTML = '<span class="material-symbols-outlined text-[22px]">menu</span>';
    document.body.appendChild(burger);

    var overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 bg-ink/50 backdrop-blur-sm z-40 opacity-0 pointer-events-none transition-opacity duration-200 lg:hidden";
    document.body.appendChild(overlay);

    aside.classList.add("-translate-x-full", "lg:translate-x-0", "transition-transform", "duration-200");

    function openAside() {
      aside.classList.remove("-translate-x-full");
      overlay.classList.remove("opacity-0", "pointer-events-none");
    }
    function closeAside() {
      aside.classList.add("-translate-x-full");
      overlay.classList.add("opacity-0", "pointer-events-none");
    }
    burger.addEventListener("click", openAside);
    overlay.addEventListener("click", closeAside);

    // Payout button
    wireByText(["Payout"], function () {
      toast("Payout request submitted", "success");
    });
  }

  /* ================= Page: Bookings ================= */
  function initBookings() {
    if (!document.getElementById("bookingSearch")) return;
    wireByText(["Message Mila", "Message", "Contact"], function () {
      toast("Chat opening soon");
    });
    wireByText(["Export Ledger"], function () {
      toast("Ledger exported (demo)", "success");
    });
    wireByText(["Request Revision"], function () {
      toast("Revision requested");
    });
    wireByText(["Open Mediation"], function () {
      toast("Mediation request opened");
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initBookings();
    initNotifications();
    initUserMenu();
    initMobileNav();
    initHeaderSearch();
    initGlobalLinks();
    initIndex();
    initGigDetails();
    initPostGig();
    initCheckout();
    initDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
