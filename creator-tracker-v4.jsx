import { useState, useEffect, useMemo, useId } from "react";
import { dataLayer, payloadToApp, auth } from "./src/supabase";

const CREATOR_PLATFORMS = ["Instagram", "YouTube", "TikTok", "LinkedIn", "X"];
const SETTER_PLATFORMS = ["Instagram", "LinkedIn", "School", "X", "Facebook"];
const PLATFORM_COLORS = {
  Instagram: "#E1306C", YouTube: "#FF0000", TikTok: "#00f2ea",
  LinkedIn: "#0A66C2", X: "#eee", Facebook: "#1877F2", School: "#FF6B35",
};
const SETTER_FIELDS = [
  { key: "newMessages", label: "New Messages" },
  { key: "followUps", label: "Follow-Ups" },
  { key: "positiveReplies", label: "Positive Replies" },
  { key: "conversationsInProgress", label: "Convos in Progress" },
  { key: "callsBooked", label: "Calls Booked" },
  { key: "freeTrials", label: "Free Trials" },
];

const LEAD_STATUSES = [
  { key: "new", label: "New", color: "#888" },
  { key: "in_convo", label: "In Conversation", color: "#5b9eff" },
  { key: "objection", label: "Objection", color: "#ffcc00" },
  { key: "follow_up", label: "Follow-Up", color: "#ff9500" },
  { key: "interested", label: "Interested", color: "#c8ff00" },
  { key: "call_booked", label: "Call Booked", color: "#00d4ff" },
  { key: "trial", label: "Trial Started", color: "#00ff8c" },
  { key: "closed_lost", label: "Closed / Lost", color: "#ff3b3b" },
];
const statusMeta = (k) => LEAD_STATUSES.find(s => s.key === k) || LEAD_STATUSES[0];

const todayStr = () => new Date().toISOString().split("T")[0];
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtViews = (n) => {
  if (!n || isNaN(n)) return "0";
  const num = parseInt(n);
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
};
const fmtNum = (n) => (parseInt(n) || 0).toLocaleString();
const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${mo[+m - 1]} ${+day}`;
};
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

// Build [{date, value}] for the last N days. Missing days fill to 0.
const dailyBucket = (items, getDate, getValue, days = 30) => {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) buckets[daysAgo(i)] = 0;
  items.forEach(it => {
    const d = getDate(it);
    if (d in buckets) buckets[d] += getValue(it) || 0;
  });
  return Object.entries(buckets).map(([date, value]) => ({ date, value }));
};

// Sum a single field across all platforms in one EOD report.
const eodTotal = (eod, field) =>
  Object.values(eod?.platforms || {}).reduce((s, p) => s + (parseInt(p[field]) || 0), 0);

const col = {
  bg: "#070708", surf: "#131316", surf2: "#1c1c21", surf3: "#26262d",
  border: "#2a2a32", borderHi: "#3a3a44",
  text: "#f5f5f7", muted: "#7a7a85", muted2: "#b3b3bf",
  accent: "#c8ff00", accentDim: "#8aae00",
  success: "#00ff8c", danger: "#ff4d6d", warn: "#ffcc00",
  blue: "#6aa8ff", blueDim: "#3d6db5",
  glow: "rgba(200,255,0,0.08)", glowBlue: "rgba(106,168,255,0.08)",
};
const font = "'DM Sans', 'Helvetica Neue', sans-serif";
const mono = "'JetBrains Mono', 'Courier New', monospace";

const S = {
  page: { minHeight: "100vh", background: col.bg, color: col.text, fontFamily: font },
  inner: { maxWidth: 1120, margin: "0 auto", padding: "32px 28px 80px" },
  card: { background: col.surf, border: `1px solid ${col.border}`, borderRadius: 10, padding: "20px 22px", marginBottom: 12, transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s" },
  label: { display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: col.muted2, fontWeight: 600, marginBottom: 8 },
  input: { width: "100%", background: col.surf2, border: `1px solid ${col.border}`, borderRadius: 6, color: col.text, padding: "11px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: font, transition: "border-color 0.15s, box-shadow 0.15s" },
  select: { width: "100%", background: col.surf2, border: `1px solid ${col.border}`, borderRadius: 6, color: col.text, padding: "11px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: font, transition: "border-color 0.15s" },
  textarea: { width: "100%", background: col.surf2, border: `1px solid ${col.border}`, borderRadius: 6, color: col.text, padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: font, minHeight: 100, resize: "vertical", transition: "border-color 0.15s" },
  sectionLabel: { fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", color: col.muted2, textTransform: "uppercase", marginBottom: 14, fontWeight: 600 },
};
const btnA = { cursor: "pointer", border: "none", borderRadius: 6, fontFamily: font, fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 24px", background: col.accent, color: "#000", boxShadow: `0 4px 24px ${col.glow}`, transition: "transform 0.12s, box-shadow 0.15s" };
const btnB = { cursor: "pointer", border: "none", borderRadius: 6, fontFamily: font, fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 24px", background: col.blue, color: "#000", boxShadow: `0 4px 24px ${col.glowBlue}`, transition: "transform 0.12s, box-shadow 0.15s" };
const btnG = { cursor: "pointer", borderRadius: 6, fontFamily: font, fontWeight: 600, fontSize: 13, padding: "12px 22px", background: col.surf2, color: col.text, border: `1px solid ${col.border}`, transition: "border-color 0.15s, background 0.15s" };
const btnSm = { cursor: "pointer", borderRadius: 6, fontFamily: font, fontWeight: 700, fontSize: 11, padding: "8px 14px", background: col.surf2, color: col.accent, border: `1px solid ${col.accent}55`, letterSpacing: "0.05em", textTransform: "uppercase", transition: "background 0.15s, border-color 0.15s" };
const btnDel = { cursor: "pointer", borderRadius: 6, fontFamily: font, fontWeight: 700, fontSize: 11, padding: "8px 12px", background: "transparent", color: col.danger, border: `1px solid ${col.danger}55`, transition: "background 0.15s" };

const platBadge = (p) => ({
  display: "inline-block", padding: "2px 7px", borderRadius: 3, fontSize: 9,
  fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
  background: (PLATFORM_COLORS[p] || col.muted) + "22",
  color: PLATFORM_COLORS[p] || col.muted,
  border: `1px solid ${(PLATFORM_COLORS[p] || col.muted)}44`,
});

// ─── CHARTS ──────────────────────────────────────────────────────────────────
function TrendBars({ data, color = col.accent, height = 130, format = (v) => v, label }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const last7 = data.slice(-7).reduce((s, d) => s + d.value, 0);
  const prev7 = data.slice(-14, -7).reduce((s, d) => s + d.value, 0);
  const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : (last7 > 0 ? 100 : 0);
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: mono, color, letterSpacing: "-0.02em" }}>{format(total)}</div>
          </div>
          {(last7 > 0 || prev7 > 0) && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: col.muted, marginBottom: 2 }}>7d vs prev</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: delta > 0 ? col.success : delta < 0 ? col.danger : col.muted2 }}>
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}%
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, padding: "4px 0 0" }}>
        {data.map(d => (
          <div key={d.date} title={`${d.date}: ${format(d.value)}`} style={{ flex: 1, position: "relative", height: "100%" }}>
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: `${(d.value / max) * 100}%`,
              background: color,
              opacity: d.value > 0 ? 0.85 : 0.08,
              minHeight: d.value > 0 ? 2 : 0,
              borderRadius: 2,
              transition: "height 0.5s, opacity 0.3s",
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: mono, fontSize: 9, color: col.muted, letterSpacing: "0.08em" }}>
        <span>{fmtDate(data[0]?.date)}</span>
        <span>{fmtDate(data[Math.floor(data.length / 2)]?.date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function TrendLine({ data, color = col.accent, height = 160, label, format = (v) => v }) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 1000;
  const padB = 14, padT = 14;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = height - padB - (d.value / max) * (height - padB - padT);
    return [x, y];
  });
  const linePts = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPts = `0,${height} ${linePts} ${w},${height}`;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color, letterSpacing: "-0.02em" }}>{format(total)}</div>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height, display: "block" }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPts} fill={`url(#grad-${id})`} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Sparkline({ data, color = col.accent, height = 28, width = 90 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 100;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = height - 2 - (d.value / max) * (height - 4);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width, height, display: "block" }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" opacity="0.9" />
    </svg>
  );
}

