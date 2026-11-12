import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { YEARS, VOICES, TYPES, CATEGORIES } from "./data.js";
import * as api from "./api.js";
import Earth from "./Earth3D.jsx";

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
function countdown(date) {
  const ms = new Date(date) - Date.now();
  if (ms <= 0) return "Ready to open";
  const days = Math.floor(ms / 864e5);
  return days >= 365 ? `Opens in ${(days / 365).toFixed(1)} years` : `Opens in ${days} days`;
}
const yearsFromNow = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toISOString(); };

function useClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return t;
}

/* ---------- Scene 1: the present ---------- */
function Hero() {
  const ref = useRef(null);
  const now = useClock();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const earthOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const earthScale = useTransform(scrollYProgress, [0, 1], [1, 0.6]);
  return (
    <section ref={ref} className="hero" id="top">
      <div className="stars" />
      <div className="earth-wrap"><motion.div className="earth" style={{ opacity: earthOpacity, scale: earthScale }}><Earth /></motion.div></div>
      <div className="hero-inner">
        <p className="clock">{now.toLocaleDateString(undefined, { dateStyle: "full" })} · {now.toLocaleTimeString()}</p>
        <h1>You are living in a moment someone will wish they could revisit.</h1>
        <a className="btn" href="#timeline">Enter the vault</a>
      </div>
    </section>
  );
}

