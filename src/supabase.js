// Supabase client + data layer.
// All DB I/O goes through `dataLayer` so the React tree stays unaware of SQL.
//
// DB columns are snake_case (Postgres convention). The transforms below
// convert to/from the camelCase shape the existing JSX already expects, so
// we don't have to touch any component beyond the App-level load/save calls.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_KEY."
  );
}

export const sb = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

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
    const [c, s, v, e, l] = await Promise.all([
      sb.from("creators").select("*").order("created_at", { ascending: true }),
      sb.from("setters").select("*").order("created_at", { ascending: true }),
      sb.from("videos").select("*"),
      sb.from("eod_reports").select("*"),
      sb.from("leads").select("*"),
    ]);
    must(c.error, "load creators");
    must(s.error, "load setters");
    must(v.error, "load videos");
    must(e.error, "load eods");
    must(l.error, "load leads");

    const creators = (c.data || []).map(rowToApp);
    const setters = (s.data || []).map(rowToApp);

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

    return { creators, setters, videosMap, eodMap, leadsMap };
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