function Funnel({ steps, color = col.blue, label }) {
  if (!steps?.length) return null;
  const max = Math.max(steps[0]?.value || 1, 1);
  return (
    <div>
      {label && <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>{label}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {steps.map((s, i) => {
          const prevVal = i > 0 ? steps[i - 1].value : null;
          const conv = prevVal !== null && prevVal > 0 ? pct(s.value, prevVal) : null;
          const convColor = conv === null ? col.muted : conv >= 25 ? col.success : conv >= 10 ? col.warn : col.danger;
          return (
            <div key={s.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: col.text, fontWeight: 600 }}>{s.label}</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color }}>{fmtNum(s.value)}</span>
                  {conv !== null && (
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: convColor }}>{conv}%</span>
                  )}
                </span>
              </div>
              <div style={{ height: 10, background: col.surf2, borderRadius: 5, overflow: "hidden", border: `1px solid ${col.border}` }}>
                <div style={{ height: "100%", width: `${(s.value / max) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`, borderRadius: 5, transition: "width 0.6s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Podium({ items, color = col.accent, valueFmt = fmtNum, onClick }) {
  const top3 = items.slice(0, 3);
  if (top3.length === 0) return null;
  // Visual order: 2nd, 1st, 3rd
  const order = top3.length === 1 ? [0] : top3.length === 2 ? [1, 0] : [1, 0, 2];
  const meta = [
    { rank: 1, medal: "#ffd700", h: 110, glow: true },
    { rank: 2, medal: "#c0c0c0", h: 86, glow: false },
    { rank: 3, medal: "#cd7f32", h: 64, glow: false },
  ];
  return (
    <div style={{
      ...S.card, padding: "28px 24px 24px", marginBottom: 16,
      background: `linear-gradient(180deg, ${col.surf}, ${col.bg})`,
    }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 18, textAlign: "center" }}>Top Performers · Last 30 Days</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12 }}>
        {order.map(i => {
          const it = top3[i];
          if (!it) return null;
          const m = meta[i];
          return (
            <div key={it.id} onClick={() => onClick?.(it.id)} style={{
              cursor: onClick ? "pointer" : "default", textAlign: "center", flex: 1, maxWidth: 200,
              transition: "transform 0.2s",
            }}
              onMouseEnter={e => onClick && (e.currentTarget.style.transform = "translateY(-3px)")}
              onMouseLeave={e => onClick && (e.currentTarget.style.transform = "translateY(0)")}
            >
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: m.medal, fontWeight: 800, marginBottom: 4, letterSpacing: "0.1em" }}>#{m.rank}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: col.text, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }}>{it.name}</div>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{valueFmt(it.value)}</div>
                {it.sub && <div style={{ fontSize: 10, color: col.muted, marginTop: 3, fontFamily: mono, letterSpacing: "0.05em" }}>{it.sub}</div>}
              </div>
              <div style={{
                height: m.h,
                background: `linear-gradient(180deg, ${m.medal}, ${m.medal}22)`,
                borderRadius: "10px 10px 0 0",
                border: `1px solid ${m.medal}66`,
                borderBottom: "none",
                position: "relative",
                boxShadow: m.glow ? `0 -12px 40px ${color}33` : "none",
              }}>
                <div style={{
                  position: "absolute", top: 10, left: 0, right: 0, textAlign: "center",
                  fontFamily: mono, fontSize: 22, fontWeight: 800, color: "#000", textShadow: "0 1px 0 rgba(255,255,255,0.3)",
                }}>{m.rank}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [creators, setCreators] = useState([]);
  const [setters, setSetters] = useState([]);
  const [videosMap, setVideosMap] = useState({});
  const [eodMap, setEodMap] = useState({});
  const [leadsMap, setLeadsMap] = useState({});
  const [focusId, setFocusId] = useState(null);
  const [adminView, setAdminView] = useState("main"); // "main" | "creator-detail" | "setter-detail"
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Auth state
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Admin notifications + profiles version (for live-updating the Users tab)
  const [notifications, setNotifications] = useState([]);
  const [profilesVersion, setProfilesVersion] = useState(0);

  const load = async () => {
    const { creators: c, setters: s, videosMap: vm, eodMap: em, leadsMap: lm } = await dataLayer.loadAll();
    setCreators(c);
    setSetters(s);
    setVideosMap(vm);
    setEodMap(em);
    setLeadsMap(lm);
  };

  // Establish session
  useEffect(() => {
    auth.getSession().then(s => { setSession(s); setSessionReady(true); });
    const sub = auth.onChange(s => setSession(s));
    return () => sub.unsubscribe();
  }, []);

  // Load profile whenever the session user changes
  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    setProfileLoading(true);
    dataLayer.loadProfile(session.user.id)
      .then(p => setProfile(p))
      .catch(e => { console.error(e); setProfile(null); })
      .finally(() => setProfileLoading(false));
  }, [session?.user?.id]);

  // Load shared data once we have an authenticated session
  useEffect(() => {
    if (!session) { setReady(false); setLoadError(null); return; }
    setLoadError(null);
    load()
      .then(() => setReady(true))
      .catch((e) => { setLoadError(e.message || String(e)); setReady(true); });
  }, [session?.user?.id]);

  // Realtime: keep state in sync when any other client mutates a row.
  useEffect(() => {
    if (!ready || loadError) return;
    const sub = dataLayer.subscribeAll((table, payload) => {
      const ev = payloadToApp(payload);
      if (table === "creators") {
        if (ev.type === "INSERT") setCreators(prev => prev.some(x => x.id === ev.new.id) ? prev : [...prev, ev.new]);
        else if (ev.type === "UPDATE") setCreators(prev => prev.map(x => x.id === ev.new.id ? ev.new : x));
        else if (ev.type === "DELETE") setCreators(prev => prev.filter(x => x.id !== ev.old.id));
      } else if (table === "setters") {
        if (ev.type === "INSERT") setSetters(prev => prev.some(x => x.id === ev.new.id) ? prev : [...prev, ev.new]);
        else if (ev.type === "UPDATE") setSetters(prev => prev.map(x => x.id === ev.new.id ? ev.new : x));
        else if (ev.type === "DELETE") setSetters(prev => prev.filter(x => x.id !== ev.old.id));
      } else if (table === "videos") {
        const id = ev.new?.creatorId || ev.old?.creatorId;
        if (!id) return;
        setVideosMap(p => {
          const cur = p[id] || [];
          if (ev.type === "INSERT") return { ...p, [id]: cur.some(v => v.id === ev.new.id) ? cur : [...cur, ev.new] };
          if (ev.type === "UPDATE") return { ...p, [id]: cur.map(v => v.id === ev.new.id ? ev.new : v) };
          if (ev.type === "DELETE") return { ...p, [id]: cur.filter(v => v.id !== ev.old.id) };
          return p;
        });
      } else if (table === "eod_reports") {
        const id = ev.new?.setterId || ev.old?.setterId;
        if (!id) return;
        setEodMap(p => {
          const cur = p[id] || [];
          if (ev.type === "INSERT") return { ...p, [id]: cur.some(e => e.id === ev.new.id) ? cur : [...cur, ev.new] };
          if (ev.type === "UPDATE") return { ...p, [id]: cur.map(e => e.id === ev.new.id ? ev.new : e) };
          if (ev.type === "DELETE") return { ...p, [id]: cur.filter(e => e.id !== ev.old.id) };
          return p;
        });
      } else if (table === "leads") {
        const id = ev.new?.setterId || ev.old?.setterId;
        if (!id) return;
        setLeadsMap(p => {
          const cur = p[id] || [];
          if (ev.type === "INSERT") return { ...p, [id]: cur.some(l => l.id === ev.new.id) ? cur : [...cur, ev.new] };
          if (ev.type === "UPDATE") return { ...p, [id]: cur.map(l => l.id === ev.new.id ? ev.new : l) };
          if (ev.type === "DELETE") return { ...p, [id]: cur.filter(l => l.id !== ev.old.id) };
          return p;
        });
      } else if (table === "profiles") {
        // Bump version so the Admin Users tab refetches in real time
        setProfilesVersion(v => v + 1);
        // If the current user is an admin and someone ELSE just signed up, raise a toast
        if (ev.type === "INSERT" && profile?.isAdmin && ev.new?.id && ev.new.id !== profile.id) {
          setNotifications(prev => {
            if (prev.some(n => n.id === ev.new.id)) return prev; // dedupe
            return [...prev, {
              id: ev.new.id,
              kind: "new_signup",
              email: ev.new.email,
              name: ev.new.name,
              ts: Date.now(),
            }];
          });
        }
      }
    });
    return () => sub.unsubscribe();
  }, [ready, loadError, profile?.isAdmin, profile?.id]);

  const dismissNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
  const clearAllNotifications = () => setNotifications([]);

  // Small uniform error wrapper so a failed save surfaces something instead of being silent.
  const wrap = async (fn) => {
    try { await fn(); }
    catch (e) { console.error(e); alert(e.message || String(e)); }
  };

  const addCreator = async (name) => {
    try {
      const nc = await dataLayer.addCreator(name);
      setCreators(prev => prev.some(x => x.id === nc.id) ? prev : [...prev, nc]);
      setVideosMap(p => ({ ...p, [nc.id]: p[nc.id] || [] }));
      return nc;
    } catch (e) { console.error(e); alert(e.message || String(e)); throw e; }
  };
  const removeCreator = async (id) => wrap(async () => {
    await dataLayer.removeCreator(id);
    setCreators(prev => prev.filter(c => c.id !== id));
    setVideosMap(p => { const n = { ...p }; delete n[id]; return n; });
  });
  const saveVideo = async (creatorId, video) => wrap(async () => {
    const saved = await dataLayer.saveVideo(creatorId, video);
    setVideosMap(p => {
      const cur = p[creatorId] || [];
      const idx = cur.findIndex(v => v.id === saved.id);
      const next = idx >= 0 ? cur.map(v => v.id === saved.id ? saved : v) : [...cur, saved];
      return { ...p, [creatorId]: next };
    });
  });
  const deleteVideo = async (creatorId, videoId) => wrap(async () => {
    await dataLayer.deleteVideo(videoId);
    setVideosMap(p => ({ ...p, [creatorId]: (p[creatorId] || []).filter(v => v.id !== videoId) }));
  });

  const addSetter = async (name) => {
    try {
      const ns = await dataLayer.addSetter(name);
      setSetters(prev => prev.some(x => x.id === ns.id) ? prev : [...prev, ns]);
      setEodMap(p => ({ ...p, [ns.id]: p[ns.id] || [] }));
      setLeadsMap(p => ({ ...p, [ns.id]: p[ns.id] || [] }));
      return ns;
    } catch (e) { console.error(e); alert(e.message || String(e)); throw e; }
  };
  const removeSetter = async (id) => wrap(async () => {
    await dataLayer.removeSetter(id);
    setSetters(prev => prev.filter(s => s.id !== id));
    setEodMap(p => { const n = { ...p }; delete n[id]; return n; });
    setLeadsMap(p => { const n = { ...p }; delete n[id]; return n; });
  });
  const saveEOD = async (setterId, eod) => wrap(async () => {
    const saved = await dataLayer.saveEOD(setterId, eod);
    setEodMap(p => {
      const cur = (p[setterId] || []).filter(e => e.date !== saved.date && e.id !== saved.id);
      return { ...p, [setterId]: [...cur, saved] };
    });
  });
  const saveLead = async (setterId, lead) => wrap(async () => {
    const saved = await dataLayer.saveLead(setterId, lead);
    setLeadsMap(p => {
      const cur = p[setterId] || [];
      const idx = cur.findIndex(l => l.id === saved.id);
      const next = idx >= 0 ? cur.map(l => l.id === saved.id ? saved : l) : [...cur, saved];
      return { ...p, [setterId]: next };
    });
  });
  const deleteLead = async (setterId, leadId) => wrap(async () => {
    await dataLayer.deleteLead(leadId);
    setLeadsMap(p => ({ ...p, [setterId]: (p[setterId] || []).filter(l => l.id !== leadId) }));
  });

  const focusCreator = creators.find(c => c.id === focusId);
  const focusSetter = setters.find(s => s.id === focusId);
  const myCreator = profile?.creatorId ? creators.find(c => c.id === profile.creatorId) : null;
  const mySetter = profile?.setterId ? setters.find(s => s.id === profile.setterId) : null;
  const [activeRole, setActiveRole] = useState(null); // "creator" | "setter" | "admin" — for users with multiple

  // Auto-pick a default active role based on what the user has
  useEffect(() => {
    if (!profile) { setActiveRole(null); return; }
    if (profile.isAdmin) { setActiveRole("admin"); return; }
    if (myCreator) { setActiveRole("creator"); return; }
    if (mySetter) { setActiveRole("setter"); return; }
    setActiveRole(null);
  }, [profile?.id, profile?.isAdmin, myCreator?.id, mySetter?.id]);

  // Roles the user has access to (for the switcher in dashboard header)
  const availableRoles = [];
  if (profile?.isAdmin) availableRoles.push({ key: "admin", label: "Admin", color: col.warn });
  if (myCreator) availableRoles.push({ key: "creator", label: "Creator", color: col.accent });
  if (mySetter) availableRoles.push({ key: "setter", label: "Setter", color: col.blue });

  const handleSignOut = async () => {
    try { await auth.signOut(); } catch (e) { console.error(e); }
    setProfile(null);
    setFocusId(null);
  };

  // Loading gates ──────────────────────────────────────────────────────────
  if (!sessionReady) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, color: col.muted, fontSize: 12 }}>Loading…</div>;

  // Not signed in
  if (!session) return <SignInPage />;

  if (loadError) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.2em", color: col.danger, textTransform: "uppercase", marginBottom: 12 }}>Connection failed</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Couldn't reach Supabase</h2>
        <p style={{ color: col.muted2, fontSize: 14, marginBottom: 18, lineHeight: 1.5 }}>{loadError}</p>
        <p style={{ color: col.muted, fontSize: 12, marginBottom: 18, lineHeight: 1.5 }}>Check that <code style={{ background: col.surf2, padding: "2px 6px", borderRadius: 4 }}>.env</code> has <code style={{ background: col.surf2, padding: "2px 6px", borderRadius: 4 }}>VITE_SUPABASE_URL</code> + <code style={{ background: col.surf2, padding: "2px 6px", borderRadius: 4 }}>VITE_SUPABASE_KEY</code> set, and that <code style={{ background: col.surf2, padding: "2px 6px", borderRadius: 4 }}>supabase/schema.sql</code> has been run.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button style={btnA} onClick={() => { setLoadError(null); setReady(false); load().then(() => setReady(true)).catch(e => { setLoadError(e.message); setReady(true); }); }}>Retry</button>
          <button style={btnG} onClick={handleSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  );

  if (!ready || profileLoading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, color: col.muted, fontSize: 12 }}>Loading…</div>;

  // Signed in, nothing assigned
  if (availableRoles.length === 0) return <UnassignedPage email={session.user.email} onSignOut={handleSignOut} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        html, body { background: ${col.bg}; }
        body {
          background-image:
            radial-gradient(900px circle at 12% -10%, ${col.glow}, transparent 55%),
            radial-gradient(900px circle at 95% 5%, ${col.glowBlue}, transparent 55%);
          background-attachment: fixed;
        }
        input::placeholder, textarea::placeholder { color: #4a4a55; }
        input:focus, select:focus, textarea:focus {
          border-color: ${col.accent} !important;
          box-shadow: 0 0 0 3px ${col.glow};
        }
        button { transition: transform 0.12s, opacity 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s; }
        button:hover:not(:disabled) { opacity: 0.95; transform: translateY(-1px); }
        button:active:not(:disabled) { transform: translateY(0); }
        button:disabled { opacity: 0.35; cursor: not-allowed; }
        a { color: inherit; }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: ${col.bg}; }
        ::-webkit-scrollbar-thumb { background: ${col.border}; border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background: ${col.borderHi}; }

        /* Stat boxes — make numbers bigger, add accent strip + hover */
        .stat-box {
          position: relative;
          overflow: hidden;
          border-radius: 10px !important;
          padding: 18px 20px !important;
        }
        .stat-box::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: linear-gradient(180deg, ${col.accent}, transparent);
          opacity: 0.6;
        }
        .stat-box.stat-blue::before { background: linear-gradient(180deg, ${col.blue}, transparent); }
        .stat-box > div:last-child { font-size: 30px !important; line-height: 1.05; letter-spacing: -0.02em; }
        .stat-row { gap: 14px !important; }

        /* Cards — softer lift on hover */
        .clickable-card:hover { border-color: ${col.borderHi} !important; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(0,0,0,0.4); }

        /* Tab buttons larger */
        .tabs button { font-size: 13.5px !important; padding: 14px 20px !important; }

        /* Section labels gain a soft chip look */
        .section-label-chip {
          display: inline-block;
          padding: 4px 10px;
          background: ${col.surf2};
          border: 1px solid ${col.border};
          border-radius: 999px;
          font-family: ${mono};
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${col.muted2};
          font-weight: 600;
          margin-bottom: 14px;
        }

        /* Pulse for "active today" dot */
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${col.success}55; }
          50% { box-shadow: 0 0 0 6px ${col.success}00; }
        }
        .pulse { animation: pulse 2s infinite; }

        /* Subtle fade-in */
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade { animation: fadeUp 0.25s ease-out; }

        /* Wider container responsive */
        @media (max-width: 720px) {
          .stat-row { gap: 8px !important; }
          .stat-box { min-width: calc(50% - 4px) !important; padding: 14px 16px !important; }
          .stat-box > div:last-child { font-size: 22px !important; }
          .row-split { flex-direction: column !important; }
        }
        @media (max-width: 480px) {
          .stat-box { min-width: 100% !important; }
        }
      `}</style>
      {activeRole === "creator" && myCreator && (
        <CreatorDash creator={myCreator}
          videos={videosMap[myCreator.id] || []}
          onSave={(v) => saveVideo(myCreator.id, v)}
          onDelete={(id) => deleteVideo(myCreator.id, id)}
          onLogout={handleSignOut}
          availableRoles={availableRoles}
          activeRole={activeRole}
          onSwitchRole={setActiveRole} />
      )}
      {activeRole === "setter" && mySetter && (
        <SetterDash setter={mySetter}
          eods={eodMap[mySetter.id] || []}
          leads={leadsMap[mySetter.id] || []}
          onSave={(e) => saveEOD(mySetter.id, e)}
          onSaveLead={(l) => saveLead(mySetter.id, l)}
          onDeleteLead={(id) => deleteLead(mySetter.id, id)}
          onLogout={handleSignOut}
          availableRoles={availableRoles}
          activeRole={activeRole}
          onSwitchRole={setActiveRole} />
      )}
      {activeRole === "admin" && adminView === "main" && (
        <AdminDash creators={creators} setters={setters} videosMap={videosMap} eodMap={eodMap}
          onAddCreator={addCreator} onRemoveCreator={removeCreator}
          onAddSetter={addSetter} onRemoveSetter={removeSetter}
          onSelectCreator={(id) => { setFocusId(id); setAdminView("creator-detail"); }}
          onSelectSetter={(id) => { setFocusId(id); setAdminView("setter-detail"); }}
          onLogout={handleSignOut}
          availableRoles={availableRoles}
          activeRole={activeRole}
          onSwitchRole={setActiveRole}
          profilesVersion={profilesVersion}
          initialTab="users" />
      )}

      {profile?.isAdmin && (
        <NotificationStack notifications={notifications}
          onDismiss={dismissNotification}
          onClearAll={clearAllNotifications}
          onJumpToUsers={() => { setActiveRole("admin"); setAdminView("main"); }} />
      )}
      {activeRole === "admin" && adminView === "creator-detail" && focusCreator && (
        <AdminCreatorDetail creator={focusCreator} videos={videosMap[focusCreator.id] || []} onBack={() => setAdminView("main")} />
      )}
      {activeRole === "admin" && adminView === "setter-detail" && focusSetter && (
        <AdminSetterDetail setter={focusSetter} eods={eodMap[focusSetter.id] || []} leads={leadsMap[focusSetter.id] || []} onBack={() => setAdminView("main")} />
      )}
    </>
  );
}

// ─── SIGN IN PAGE ────────────────────────────────────────────────────────────
function GoogleIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function SignInPage() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  const handleGoogle = async () => {
    setBusy(true); setErr(null); setInfo(null);
    try {
      await auth.signInWithGoogle();
      // The browser will navigate away to Google; if it returns we're signed in.
    } catch (e) {
      setErr(e.message || String(e));
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    setErr(null); setInfo(null);
    if (!email || !password) { setErr("Email and password required."); return; }
    setBusy(true);
    try {
      if (mode === "signin") {
        await auth.signIn(email, password);
        // The App's auth listener picks it up — no nav needed
      } else {
        const { user, session } = await auth.signUp(email, password);
        if (!session) {
          setInfo("Account created. Check your inbox to confirm your email, then come back and sign in.");
          setMode("signin");
        }
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 420 }} className="fade">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.3em", color: col.muted2, textTransform: "uppercase", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.accent, boxShadow: `0 0 12px ${col.accent}` }} />
            LocaScale Operations
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 10, lineHeight: 1 }}>
            <span style={{ background: `linear-gradient(135deg, ${col.accent}, ${col.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Daily Tracker</span>
          </h1>
          <p style={{ color: col.muted2, fontSize: 14 }}>{mode === "signin" ? "Sign in to continue." : "Create an account to get started."}</p>
        </div>

        <form onSubmit={submit} style={{ ...S.card, padding: "28px 26px" }}>
          <button type="button" onClick={handleGoogle} disabled={busy} style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "12px 14px",
            background: col.surf2, color: col.text,
            border: `1px solid ${col.border}`, borderRadius: 6,
            cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 600,
            marginBottom: 18,
          }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.borderColor = col.borderHi; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = col.border; }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: col.border }} />
            <span style={{ fontFamily: mono, fontSize: 9, color: col.muted, letterSpacing: "0.2em", textTransform: "uppercase" }}>or email</span>
            <div style={{ flex: 1, height: 1, background: col.border }} />
          </div>

          <div style={{ display: "flex", gap: 4, padding: 3, background: col.surf2, borderRadius: 8, marginBottom: 20 }}>
            {[
              { id: "signin", label: "Sign in" },
              { id: "signup", label: "Sign up" },
            ].map(t => (
              <button key={t.id} type="button" onClick={() => { setMode(t.id); setErr(null); setInfo(null); }} style={{
                flex: 1, padding: "10px 14px", borderRadius: 6,
                border: "none", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700,
                background: mode === t.id ? col.surf : "transparent",
                color: mode === t.id ? col.text : col.muted2,
                transition: "background 0.15s, color 0.15s",
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Email</label>
            <input autoFocus type="email" autoComplete="email" style={S.input} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={S.label}>Password</label>
            <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} style={S.input} placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {err && (
            <div style={{ background: `${col.danger}1a`, border: `1px solid ${col.danger}55`, color: col.danger, padding: "10px 12px", borderRadius: 6, fontSize: 13, marginBottom: 14 }}>{err}</div>
          )}
          {info && (
            <div style={{ background: `${col.success}1a`, border: `1px solid ${col.success}55`, color: col.success, padding: "10px 12px", borderRadius: 6, fontSize: 13, marginBottom: 14 }}>{info}</div>
          )}

          <button type="submit" style={{ ...btnA, width: "100%", padding: "14px" }} disabled={busy || !email || !password}>
            {busy ? (mode === "signin" ? "Signing in…" : "Creating account…") : (mode === "signin" ? "Sign in" : "Create account")}
          </button>

          <p style={{ marginTop: 18, fontSize: 12, color: col.muted, textAlign: "center", lineHeight: 1.5 }}>
            {mode === "signin"
              ? <>Don't have an account? <button type="button" onClick={() => { setMode("signup"); setErr(null); setInfo(null); }} style={{ background: "none", border: "none", color: col.accent, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, padding: 0 }}>Sign up</button></>
              : <>Already have an account? <button type="button" onClick={() => { setMode("signin"); setErr(null); setInfo(null); }} style={{ background: "none", border: "none", color: col.accent, cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, padding: 0 }}>Sign in</button></>
            }
          </p>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>tracking.outscript.io</div>
      </div>
    </div>
  );
}

// ─── NOTIFICATION STACK ──────────────────────────────────────────────────────
function NotificationStack({ notifications, onDismiss, onClearAll, onJumpToUsers }) {
  if (!notifications || notifications.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 1000,
      display: "flex", flexDirection: "column", gap: 10,
      maxWidth: 360, width: "calc(100vw - 40px)",
    }}>
      {notifications.length > 1 && (
        <button onClick={onClearAll} style={{
          alignSelf: "flex-end",
          background: col.surf2, color: col.muted2,
          border: `1px solid ${col.border}`, borderRadius: 6,
          padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
          fontFamily: font,
        }}>Dismiss all ({notifications.length})</button>
      )}
      {notifications.map(n => (
        <NotificationToast key={n.id} notification={n}
          onDismiss={() => onDismiss(n.id)}
          onAction={onJumpToUsers} />
      ))}
    </div>
  );
}

