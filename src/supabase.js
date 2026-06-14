// Supabase client + data layer.
// All DB I/O goes through `dataLayer` so the React tree stays unaware of SQL.
//
// DB columns are snake_case (Postgres convention). The transforms below
// convert to/from the camelCase shape the existing JSX already expects, so
// we don't have to touch any component beyond the App-level load/save calls.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

// Surface config errors as a value rather than a throw — a top-level throw
// during module load blanks the page before React can mount and show anything.
export const configError = (!url || !key)
  ? "Missing Supabase config. VITE_SUPABASE_URL and VITE_SUPABASE_KEY must be set as environment variables in your hosting provider (Cloudflare Pages → Settings → Variables) AND a fresh deploy triggered (Vite inlines env vars at build time)."
  : null;

// If config is missing, don't even build a client — App checks `configError`
// and renders a friendly error screen instead of blank-screening.
export const sb = configError
  ? null
  : createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });

// ─── Auth ───────────────────────────────────────────────────────────────────
export const auth = {
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },
  /**
   * Kick off Google OAuth. The browser navigates away to Google → Supabase →
   * back to this app with the session in the URL hash. The Supabase client's
   * `detectSessionInUrl` flag picks it up automatically on return.
   */
  async signInWithGoogle() {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) throw error;
    return data;
  },
  async signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },
  async getSession() {
    const { data } = await sb.auth.getSession();
    return data.session;
  },
  /** Subscribe to auth changes. Returns a subscription with `.unsubscribe()`. */
  onChange(cb) {
    const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
    return data.subscription;
  },
};

// ─── camelCase ↔ snake_case ────────────────────────────────────────────────
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

const rowToApp = (row) => {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
};
const appToRow = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[toSnake(k)] = v;
  return out;
};

const must = (error, label) => {
  if (error) {
    console.error(`[supabase:${label}]`, error);
    throw new Error(`${label}: ${error.message || error.code || "unknown error"}`);
  }
};