/* ---------- Scene 2: timeline ---------- */
function Timeline() {
  const [i, setI] = useState(4);
  const cur = YEARS[i];
  return (
    <section className="scene" id="timeline">
      <h2>The timeline of humanity</h2>
      <p className="lede">Drag through time. Some memories come from visitors, others are curated entries.</p>
      <input className="slider" type="range" min="0" max={YEARS.length - 1} value={i} onChange={(e) => setI(+e.target.value)} aria-label="Time travel slider" />
      <div className="ticks">{YEARS.map((y, k) => <button key={y.y} className={k === i ? "on" : ""} onClick={() => setI(k)}>{y.y}</button>)}</div>
      <AnimatePresence mode="wait">
        <motion.div key={cur.y} className="year" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className="bigyear">{cur.y}</div>
          <div><h3>{cur.t}</h3><ul>{cur.items.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/* ---------- Scene 3: voices ---------- */
function Voices({ capsules }) {
  const opened = capsules.filter((c) => c.unlocked && c.isPublic && c.message).map((c) => ({ year: new Date(c.createdAt).getFullYear(), text: c.message }));
  const all = [...opened, ...VOICES];
  const [k, setK] = useState(0);
  const v = all[k % all.length];
  return (
    <section className="scene" id="voices">
      <h2>Voices from another time</h2>
      <p className="lede">Anonymous messages from people who lived in earlier years.</p>
      <AnimatePresence mode="wait">
        <motion.blockquote key={k} className="voice" initial={{ opacity: 0, filter: "blur(8px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          “{v.text}”<cite>Written in {v.year}</cite>
        </motion.blockquote>
      </AnimatePresence>
      <button className="btn ghost" onClick={() => setK(Math.floor(Math.random() * 1000))}>Open a random memory</button>
    </section>
  );
}

/* ---------- Scene 4: predictions ---------- */
function Predictions() {
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [msg, setMsg] = useState("");
  const load = () => api.getPredictions().then(setList).catch(() => setMsg("Server not running. Start the API to save predictions."));
  useEffect(() => { load(); }, []);
  async function submit(e) {
    e.preventDefault();
    try { await api.addPrediction({ text, category: cat, opensAt: new Date("2040-01-01").toISOString() }); setText(""); setMsg("Sealed until 2040."); load(); }
    catch (err) { setMsg(err.message); }
  }
  return (
    <section className="scene" id="predictions">
      <h2>The future prediction wall</h2>
      <p className="lede">What do you think the world will look like in 2040?</p>
      <form onSubmit={submit} className="row">
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <input required maxLength={400} value={text} onChange={(e) => setText(e.target.value)} placeholder="By 2040, people will…" />
        <button className="btn">Seal prediction</button>
      </form>
      {msg && <p className="note">{msg}</p>}
      <div className="grid">
        <div className="card locked"><b>Prediction #2040</b><span className="tag">Locked</span><p>“By 2040, people will probably have AI assistants that know them better than their closest friends.”</p><small>Submitted November 2026 · Opens in 14 years</small></div>
        {list.map((p) => (
          <div className={"card" + (p.locked ? " locked" : "")} key={p.id}>
            <b>{p.category}</b><span className="tag">{p.locked ? "Locked" : "Open"}</span>
            <p>{p.locked ? "Sealed until its opening date." : `“${p.text}”`}</p><small>Opens {fmt(p.opensAt)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Scene 5: create capsule ---------- */
function Create({ onCreated }) {
  const [type, setType] = useState(null);
  const [f, setF] = useState({ title: "", message: "", unlockDate: "", isPublic: false, consent: false });
  const [stage, setStage] = useState("form");
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const min = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  async function seal(e) {
    e.preventDefault(); setErr("");
    try {
      await api.addCapsule({ ...f, type: type.name, unlockDate: new Date(f.unlockDate).toISOString() });
      setStage("sealing");
      setTimeout(() => { setStage("done"); onCreated(); }, 2200);
    } catch (e2) { setErr(e2.message); }
  }
  return (
    <section className="scene" id="create">
      <h2>Create your time capsule</h2>
      {stage === "form" && !type && (<>
        <p className="lede">Choose a capsule type.</p>
        <div className="grid four">{TYPES.map((t) => <button key={t.id} className="card type" onClick={() => setType(t)}><b>{t.name}</b><span>{t.desc}</span></button>)}</div>
      </>)}
      {stage === "form" && type && (
        <form className="form" onSubmit={seal}>
          <p className="lede">{type.name}. <button type="button" className="link" onClick={() => setType(null)}>Change type</button></p>
          <input required maxLength={80} placeholder="Give it a title" value={f.title} onChange={(e) => set("title", e.target.value)} />
          <textarea required rows={6} maxLength={5000} placeholder="Write your message to the future…" value={f.message} onChange={(e) => set("message", e.target.value)} />
          <label>Opening date<input required type="date" min={min} value={f.unlockDate} onChange={(e) => set("unlockDate", e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={f.isPublic} onChange={(e) => set("isPublic", e.target.checked)} /> Share this capsule publicly after it opens</label>
          {f.isPublic && <label className="check"><input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} /> I consent to my message being shown to strangers. It can’t contain private details about other people.</label>}
          {err && <p className="note">{err}</p>}
          <button className="btn" disabled={f.isPublic && !f.consent}>Seal capsule</button>
        </form>
      )}
      {stage === "sealing" && <div className="sealing"><div className="orb big" /><p>Sealing… travelling into the timeline…</p></div>}
      {stage === "done" && <div className="sealing"><div className="orb big done" /><p>Your capsule is in your vault.</p><a className="btn" href="#vault" onClick={() => { setStage("form"); setType(null); setF({ title: "", message: "", unlockDate: "", isPublic: false, consent: false }); }}>See it in the vault</a></div>}
    </section>
  );
}

/* ---------- Scene 6: vault ---------- */
function Vault({ capsules }) {
  const canvas = useRef(null);
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(null);
  const shown = capsules.filter((c) => (filter === "mine" ? c.mine : filter === "public" ? c.isPublic : true));
  const orbs = useRef([]);
  useEffect(() => {
    const cv = canvas.current, ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf;
    const resize = () => { cv.width = cv.clientWidth * devicePixelRatio; cv.height = cv.clientHeight * devicePixelRatio; };
    resize(); addEventListener("resize", resize);
    const W = () => cv.width, H = () => cv.height;
    // decorative ambient orbs + real capsules
    const ambient = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), r: 4 + Math.random() * 10, vx: (Math.random() - 0.5) * 0.0004, vy: (Math.random() - 0.5) * 0.0004, a: 0.15 }));
    orbs.current = shown.map((c, i) => ({ c, x: 0.1 + ((i * 0.37) % 0.8), y: 0.15 + ((i * 0.23) % 0.7), r: 18, vx: 0.0003 * (i % 2 ? 1 : -1), vy: 0.0002, a: 1 }));
    const draw = () => {
      ctx.clearRect(0, 0, W(), H());
      [...ambient, ...orbs.current].forEach((o) => {
        if (!reduce) { o.x += o.vx; o.y += o.vy; if (o.x < 0 || o.x > 1) o.vx *= -1; if (o.y < 0 || o.y > 1) o.vy *= -1; }
        const px = o.x * W(), py = o.y * H(), r = o.r * devicePixelRatio;
        const soon = o.c && !o.c.unlocked && (new Date(o.c.unlockDate) - Date.now()) / 864e5 < 30;
        const hue = o.c ? (o.c.unlocked ? "184,165,255" : soon ? "255,190,120" : "118,98,199") : "118,98,199";
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.4);
        g.addColorStop(0, `rgba(${hue},${o.a})`); g.addColorStop(0.4, `rgba(${hue},${o.a * 0.35})`); g.addColorStop(1, `rgba(${hue},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 2.4, 0, 7); ctx.fill();
        o.px = px; o.py = py; o.pr = r;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const click = (e) => {
      const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) * devicePixelRatio, y = (e.clientY - b.top) * devicePixelRatio;
      const hit = orbs.current.find((o) => Math.hypot(o.px - x, o.py - y) < o.pr * 1.6);
      setSel(hit ? hit.c : null);
    };
    cv.addEventListener("click", click);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); cv.removeEventListener("click", click); };
  }, [filter, capsules]);
  return (
    <section className="scene vault" id="vault">
      <h2>The vault of tomorrow</h2>
      <p className="lede">Each glowing capsule is a human memory. Violet is sealed, amber is close to opening, pale lilac is open.</p>
      <div className="ticks">{["all", "mine", "public"].map((k) => <button key={k} className={k === filter ? "on" : ""} onClick={() => setFilter(k)}>{k === "all" ? "All" : k === "mine" ? "My capsules" : "Public"}</button>)}</div>
      <canvas ref={canvas} aria-label="Floating capsules" />
      <div className="detail" aria-live="polite">
        {sel ? (<><b>{sel.title}</b> <span className="tag">{sel.type}</span><p>{sel.unlocked ? sel.message : countdown(sel.unlockDate)}</p><small>Sealed {fmt(sel.createdAt)} · opens {fmt(sel.unlockDate)}</small></>)
          : <p className="note">{shown.length ? "Select a capsule." : "No capsules yet. Create one above, or start the API if you haven’t."}</p>}
      </div>
    </section>
  );
}

/* ---------- 24-Hour Memory ---------- */
function DayMemory() {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ song: "", doing: "", worry: "", happy: "" });
  const [msg, setMsg] = useState("");
  const load = () => api.getMemories().then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  const today = new Date().toISOString().slice(0, 10);
  async function submit(e) {
    e.preventDefault();
    try { await api.addMemory({ ...f, day: today }); setF({ song: "", doing: "", worry: "", happy: "" }); setMsg("Added to today’s archive."); load(); } catch { setMsg("Server not running."); }
  }
  return (
    <section className="scene" id="today">
      <h2>The 24-hour memory</h2>
      <p className="lede">{fmt(today)}: what does an ordinary day in your life look like today?</p>
      <form className="form" onSubmit={submit}>
        <input placeholder="Your current favourite song" value={f.song} onChange={(e) => setF({ ...f, song: e.target.value })} />
        <input placeholder="What you’re studying or working on" value={f.doing} onChange={(e) => setF({ ...f, doing: e.target.value })} />
        <input placeholder="What you’re worried about" value={f.worry} onChange={(e) => setF({ ...f, worry: e.target.value })} />
        <input placeholder="What makes you happy" value={f.happy} onChange={(e) => setF({ ...f, happy: e.target.value })} />
        <button className="btn">Add my day</button>{msg && <p className="note">{msg}</p>}
      </form>
      <div className="grid">{list.slice(0, 6).map((m) => <div className="card" key={m.id}><small>{m.day}</small><p>♪ {m.song || "—"}</p><p>{m.doing}</p><p>Happy: {m.happy}</p></div>)}</div>
    </section>
  );
}

export default function App() {
  const [capsules, setCapsules] = useState([]);
  const refresh = () => api.getCapsules().then(setCapsules).catch(() => setCapsules([]));
  useEffect(() => { refresh(); }, []);
  return (
    <>
      <nav><a href="#top" className="logo">CHRONO</a><div><a href="#timeline">Timeline</a><a href="#voices">Voices</a><a href="#predictions">2040</a><a href="#create">Create</a><a href="#vault">Vault</a></div></nav>
      <main>
        <Hero /><Timeline /><Voices capsules={capsules} /><Predictions /><Create onCreated={refresh} /><Vault capsules={capsules} /><DayMemory />
      </main>
      <footer>Today is history. Leave something behind.</footer>
    </>
  );
}