function NotificationToast({ notification, onDismiss, onAction }) {
  // Auto-dismiss after 20 seconds (admin still sees count via toast stack if multiple)
  useEffect(() => {
    const t = setTimeout(() => onDismiss(), 20000);
    return () => clearTimeout(t);
  }, []);

  const display = notification.name || notification.email?.split("@")[0] || "New user";

  return (
    <div className="fade" style={{
      background: col.surf,
      border: `1px solid ${col.accent}66`,
      borderRadius: 10,
      padding: "14px 16px",
      boxShadow: `0 12px 40px ${col.glow}, 0 4px 12px rgba(0,0,0,0.4)`,
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(180deg, ${col.accent}, ${col.accent}33)`,
      }} />
      <div style={{ flexShrink: 0, marginTop: 2, fontSize: 18 }}>✨</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: col.accent, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>New sign-up</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</div>
        <div style={{ fontSize: 11, color: col.muted, fontFamily: mono, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notification.email}</div>
        <button onClick={() => { onAction?.(); onDismiss(); }} style={{
          background: col.accent, color: "#000", border: "none", borderRadius: 5,
          padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase",
        }}>Assign now →</button>
      </div>
      <button onClick={onDismiss} style={{
        background: "transparent", color: col.muted2, border: "none",
        cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1, fontFamily: font,
      }}>✕</button>
    </div>
  );
}

// ─── ROLE SWITCHER (for users with multiple roles) ──────────────────────────
function RoleSwitcher({ availableRoles, activeRole, onSwitchRole }) {
  if (!availableRoles || availableRoles.length < 2) return null;
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, background: col.surf2, borderRadius: 8, border: `1px solid ${col.border}` }}>
      {availableRoles.map(r => (
        <button key={r.key} onClick={() => onSwitchRole(r.key)} style={{
          padding: "7px 14px", borderRadius: 5, cursor: "pointer",
          fontFamily: font, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          background: activeRole === r.key ? r.color + "22" : "transparent",
          color: activeRole === r.key ? r.color : col.muted2,
          border: activeRole === r.key ? `1px solid ${r.color}55` : "1px solid transparent",
          transition: "background 0.15s, color 0.15s",
        }}>{r.label}</button>
      ))}
    </div>
  );
}

// ─── UNASSIGNED PAGE ────────────────────────────────────────────────────────
function UnassignedPage({ email, onSignOut, reason }) {
  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }} className="fade">
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: `${col.warn}22`, border: `1px solid ${col.warn}55`, marginBottom: 22 }}>
          <span style={{ fontSize: 28 }}>⏳</span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.25em", color: col.warn, textTransform: "uppercase", marginBottom: 12 }}>Awaiting Assignment</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 14, lineHeight: 1.2 }}>You're signed in, but not yet assigned a role.</h1>
        <p style={{ color: col.muted2, fontSize: 15, marginBottom: 8, lineHeight: 1.5 }}>{reason || "Please contact your admin to get linked to your creator or setter profile."}</p>
        <p style={{ color: col.muted, fontSize: 13, marginBottom: 28, fontFamily: mono }}>{email}</p>
        <button style={btnG} onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

// ─── CREATOR DASHBOARD ──────────────────────────────────────────────────────
function CreatorDash({ creator, videos, onSave, onDelete, onLogout, availableRoles, activeRole, onSwitchRole }) {
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const cutoff = daysAgo(30);
  const last30 = videos.filter(v => v.postedDate >= cutoff);
  const totalViews = last30.reduce((s, v) => s + (parseInt(v.views) || 0), 0);

  const byPlatform = CREATOR_PLATFORMS.map(p => {
    const vids = last30.filter(v => v.platform === p);
    return { platform: p, videos: vids.length, views: vids.reduce((s, v) => s + (parseInt(v.views) || 0), 0) };
  });
  const maxPlat = Math.max(...byPlatform.map(p => p.views), 1);
  const topVideos = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  const dailyViews = useMemo(() => dailyBucket(videos, v => v.postedDate, v => parseInt(v.views) || 0, 30), [videos]);
  const dailyVids = useMemo(() => dailyBucket(videos, v => v.postedDate, () => 1, 30), [videos]);

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", color: col.muted, textTransform: "uppercase", marginBottom: 8 }}>Creator Dashboard</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{creator.name}</h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <RoleSwitcher availableRoles={availableRoles} activeRole={activeRole} onSwitchRole={onSwitchRole} />
            <button style={{ ...btnG, padding: "8px 16px", fontSize: 12 }} onClick={onLogout}>Sign out</button>
          </div>
        </div>

        <div className="tabs" style={{ display: "flex", borderBottom: `1px solid ${col.border}`, marginBottom: 24, gap: 4, overflowX: "auto" }}>
          {[
            { id: "overview", label: "Overview" },
            { id: "library", label: `Library (${videos.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none", color: tab === t.id ? col.accent : col.muted,
              fontFamily: font, fontWeight: 700, fontSize: 13, padding: "12px 18px", cursor: "pointer",
              borderBottom: `2px solid ${tab === t.id ? col.accent : "transparent"}`, marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div>
            <div style={S.sectionLabel}>Last 30 Days</div>
            <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 32, flexWrap: "wrap" }}>
              {[
                { label: "Total Views", value: fmtViews(totalViews) },
                { label: "Videos Posted", value: last30.length },
                { label: "Avg Views/Vid", value: last30.length ? fmtViews(Math.round(totalViews / last30.length)) : "0" },
              ].map(s => (
                <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 100, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "16px 18px" }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color: col.accent }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={S.sectionLabel}>Daily Trend</div>
            <div style={{ ...S.card, padding: "22px 24px", marginBottom: 28 }}>
              <TrendBars data={dailyViews} color={col.accent} height={140} format={fmtViews} label="Views from videos posted" />
              <div style={{ height: 1, background: col.border, margin: "20px 0" }} />
              <TrendBars data={dailyVids} color={col.blue} height={70} format={(v) => v} label="Videos posted per day" />
            </div>

            <div style={S.sectionLabel}>Views by Platform (30d)</div>
            <div style={{ ...S.card, padding: "20px 22px" }}>
              {byPlatform.every(p => p.views === 0)
                ? <div style={{ color: col.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>No videos in last 30 days.</div>
                : byPlatform.map(p => (
                  <div key={p.platform} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: PLATFORM_COLORS[p.platform] }}>{p.platform}</span>
                      <span style={{ fontFamily: mono, fontSize: 12, color: col.muted2 }}>{fmtViews(p.views)} · {p.videos} vids</span>
                    </div>
                    <div style={{ height: 6, background: col.surf2, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(p.views / maxPlat) * 100}%`, background: PLATFORM_COLORS[p.platform], borderRadius: 3, transition: "width 0.5s" }} />
                    </div>
                  </div>
                ))}
            </div>

            {topVideos.length > 0 && (
              <>
                <div style={{ ...S.sectionLabel, marginTop: 32 }}>Top Performers (All Time)</div>
                {topVideos.map((v, i) => (
                  <div key={v.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, padding: "13px 18px" }}>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 800, color: col.border, minWidth: 28 }}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={platBadge(v.platform)}>{v.platform}</span>
                        <span style={{ fontSize: 11, color: col.muted }}>{fmtDate(v.postedDate)}</span>
                      </div>
                      <a href={v.url} target="_blank" rel="noreferrer" style={{ color: col.text, textDecoration: "none", fontSize: 11, fontFamily: mono, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.url}</a>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: col.accent, flexShrink: 0 }}>{fmtViews(v.views)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "library" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ ...S.sectionLabel, marginBottom: 0 }}>All Videos</div>
              <button style={btnSm} onClick={() => setAdding(true)}>+ Add Video</button>
            </div>

            {adding && <VideoForm video={null} onSave={async (v) => { await onSave(v); setAdding(false); }} onCancel={() => setAdding(false)} />}

            {videos.length === 0 && !adding
              ? <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 40 }}>
                  <div style={{ marginBottom: 12 }}>No videos yet.</div>
                  <button style={btnA} onClick={() => setAdding(true)}>Add your first video</button>
                </div>
              : [...videos].sort((a, b) => b.postedDate.localeCompare(a.postedDate)).map(v => (
                editing === v.id
                  ? <VideoForm key={v.id} video={v}
                      onSave={async (u) => { await onSave(u); setEditing(null); }}
                      onCancel={() => setEditing(null)}
                      onDelete={async () => { if (window.confirm("Delete this video?")) { await onDelete(v.id); setEditing(null); } }} />
                  : <div key={v.id}
                      style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                      onClick={() => setEditing(v.id)}
                      className="clickable-card"
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                          <span style={platBadge(v.platform)}>{v.platform}</span>
                          <span style={{ fontSize: 11, color: col.muted }}>{fmtDate(v.postedDate)}</span>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: mono, color: col.muted2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.url}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: col.accent }}>{fmtViews(v.views)}</div>
                        <div style={{ fontSize: 10, color: col.muted }}>tap to edit</div>
                      </div>
                    </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ─── VIDEO FORM ──────────────────────────────────────────────────────────────
function VideoForm({ video, onSave, onCancel, onDelete }) {
  const [url, setUrl] = useState(video?.url || "");
  const [platform, setPlatform] = useState(video?.platform || "Instagram");
  const [views, setViews] = useState(video?.views?.toString() || "");
  const [postedDate, setPostedDate] = useState(video?.postedDate || todayStr());
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!url) return;
    setBusy(true);
    await onSave({ ...(video || {}), url, platform, postedDate, views: parseInt(views) || 0 });
    setBusy(false);
  };
  const editMode = !!video;

  return (
    <div style={{ ...S.card, background: col.surf2, border: `1px solid ${col.accent}66`, padding: "20px 22px" }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", color: col.accent, textTransform: "uppercase", marginBottom: 14 }}>{editMode ? "Edit Video" : "New Video"}</div>
      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>Video URL</label>
        <input type="url" placeholder="https://..." style={S.input} value={url} onChange={e => setUrl(e.target.value)} autoFocus={!editMode} />
      </div>
      <div className="row-split" style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Platform</label>
          <select style={S.select} value={platform} onChange={e => setPlatform(e.target.value)}>
            {CREATOR_PLATFORMS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Date Posted</label>
          <input type="date" style={S.input} value={postedDate} onChange={e => setPostedDate(e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Current Views</label>
        <input type="number" placeholder="0" style={S.input} value={views} onChange={e => setViews(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnA} onClick={handleSave} disabled={busy || !url}>{busy ? "Saving..." : editMode ? "Update" : "Add Video"}</button>
          <button style={btnG} onClick={onCancel}>Cancel</button>
        </div>
        {editMode && onDelete && <button style={btnDel} onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}

// ─── SETTER DASHBOARD ────────────────────────────────────────────────────────
function SetterDash({ setter, eods, leads, onSave, onSaveLead, onDeleteLead, onLogout, availableRoles, activeRole, onSwitchRole }) {
  const [tab, setTab] = useState("overview");
  const [submitting, setSubmitting] = useState(false);

  const cutoff = daysAgo(30);
  const last30 = eods.filter(e => e.date >= cutoff);

  const totals = useMemo(() => {
    const t = { newMessages: 0, followUps: 0, positiveReplies: 0, callsBooked: 0, freeTrials: 0 };
    last30.forEach(eod => {
      Object.values(eod.platforms || {}).forEach(p => {
        SETTER_FIELDS.forEach(f => {
          if (f.key !== "conversationsInProgress") t[f.key] = (t[f.key] || 0) + (parseInt(p[f.key]) || 0);
        });
      });
    });
    return t;
  }, [last30]);

  const latestConvos = useMemo(() => {
    const sorted = [...eods].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length === 0) return 0;
    return Object.values(sorted[0].platforms || {}).reduce((s, p) => s + (parseInt(p.conversationsInProgress) || 0), 0);
  }, [eods]);

  const replyRate = pct(totals.positiveReplies, totals.newMessages);
  const callConvRate = pct(totals.callsBooked, totals.positiveReplies);

  const dailyMsgs = useMemo(() => dailyBucket(eods, e => e.date, e => eodTotal(e, "newMessages"), 30), [eods]);
  const dailyCalls = useMemo(() => dailyBucket(eods, e => e.date, e => eodTotal(e, "callsBooked"), 30), [eods]);

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", color: col.blue, textTransform: "uppercase", marginBottom: 8 }}>Setter Dashboard</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{setter.name}</h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <RoleSwitcher availableRoles={availableRoles} activeRole={activeRole} onSwitchRole={onSwitchRole} />
            <button style={{ ...btnG, padding: "8px 16px", fontSize: 12 }} onClick={onLogout}>Sign out</button>
          </div>
        </div>

        <div className="tabs" style={{ display: "flex", borderBottom: `1px solid ${col.border}`, marginBottom: 24, gap: 4, overflowX: "auto" }}>
          {[
            { id: "overview", label: "Overview" },
            { id: "submit", label: "Submit EOD" },
            { id: "leads", label: `Leads (${leads.length})` },
            { id: "history", label: `History (${eods.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none", color: tab === t.id ? col.blue : col.muted,
              fontFamily: font, fontWeight: 700, fontSize: 13, padding: "12px 18px", cursor: "pointer",
              borderBottom: `2px solid ${tab === t.id ? col.blue : "transparent"}`, marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div>
            <div style={S.sectionLabel}>Last 30 Days</div>
            <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { label: "Messages", value: fmtNum(totals.newMessages) },
                { label: "Positive Replies", value: fmtNum(totals.positiveReplies) },
                { label: "Calls Booked", value: fmtNum(totals.callsBooked) },
                { label: "Free Trials", value: fmtNum(totals.freeTrials) },
              ].map(s => (
                <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 100, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "16px 18px" }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color: col.blue }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 32, flexWrap: "wrap" }}>
              {[
                { label: "Reply Rate", value: replyRate + "%", hint: "positive / messages" },
                { label: "Reply→Call Rate", value: callConvRate + "%", hint: "calls / positive replies" },
                { label: "Open Convos Now", value: fmtNum(latestConvos), hint: "from latest EOD" },
              ].map(s => (
                <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 100, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "16px 18px" }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color: col.accent }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: col.muted, marginTop: 4 }}>{s.hint}</div>
                </div>
              ))}
            </div>

            <div style={S.sectionLabel}>Daily Activity Trend</div>
            <div style={{ ...S.card, padding: "22px 24px", marginBottom: 24 }}>
              <TrendBars data={dailyMsgs} color={col.blue} height={120} format={fmtNum} label="Messages sent" />
              <div style={{ height: 1, background: col.border, margin: "20px 0" }} />
              <TrendBars data={dailyCalls} color={col.accent} height={70} format={fmtNum} label="Calls booked" />
            </div>

            <div style={S.sectionLabel}>Conversion Funnel (30d)</div>
            <div style={{ ...S.card, padding: "22px 24px", marginBottom: 24 }}>
              <Funnel steps={[
                { label: "Messages sent", value: totals.newMessages },
                { label: "Positive replies", value: totals.positiveReplies },
                { label: "Calls booked", value: totals.callsBooked },
                { label: "Free trials", value: totals.freeTrials },
              ]} color={col.blue} />
            </div>

            <div style={{ ...S.card, textAlign: "center", padding: 24 }}>
              <button style={btnB} onClick={() => setTab("submit")}>+ Submit Today's EOD</button>
            </div>
          </div>
        )}

        {tab === "submit" && (
          <SetterEODForm
            existing={eods.find(e => e.date === todayStr())}
            onSubmit={async (eod) => { setSubmitting(true); await onSave(eod); setSubmitting(false); setTab("history"); }}
            submitting={submitting}
          />
        )}

        {tab === "leads" && <LeadsManager leads={leads} onSave={onSaveLead} onDelete={onDeleteLead} />}

        {tab === "history" && (
          <div>
            <div style={S.sectionLabel}>All EOD Reports</div>
            {eods.length === 0
              ? <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 40 }}>No EOD reports submitted yet.</div>
              : [...eods].sort((a, b) => b.date.localeCompare(a.date)).map(e => <SetterEODCard key={e.date} eod={e} />)
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LEADS MANAGER (Setter side) ─────────────────────────────────────────────
function LeadsManager({ leads, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    const c = { all: leads.length };
    LEAD_STATUSES.forEach(s => { c[s.key] = leads.filter(l => l.status === s.key).length; });
    return c;
  }, [leads]);

  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);
  const sorted = [...filtered].sort((a, b) => (b.lastTouch || "").localeCompare(a.lastTouch || ""));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ ...S.sectionLabel, marginBottom: 0 }}>Lead Pipeline</div>
        <button style={{ ...btnSm, color: col.blue, borderColor: col.blue + "44" }} onClick={() => { setAdding(true); setEditing(null); }}>+ Add Lead</button>
      </div>

      {/* Status filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} color={col.text} />
        {LEAD_STATUSES.map(s => counts[s.key] > 0 && (
          <FilterChip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)} label={s.label} count={counts[s.key]} color={s.color} />
        ))}
      </div>

      {adding && <LeadForm lead={null} onSave={async (l) => { await onSave(l); setAdding(false); }} onCancel={() => setAdding(false)} />}

      {sorted.length === 0 && !adding ? (
        <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 40 }}>
          <div style={{ marginBottom: 12 }}>{filter === "all" ? "No leads yet. Add the first person who engaged." : "No leads in this stage."}</div>
          {filter === "all" && <button style={{ ...btnB }} onClick={() => setAdding(true)}>Add your first lead</button>}
        </div>
      ) : sorted.map(l => (
        editing === l.id
          ? <LeadForm key={l.id} lead={l}
              onSave={async (u) => { await onSave(u); setEditing(null); }}
              onCancel={() => setEditing(null)}
              onDelete={async () => { if (window.confirm("Delete this lead?")) { await onDelete(l.id); setEditing(null); } }} />
          : <LeadRow key={l.id} lead={l} onClick={() => { setEditing(l.id); setAdding(false); }} />
      ))}
    </div>
  );
}

function FilterChip({ active, onClick, label, count, color }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 4,
      fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: font,
      border: `1px solid ${active ? color : col.border}`,
      background: active ? color + "22" : "transparent",
      color: active ? color : col.muted2,
    }}>
      {label}
      <span style={{ fontFamily: mono, fontSize: 10, opacity: 0.8 }}>{count}</span>
    </button>
  );
}

function LeadRow({ lead, onClick }) {
  const sm = statusMeta(lead.status);
  return (
    <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
      onClick={onClick}
      className="clickable-card"
    >
      <div style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: sm.color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{lead.name || "Unnamed lead"}</span>
          {lead.platform && <span style={platBadge(lead.platform)}>{lead.platform}</span>}
        </div>
        <div style={{ fontSize: 11, color: col.muted, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {lead.profileUrl && <span style={{ color: col.blue }}>profile ↗</span>}
          {lead.email && <span>{lead.email}</span>}
          {lead.phone && <span>{lead.phone}</span>}
        </div>
      </div>
      <span style={{
        padding: "3px 9px", borderRadius: 3, fontSize: 10, fontWeight: 700,
        letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0,
        background: sm.color + "22", color: sm.color, border: `1px solid ${sm.color}44`,
      }}>{sm.label}</span>
    </div>
  );
}

// ─── LEAD FORM (Add / Edit) ──────────────────────────────────────────────────
function LeadForm({ lead, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(lead?.name || "");
  const [profileUrl, setProfileUrl] = useState(lead?.profileUrl || "");
  const [platform, setPlatform] = useState(lead?.platform || "Instagram");
  const [status, setStatus] = useState(lead?.status || "new");
  const [email, setEmail] = useState(lead?.email || "");
  const [phone, setPhone] = useState(lead?.phone || "");
  const [notes, setNotes] = useState(lead?.notes || "");
  const [busy, setBusy] = useState(false);
  const editMode = !!lead;

  const handleSave = async () => {
    if (!name.trim() && !profileUrl.trim()) return;
    setBusy(true);
    await onSave({ ...(lead || {}), name: name.trim(), profileUrl: profileUrl.trim(), platform, status, email: email.trim(), phone: phone.trim(), notes });
    setBusy(false);
  };

  return (
    <div style={{ ...S.card, background: col.surf2, border: `1px solid ${col.blue}66`, padding: "20px 22px" }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", color: col.blue, textTransform: "uppercase", marginBottom: 14 }}>{editMode ? "Edit Lead" : "New Lead"}</div>

      <div className="row-split" style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Name</label>
          <input style={S.input} placeholder="Lead name" value={name} onChange={e => setName(e.target.value)} autoFocus={!editMode} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Platform</label>
          <select style={S.select} value={platform} onChange={e => setPlatform(e.target.value)}>
            {SETTER_PLATFORMS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>Profile Link</label>
        <input type="url" style={S.input} placeholder="https://instagram.com/..." value={profileUrl} onChange={e => setProfileUrl(e.target.value)} />
      </div>

      <div className="row-split" style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Email</label>
          <input type="email" style={S.input} placeholder="name@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Phone</label>
          <input type="tel" style={S.input} placeholder="+1..." value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>Status</label>
        <select style={S.select} value={status} onChange={e => setStatus(e.target.value)}>
          {LEAD_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Notes (objection, context, next step)</label>
        <textarea style={{ ...S.textarea, minHeight: 70 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What's the situation? Objection? When to follow up?" />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnB} onClick={handleSave} disabled={busy || (!name.trim() && !profileUrl.trim())}>{busy ? "Saving..." : editMode ? "Update Lead" : "Add Lead"}</button>
          <button style={btnG} onClick={onCancel}>Cancel</button>
        </div>
        {editMode && onDelete && <button style={btnDel} onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}

// ─── SETTER EOD FORM ─────────────────────────────────────────────────────────
function SetterEODForm({ existing, onSubmit, submitting }) {
  const [date, setDate] = useState(existing?.date || todayStr());
  const [activePlatforms, setActivePlatforms] = useState(existing ? Object.keys(existing.platforms || {}) : []);
  const [platformData, setPlatformData] = useState(existing?.platforms || {});
  const [notes, setNotes] = useState(existing?.notes || "");

  const togglePlatform = (p) => {
    if (activePlatforms.includes(p)) {
      setActivePlatforms(prev => prev.filter(x => x !== p));
    } else {
      setActivePlatforms(prev => [...prev, p]);
      if (!platformData[p]) {
        setPlatformData(prev => ({ ...prev, [p]: SETTER_FIELDS.reduce((a, f) => ({ ...a, [f.key]: "" }), {}) }));
      }
    }
  };

  const updateField = (platform, key, val) => {
    setPlatformData(prev => ({ ...prev, [platform]: { ...prev[platform], [key]: val } }));
  };

  const handleSubmit = async () => {
    const platforms = {};
    activePlatforms.forEach(p => {
      platforms[p] = SETTER_FIELDS.reduce((a, f) => ({ ...a, [f.key]: parseInt(platformData[p]?.[f.key]) || 0 }), {});
    });
    const payload = { date, platforms, notes, submittedAt: new Date().toISOString() };
    if (existing?.id) payload.id = existing.id;
    await onSubmit(payload);
  };

  return (
    <div>
      <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>EOD Report</h3>
      <p style={{ color: col.muted, fontSize: 14, marginBottom: 20 }}>{existing ? "Updating today's report." : "Fill in your numbers for the day."}</p>

      <div style={S.card}>
        <label style={S.label}>Report Date</label>
        <input type="date" style={S.input} value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <div style={S.card}>
        <label style={S.label}>Platforms you outreached on today</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SETTER_PLATFORMS.map(p => (
            <button key={p} onClick={() => togglePlatform(p)} style={{
              padding: "8px 16px", borderRadius: 4, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: font, border: "none",
              background: activePlatforms.includes(p) ? PLATFORM_COLORS[p] : col.surf2,
              color: activePlatforms.includes(p) ? "#000" : col.muted,
            }}>{p}</button>
          ))}
        </div>
      </div>

      {activePlatforms.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 24, fontSize: 13 }}>Select platforms above to enter your numbers.</div>
      )}

      {activePlatforms.map(p => (
        <div key={p} style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: PLATFORM_COLORS[p] }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: PLATFORM_COLORS[p] }}>{p}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SETTER_FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ ...S.label, fontSize: 9 }}>{f.label}</label>
                <input type="number" placeholder="0" style={S.input} value={platformData[p]?.[f.key] || ""} onChange={e => updateField(p, f.key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={S.card}>
        <label style={S.label}>Notes & Observations</label>
        <textarea style={S.textarea} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="What's working, what's not, leads not replying, objections you noticed, ideas to test..." />
      </div>

      <button style={{ ...btnB, width: "100%", padding: "14px 22px", fontSize: 14 }} onClick={handleSubmit} disabled={submitting || activePlatforms.length === 0}>
        {submitting ? "Submitting..." : existing ? "Update EOD Report" : "Submit EOD Report"}
      </button>
    </div>
  );
}

// ─── SETTER EOD CARD (for history) ───────────────────────────────────────────
function SetterEODCard({ eod }) {
  const [expanded, setExpanded] = useState(false);
  const platforms = Object.entries(eod.platforms || {});
  const totals = platforms.reduce((acc, [, p]) => {
    SETTER_FIELDS.forEach(f => { acc[f.key] = (acc[f.key] || 0) + (parseInt(p[f.key]) || 0); });
    return acc;
  }, {});

  return (
    <div style={{ ...S.card, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(eod.date)}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {platforms.map(([p]) => <span key={p} style={platBadge(p)}>{p}</span>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontFamily: mono, fontSize: 12 }}>
          <span style={{ color: col.muted2 }}>{totals.newMessages || 0} msgs</span>
          <span style={{ color: col.accent }}>{totals.callsBooked || 0} calls</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${col.border}` }}>
          {platforms.map(([p, data]) => (
            <div key={p} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: PLATFORM_COLORS[p], marginBottom: 8 }}>{p}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, fontSize: 12 }}>
                {SETTER_FIELDS.map(f => (
                  <div key={f.key} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: col.muted2 }}>{f.label}</span>
                    <span style={{ fontFamily: mono, fontWeight: 700 }}>{data[f.key] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {eod.notes && (
            <div style={{ marginTop: 12, padding: 12, background: col.surf2, borderRadius: 4 }}>
              <div style={{ ...S.label, marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 13, color: col.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{eod.notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDash({ creators, setters, videosMap, eodMap, onAddCreator, onRemoveCreator, onAddSetter, onRemoveSetter, onSelectCreator, onSelectSetter, onLogout, availableRoles, activeRole, onSwitchRole, profilesVersion = 0, initialTab = "users" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", color: col.muted, textTransform: "uppercase", marginBottom: 8 }}>Admin · Operations</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard</h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <RoleSwitcher availableRoles={availableRoles} activeRole={activeRole} onSwitchRole={onSwitchRole} />
            <button style={{ ...btnG, padding: "8px 16px", fontSize: 12 }} onClick={onLogout}>Sign out</button>
          </div>
        </div>

        <div className="tabs" style={{ display: "flex", borderBottom: `1px solid ${col.border}`, marginBottom: 24, gap: 4, overflowX: "auto" }}>
          {[
            { id: "creators", label: `Creators (${creators.length})`, color: col.accent },
            { id: "setters", label: `Setters (${setters.length})`, color: col.blue },
            { id: "users", label: "Users", color: col.warn },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none", color: tab === t.id ? t.color : col.muted,
              fontFamily: font, fontWeight: 700, fontSize: 13, padding: "12px 18px", cursor: "pointer",
              borderBottom: `2px solid ${tab === t.id ? t.color : "transparent"}`, marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "creators" && <AdminCreatorsView creators={creators} videosMap={videosMap} onAdd={onAddCreator} onRemove={onRemoveCreator} onSelect={onSelectCreator} />}
        {tab === "setters" && <AdminSettersView setters={setters} eodMap={eodMap} onAdd={onAddSetter} onRemove={onRemoveSetter} onSelect={onSelectSetter} />}
        {tab === "users" && <AdminUsersView creators={creators} setters={setters} onAddCreator={onAddCreator} onAddSetter={onAddSetter} externalVersion={profilesVersion} />}
      </div>
    </div>
  );
}

// ─── ADMIN USERS VIEW ────────────────────────────────────────────────────────
function AdminUsersView({ creators, setters, onAddCreator, onAddSetter, externalVersion = 0 }) {
  const [profiles, setProfiles] = useState(null);
  const [invites, setInvites] = useState(null);
  const [editing, setEditing] = useState(null); // profile id OR "invite:<email>" OR "new"
  const [refreshKey, setRefreshKey] = useState(0);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([dataLayer.listProfiles(), dataLayer.listInvites()])
      .then(([p, i]) => { if (alive) { setProfiles(p); setInvites(i); } })
      .catch(e => { if (alive) setErr(e.message || String(e)); });
    return () => { alive = false; };
  }, [refreshKey, externalVersion]);

  const refresh = () => setRefreshKey(k => k + 1);

  const rolesOf = (p) => {
    const out = [];
    if (p.isAdmin) out.push({ key: "admin", label: "Admin", color: col.warn });
    if (p.creatorId) out.push({ key: "creator", label: "Creator", color: col.accent, entityName: creators.find(c => c.id === p.creatorId)?.name || "(deleted)" });
    if (p.setterId) out.push({ key: "setter", label: "Setter", color: col.blue, entityName: setters.find(s => s.id === p.setterId)?.name || "(deleted)" });
    return out;
  };

  if (err) return <div style={{ ...S.card, padding: 20, color: col.danger }}>Couldn't load users: {err}</div>;
  if (!profiles || !invites) return <div style={{ ...S.card, padding: 30, color: col.muted, textAlign: "center" }}>Loading…</div>;

  const unassigned = profiles.filter(p => !p.isAdmin && !p.creatorId && !p.setterId);
  const assigned = profiles.filter(p => p.isAdmin || p.creatorId || p.setterId);

  const handleDeleteInvite = async (email) => {
    if (!window.confirm(`Cancel invite for ${email}?`)) return;
    try { await dataLayer.deleteInvite(email); refresh(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ ...S.sectionLabel, marginBottom: 0 }}>User Management</div>
        <button style={{ ...btnSm, color: col.warn, borderColor: col.warn + "55" }} onClick={() => setEditing("new")}>+ Add User by Email</button>
      </div>

      {editing === "new" && (
        <InviteForm creators={creators} setters={setters}
          onAddCreator={onAddCreator} onAddSetter={onAddSetter}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }} />
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <>
          <div style={{ ...S.sectionLabel, marginTop: 24 }}>Pending Invites ({invites.length}) — auto-applies when they sign up</div>
          {invites.map(i => {
            const iRoles = [];
            if (i.isAdmin) iRoles.push({ label: "Admin", color: col.warn });
            if (i.creatorId) iRoles.push({ label: "Creator", color: col.accent, entityName: creators.find(c => c.id === i.creatorId)?.name });
            if (i.setterId) iRoles.push({ label: "Setter", color: col.blue, entityName: setters.find(s => s.id === i.setterId)?.name });
            return (
              <div key={i.email} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.warn, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.email}</div>
                  <div style={{ fontSize: 11, color: col.muted }}>Invited {fmtDate(i.invitedAt?.split("T")[0])} · waiting for sign-up</div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {iRoles.map(r => (
                    <span key={r.label} style={{
                      padding: "3px 9px", borderRadius: 3, fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.05em", textTransform: "uppercase",
                      background: r.color + "22", color: r.color, border: `1px solid ${r.color}44`,
                    }}>{r.label}{r.entityName ? ` · ${r.entityName}` : ""}</span>
                  ))}
                </div>
                <button style={btnDel} onClick={() => handleDeleteInvite(i.email)}>✕</button>
              </div>
            );
          })}
        </>
      )}

      {/* Awaiting assignment (signed up, nothing assigned) */}
      <div style={{ ...S.sectionLabel, marginTop: 24 }}>Awaiting Assignment ({unassigned.length})</div>
      {unassigned.length === 0
        ? <div style={{ ...S.card, padding: 24, textAlign: "center", color: col.muted, marginBottom: 28 }}>Everyone's assigned. ✓</div>
        : unassigned.map(p => (
          <UserRow key={p.id} profile={p} creators={creators} setters={setters}
            onAddCreator={onAddCreator} onAddSetter={onAddSetter}
            editing={editing === p.id}
            onEdit={() => setEditing(p.id)}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); refresh(); }}
            rolesOf={rolesOf}
          />
        ))
      }

      <div style={{ ...S.sectionLabel, marginTop: 28 }}>Assigned ({assigned.length})</div>
      {assigned.length === 0
        ? <div style={{ ...S.card, padding: 24, textAlign: "center", color: col.muted }}>Nobody assigned yet.</div>
        : assigned.map(p => (
          <UserRow key={p.id} profile={p} creators={creators} setters={setters}
            onAddCreator={onAddCreator} onAddSetter={onAddSetter}
            editing={editing === p.id}
            onEdit={() => setEditing(p.id)}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); refresh(); }}
            rolesOf={rolesOf}
          />
        ))
      }
    </div>
  );
}

