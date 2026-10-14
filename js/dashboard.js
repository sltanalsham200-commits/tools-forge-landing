/* Tools Forge — Dashboard logic */
(function () {
  "use strict";

  const CFG = window.TF_CONFIG || {};
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || CFG.SUPABASE_ANON_KEY.startsWith("PASTE_")) {
    document.body.innerHTML =
      '<div style="padding:24px;color:#fff;font-family:sans-serif">' +
      "<h2>⚠️ إعداد ناقص</h2>" +
      "<p>افتح <code>js/dashboard-config.js</code> وضع قيمة <code>SUPABASE_ANON_KEY</code>.</p>" +
      "</div>";
    return;
  }

  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const API = CFG.API_BASE;

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const authView = $("auth-view");
  const dashView = $("dashboard-view");
  const authForm = $("auth-form");
  const authTitle = $("auth-title");
  const authSubmit = $("auth-submit");
  const alertSlot = $("alert-slot");
  const dashAlert = $("dash-alert");
  const headerActions = $("header-actions");

  let mode = "login";
  let currentSession = null;

  // ---------- Helpers ----------
  function showAlert(el, msg, type) {
    el.innerHTML = `<div class="alert alert-${type || "warn"}">${msg}</div>`;
    setTimeout(() => { el.innerHTML = ""; }, 8000);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  async function apiCall(method, path, { body, jwt } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (jwt) headers["Authorization"] = "Bearer " + jwt;

    const r = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try { data = await r.json(); } catch (_) {}
    if (!r.ok) {
      const detail = (data && (data.detail || data.message)) || `HTTP ${r.status}`;
      throw new Error(detail);
    }
    return data;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString("ar", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return iso; }
  }

  // ---------- Auth Tabs ----------
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.tab;
      authTitle.textContent = mode === "login" ? "تسجيل الدخول" : "حساب جديد";
      authSubmit.textContent = mode === "login" ? "دخول" : "إنشاء الحساب";
      alertSlot.innerHTML = "";
    });
  });

  // ---------- Auth submit ----------
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authSubmit.disabled = true;
    alertSlot.innerHTML = "";
    const email = $("email").value.trim();
    const password = $("password").value;

    try {
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          showAlert(alertSlot,
            "✅ تم إنشاء الحساب. يرجى تأكيد البريد الإلكتروني قبل الدخول. تحقق من صندوق الوارد.",
            "ok");
          return;
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentSession = data.session;
        await enterDashboard();
      }
    } catch (err) {
      let msg = err.message || "حدث خطأ";
      if (msg.includes("Invalid login credentials")) msg = "البريد أو كلمة المرور غير صحيحة";
      else if (msg.includes("Email not confirmed")) msg = "يرجى تأكيد البريد الإلكتروني أولاً";
      else if (msg.includes("already registered")) msg = "هذا البريد مُسجّل بالفعل";
      else if (msg.includes("Password should be")) msg = "كلمة المرور قصيرة جداً";
      showAlert(alertSlot, "❌ " + msg, "err");
    } finally {
      authSubmit.disabled = false;
    }
  });

  // ---------- Enter dashboard ----------
  async function enterDashboard() {
    authView.classList.add("hidden");
    dashView.classList.remove("hidden");
    headerActions.innerHTML =
      '<button class="btn btn-ghost btn-sm" id="logout-btn">خروج</button>';
    $("logout-btn").addEventListener("click", logout);

    await loadOverview();
    await loadKeys();
    await loadUsage();
    await loadPayments();
  }

  async function logout() {
    await sb.auth.signOut();
    currentSession = null;
    dashView.classList.add("hidden");
    authView.classList.remove("hidden");
    headerActions.innerHTML = "";
    authForm.reset();
  }

  // ---------- Dashboard Tabs ----------
  document.querySelectorAll("[data-dtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-dtab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".dash-panel").forEach((p) => p.classList.add("hidden"));
      const panel = document.querySelector(`[data-panel="${btn.dataset.dtab}"]`);
      if (panel) panel.classList.remove("hidden");
    });
  });

  // ---------- Load: Overview ----------
  async function loadOverview() {
    try {
      const data = await apiCall("GET", "/v1/me", { jwt: currentSession.access_token });
      $("account-info").innerHTML = `
        <div class="row">
          <div><label>البريد</label><div class="mono">${esc(data.subscriber.email)}</div></div>
          <div><label>الحالة</label><span class="pill ok">${esc(data.subscriber.status)}</span></div>
        </div>
        <div class="row">
          <div><label>تاريخ التسجيل</label><div>${fmtDate(data.subscriber.created_at)}</div></div>
        </div>`;

      const plan = data.plan || {};
      const sub = data.subscription || {};
      const usage = data.usage || {};
      const pct = usage.max_requests ? Math.min(100, Math.round((usage.current_month / usage.max_requests) * 100)) : 0;

      $("plan-info").innerHTML = `
        <div class="row">
          <div><label>الخطة</label><b>${esc(plan.display_name || "—")}</b></div>
          <div><label>الحالة</label><span class="pill ok">${esc(sub.status || "—")}</span></div>
        </div>
        <div class="row">
          <div><label>الحد الشهري</label><div>${usage.max_requests || 0} طلب</div></div>
          <div><label>معدل الطلبات</label><div>${plan.rate_limit_per_min || 0} / دقيقة</div></div>
        </div>
        <div style="margin-top:8px">
          <label>الاستهلاك: ${usage.current_month || 0} / ${usage.max_requests || 0}</label>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <small class="muted">${pct}% مستخدم</small>
        </div>`;
    } catch (e) {
      showAlert(dashAlert, "❌ فشل تحميل البيانات: " + esc(e.message), "err");
    }
  }

  // ---------- Load: Keys ----------
  async function loadKeys() {
    try {
      const data = await apiCall("GET", "/v1/keys", { jwt: currentSession.access_token });
      renderKeys(data.keys || []);
    } catch (e) {
      $("keys-list").innerHTML = `<div class="alert alert-err">فشل التحميل: ${esc(e.message)}</div>`;
    }
  }

  function renderKeys(list) {
    if (!list.length) {
      $("keys-list").innerHTML =
        '<p class="muted">لا توجد مفاتيح بعد. أنشئ مفتاحك الأول.</p>';
      return;
    }
    $("keys-list").innerHTML = list.map((k) => `
      <div class="key-row">
        <div class="meta">
          <b>${esc(k.name)}</b>
          <small class="mono">${esc(k.key_prefix)}... </small>
          <small> — ${k.status === "active" ? "نشط" : "ملغى"}</small>
          <small> — آخر استخدام: ${fmtDate(k.last_used_at)}</small>
        </div>
        <div>
          ${k.status === "active"
            ? `<button class="btn btn-danger btn-sm" data-revoke="${esc(k.id)}">إلغاء</button>`
            : '<span class="pill err">ملغى</span>'}
        </div>
      </div>`).join("");

    document.querySelectorAll("[data-revoke]").forEach((b) => {
      b.addEventListener("click", () => revokeKey(b.dataset.revoke));
    });
  }

  $("create-key-btn").addEventListener("click", async () => {
    const name = $("key-name").value.trim() || "Default";
    const btn = $("create-key-btn");
    btn.disabled = true;
    try {
      const data = await apiCall("POST", "/v1/keys", {
        jwt: currentSession.access_token,
        body: { name },
      });
      $("key-name").value = "";
      // Modal-like alert showing full key
      showAlert(dashAlert,
        `<b>✅ تم إنشاء المفتاح. انسخه الآن — لن يظهر مرة أخرى:</b>
         <div class="mono" style="background:#232d5c;padding:10px;border-radius:8px;margin-top:8px;word-break:break-all">${esc(data.plaintext)}</div>
         <div style="margin-top:10px">
           <button class="btn btn-sm" id="goto-docs-btn" style="cursor:pointer;">📖 انتقل للتوثيق →</button>
         </div>`,
        "ok");

      setTimeout(() => {
        const gotoBtn = document.getElementById("goto-docs-btn");
        if (gotoBtn) {
          gotoBtn.addEventListener("click", () => {
            const tab = document.querySelector('[data-dtab="docs"]');
            if (tab) tab.click();
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
        }
      }, 50);
      // Extend alert duration for key
      await navigator.clipboard.writeText(data.plaintext).catch(() => {});
      await loadKeys();
      await loadOverview();
    } catch (e) {
      showAlert(dashAlert, "❌ " + esc(e.message), "err");
    } finally {
      btn.disabled = false;
    }
  });

  async function revokeKey(id) {
    if (!confirm("هل أنت متأكد من إلغاء هذا المفتاح؟")) return;
    try {
      await apiCall("POST", `/v1/keys/${id}/revoke`, { jwt: currentSession.access_token });
      showAlert(dashAlert, "✅ تم إلغاء المفتاح", "ok");
      await loadKeys();
    } catch (e) {
      showAlert(dashAlert, "❌ " + esc(e.message), "err");
    }
  }

  // ---------- Load: Usage ----------
  async function loadUsage() {
    try {
      const data = await apiCall("GET", "/v1/me", { jwt: currentSession.access_token });
      const u = data.usage || {};
      const pct = u.max_requests ? Math.min(100, Math.round((u.current_month / u.max_requests) * 100)) : 0;
      $("usage-info").innerHTML = `
        <div class="row">
          <div><label>الاستخدام هذا الشهر</label><div>${u.current_month || 0} طلب</div></div>
          <div><label>المتبقي</label><div>${u.remaining || 0} طلب</div></div>
        </div>
        <div class="progress" style="margin-top:12px"><span style="width:${pct}%"></span></div>
        <small class="muted">${pct}% من الحد الشهري</small>`;
    } catch (e) {
      $("usage-info").innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    }
  }

  // ---------- Load: Payments ----------
  async function loadPayments() {
    try {
      const data = await apiCall("GET", "/v1/payments", { jwt: currentSession.access_token });
      const list = data.payments || [];
      const intents = data.pending_intents || [];
      if (!list.length && !intents.length) {
        $("payments-list").innerHTML = '<p class="muted">لا توجد مدفوعات بعد.</p>';
      } else {
        let html = "";
        if (intents.length) {
          html += "<h3>طلبات قيد الانتظار</h3>" + intents.map((i) => `
            <div class="key-row">
              <div class="meta">
                <b>${esc(i.billing_period)} — ${i.amount_usd} USD</b>
                <small>الحالة: ${esc(i.status)}</small>
              </div>
            </div>`).join("");
        }
        if (list.length) {
          html += "<h3>مدفوعات مؤكدة</h3>" + list.map((p) => `
            <div class="key-row">
              <div class="meta">
                <b>${p.amount} ${esc(p.currency)}</b>
                <small>${fmtDate(p.created_at)} — ${esc(p.status)}</small>
              </div>
            </div>`).join("");
        }
        $("payments-list").innerHTML = html;
      }
    } catch (e) {
      $("payments-list").innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    }
  }

  // ---------- Init ----------
  (async function init() {
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      currentSession = data.session;
      await enterDashboard();
    }

    sb.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      if (session && dashView.classList.contains("hidden")) {
        enterDashboard();
      } else if (!session && !dashView.classList.contains("hidden")) {
        logout();
      }
    });
  })();

})();