// ─── Data layer ─────────────────────────────────────────────────────────────
export const dataLayer = {
  /**
   * One-shot load of everything the app needs. Scales fine into the low
   * tens of thousands of rows; past that, switch to lazy loads per screen.
   */
  async loadAll() {
    const [c, s, v, e, l, ed, rc, ev, rr, hh] = await Promise.all([
      sb.from("creators").select("*").order("created_at", { ascending: true }),
      sb.from("setters").select("*").order("created_at", { ascending: true }),
      sb.from("videos").select("*"),
      sb.from("eod_reports").select("*"),
      sb.from("leads").select("*"),
      sb.from("editors").select("*").order("created_at", { ascending: true }),
      sb.from("recruiters").select("*").order("created_at", { ascending: true }),
      sb.from("edits").select("*"),
      sb.from("recruit_reports").select("*"),
      sb.from("hires").select("*"),
    ]);
    must(c.error, "load creators");
    must(s.error, "load setters");
    must(v.error, "load videos");
    must(e.error, "load eods");
    must(l.error, "load leads");
    must(ed.error, "load editors");
    must(rc.error, "load recruiters");
    must(ev.error, "load edits");
    must(rr.error, "load recruit_reports");
    must(hh.error, "load hires");

    const creators = (c.data || []).map(rowToApp);
    const setters = (s.data || []).map(rowToApp);
    const editors = (ed.data || []).map(rowToApp);
    const recruiters = (rc.data || []).map(rowToApp);

    const videosMap = {};
    creators.forEach((cr) => (videosMap[cr.id] = []));
    (v.data || []).forEach((row) => {
      const a = rowToApp(row);
      (videosMap[a.creatorId] ||= []).push(a);
    });

    const eodMap = {};
    const leadsMap = {};
    setters.forEach((st) => {
      eodMap[st.id] = [];
      leadsMap[st.id] = [];
    });
    (e.data || []).forEach((row) => {
      const a = rowToApp(row);
      (eodMap[a.setterId] ||= []).push(a);
    });
    (l.data || []).forEach((row) => {
      const a = rowToApp(row);
      (leadsMap[a.setterId] ||= []).push(a);
    });

    const editsMap = {};
    editors.forEach((ee) => (editsMap[ee.id] = []));
    (ev.data || []).forEach((row) => {
      const a = rowToApp(row);
      (editsMap[a.editorId] ||= []).push(a);
    });

    const recruitMap = {};
    const hiresMap = {};
    recruiters.forEach((rcr) => {
      recruitMap[rcr.id] = [];
      hiresMap[rcr.id] = [];
    });
    (rr.data || []).forEach((row) => {
      const a = rowToApp(row);
      (recruitMap[a.recruiterId] ||= []).push(a);
    });
    (hh.data || []).forEach((row) => {
      const a = rowToApp(row);
      (hiresMap[a.recruiterId] ||= []).push(a);
    });

    return {
      creators, setters, videosMap, eodMap, leadsMap,
      editors, recruiters, editsMap, recruitMap, hiresMap,
    };
  },

  // ── Creators ──────────────────────────────────────────────────────────
  async addCreator(name) {
    const { data, error } = await sb
      .from("creators")
      .insert({ name })
      .select()
      .single();
    must(error, "addCreator");
    return rowToApp(data);
  },
  async removeCreator(id) {
    const { error } = await sb.from("creators").delete().eq("id", id);
    must(error, "removeCreator");
  },

  // ── Setters ───────────────────────────────────────────────────────────
  async addSetter(name) {
    const { data, error } = await sb
      .from("setters")
      .insert({ name })
      .select()
      .single();
    must(error, "addSetter");
    return rowToApp(data);
  },
  async removeSetter(id) {
    const { error } = await sb.from("setters").delete().eq("id", id);
    must(error, "removeSetter");
  },

  // ── Videos ────────────────────────────────────────────────────────────
  async saveVideo(creatorId, video) {
    const row = appToRow({ ...video, creatorId, lastUpdated: new Date().toISOString() });
    // Don't send fields the DB manages or that aren't real columns
    delete row.created_at;
    if (row.id) {
      const id = row.id;
      delete row.id;
      const { data, error } = await sb
        .from("videos")
        .update(row)
        .eq("id", id)
        .select()
        .single();
      must(error, "updateVideo");
      return rowToApp(data);
    }
    delete row.id;
    const { data, error } = await sb.from("videos").insert(row).select().single();
    must(error, "insertVideo");
    return rowToApp(data);
  },
  async deleteVideo(videoId) {
    const { error } = await sb.from("videos").delete().eq("id", videoId);
    must(error, "deleteVideo");
  },

  // ── EOD reports ───────────────────────────────────────────────────────
  async saveEOD(setterId, eod) {
    // (setter_id, date) is unique — upsert on that conflict so resubmitting
    // today's report overwrites cleanly.
    const row = appToRow({ ...eod, setterId, lastUpdated: new Date().toISOString() });
    delete row.created_at;
    if (!row.id) delete row.id;
    const { data, error } = await sb
      .from("eod_reports")
      .upsert(row, { onConflict: "setter_id,date" })
      .select()
      .single();
    must(error, "saveEOD");
    return rowToApp(data);
  },

  // ── Leads ─────────────────────────────────────────────────────────────
  async saveLead(setterId, lead) {
    const row = appToRow({ ...lead, setterId, lastTouch: new Date().toISOString() });
    delete row.created_at;
    if (row.id) {
      const id = row.id;
      delete row.id;
      const { data, error } = await sb
        .from("leads")
        .update(row)
        .eq("id", id)
        .select()
        .single();
      must(error, "updateLead");
      return rowToApp(data);
    }
    delete row.id;
    const { data, error } = await sb.from("leads").insert(row).select().single();
    must(error, "insertLead");
    return rowToApp(data);
  },
  async deleteLead(leadId) {
    const { error } = await sb.from("leads").delete().eq("id", leadId);
    must(error, "deleteLead");
  },

  // ── Editors ───────────────────────────────────────────────────────────
  async addEditor(name) {
    const { data, error } = await sb.from("editors").insert({ name }).select().single();
    must(error, "addEditor");
    return rowToApp(data);
  },
  async removeEditor(id) {
    const { error } = await sb.from("editors").delete().eq("id", id);
    must(error, "removeEditor");
  },

  // ── Edits (one row per logged edit / folder of edits) ─────────────────
  async saveEdit(editorId, edit) {
    const row = appToRow({ ...edit, editorId, lastUpdated: new Date().toISOString() });
    delete row.created_at;
    if (row.id) {
      const id = row.id;
      delete row.id;
      const { data, error } = await sb.from("edits").update(row).eq("id", id).select().single();
      must(error, "updateEdit");
      return rowToApp(data);
    }
    delete row.id;
    const { data, error } = await sb.from("edits").insert(row).select().single();
    must(error, "insertEdit");
    return rowToApp(data);
  },
  async deleteEdit(editId) {
    const { error } = await sb.from("edits").delete().eq("id", editId);
    must(error, "deleteEdit");
  },

  // ── Recruiters ────────────────────────────────────────────────────────
  async addRecruiter(name) {
    const { data, error } = await sb.from("recruiters").insert({ name }).select().single();
    must(error, "addRecruiter");
    return rowToApp(data);
  },
  async removeRecruiter(id) {
    const { error } = await sb.from("recruiters").delete().eq("id", id);
    must(error, "removeRecruiter");
  },

  // ── Recruiter EOD reports (upsert on recruiter_id + date) ─────────────
  async saveRecruitEOD(recruiterId, eod) {
    const row = appToRow({ ...eod, recruiterId, lastUpdated: new Date().toISOString() });
    delete row.created_at;
    if (!row.id) delete row.id;
    const { data, error } = await sb
      .from("recruit_reports")
      .upsert(row, { onConflict: "recruiter_id,date" })
      .select()
      .single();
    must(error, "saveRecruitEOD");
    return rowToApp(data);
  },

  // ── Hires (recruiter-owned candidate pipeline) ────────────────────────
  async saveHire(recruiterId, hire) {
    const row = appToRow({ ...hire, recruiterId, lastUpdated: new Date().toISOString() });
    delete row.created_at;
    if (row.id) {
      const id = row.id;
      delete row.id;
      const { data, error } = await sb.from("hires").update(row).eq("id", id).select().single();
      must(error, "updateHire");
      return rowToApp(data);
    }
    delete row.id;
    const { data, error } = await sb.from("hires").insert(row).select().single();
    must(error, "insertHire");
    return rowToApp(data);
  },
  // Partial update (e.g. status change from the card dropdown)
  async updateHire(id, patch) {
    const row = appToRow({ ...patch, lastUpdated: new Date().toISOString() });
    delete row.id;
    delete row.created_at;
    const { data, error } = await sb.from("hires").update(row).eq("id", id).select().single();
    must(error, "updateHirePatch");
    return rowToApp(data);
  },
  async deleteHire(id) {
    const { error } = await sb.from("hires").delete().eq("id", id);
    must(error, "deleteHire");
  },

  // ── Profiles (auth-linked) ───────────────────────────────────────────
  async loadProfile(userId) {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      // PGRST116 = no row found via maybeSingle — treat as null
      if (error.code === "PGRST116") return null;
      must(error, "loadProfile");
    }
    return data ? rowToApp(data) : null;
  },
  async listProfiles() {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    must(error, "listProfiles");
    return (data || []).map(rowToApp);
  },
  async updateProfile(id, updates) {
    // Strip immutable + server-managed fields (email comes from auth.users)
    const row = appToRow(updates);
    delete row.id;
    delete row.email;
    delete row.created_at;
    const { data, error } = await sb
      .from("profiles")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    must(error, "updateProfile");
    return rowToApp(data);
  },

  // ── Pending invites ───────────────────────────────────────────────────
  async listInvites() {
    const { data, error } = await sb
      .from("pending_invites")
      .select("*")
      .order("invited_at", { ascending: false });
    must(error, "listInvites");
    return (data || []).map(rowToApp);
  },
  async createInvite({ email, isAdmin = false, creatorId = null, setterId = null, editorId = null, recruiterId = null }) {
    const row = appToRow({ email: email.trim().toLowerCase(), isAdmin: !!isAdmin, creatorId, setterId, editorId, recruiterId });
    const { data, error } = await sb
      .from("pending_invites")
      .upsert(row, { onConflict: "email" })
      .select()
      .single();
    must(error, "createInvite");
    return rowToApp(data);
  },
  /**
   * Smart assignment: if a profile already exists for this email (user signed up),
   * update it directly. Otherwise create a pending_invite that auto-applies on
   * next sign-up. Returns { applied: "profile" | "invite" }.
   *
   * Roles are non-exclusive — a user can be any combination of admin / creator / setter.
   */
  async assignByEmail({ email, isAdmin = false, creatorId = null, setterId = null, editorId = null, recruiterId = null }) {
    const cleanEmail = email.trim().toLowerCase();
    const { data: existing, error: lookupErr } = await sb
      .from("profiles")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();
    if (lookupErr && lookupErr.code !== "PGRST116") must(lookupErr, "assignByEmail.lookup");

    if (existing) {
      const { error } = await sb
        .from("profiles")
        .update(appToRow({ isAdmin: !!isAdmin, creatorId, setterId, editorId, recruiterId }))
        .eq("id", existing.id);
      must(error, "assignByEmail.update");
      return { applied: "profile" };
    }

    const row = appToRow({ email: cleanEmail, isAdmin: !!isAdmin, creatorId, setterId, editorId, recruiterId });
    const { error } = await sb
      .from("pending_invites")
      .upsert(row, { onConflict: "email" });
    must(error, "assignByEmail.invite");
    return { applied: "invite" };
  },
  async deleteInvite(email) {
    const { error } = await sb
      .from("pending_invites")
      .delete()
      .eq("email", email.trim().toLowerCase());
    must(error, "deleteInvite");
  },

  // ── Realtime ──────────────────────────────────────────────────────────
  /**
   * Subscribe to every change across every table. Call `unsubscribe()` on
   * the returned object when unmounting. Best used in App.useEffect after
   * the initial load completes.
   */
  subscribeAll(onChange) {
    const channel = sb
      .channel("locascale-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "creators" }, (payload) => onChange("creators", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "setters" }, (payload) => onChange("setters", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "videos" }, (payload) => onChange("videos", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "eod_reports" }, (payload) => onChange("eod_reports", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => onChange("leads", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "editors" }, (payload) => onChange("editors", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "recruiters" }, (payload) => onChange("recruiters", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "edits" }, (payload) => onChange("edits", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "recruit_reports" }, (payload) => onChange("recruit_reports", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "hires" }, (payload) => onChange("hires", payload))
      .subscribe();
    return {
      unsubscribe: () => sb.removeChannel(channel),
    };
  },
};

// Helper for the realtime change handler — converts a payload's new/old row
// to the camelCase app shape so consumers don't need to remember.
export const payloadToApp = (payload) => ({
  type: payload.eventType, // "INSERT" | "UPDATE" | "DELETE"
  new: rowToApp(payload.new),
  old: rowToApp(payload.old),
});