// ─── INVITE FORM (add user by email) ─────────────────────────────────────────
function InviteForm({ creators, setters, onAddCreator, onAddSetter, onCancel, onSaved }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [assigner, setAssigner] = useState({ resolve: null, valid: true, anySelected: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Derive a default name from the email handle if user hasn't typed one
  const effectiveName = name.trim() || email.split("@")[0] || "";

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const resolved = await assigner.resolve();
      await dataLayer.assignByEmail({ email: email.trim(), ...resolved });
      onSaved();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...S.card, padding: "22px 24px", background: col.surf2, border: `1px solid ${col.warn}66`, marginBottom: 16 }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: col.warn, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>Add User by Email</div>

      <div className="row-split" style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Email</label>
          <input autoFocus type="email" style={S.input} placeholder="them@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Display Name <span style={{ color: col.muted, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· optional</span></label>
          <input style={S.input} placeholder={email ? email.split("@")[0] : "Full name"} value={name} onChange={e => setName(e.target.value)} />
        </div>
      </div>

      <RoleAssignmentFields
        onAddCreator={onAddCreator} onAddSetter={onAddSetter}
        value={{ isAdmin: false, creatorId: null, setterId: null }}
        onChange={setAssigner}
        displayName={effectiveName} />

      {err && <div style={{ background: `${col.danger}1a`, border: `1px solid ${col.danger}55`, color: col.danger, padding: "10px 12px", borderRadius: 6, fontSize: 13, marginTop: 14 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button style={btnA} onClick={submit} disabled={busy || !email.trim() || !assigner.valid}>
          {busy ? "Saving…" : assigner.anySelected ? "Save" : "Add Email (no role yet)"}
        </button>
        <button style={btnG} onClick={onCancel}>Cancel</button>
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: col.muted, lineHeight: 1.5 }}>
        If this email already has an account, roles apply immediately. Otherwise a pending invite is saved and auto-applied on their next sign-up. When they sign in with Google, their Google name overrides the Display Name above — you can re-edit anytime.
      </p>
    </div>
  );
}

// Role assignment editor — checkbox model only, no entity picking.
// Checking Creator/Setter auto-creates a fresh entity (named from displayName).
// Admin role requires typing "admin" in a confirmation box to avoid accidents.
function RoleAssignmentFields({ onAddCreator, onAddSetter, value, onChange, displayName }) {
  const [isAdmin, setIsAdmin] = useState(value.isAdmin);
  const [isCreator, setIsCreator] = useState(!!value.creatorId);
  const [isSetter, setIsSetter] = useState(!!value.setterId);
  const [adminConfirm, setAdminConfirm] = useState("");

  // Resolve to final {isAdmin, creatorId, setterId}. Entities are created only
  // when newly checked (no entity exists yet); existing links are preserved.
  const resolve = async () => {
    if (isAdmin && !value.isAdmin && adminConfirm.trim().toLowerCase() !== "admin") {
      throw new Error('Type "admin" in the confirmation box to grant admin role.');
    }
    let creatorId = null;
    let setterId = null;
    if (isCreator) {
      if (value.creatorId) {
        creatorId = value.creatorId; // preserve existing link
      } else {
        const name = (displayName || "").trim();
        if (!name) throw new Error("Display name required to create a creator entity.");
        const nc = await onAddCreator(name);
        creatorId = nc.id;
      }
    }
    if (isSetter) {
      if (value.setterId) {
        setterId = value.setterId;
      } else {
        const name = (displayName || "").trim();
        if (!name) throw new Error("Display name required to create a setter entity.");
        const ns = await onAddSetter(name);
        setterId = ns.id;
      }
    }
    return { isAdmin, creatorId, setterId };
  };

  const needsAdminConfirm = isAdmin && !value.isAdmin;
  const adminConfirmed = !needsAdminConfirm || adminConfirm.trim().toLowerCase() === "admin";
  const needsDisplayName = (isCreator && !value.creatorId) || (isSetter && !value.setterId);
  const hasDisplayName = !needsDisplayName || (displayName || "").trim().length > 0;
  const valid = adminConfirmed && hasDisplayName;
  const anySelected = isAdmin || isCreator || isSetter;

  useEffect(() => {
    onChange({ resolve, valid, anySelected });
  }, [isAdmin, isCreator, isSetter, adminConfirm, displayName]);

  return (
    <div>
      <label style={S.label}>Roles (pick any combination)</label>

      {/* Creator */}
      <CheckboxRow label="Creator" color={col.accent} checked={isCreator} onChange={setIsCreator}
        desc={value.creatorId ? "Already linked — uncheck to unlink." : "Creates a fresh creator profile under their display name."} />

      {/* Setter */}
      <CheckboxRow label="Setter" color={col.blue} checked={isSetter} onChange={setIsSetter}
        desc={value.setterId ? "Already linked — uncheck to unlink." : "Creates a fresh setter profile under their display name."} />

      {/* Display name warning */}
      {needsDisplayName && !hasDisplayName && (
        <div style={{ marginLeft: 26, marginTop: -4, marginBottom: 8, fontSize: 12, color: col.warn, lineHeight: 1.5 }}>
          ⚠ Set a Display Name above — the new entity needs a name.
        </div>
      )}

      {/* Admin (gated) */}
      <CheckboxRow label="Admin" color={col.warn} checked={isAdmin} onChange={(v) => { setIsAdmin(v); if (!v) setAdminConfirm(""); }}
        desc="Full team control — see + edit every creator, setter, and user." />

      {needsAdminConfirm && (
        <div style={{ marginLeft: 26, marginTop: 6, marginBottom: 6 }}>
          <div style={{ background: `${col.danger}1a`, border: `1px solid ${col.danger}66`, padding: "12px 14px", borderRadius: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: col.danger, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>⚠</span> Granting admin = full access
            </div>
            <div style={{ fontSize: 12, color: col.text, lineHeight: 1.5 }}>
              Admins can view & edit ALL data — every creator's videos, every setter's leads + EODs, the full pipeline. They can also assign/remove other admins (including yourself). Only do this for people you fully trust to operate the team.
            </div>
          </div>
          <label style={{ ...S.label, color: col.danger }}>Type <strong>admin</strong> to confirm</label>
          <input style={{
            ...S.input,
            borderColor: adminConfirmed ? col.success : col.danger,
            background: col.surf,
          }} placeholder='Type "admin"' value={adminConfirm} onChange={e => setAdminConfirm(e.target.value)} autoComplete="off" />
          {adminConfirmed && <div style={{ fontSize: 11, color: col.success, marginTop: 6, fontWeight: 700 }}>✓ Confirmation accepted</div>}
        </div>
      )}

      {value.isAdmin && !isAdmin && (
        <div style={{ marginLeft: 26, marginTop: 6, fontSize: 12, color: col.warn, lineHeight: 1.5 }}>
          ⚠ This will revoke admin access on save.
        </div>
      )}
    </div>
  );
}

function CheckboxRow({ label, color, checked, onChange, desc }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "10px 0" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, marginTop: 2, cursor: "pointer", accentColor: color }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: checked ? color : col.text }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: col.muted, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
    </label>
  );
}

