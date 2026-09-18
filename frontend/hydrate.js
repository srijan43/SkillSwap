/*
 * SkillSwap frontend hydration.
 *
 * Detects the current page from location.pathname and (progressively)
 * replaces the seeded mock DOM with live data from the SkillSwap backend.
 * Every hydrator swallows fetch failures: the pages still render standalone
 * if the API is unavailable.
 */
(function () {
  "use strict";
  if (!window.SS || !window.SS.api) {
    console.warn("[skillswap] api-client.js must load before hydrate.js");
    return;
  }
  var api = window.SS.api;
  var inr = window.SS.paiseToInr;

  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  // Actor selection per page (demo personas seeded by the backend).
  var isCreatorPage = page === "dashboard.html" || page === "post-gig.html";
  var actorHandle =
    window.SS_ACTOR_HANDLE || (isCreatorPage ? "milaclay" : "mayarivera");

  function toast(msg, kind) {
    if (window.ssToast) window.ssToast(msg, kind);
  }
  function q(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function qsParam(name) {
    var m = new RegExp("[?&]" + name + "=([^&]+)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Bootstrap: resolve the actor id in the background; page hydrators wait
  // on this when they need to write.
  var actorPromise = api ? window.SS.loadActor(actorHandle).catch(function (err) {
    console.warn("[skillswap] actor lookup failed", err);
    return null;
  }) : Promise.resolve(null);

  document.addEventListener("DOMContentLoaded", function () {
    // Route by page.
    try {
      if (page === "" || page === "index.html") hydrateIndex();
      else if (page === "gig-details.html") hydrateGigDetails();
      else if (page === "post-gig.html") hydratePostGig();
      else if (page === "checkout.html") hydrateCheckout();
      else if (page === "bookings.html") hydrateBookings();
      else if (page === "dashboard.html") hydrateDashboard();
    } catch (err) {
      console.error("[skillswap] hydration crash", err);
    }
  });

  // ─── Marketplace (index.html) ────────────────────────────────────────

  async function hydrateIndex() {
    var grid = q(
      ".max-w-7xl.mx-auto.w-full.px-gutter.py-space-xl .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4",
    );
    var heroInput = q("#hero-search-input");
    var tabButtons = qa("#gig-filter-tabs .filter-btn");
    var activeCategory = null;
    var q_ = "";

    async function refresh() {
      try {
        var res = await api.listGigs({
          q: q_ || undefined,
          category: activeCategory || undefined,
          limit: 12,
          sort: "trending",
        });
        renderGigGrid(grid, res.data);
      } catch (err) {
        console.warn("[skillswap] listGigs failed", err);
      }
    }

    if (heroInput) {
      var t;
      heroInput.addEventListener("input", function () {
        q_ = heroInput.value.trim();
        clearTimeout(t);
        t = setTimeout(refresh, 200);
      });
    }
    tabButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-category");
        // Map front-end filter chip to backend category slug.
        var map = { design: "3d-clay", video: "viral-formats", dev: "frontend-app", marketing: "visual-identity" };
        activeCategory = map[cat] || null;
        refresh();
      });
    });

    // Also hydrate the 6-hub category grid from live counts.
    hydrateCategoryHubs().catch(function () {});
    refresh();
  }

  function renderGigGrid(grid, gigs) {
    if (!grid) return;
    // Replace the existing card children entirely (keep the empty-state div added by app.js).
    var empty = q(".col-span-full", grid);
    qa(":scope > div", grid).forEach(function (n) {
      if (n !== empty) n.remove();
    });
    if (!gigs.length) {
      if (empty) empty.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");
    gigs.forEach(function (g) {
      var card = document.createElement("div");
      card.className =
        "group bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer";
      card.setAttribute("data-category", g.category && g.category.slug ? g.category.slug : "");
      var cover = (g.cover && g.cover.url) || "";
      var avatar = (g.creator && g.creator.avatarUrl) || "";
      card.innerHTML =
        '<div><div class="relative h-48 w-full bg-surface-card overflow-hidden">' +
        (cover ? '<img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="' + esc(cover) + '"/>' : "") +
        '<div class="absolute top-3 left-3 flex gap-1.5">' +
        '<span class="px-2 py-0.5 rounded-full bg-ink/80 backdrop-blur-md text-white font-caption text-[11px] font-medium">' + esc((g.category && g.category.name) || "Gig") + "</span>" +
        (g.coverBadge ? '<span class="px-2 py-0.5 rounded-full bg-brand-pink text-white font-caption text-[11px] font-bold">' + esc(g.coverBadge) + "</span>" : "") +
        "</div></div>" +
        '<div class="p-space-md">' +
        '<div class="flex items-center justify-between gap-space-xs mb-space-sm">' +
        '<div class="flex items-center gap-2">' +
        (avatar ? '<img class="w-6 h-6 rounded-full object-cover" src="' + esc(avatar) + '"/>' : "") +
        '<span class="font-caption text-caption text-ink font-semibold">' + esc(g.creator && g.creator.name) + "</span></div>" +
        '<div class="flex items-center gap-0.5 text-caption text-ink font-semibold">' +
        '<span class="material-symbols-outlined text-[15px] text-brand-ochre">star</span>' +
        esc((g.ratingAverage || 0).toFixed(2)) + "</div></div>" +
        '<h3 class="font-title-sm text-title-sm text-ink font-bold line-clamp-2 mb-space-sm">' + esc(g.title) + "</h3>" +
        '<div class="flex flex-wrap gap-1.5 mb-space-md">' +
        (g.disciplineTags || []).slice(0, 3).map(function (t) {
          return '<span class="px-2 py-0.5 rounded bg-surface-soft text-muted font-caption text-[11px]">' + esc(t) + "</span>";
        }).join("") + "</div></div></div>" +
        '<div class="p-space-md pt-0">' +
        '<div class="flex items-center justify-between pt-space-sm bg-surface-soft/50 rounded-xl p-2.5">' +
        '<div><span class="font-caption text-[11px] text-muted block">Starting at</span>' +
        '<span class="font-title-sm text-title-sm text-ink font-bold">' + inr(g.priceFromPaise) + "</span></div>" +
        '<span class="font-caption text-caption text-muted">INR</span></div>' +
        '<div class="mt-space-sm flex items-center gap-2">' +
        '<a href="gig-details.html?slug=' + encodeURIComponent(g.slug) + '" class="w-full py-2 rounded-full bg-ink hover:bg-primary-active text-on-primary font-button text-button transition-colors text-center shadow-sm">View Gig</a>' +
        "</div></div>";
      card.addEventListener("click", function (e) {
        // Whole card is clickable; anchors already navigate.
        if (e.target.closest("a")) return;
        location.href = "gig-details.html?slug=" + encodeURIComponent(g.slug);
      });
      grid.appendChild(card);
    });
  }

  async function hydrateCategoryHubs() {
    var cats;
    try { cats = await api.listCategories(); } catch (_) { return; }
    var cards = qa('a[data-path="index.html"], a[href="index.html"]').filter(function (a) {
      return a.className.indexOf("rounded-2xl") !== -1 && a.querySelector("h3");
    });
    // Only 6 category hub cards — order matches seed order.
    cats.slice(0, cards.length).forEach(function (cat, i) {
      var card = cards[i];
      if (!card) return;
      card.href = "index.html?category=" + encodeURIComponent(cat.slug);
      var count = card.querySelector("span.font-caption");
      var title = card.querySelector("h3");
      if (count) count.textContent = cat.gigCount + "+ Gigs";
      if (title) title.textContent = cat.name;
    });
  }

  // ─── Gig details (gig-details.html) ─────────────────────────────────

  async function hydrateGigDetails() {
    var slug = qsParam("slug") || qsParam("id") || "mila-3d-clay-character-modeling";
    var gig;
    try { gig = await api.getGig(slug); } catch (err) { console.warn("[skillswap] getGig failed", err); return; }

    // Title + creator info
    var h1 = q("h1");
    if (h1) h1.textContent = gig.title;
    var overview = document.body.textContent; // (untouched — visual layout intact)

    // Tier data: rewrite the inline tiers object the existing script uses.
    if (window.tiers && gig.tiers && gig.tiers.length) {
      gig.tiers.forEach(function (t) {
        if (!window.tiers[t.slug]) return;
        window.tiers[t.slug] = {
          title: t.name,
          price: inr(t.price),
          description: t.deliverables.slice(0, 3).join(" · "),
          delivery: t.deliveryDays + " Days Delivery",
          revisions: (t.revisions >= 999 ? "Unlimited" : t.revisions) + " Revisions",
          features: t.deliverables,
        };
      });
      // Force re-render of the currently-active tier.
      if (typeof window.selectTier === "function") {
        window.selectTier(window.currentTier || "standard");
      }
    }

    // Reviews summary
    try {
      var reviews = await api.listReviews(gig.slug, { limit: 3 });
      var reviewCount = q(".font-caption.text-caption.text-muted");
      if (reviewCount && reviews.total) reviewCount.textContent = "From " + reviews.total + " verified swaps";
    } catch (_) {}

    // Wire Continue-to-book to prefill checkout with the chosen tier
    var cta = q("#primaryCtaBtn");
    if (cta) {
      cta.addEventListener(
        "click",
        function (e) {
          // Only override if we actually loaded a live gig.
          if (!gig) return;
          e.stopImmediatePropagation();
          var tierSlug = window.currentTier || "standard";
          location.href =
            "checkout.html?gig=" + encodeURIComponent(gig.slug) + "&tier=" + encodeURIComponent(tierSlug);
        },
        true,
      );
    }

    // Similar gigs — silently ignore failures.
    api.listSimilar(gig.slug, 3).catch(function () {});
  }

  // ─── Post a gig (post-gig.html) ─────────────────────────────────────

  async function hydratePostGig() {
    var actor = await actorPromise;
    if (!actor) return;
    // Rebind the Publish button to actually POST /api/gigs.
    var publish = Array.prototype.slice
      .call(document.querySelectorAll("button"))
      .filter(function (b) {
        var t = (b.textContent || "").trim();
        return t.indexOf("Publish Gig") !== -1;
      })[0];
    if (!publish) return;

    var titleInput = q("#gigTitle");
    var priceInput = q("#basePrice");
    var descInput = q("#gigDescription");
    var deliverySelect = q("#deliveryTime");
    var revSelect = q("#revisions");

    publish.addEventListener(
      "click",
      async function (e) {
        e.stopImmediatePropagation();
        var title = titleInput ? titleInput.value.trim() : "";
        if (title.length < 6) { toast("Title too short", "error"); return; }
        var priceInr = priceInput ? Number(priceInput.value || 0) : 20750;
        var deliveryDays = daysFromLabel(deliverySelect ? deliverySelect.value : "3 Days");
        var revisions = revsFromLabel(revSelect ? revSelect.value : "3 Iterations");
        publish.disabled = true;
        try {
          var gig = await api.createGig({
            creatorId: actor.id,
            title: title,
            categorySlug: activeCategorySlug(),
            description: descInput ? descInput.value.trim() : "Delivered with care.",
            disciplineTags: [],
            turnaroundDays: deliveryDays,
            tiers: [
              {
                name: "Standard",
                slug: "standard",
                price: priceInr * 100,
                deliverables: ["1 core deliverable", "Commercial license"],
                revisions: revisions,
                deliveryDays: deliveryDays,
                isFeatured: true,
              },
            ],
          });
          toast("Gig published! Redirecting…", "success");
          setTimeout(function () {
            location.href = "gig-details.html?slug=" + encodeURIComponent(gig.slug);
          }, 700);
        } catch (err) {
          console.error(err);
          toast(err.message || "Publish failed", "error");
        } finally {
          publish.disabled = false;
        }
      },
      true,
    );
  }

  function activeCategorySlug() {
    var active = q(".category-btn.bg-ink") || q(".category-btn");
    var cat = active && active.getAttribute("data-cat");
    var map = { "3d": "3d-clay", product: "visual-identity", code: "frontend-app", video: "viral-formats", ai: "ai-workflows", growth: "visual-identity" };
    return map[cat] || "visual-identity";
  }
  function daysFromLabel(label) {
    if (/24/.test(label)) return 1;
    if (/7/.test(label)) return 7;
    if (/14/.test(label)) return 14;
    return 3;
  }
  function revsFromLabel(label) {
    if (/unlimited/i.test(label)) return 999;
    if (/^\s*1/.test(label)) return 1;
    return 3;
  }

  // ─── Checkout (checkout.html) ───────────────────────────────────────

  async function hydrateCheckout() {
    var slug = qsParam("gig");
    var tierSlug = qsParam("tier") || "standard";
    var actor = await actorPromise;
    var gig;

    if (slug) {
      try {
        gig = await api.getGig(slug);
        var tier = (gig.tiers || []).filter(function (t) { return t.slug === tierSlug; })[0];
        if (tier) {
          repriceCheckout(tier.price, false);
          // If the user later toggles the rush option, rerun our math.
          var optStd = q("#optStandard");
          var optRush = q("#optRush");
          if (optStd) optStd.addEventListener("change", function () { repriceCheckout(tier.price, false); });
          if (optRush) optRush.addEventListener("change", function () { repriceCheckout(tier.price, true); });
        }
      } catch (err) {
        console.warn("[skillswap] getGig on checkout failed", err);
      }
    }

    function repriceCheckout(basePaise, isRush) {
      var rushPaise = isRush ? 500000 : 0;
      var subtotal = basePaise + rushPaise;
      var fee = Math.round(subtotal * 0.05);
      var total = subtotal + fee;
      var hero = q("#heroPriceDisplay");
      var rowSub = q("#rowSubtotal");
      var rowFee = q("#rowPlatformFee");
      var rowRush = q("#rowRush");
      var rushRow = q("#rushRow");
      var totalEl = q("#totalDisplay");
      var btn = q("#btnLabel");
      if (hero) hero.textContent = inr(subtotal);
      if (rowSub) rowSub.textContent = inr(basePaise);
      if (rowFee) rowFee.textContent = inr(fee);
      if (rowRush) rowRush.textContent = "+" + inr(rushPaise);
      if (rushRow) rushRow.style.display = isRush ? "flex" : "none";
      if (totalEl) totalEl.textContent = inr(total);
      if (btn) btn.textContent = "Confirm & Fund Escrow (" + inr(total) + ")";
    }

    // Rebind Fund button to actually POST /api/bookings.
    var fund = q("#btnFundEscrow");
    if (!fund) return;
    fund.addEventListener(
      "click",
      async function (e) {
        if (!actor || !gig) return; // fall back to demo modal in app.js
        e.stopImmediatePropagation();
        var briefEl = q("#projectBrief");
        var brief = briefEl ? briefEl.value.trim() : "";
        if (brief.length < 20) { toast("Add a longer brief (20+ chars)", "error"); return; }
        var rush = q("#optRush") && q("#optRush").checked;
        fund.disabled = true;
        try {
          var booking = await api.createBooking({
            gigId: gig.id,
            tierSlug: tierSlug,
            clientId: actor.id,
            briefText: brief,
            deliveryPace: rush ? "RUSH" : "STANDARD",
          });
          toast("Booking " + booking.id + " created", "success");
          try { localStorage.setItem("ss.lastBooking", booking.id); } catch (_) {}
          // Open the success modal already in the DOM.
          var overlay = q("#successModalOverlay");
          var content = q("#successModalContent");
          if (overlay && content) {
            overlay.classList.remove("opacity-0", "pointer-events-none");
            overlay.classList.add("opacity-100");
            content.classList.remove("scale-95");
            content.classList.add("scale-100");
          } else {
            setTimeout(function () { location.href = "bookings.html"; }, 600);
          }
        } catch (err) {
          console.error(err);
          toast(err.message || "Booking failed", "error");
        } finally {
          fund.disabled = false;
        }
      },
      true,
    );
  }

  // ─── My Bookings (bookings.html) ────────────────────────────────────

  async function hydrateBookings() {
    var actor = await actorPromise;
    if (!actor) return;
    try {
      var res = await api.listBookings({
        role: "client",
        actorId: actor.id,
        limit: 20,
      });
      renderBookingsList(res.data);
      wireApproveButtons(actor.id);
    } catch (err) {
      console.warn("[skillswap] listBookings failed", err);
    }
  }

  function renderBookingsList(bookings) {
    var stream = q("#bookingsStream");
    if (!stream) return;
    stream.innerHTML = "";
    if (!bookings.length) {
      stream.innerHTML =
        '<div class="p-space-xl bg-surface-card rounded-xl text-center text-muted font-caption">' +
        "No bookings yet. Head to the marketplace to create one." +
        "</div>";
      return;
    }
    bookings.forEach(function (b) {
      var art = document.createElement("article");
      art.className =
        "booking-item group bg-surface-card hover:bg-surface-container-low transition-all duration-200 rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md";
      art.setAttribute("data-category", categoryFromStatus(b.status));
      art.setAttribute("data-id", b.id);
      var creator = b.creator || {};
      var latest = (b.ledger && b.ledger[b.ledger.length - 1]) || null;
      var balance = latest ? latest.balanceAfter : b.totalCharged;
      var due = b.dueAt ? new Date(b.dueAt) : null;
      var dueText = due
        ? "Due " + due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : "—";
      art.innerHTML =
        '<div class="flex items-center justify-between gap-space-sm pb-space-sm">' +
        '<div class="flex items-center gap-space-sm">' +
        (creator.avatarUrl ? '<img class="w-12 h-12 rounded-full object-cover" src="' + esc(creator.avatarUrl) + '"/>' : "") +
        '<div class="flex flex-col"><div class="flex items-center gap-space-xs">' +
        '<h3 class="font-title-md text-title-md text-ink font-bold">' + esc(creator.name) + "</h3>" +
        '<span class="font-caption text-caption text-muted">(@' + esc(creator.handle) + ")</span></div>" +
        '<span class="font-caption text-caption text-on-surface-variant">' + esc((b.gig && b.gig.category && b.gig.category.name) || "Creator") + "</span></div></div>" +
        '<div class="flex flex-wrap items-center gap-space-xs">' +
        '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-mint text-ink font-caption text-[12px] font-semibold">Cash Escrow ' + inr(balance) + "</span>" +
        '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-lavender text-ink font-caption text-[12px] font-semibold">' + esc(prettyStatus(b.status)) + "</span></div></div>" +
        '<div class="flex flex-col gap-space-xs"><div class="flex items-baseline justify-between">' +
        '<h2 class="font-title-lg text-title-lg text-ink font-semibold">' + esc(b.gig && b.gig.title) + "</h2>" +
        '<span class="font-caption text-caption text-error font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">schedule</span>' + esc(dueText) + "</span></div>" +
        '<p class="font-body-sm text-body-sm text-body">' + esc(b.briefText) + "</p></div>" +
        '<div class="pt-space-xs flex flex-wrap items-center justify-between gap-space-sm">' +
        '<span class="font-caption text-caption text-muted">ID: #' + esc(b.id) + " • " + new Date(b.createdAt).toLocaleDateString() + "</span>" +
        actionButtonsFor(b) +
        "</div>";
      stream.appendChild(art);
    });
  }

  function categoryFromStatus(s) {
    if (s === "PENDING") return "pending";
    if (s === "COMPLETED") return "completed";
    if (s === "DECLINED" || s === "CANCELLED") return "declined";
    return "active";
  }
  function prettyStatus(s) {
    return { PENDING: "Pending", ACCEPTED: "Accepted", IN_PROGRESS: "In Progress", DELIVERED: "Delivered", APPROVED: "Approved", COMPLETED: "Completed", DECLINED: "Declined", CANCELLED: "Cancelled", DISPUTED: "Disputed" }[s] || s;
  }
  function actionButtonsFor(b) {
    var canApprove = b.status === "DELIVERED";
    return '<div class="flex items-center gap-space-sm">' +
      (canApprove
        ? '<button data-action="approve" data-id="' + esc(b.id) + '" class="px-space-md py-2 rounded-full bg-ink hover:bg-primary-active text-on-primary font-button text-button shadow-sm flex items-center gap-1.5 transition-colors" type="button"><span class="material-symbols-outlined text-[18px]">lock_open</span>Approve &amp; Release</button>'
        : '<button class="px-space-md py-2 rounded-full bg-canvas text-ink font-button text-button shadow-sm" type="button">View</button>') +
      "</div>";
  }
  function wireApproveButtons(actorId) {
    qa('button[data-action="approve"]').forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-id");
        btn.disabled = true;
        btn.innerHTML =
          '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span> Releasing…';
        try {
          await api.transition(id, "approve", { actorId: actorId });
          toast("Escrow released", "success");
          btn.innerHTML =
            '<span class="material-symbols-outlined text-[18px]">check_circle</span> Released';
        } catch (err) {
          console.error(err);
          toast(err.message || "Release failed", "error");
          btn.disabled = false;
        }
      });
    });
  }

  // ─── Creator Dashboard (dashboard.html) ─────────────────────────────

  async function hydrateDashboard() {
    var actor = await actorPromise;
    if (!actor) return;
    try {
      var d = await api.getCreatorDashboard(actor.id);
      // Greeting
      var greeting = q("h1");
      if (greeting) greeting.innerHTML = "Welcome back, " + esc(actor.name.split(" ")[0]) + " ✨";

      // Metrics row: 3 stat cards live in the DOM in order:
      // [Total Earnings] [Active Pipeline] [Success Score]
      var stats = qa("section.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3 > div");
      if (stats[0]) {
        var earn = q(".font-display-sm", stats[0]);
        if (earn) earn.textContent = inr(d.earnings.totalPaise);
        var earnCaption = q(".font-caption.text-caption.text-muted", stats[0]);
        if (earnCaption) earnCaption.textContent = "+" + inr(d.earnings.last30DaysPaise) + " last 30 days";
      }
      if (stats[1]) {
        var pipe = q(".font-display-sm", stats[1]);
        if (pipe) pipe.textContent = d.activePipeline.total + " in progress";
      }
      if (stats[2]) {
        var succ = q(".font-display-sm", stats[2]);
        if (succ) succ.textContent = (d.successScore || 0).toFixed(1) + "%";
      }
      // Payout button pill.
      var payoutBtn = Array.prototype.slice
        .call(document.querySelectorAll("button"))
        .filter(function (b) { return /Payout/.test(b.textContent); })[0];
      if (payoutBtn) {
        payoutBtn.innerHTML =
          '<span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>' +
          '<span>Payout (' + inr(d.earnings.pendingPayoutPaise) + ")</span>";
      }
      // Weekly impressions (top-right widget).
      var impressions = document.body.innerText.match(/Weekly Impressions/i);
      if (impressions) {
        var target = Array.prototype.slice
          .call(document.querySelectorAll("*"))
          .filter(function (n) { return n.children.length === 0 && n.textContent && /^\d[\d,]*$/.test(n.textContent.replace(/\s+/g, "")); })[0];
        if (target) target.textContent = (d.weeklyImpressions || 0).toLocaleString("en-IN");
      }
    } catch (err) {
      console.warn("[skillswap] dashboard failed", err);
    }
  }
})();
