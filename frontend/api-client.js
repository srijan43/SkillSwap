/*
 * SkillSwap frontend API client.
 *
 * Every page loads this before `app.js` and `hydrate.js`. Live data replaces
 * the seeded mock content whenever the API is reachable; if a fetch fails we
 * silently keep the static markup so the pages still work standalone.
 *
 * Config:
 *   window.SS_API_BASE — API root; defaults to http://localhost:4000/api.
 *                         In production, inject via a small inline <script>
 *                         in the deployed HTML.
 *   window.SS_ACTOR_HANDLE — demo persona; defaults per-page (mayarivera for
 *                            client screens, milaclay for creator screens).
 */
(function () {
  "use strict";

  // Production URL is injected via a <meta name="ss-api-base"> tag in each HTML file,
  // or via window.SS_API_BASE (e.g. set inline in HTML for Vercel deployments).
  // Falls back to localhost for local dev.
  var metaTag = document.querySelector('meta[name="ss-api-base"]');
  var API_BASE = (
    window.SS_API_BASE ||
    (metaTag && metaTag.getAttribute("content")) ||
    "http://localhost:4000/api"
  ).replace(/\/$/, "");

  // Money formatter: paise → "₹12,345".
  var inrFmt = new Intl.NumberFormat("en-IN");
  function paiseToInr(paise) {
    return "₹" + inrFmt.format(Math.round((paise || 0) / 100));
  }

  function withQuery(path, params) {
    if (!params) return path;
    var q = Object.keys(params)
      .filter(function (k) {
        return params[k] !== undefined && params[k] !== null && params[k] !== "";
      })
      .map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
      })
      .join("&");
    return q ? path + "?" + q : path;
  }

  async function req(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    var body = opts.body;
    if (body && typeof body !== "string") body = JSON.stringify(body);
    var res = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers: headers,
      body: body,
      credentials: "omit",
    });
    var text = await res.text();
    var json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      var err = new Error((json && json.error && json.error.message) || res.statusText);
      err.status = res.status;
      err.code = json && json.error && json.error.code;
      err.details = json && json.error && json.error.details;
      throw err;
    }
    return json;
  }

  // ─── Actor identity (no auth; localStorage-backed demo persona) ─────

  var ACTOR_KEY_PREFIX = "ss.actor.";

  async function loadActor(handle) {
    var cacheKey = ACTOR_KEY_PREFIX + handle;
    try {
      var cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    var res = await req("/users/by-handle/" + encodeURIComponent(handle));
    try {
      localStorage.setItem(cacheKey, JSON.stringify(res.data));
    } catch (_) {}
    return res.data;
  }

  // ─── Endpoint bindings ──────────────────────────────────────────────

  var api = {
    // Marketplace
    listCategories: function () {
      return req("/categories").then(function (r) { return r.data; });
    },
    listGigs: function (params) {
      return req(withQuery("/gigs", params || {}));
    },
    getGig: function (idOrSlug) {
      return req("/gigs/" + encodeURIComponent(idOrSlug)).then(function (r) { return r.data; });
    },
    listReviews: function (idOrSlug, params) {
      return req(withQuery("/gigs/" + encodeURIComponent(idOrSlug) + "/reviews", params || {}));
    },
    listSimilar: function (idOrSlug, take) {
      return req(withQuery("/gigs/" + encodeURIComponent(idOrSlug) + "/similar", { take: take || 3 }))
        .then(function (r) { return r.data; });
    },
    createGig: function (body) {
      return req("/gigs", { method: "POST", body: body }).then(function (r) { return r.data; });
    },

    // Bookings
    createBooking: function (body) {
      return req("/bookings", { method: "POST", body: body }).then(function (r) { return r.data; });
    },
    getBooking: function (id) {
      return req("/bookings/" + encodeURIComponent(id)).then(function (r) { return r.data; });
    },
    listBookings: function (params) {
      return req(withQuery("/bookings", params));
    },
    getEscrowSummary: function (id) {
      return req("/bookings/" + encodeURIComponent(id) + "/escrow-summary")
        .then(function (r) { return r.data; });
    },
    transition: function (id, action, body) {
      return req("/bookings/" + encodeURIComponent(id) + "/" + action, { method: "POST", body: body })
        .then(function (r) { return r.data; });
    },
    addMilestone: function (id, body) {
      return req("/bookings/" + encodeURIComponent(id) + "/milestones", {
        method: "POST",
        body: body,
      }).then(function (r) { return r.data; });
    },
    patchMilestone: function (milestoneId, body) {
      return req("/milestones/" + encodeURIComponent(milestoneId), {
        method: "PATCH",
        body: body,
      }).then(function (r) { return r.data; });
    },

    // Creator dashboard
    getCreatorDashboard: function (creatorId) {
      return req("/creators/" + encodeURIComponent(creatorId) + "/dashboard")
        .then(function (r) { return r.data; });
    },
    getCreatorActivity: function (creatorId, take) {
      return req(withQuery("/creators/" + encodeURIComponent(creatorId) + "/activity", { take: take }))
        .then(function (r) { return r.data; });
    },
  };

  window.SS = {
    api: api,
    loadActor: loadActor,
    paiseToInr: paiseToInr,
    apiBase: API_BASE,
  };
})();