function UserRow({ profile, creators, setters, onAddCreator, onAddSetter, editing, onEdit, onCancel, onSaved, rolesOf }) {
  const [name, setName] = useState(profile.name || "");
  const [assigner, setAssigner] = useState({ resolve: null, valid: true, anySelected: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { if (editing) { setName(profile.name || ""); setErr(null); } }, [editing, profile]);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const resolved = await assigner.resolve();
      const updates = { name: name.trim() || null, ...resolved };
      await dataLayer.updateProfile(profile.id, updates);
      onSaved();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div style={{ ...S.card, padding: "22px 24px", background: col.surf2, border: `1px solid ${col.warn}66` }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: col.warn, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>Edit User</div>
        <div style={{ marginBottom: 16, padding: "10px 12px", background: col.surf, borderRadius: 6, border: `1px solid ${col.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{profile.email}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: col.muted }}>{profile.id}</div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={S.label}>Display Name <span style={{ color: col.muted, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· override Google's name if needed</span></label>
          <input style={S.input} placeholder="Their display name" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <RoleAssignmentFields
          onAddCreator={onAddCreator} onAddSetter={onAddSetter}
          value={{ isAdmin: profile.isAdmin, creatorId: profile.creatorId, setterId: profile.setterId }}
          onChange={setAssigner}
          displayName={name.trim() || profile.email?.split("@")[0] || ""} />

        {err && <div style={{ background: `${col.danger}1a`, border: `1px solid ${col.danger}55`, color: col.danger, padding: "10px 12px", borderRadius: 6, fontSize: 13, marginTop: 14 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button style={btnA} onClick={save} disabled={busy || !assigner.valid}>{busy ? "Saving…" : "Save"}</button>
          <button style={btnG} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  const displayName = profile.name || profile.email.split("@")[0];
  const roles = rolesOf(profile);

  return (
    <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer" }} className="clickable-card" onClick={onEdit}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: roles[0]?.color || col.muted, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
        <div style={{ fontSize: 11, color: col.muted, fontFamily: mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email}</div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {roles.length === 0
          ? <span style={{ padding: "4px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: col.muted + "22", color: col.muted, border: `1px solid ${col.muted}44` }}>Unassigned</span>
          : roles.map(r => (
            <span key={r.key} style={{
              padding: "4px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.05em", textTransform: "uppercase",
              background: r.color + "22", color: r.color, border: `1px solid ${r.color}44`,
            }}>{r.label}{r.entityName ? ` · ${r.entityName}` : ""}</span>
          ))}
      </div>
      <div style={{ fontSize: 11, color: col.muted, opacity: 0.5 }}>edit →</div>
    </div>
  );
}

// ─── ADMIN CREATORS VIEW ─────────────────────────────────────────────────────
function AdminCreatorsView({ creators, videosMap, onAdd, onRemove, onSelect }) {
  const cutoff = daysAgo(30);

  const stats = useMemo(() => creators.map(c => {
    const vids = videosMap[c.id] || [];
    const last30 = vids.filter(v => v.postedDate >= cutoff);
    return {
      ...c, totalVids: vids.length, vids30: last30.length,
      views30: last30.reduce((s, v) => s + (parseInt(v.views) || 0), 0),
      daily: dailyBucket(vids, v => v.postedDate, v => parseInt(v.views) || 0, 30),
    };
  }).sort((a, b) => b.views30 - a.views30), [creators, videosMap, cutoff]);

  const totalViews30 = stats.reduce((s, c) => s + c.views30, 0);
  const totalVids30 = stats.reduce((s, c) => s + c.vids30, 0);

  const teamDaily = useMemo(() => {
    const out = {};
    for (let i = 29; i >= 0; i--) out[daysAgo(i)] = 0;
    Object.values(videosMap).forEach(vids => {
      vids.forEach(v => { if (v.postedDate in out) out[v.postedDate] += parseInt(v.views) || 0; });
    });
    return Object.entries(out).map(([date, value]) => ({ date, value }));
  }, [videosMap]);

  const platStats = CREATOR_PLATFORMS.map(p => {
    let views = 0, count = 0;
    Object.values(videosMap).forEach(vids => {
      vids.filter(v => v.platform === p && v.postedDate >= cutoff).forEach(v => {
        views += parseInt(v.views) || 0; count++;
      });
    });
    return { platform: p, views, count };
  });
  const maxPlat = Math.max(...platStats.map(p => p.views), 1);

  return (
    <div>
      <div style={S.sectionLabel}>Last 30 Days · All Creators</div>
      <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Total Views", value: fmtViews(totalViews30) },
          { label: "Total Videos", value: totalVids30 },
          { label: "Active", value: `${stats.filter(s => s.vids30 > 0).length}/${creators.length}` },
        ].map(s => (
          <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 100, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "16px 18px" }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color: col.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={S.sectionLabel}>Team Daily Views Trend (30d)</div>
      <div style={{ ...S.card, padding: "22px 24px", marginBottom: 24 }}>
        <TrendLine data={teamDaily} color={col.accent} height={170} format={fmtViews} label="Team total views" />
      </div>

      <div style={S.sectionLabel}>Views by Platform (30d)</div>
      <div style={{ ...S.card, padding: "20px 22px", marginBottom: 24 }}>
        {platStats.every(p => p.views === 0)
          ? <div style={{ color: col.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>No data yet.</div>
          : platStats.map(p => (
            <div key={p.platform} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: PLATFORM_COLORS[p.platform] }}>{p.platform}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: col.muted2 }}>{fmtViews(p.views)} · {p.count} vids</span>
              </div>
              <div style={{ height: 6, background: col.surf2, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(p.views / maxPlat) * 100}%`, background: PLATFORM_COLORS[p.platform], borderRadius: 3 }} />
              </div>
            </div>
          ))}
      </div>

      {stats.filter(s => s.views30 > 0).length > 0 && (
        <Podium
          items={stats.filter(s => s.views30 > 0).map(s => ({ id: s.id, name: s.name, value: s.views30, sub: `${s.vids30} videos` }))}
          color={col.accent}
          valueFmt={fmtViews}
          onClick={onSelect}
        />
      )}

      <div style={{ ...S.sectionLabel, marginBottom: 12 }}>Creator Leaderboard</div>

      {stats.length === 0
        ? <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 40 }}>No creators yet.</div>
        : stats.map((c, i) => (
          <div key={c.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
            onClick={() => onSelect(c.id)}
            className="clickable-card"
          >
            <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: i < 3 ? col.accent : col.muted, minWidth: 28 }}>#{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: col.muted }}>{c.vids30} videos · 30d · {c.totalVids} total</div>
            </div>
            <div style={{ flexShrink: 0, opacity: c.views30 > 0 ? 1 : 0.3 }}>
              <Sparkline data={c.daily} color={col.accent} height={32} width={100} />
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, minWidth: 90 }}>
              <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: col.accent }}>{fmtViews(c.views30)}</div>
              <div style={{ fontSize: 11, color: col.muted }}>30d views</div>
            </div>
            <div style={{ fontSize: 11, color: col.muted, opacity: 0.5 }}>→</div>
            <button style={btnDel} onClick={e => { e.stopPropagation(); if (window.confirm(`Remove ${c.name}?`)) onRemove(c.id); }}>✕</button>
          </div>
        ))}
    </div>
  );
}

// ─── ADMIN SETTERS VIEW ──────────────────────────────────────────────────────
function AdminSettersView({ setters, eodMap, onAdd, onRemove, onSelect }) {
  const cutoff = daysAgo(30);
  const today = todayStr();

  const stats = useMemo(() => setters.map(s => {
    const eods = eodMap[s.id] || [];
    const last30 = eods.filter(e => e.date >= cutoff);
    const t = { newMessages: 0, followUps: 0, positiveReplies: 0, callsBooked: 0, freeTrials: 0 };
    last30.forEach(eod => {
      Object.values(eod.platforms || {}).forEach(p => {
        Object.keys(t).forEach(k => { t[k] += parseInt(p[k]) || 0; });
      });
    });
    const latest = [...eods].sort((a, b) => b.date.localeCompare(a.date))[0];
    const latestConvos = latest ? Object.values(latest.platforms || {}).reduce((sum, p) => sum + (parseInt(p.conversationsInProgress) || 0), 0) : 0;
    return {
      ...s, ...t, latestConvos,
      reportToday: !!eods.find(e => e.date === today),
      replyRate: pct(t.positiveReplies, t.newMessages),
      callRate: pct(t.callsBooked, t.positiveReplies),
      daysReported: last30.length,
      daily: dailyBucket(eods, e => e.date, e => eodTotal(e, "callsBooked"), 30),
    };
  }).sort((a, b) => b.callsBooked - a.callsBooked), [setters, eodMap, cutoff, today]);

  const teamDailyMsgs = useMemo(() => {
    const out = {};
    for (let i = 29; i >= 0; i--) out[daysAgo(i)] = 0;
    Object.values(eodMap).forEach(eods => {
      eods.forEach(e => { if (e.date in out) out[e.date] += eodTotal(e, "newMessages"); });
    });
    return Object.entries(out).map(([date, value]) => ({ date, value }));
  }, [eodMap]);

  const teamDailyCalls = useMemo(() => {
    const out = {};
    for (let i = 29; i >= 0; i--) out[daysAgo(i)] = 0;
    Object.values(eodMap).forEach(eods => {
      eods.forEach(e => { if (e.date in out) out[e.date] += eodTotal(e, "callsBooked"); });
    });
    return Object.entries(out).map(([date, value]) => ({ date, value }));
  }, [eodMap]);

  const teamTotal = stats.reduce((acc, s) => ({
    newMessages: acc.newMessages + s.newMessages,
    positiveReplies: acc.positiveReplies + s.positiveReplies,
    callsBooked: acc.callsBooked + s.callsBooked,
    freeTrials: acc.freeTrials + s.freeTrials,
    convos: acc.convos + s.latestConvos,
  }), { newMessages: 0, positiveReplies: 0, callsBooked: 0, freeTrials: 0, convos: 0 });

  const teamReplyRate = pct(teamTotal.positiveReplies, teamTotal.newMessages);
  const teamCallRate = pct(teamTotal.callsBooked, teamTotal.positiveReplies);

  return (
    <div>
      <div style={S.sectionLabel}>Last 30 Days · Team Totals</div>
      <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Messages", value: fmtNum(teamTotal.newMessages) },
          { label: "Positive Replies", value: fmtNum(teamTotal.positiveReplies) },
          { label: "Calls Booked", value: fmtNum(teamTotal.callsBooked) },
          { label: "Free Trials", value: fmtNum(teamTotal.freeTrials) },
        ].map(s => (
          <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 100, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "16px 18px" }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color: col.blue }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Reply Rate", value: teamReplyRate + "%", color: col.accent },
          { label: "Reply→Call", value: teamCallRate + "%", color: teamCallRate >= 20 ? col.success : teamCallRate >= 10 ? col.warn : col.danger },
          { label: "Open Convos", value: fmtNum(teamTotal.convos), color: col.accent },
        ].map(s => (
          <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 100, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "16px 18px" }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={S.sectionLabel}>Team Daily Activity (30d)</div>
      <div style={{ ...S.card, padding: "22px 24px", marginBottom: 24 }}>
        <TrendBars data={teamDailyMsgs} color={col.blue} height={120} format={fmtNum} label="Messages sent" />
        <div style={{ height: 1, background: col.border, margin: "20px 0" }} />
        <TrendBars data={teamDailyCalls} color={col.accent} height={70} format={fmtNum} label="Calls booked" />
      </div>

      <div style={S.sectionLabel}>Team Conversion Funnel (30d)</div>
      <div style={{ ...S.card, padding: "22px 24px", marginBottom: 24 }}>
        <Funnel steps={[
          { label: "Messages sent", value: teamTotal.newMessages },
          { label: "Positive replies", value: teamTotal.positiveReplies },
          { label: "Calls booked", value: teamTotal.callsBooked },
          { label: "Free trials", value: teamTotal.freeTrials },
        ]} color={col.blue} />
      </div>

      {stats.filter(s => s.callsBooked > 0).length > 0 && (
        <Podium
          items={stats.filter(s => s.callsBooked > 0).map(s => ({ id: s.id, name: s.name, value: s.callsBooked, sub: `${s.callRate}% call rate` }))}
          color={col.blue}
          valueFmt={(v) => `${v} calls`}
          onClick={onSelect}
        />
      )}

      <div style={{ ...S.sectionLabel, marginBottom: 12 }}>Setter Leaderboard</div>

      {stats.length === 0
        ? <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 40 }}>No setters yet.</div>
        : stats.map((s, i) => (
          <div key={s.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flexWrap: "wrap" }}
            onClick={() => onSelect(s.id)}
            className="clickable-card"
          >
            <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: i < 3 ? col.blue : col.muted, minWidth: 28 }}>#{i + 1}</div>
            <div className={s.reportToday ? "pulse" : ""} style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: s.reportToday ? col.success : col.muted }} title={s.reportToday ? "Reported today" : "No report today"} />
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: col.muted }}>
                {s.newMessages} msgs · {s.daysReported}d reports
              </div>
            </div>
            <div style={{ flexShrink: 0, opacity: s.callsBooked > 0 ? 1 : 0.3 }}>
              <Sparkline data={s.daily} color={col.blue} height={32} width={100} />
            </div>
            <div style={{ display: "flex", gap: 14, fontFamily: mono, fontSize: 13, alignItems: "center" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: col.blue, fontSize: 16 }}>{s.callsBooked}</div>
                <div style={{ fontSize: 10, color: col.muted }}>calls</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: s.callRate >= 20 ? col.success : s.callRate >= 10 ? col.warn : col.danger, fontSize: 16 }}>{s.callRate}%</div>
                <div style={{ fontSize: 10, color: col.muted }}>call rate</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: col.muted, opacity: 0.5 }}>→</div>
            <button style={btnDel} onClick={e => { e.stopPropagation(); if (window.confirm(`Remove ${s.name}?`)) onRemove(s.id); }}>✕</button>
          </div>
        ))}
    </div>
  );
}

// ─── ADMIN CREATOR DETAIL ────────────────────────────────────────────────────
function AdminCreatorDetail({ creator, videos, onBack }) {
  const cutoff = daysAgo(30);
  const last30 = videos.filter(v => v.postedDate >= cutoff);
  const totalViews = last30.reduce((s, v) => s + (parseInt(v.views) || 0), 0);
  const allViews = videos.reduce((s, v) => s + (parseInt(v.views) || 0), 0);
  const topVideos = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  const byPlatform = CREATOR_PLATFORMS.map(p => {
    const vids = last30.filter(v => v.platform === p);
    return { platform: p, videos: vids.length, views: vids.reduce((s, v) => s + (parseInt(v.views) || 0), 0) };
  });
  const maxPlat = Math.max(...byPlatform.map(p => p.views), 1);

  const dailyViews = useMemo(() => dailyBucket(videos, v => v.postedDate, v => parseInt(v.views) || 0, 30), [videos]);
  const dailyVids = useMemo(() => dailyBucket(videos, v => v.postedDate, () => 1, 30), [videos]);

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <button style={{ ...btnG, padding: "8px 16px", fontSize: 12, marginBottom: 28 }} onClick={onBack}>← Dashboard</button>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", color: col.muted, textTransform: "uppercase", marginBottom: 8 }}>Creator Profile</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{creator.name}</h1>
        </div>

        <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          {[
            { label: "Views 30d", value: fmtViews(totalViews) },
            { label: "Videos 30d", value: last30.length },
            { label: "All-Time Views", value: fmtViews(allViews) },
          ].map(s => (
            <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 100, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "16px 18px" }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color: col.accent }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={S.sectionLabel}>Daily Output (30d)</div>
        <div style={{ ...S.card, padding: "22px 24px", marginBottom: 28 }}>
          <TrendBars data={dailyViews} color={col.accent} height={150} format={fmtViews} label="Views from videos posted" />
          <div style={{ height: 1, background: col.border, margin: "20px 0" }} />
          <TrendBars data={dailyVids} color={col.blue} height={70} format={(v) => v} label="Videos posted per day" />
        </div>

        <div style={S.sectionLabel}>Platform Breakdown (30d)</div>
        <div style={{ ...S.card, padding: "20px 22px", marginBottom: 28 }}>
          {byPlatform.every(p => p.views === 0)
            ? <div style={{ color: col.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>No videos in last 30 days.</div>
            : byPlatform.map(p => (
              <div key={p.platform} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: PLATFORM_COLORS[p.platform] }}>{p.platform}</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: col.muted2 }}>{fmtViews(p.views)} · {p.videos} vids</span>
                </div>
                <div style={{ height: 6, background: col.surf2, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(p.views / maxPlat) * 100}%`, background: PLATFORM_COLORS[p.platform], borderRadius: 3 }} />
                </div>
              </div>
            ))}
        </div>

        {topVideos.length > 0 && (
          <>
            <div style={S.sectionLabel}>Top Performers</div>
            {topVideos.map((v, i) => (
              <div key={v.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, padding: "13px 18px" }}>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 800, color: col.border, minWidth: 28 }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={platBadge(v.platform)}>{v.platform}</span>
                    <span style={{ fontSize: 11, color: col.muted }}>{fmtDate(v.postedDate)}</span>
                  </div>
                  <a href={v.url} target="_blank" rel="noreferrer" style={{ color: col.text, textDecoration: "none", fontSize: 11, fontFamily: mono, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.url}</a>
                </div>
                <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: col.accent, flexShrink: 0 }}>{fmtViews(v.views)}</div>
              </div>
            ))}
          </>
        )}

        <div style={{ ...S.sectionLabel, marginTop: 28 }}>All Videos ({videos.length})</div>
        {videos.length === 0
          ? <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 36 }}>No videos posted yet.</div>
          : [...videos].sort((a, b) => b.postedDate.localeCompare(a.postedDate)).map(v => (
            <div key={v.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={platBadge(v.platform)}>{v.platform}</span>
                  <span style={{ fontSize: 11, color: col.muted }}>{fmtDate(v.postedDate)}</span>
                </div>
                <a href={v.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontFamily: mono, color: col.muted2, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.url}</a>
              </div>
              <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: col.accent, flexShrink: 0 }}>{fmtViews(v.views)}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── ADMIN LEAD TABLE ────────────────────────────────────────────────────────
function AdminLeadTable({ leads }) {
  const [filter, setFilter] = useState("interested_hot");

  const counts = useMemo(() => {
    const c = { all: leads.length };
    LEAD_STATUSES.forEach(s => { c[s.key] = leads.filter(l => l.status === s.key).length; });
    // "hot" = interested, call_booked, trial
    c.interested_hot = leads.filter(l => ["interested", "call_booked", "trial"].includes(l.status)).length;
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    let f;
    if (filter === "all") f = leads;
    else if (filter === "interested_hot") f = leads.filter(l => ["interested", "call_booked", "trial"].includes(l.status));
    else f = leads.filter(l => l.status === filter);
    return [...f].sort((a, b) => (b.lastTouch || "").localeCompare(a.lastTouch || ""));
  }, [leads, filter]);

  if (leads.length === 0) {
    return <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 36, marginBottom: 28 }}>No leads logged yet.</div>;
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <FilterChip active={filter === "interested_hot"} onClick={() => setFilter("interested_hot")} label="🔥 Interested" count={counts.interested_hot} color={col.accent} />
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} color={col.text} />
        {LEAD_STATUSES.map(s => counts[s.key] > 0 && (
          <FilterChip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)} label={s.label} count={counts[s.key]} color={s.color} />
        ))}
      </div>

      {filtered.length === 0
        ? <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 28 }}>No leads in this view.</div>
        : filtered.map(l => {
          const sm = statusMeta(l.status);
          return (
            <div key={l.id} style={{ ...S.card, padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: (l.email || l.phone || l.notes) ? 8 : 0, flexWrap: "wrap" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sm.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{l.name || "Unnamed"}</span>
                {l.platform && <span style={platBadge(l.platform)}>{l.platform}</span>}
                <span style={{
                  padding: "3px 9px", borderRadius: 3, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  background: sm.color + "22", color: sm.color, border: `1px solid ${sm.color}44`,
                }}>{sm.label}</span>
                {l.profileUrl && (
                  <a href={l.profileUrl} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: col.blue, textDecoration: "none", fontWeight: 700 }}>
                    View Profile ↗
                  </a>
                )}
              </div>
              {(l.email || l.phone) && (
                <div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: mono, color: col.muted2, marginBottom: l.notes ? 8 : 0, paddingLeft: 18 }}>
                  {l.email && <span>✉ {l.email}</span>}
                  {l.phone && <span>☎ {l.phone}</span>}
                </div>
              )}
              {l.notes && (
                <div style={{ fontSize: 12, color: col.muted2, lineHeight: 1.5, whiteSpace: "pre-wrap", paddingLeft: 18 }}>{l.notes}</div>
              )}
            </div>
          );
        })}
    </div>
  );
}

// ─── ADMIN SETTER DETAIL ─────────────────────────────────────────────────────
function AdminSetterDetail({ setter, eods, leads, onBack }) {
  const cutoff = daysAgo(30);
  const last30 = eods.filter(e => e.date >= cutoff);

  const t = { newMessages: 0, followUps: 0, positiveReplies: 0, callsBooked: 0, freeTrials: 0 };
  last30.forEach(eod => {
    Object.values(eod.platforms || {}).forEach(p => {
      Object.keys(t).forEach(k => { t[k] += parseInt(p[k]) || 0; });
    });
  });
  const replyRate = pct(t.positiveReplies, t.newMessages);
  const callRate = pct(t.callsBooked, t.positiveReplies);

  const latest = [...eods].sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestConvos = latest ? Object.values(latest.platforms || {}).reduce((s, p) => s + (parseInt(p.conversationsInProgress) || 0), 0) : 0;

  // Per platform breakdown (30d)
  const byPlatform = SETTER_PLATFORMS.map(p => {
    const platTotals = { newMessages: 0, positiveReplies: 0, callsBooked: 0, freeTrials: 0 };
    last30.forEach(eod => {
      if (eod.platforms?.[p]) {
        Object.keys(platTotals).forEach(k => { platTotals[k] += parseInt(eod.platforms[p][k]) || 0; });
      }
    });
    return { platform: p, ...platTotals };
  });

  const allNotes = [...eods].filter(e => e.notes?.trim()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  const dailyMsgs = useMemo(() => dailyBucket(eods, e => e.date, e => eodTotal(e, "newMessages"), 30), [eods]);
  const dailyCalls = useMemo(() => dailyBucket(eods, e => e.date, e => eodTotal(e, "callsBooked"), 30), [eods]);
  const dailyReplies = useMemo(() => dailyBucket(eods, e => e.date, e => eodTotal(e, "positiveReplies"), 30), [eods]);

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <button style={{ ...btnG, padding: "8px 16px", fontSize: 12, marginBottom: 28 }} onClick={onBack}>← Dashboard</button>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", color: col.blue, textTransform: "uppercase", marginBottom: 8 }}>Setter Profile</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{setter.name}</h1>
        </div>

        <div style={S.sectionLabel}>Last 30 Days</div>
        <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { label: "Messages", value: fmtNum(t.newMessages) },
            { label: "Follow-Ups", value: fmtNum(t.followUps) },
            { label: "Pos Replies", value: fmtNum(t.positiveReplies) },
            { label: "Calls Booked", value: fmtNum(t.callsBooked) },
            { label: "Free Trials", value: fmtNum(t.freeTrials) },
          ].map(s => (
            <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 90, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "14px 16px" }}>
              <div style={{ fontFamily: mono, fontSize: 9, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: mono, color: col.blue }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="stat-row" style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          {[
            { label: "Reply Rate", value: replyRate + "%", hint: "of msgs", color: col.accent },
            { label: "Reply→Call", value: callRate + "%", hint: "20%+ benchmark", color: callRate >= 20 ? col.success : callRate >= 10 ? col.warn : col.danger },
            { label: "Open Convos", value: fmtNum(latestConvos), hint: "latest EOD", color: col.accent },
          ].map(s => (
            <div key={s.label} className="stat-box" style={{ flex: 1, minWidth: 100, background: col.surf, border: `1px solid ${col.border}`, borderRadius: 6, padding: "16px 18px" }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: col.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: mono, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: col.muted, marginTop: 4 }}>{s.hint}</div>
            </div>
          ))}
        </div>

        <div style={S.sectionLabel}>Daily Activity (30d)</div>
        <div style={{ ...S.card, padding: "22px 24px", marginBottom: 24 }}>
          <TrendBars data={dailyMsgs} color={col.blue} height={120} format={fmtNum} label="Messages sent" />
          <div style={{ height: 1, background: col.border, margin: "20px 0" }} />
          <TrendBars data={dailyReplies} color={col.warn} height={70} format={fmtNum} label="Positive replies" />
          <div style={{ height: 1, background: col.border, margin: "20px 0" }} />
          <TrendBars data={dailyCalls} color={col.accent} height={70} format={fmtNum} label="Calls booked" />
        </div>

        <div style={S.sectionLabel}>Conversion Funnel (30d)</div>
        <div style={{ ...S.card, padding: "22px 24px", marginBottom: 28 }}>
          <Funnel steps={[
            { label: "Messages sent", value: t.newMessages },
            { label: "Positive replies", value: t.positiveReplies },
            { label: "Calls booked", value: t.callsBooked },
            { label: "Free trials", value: t.freeTrials },
          ]} color={col.blue} />
        </div>

        <div style={S.sectionLabel}>Platform Breakdown (30d)</div>
        <div style={{ marginBottom: 28 }}>
          {byPlatform.filter(p => p.newMessages > 0).length === 0
            ? <div style={{ ...S.card, color: col.muted, fontSize: 13, textAlign: "center", padding: 24 }}>No activity in last 30 days.</div>
            : byPlatform.filter(p => p.newMessages > 0).map(p => (
              <div key={p.platform} style={{ ...S.card, padding: "16px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: PLATFORM_COLORS[p.platform], marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: PLATFORM_COLORS[p.platform] }} />
                  {p.platform}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontSize: 12 }}>
                  <div><div style={{ color: col.muted, fontSize: 10, marginBottom: 2 }}>MSGS</div><div style={{ fontFamily: mono, fontWeight: 700, fontSize: 16 }}>{p.newMessages}</div></div>
                  <div><div style={{ color: col.muted, fontSize: 10, marginBottom: 2 }}>REPLIES</div><div style={{ fontFamily: mono, fontWeight: 700, fontSize: 16 }}>{p.positiveReplies}</div></div>
                  <div><div style={{ color: col.muted, fontSize: 10, marginBottom: 2 }}>CALLS</div><div style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, color: col.blue }}>{p.callsBooked}</div></div>
                  <div><div style={{ color: col.muted, fontSize: 10, marginBottom: 2 }}>TRIALS</div><div style={{ fontFamily: mono, fontWeight: 700, fontSize: 16 }}>{p.freeTrials}</div></div>
                </div>
              </div>
            ))}
        </div>

        {/* LEAD PIPELINE */}
        <div style={S.sectionLabel}>Lead Pipeline ({leads.length})</div>
        <AdminLeadTable leads={leads} />

        {allNotes.length > 0 && (
          <>
            <div style={S.sectionLabel}>Recent Notes & Observations</div>
            {allNotes.map(e => (
              <div key={e.date} style={{ ...S.card, padding: "14px 18px" }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: col.muted, marginBottom: 6 }}>{fmtDate(e.date)}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.notes}</div>
              </div>
            ))}
          </>
        )}

        <div style={{ ...S.sectionLabel, marginTop: 28 }}>All EOD Reports ({eods.length})</div>
        {eods.length === 0
          ? <div style={{ ...S.card, textAlign: "center", color: col.muted, padding: 36 }}>No EOD reports yet.</div>
          : [...eods].sort((a, b) => b.date.localeCompare(a.date)).map(e => <SetterEODCard key={e.date} eod={e} />)
        }
      </div>
    </div>
  );
}
