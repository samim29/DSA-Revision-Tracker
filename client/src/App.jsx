import { useEffect, useState } from "react";

/* ---------- constants and helpers ---------- */
const INTERVALS = [1, 3, 7, 21, 45, 90]; // keep in sync with server/index.js
const TOKEN = "revisit-token";
const pad = (n) => (n < 10 ? "0" : "") + n;
const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dstr(new Date());
const add = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return dstr(d); };
const diff = (a, b) => Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 864e5);
const fmt = (s) => new Date(s + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
const nextFor = (p, r) => {
  const stage = r === "Easy" ? Math.min(p.stage + 1, INTERVALS.length - 1) : r === "Hard" ? 0 : p.stage;
  return { stage, next: add(today(), INTERVALS[stage]) };
};

async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem(TOKEN);
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// Sample data shown to visitors who are not logged in (read only).
function demo() {
  const t = today();
  const base = { link: "", code: "", history: [] };
  return {
    patterns: ["Sliding Window", "Two Pointers"],
    log: [add(t, -1)],
    problems: [
      { ...base, _id: "d1", pattern: "Sliding Window", title: "Longest Substring Without Repeating Characters", difficulty: "Medium", approach: "Variable window with a set. Shrink from the left until there are no duplicates.", tc: "O(n)", sc: "O(k)", mistakes: "Forgot to remove s[left] from the set before moving left.", stage: 1, last: add(t, -3), next: t },
      { ...base, _id: "d2", pattern: "Sliding Window", title: "Maximum Sum Subarray of Size K", difficulty: "Easy", approach: "Fixed window. Add the new element, subtract the one leaving.", tc: "O(n)", sc: "O(1)", mistakes: "", stage: 3, last: add(t, -10), next: add(t, 11) },
      { ...base, _id: "d3", pattern: "Two Pointers", title: "3Sum", difficulty: "Medium", approach: "Sort, fix one number, then two pointers. Skip duplicates.", tc: "O(n²)", sc: "O(1)", mistakes: "Off-by-one on duplicate skipping.", stage: 0, last: add(t, -2), next: add(t, -1) },
    ],
  };
}

/* ---------- problem card ---------- */
function Card({ p, full, shown, onReveal, onRate, onEdit, onDelete }) {
  const late = diff(today(), p.next);
  const isDue = p.next <= today();
  return (
    <div className="panel">
      <div className="row">
        <h3>{p.title}</h3>
        <span className={"tag " + p.difficulty}>{p.difficulty}</span>
        <span className="tag">{p.pattern}</span>
        <span className="sp" />
        {isDue ? <span className="tag due">{late > 0 ? `${late}d overdue` : "due today"}</span> : <span className="tag ok">next {fmt(p.next)}</span>}
      </div>
      {p.link && <p style={{ margin: "6px 0" }}><a href={p.link} target="_blank" rel="noopener noreferrer">Open problem</a></p>}
      {full && !shown ? (
        <>
          <p className="mute">Try it first: name the pattern, write the code, state the complexity. Then reveal your notes.</p>
          <button className="btn p" onClick={onReveal}>Reveal my notes</button>
        </>
      ) : (
        <>
          {p.mistakes && <><b className="mute">My mistakes</b><div className="note">{p.mistakes}</div></>}
          {p.approach && <><b className="mute">Approach</b><p style={{ margin: "2px 0 8px" }}>{p.approach}</p></>}
          {p.code && <div className="code">{p.code}</div>}
          <p className="mute">Time {p.tc || "-"} · Space {p.sc || "-"} · Stage {p.stage + 1}/{INTERVALS.length}{p.last ? ` · Last revised ${fmt(p.last)}` : ""}</p>
          {full ? (
            <div className="rate">
              {["Easy", "Medium", "Hard"].map((r) => (
                <button key={r} className={r} onClick={() => onRate(r)}>{r}<small>again {fmt(nextFor(p, r).next)}</small></button>
              ))}
            </div>
          ) : (
            <div className="row">
              <button className="btn s" onClick={onEdit}>Edit</button>
              <button className="btn s r" onClick={onDelete}>Delete</button>
              <button className="btn s" onClick={onReveal}>Hide</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- modals ---------- */
function Modal({ children, onClose }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

function AuthModal({ reason, onClose, onDone }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const submit = async () => {
    try {
      const { token } = await api("/auth/" + mode, { method: "POST", body: f });
      localStorage.setItem(TOKEN, token);
      await onDone();
    } catch (e) { setErr(e.message); }
  };
  return (
    <Modal onClose={onClose}>
      <h2>{mode === "login" ? "Log in" : "Create your account"}</h2>
      <p className="mute">{reason}</p>
      <label htmlFor="em">Email</label>
      <input id="em" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label htmlFor="pw">Password</label>
      <input id="pw" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} />
      {err && <p className="err">{err}</p>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn s" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}>
          {mode === "login" ? "New here? Sign up" : "Have an account? Log in"}
        </button>
        <span className="sp" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn p" onClick={submit}>{mode === "login" ? "Log in" : "Sign up"}</button>
      </div>
    </Modal>
  );
}

function ProblemModal({ initial, patterns, onClose, onSave }) {
  const [f, setF] = useState({ title: "", pattern: patterns[0] || "", difficulty: "Medium", link: "", approach: "", code: "", tc: "", sc: "", mistakes: "", ...initial });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal onClose={onClose}>
      <h2>{initial?._id ? "Edit problem" : "Add problem"}</h2>
      <label htmlFor="f-t">Title</label><input id="f-t" value={f.title} onChange={set("title")} />
      <div className="two">
        <div><label htmlFor="f-p">Pattern</label>
          <select id="f-p" value={f.pattern} onChange={set("pattern")}>{patterns.map((n) => <option key={n}>{n}</option>)}</select></div>
        <div><label htmlFor="f-d">Difficulty</label>
          <select id="f-d" value={f.difficulty} onChange={set("difficulty")}><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
      </div>
      <label htmlFor="f-l">Problem link</label><input id="f-l" value={f.link} onChange={set("link")} />
      <label htmlFor="f-a">Approach</label><textarea id="f-a" value={f.approach} onChange={set("approach")} />
      <label htmlFor="f-c">Code (optional)</label><textarea id="f-c" value={f.code} onChange={set("code")} />
      <div className="two">
        <div><label htmlFor="f-tc">Time complexity</label><input id="f-tc" value={f.tc} onChange={set("tc")} /></div>
        <div><label htmlFor="f-sc">Space complexity</label><input id="f-sc" value={f.sc} onChange={set("sc")} /></div>
      </div>
      <label htmlFor="f-m">Mistakes I made</label><textarea id="f-m" value={f.mistakes} onChange={set("mistakes")} />
      <div className="row" style={{ marginTop: 14 }}>
        <span className="sp" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn p" disabled={!f.title.trim()} onClick={() => onSave(f)}>Save problem</button>
      </div>
    </Modal>
  );
}

function PatternModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  return (
    <Modal onClose={onClose}>
      <h2>New pattern</h2>
      <label htmlFor="pn">Pattern name</label>
      <input id="pn" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && onSave(name.trim())} />
      <div className="row" style={{ marginTop: 14 }}>
        <span className="sp" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn p" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Create pattern</button>
      </div>
    </Modal>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(demo);
  const [tab, setTab] = useState("dash");
  const [pat, setPat] = useState("All");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState({});
  const [modal, setModal] = useState(null);
  const [calOff, setCalOff] = useState(0);
  const [calSel, setCalSel] = useState(null);
  const { patterns, problems, log } = data;
  const t = today();

  const load = async () => {
    const [me, ps] = await Promise.all([api("/me"), api("/problems")]);
    setUser({ email: me.email });
    setData({ patterns: me.patterns, log: me.log, problems: ps });
    setModal(null);
  };
  useEffect(() => { if (localStorage.getItem(TOKEN)) load().catch(() => localStorage.removeItem(TOKEN)); }, []);

  // Visitors can browse, but any change needs an account.
  const guard = (reason) => { if (user) return true; setModal({ type: "auth", reason }); return false; };
  const run = async (fn) => { try { await fn(); await load(); } catch (e) { alert(e.message); } };
  const logout = () => { localStorage.removeItem(TOKEN); setUser(null); setData(demo()); setPat("All"); };

  const openAdd = () => {
    if (!guard("Log in or sign up to add your own problems. It takes 10 seconds.")) return;
    if (!patterns.length) return setModal({ type: "pattern" });
    setModal({ type: "problem", initial: { pattern: pat === "All" ? patterns[0] : pat } });
  };
  const saveProblem = (f) => run(() => api(f._id ? "/problems/" + f._id : "/problems", { method: f._id ? "PUT" : "POST", body: { ...f, today: t } }));
  const rate = (p, r) => { if (guard("Log in to save your revision progress.")) run(() => api(`/problems/${p._id}/rate`, { method: "POST", body: { rating: r, today: t } })); };
  const remove = (p) => { if (guard("Log in first.") && confirm("Delete this problem?")) run(() => api("/problems/" + p._id, { method: "DELETE" })); };
  const addPattern = (name) => run(async () => { await api("/patterns", { method: "POST", body: { name } }); setPat(name); });
  const removePattern = () => { if (confirm(`Delete “${pat}” and all its problems?`)) run(async () => { await api("/patterns/" + encodeURIComponent(pat), { method: "DELETE" }); setPat("All"); }); };

  const dueList = problems.filter((p) => p.next <= t).sort((a, b) => (a.next < b.next ? -1 : 1));
  const streak = () => { let s = 0, d = log.includes(t) ? t : add(t, -1); while (log.includes(d)) { s++; d = add(d, -1); } return s; };
  const toggle = (id) => setShown((o) => ({ ...o, [id]: !o[id] }));

  /* ----- views ----- */
  const Dash = () => {
    const mastered = problems.filter((p) => p.stage >= INTERVALS.length - 1).length;
    const weak = problems.filter((p) => p.mistakes && p.stage <= 1).slice(0, 3);
    return (<>
      <div className="grid">
        <div className="stat"><b>{dueList.length}</b><span>Due today</span></div>
        <div className="stat"><b>{problems.length}</b><span>Problems tracked</span></div>
        <div className="stat"><b>{streak()}</b><span>Day streak</span></div>
        <div className="stat"><b>{mastered}</b><span>Well retained</span></div>
      </div>
      <div className="panel">
        <h2>Pattern strength</h2>
        <p className="mute" style={{ margin: "2px 0 8px" }}>Based on how far each problem has moved through the revision schedule.</p>
        {!patterns.length && <div className="empty">No patterns yet. Add one in the Patterns tab.</div>}
        {patterns.map((n) => {
          const L = problems.filter((p) => p.pattern === n);
          const pc = L.length ? Math.round((L.reduce((a, p) => a + p.stage / (INTERVALS.length - 1), 0) / L.length) * 100) : 0;
          const d = L.filter((p) => p.next <= t).length;
          return (
            <div className="pr" key={n}>
              <div className="row"><b>{n}</b><span className="mute">{L.length} problems</span><span className="sp" />
                {d > 0 && <span className="tag due">{d} due</span>}<span className="mute">{pc}%</span></div>
              <div className="bar"><i style={{ width: pc + "%" }} /></div>
            </div>
          );
        })}
      </div>
      {weak.length > 0 && (
        <div className="panel"><h2>Mistakes to watch</h2>
          {weak.map((p) => <div className="pr" key={p._id}><b>{p.title}</b><div className="note">{p.mistakes}</div></div>)}
        </div>
      )}
    </>);
  };

  const Due = () => !dueList.length ? (
    <div className="panel empty"><h2 style={{ color: "var(--ink)" }}>Nothing due today</h2>
      <p>Solve a new problem or revisit a pattern.</p></div>
  ) : (<>
    <p className="mute">{dueList.length} to revise. Most overdue first.</p>
    {dueList.map((p) => <Card key={p._id} p={p} full shown={shown[p._id]} onReveal={() => toggle(p._id)} onRate={(r) => rate(p, r)} />)}
  </>);

  const Patterns = () => {
    const L = problems.filter((p) => (pat === "All" || p.pattern === pat) && p.title.toLowerCase().includes(q.toLowerCase()));
    return (<>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="chips">
          {["All", ...patterns].map((n) => <button key={n} className={"chip" + (pat === n ? " on" : "")} onClick={() => setPat(n)}>{n}</button>)}
        </div>
        <span className="sp" />
        <button className="btn s" onClick={() => guard("Log in to create your own patterns.") && setModal({ type: "pattern" })}>New pattern</button>
        <button className="btn p s" onClick={openAdd}>Add problem</button>
      </div>
      {pat !== "All" && user && <div style={{ marginBottom: 8 }}><button className="btn s r" onClick={removePattern}>Delete pattern “{pat}”</button></div>}
      <input placeholder="Search problems" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {!L.length && <div className="panel empty">No problems here yet. Use “Add problem” after you solve one.</div>}
      {L.map((p) => <Card key={p._id} p={p} onReveal={() => toggle(p._id)} onEdit={() => guard("Log in first.") && setModal({ type: "problem", initial: p })} onDelete={() => remove(p)} />)}
    </>);
  };

  const Calendar = () => {
    const now = new Date();
    const b = new Date(now.getFullYear(), now.getMonth() + calOff, 1);
    const n = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    const map = {};
    problems.forEach((p) => { const k = p.next < t ? t : p.next; (map[k] = map[k] || []).push(p); });
    const sel = calSel || t;
    return (<>
      <div className="panel">
        <div className="row">
          <button className="btn s" onClick={() => setCalOff(calOff - 1)}>Prev</button>
          <h2>{b.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          <button className="btn s" onClick={() => setCalOff(calOff + 1)}>Next</button>
          <span className="sp" />
          <button className="btn s" onClick={() => { setCalOff(0); setCalSel(null); }}>Today</button>
        </div>
        <div className="cal">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div className="h" key={d}>{d}</div>)}
          {Array.from({ length: b.getDay() }, (_, i) => <button key={"b" + i} className="day blank" tabIndex={-1} aria-hidden="true" />)}
          {Array.from({ length: n }, (_, i) => {
            const k = dstr(new Date(b.getFullYear(), b.getMonth(), i + 1)), c = (map[k] || []).length;
            return <button key={k} className={"day" + (k === t ? " today" : "") + (k === sel ? " sel" : "")} onClick={() => setCalSel(k)}>{i + 1}{c > 0 && <i>{c}</i>}</button>;
          })}
        </div>
      </div>
      <div className="panel">
        <h2>{fmt(sel)}{sel === t ? " (today, includes overdue)" : ""}</h2>
        {!(map[sel] || []).length && <p className="mute">Nothing scheduled for this day.</p>}
        {(map[sel] || []).map((p) => <div className="pr" key={p._id}><b>{p.title}</b> <span className="tag">{p.pattern}</span> <span className={"tag " + p.difficulty}>{p.difficulty}</span></div>)}
      </div>
    </>);
  };

  const Guide = () => (
    <div className="panel guide">
      <h2>How to use Revisit</h2>
      <h3>1. Add problems after solving</h3>
      <p>Create a pattern (like Sliding Window), then add each problem you solve with your approach, code, complexity and the mistakes you made. Writing the mistake is the most valuable part.</p>
      <h3>2. Revise what is due</h3>
      <ol><li>Open <b>Due today</b>.</li><li>Read only the title. Name the pattern, write the code, say the complexity.</li><li>Tap <b>Reveal my notes</b> and compare.</li><li>Rate yourself honestly.</li></ol>
      <h3>3. Ratings set the next date</h3>
      <table><tbody>
        <tr><th>Rating</th><th>Meaning</th><th>What happens</th></tr>
        <tr><td>Easy</td><td>Fast, correct, no peeking</td><td>Moves to the next, longer gap</td></tr>
        <tr><td>Medium</td><td>Idea right, code or edge cases shaky</td><td>Repeats the same gap</td></tr>
        <tr><td>Hard</td><td>Could not recall or needed hints</td><td>Resets to 1 day</td></tr>
      </tbody></table>
      <h3>4. The schedule</h3>
      <p>Gaps in days: {INTERVALS.join(", ")}. A new problem is first due the next day. The Calendar tab shows what is coming up, and overdue problems are counted on today.</p>
      <h3>5. Weekly habit</h3>
      <ul><li>Spend about 70% of your time on new problems and 30% on revision.</li><li>Once a week, write the template code for one pattern from memory.</li><li>Check “Mistakes to watch” on the dashboard.</li></ul>
    </div>
  );

  const views = { dash: Dash, due: Due, pat: Patterns, cal: Calendar, guide: Guide };
  const View = views[tab];
  const tabs = [["dash", "Dashboard"], ["due", "Due today"], ["pat", "Patterns"], ["cal", "Calendar"], ["guide", "Guide"]];

  return (
    <div className="app">
      <header>
        <h1>Revisit</h1>
        <nav>
          {tabs.map(([k, label]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {label}{k === "due" && dueList.length > 0 && <span className="badge">{dueList.length}</span>}
            </button>
          ))}
        </nav>
        {user ? (
          <div className="row"><span className="mute">{user.email}</span><button className="btn s" onClick={logout}>Log out</button></div>
        ) : (
          <button className="btn p s" onClick={() => setModal({ type: "auth", reason: "Log in to keep your own problems and revision schedule." })}>Log in / Sign up</button>
        )}
      </header>
      {!user && <div className="banner">You are viewing sample data. Log in or sign up when you want to add your own problems.</div>}
      <main><View /></main>

      {modal?.type === "auth" && <AuthModal reason={modal.reason} onClose={() => setModal(null)} onDone={load} />}
      {modal?.type === "problem" && <ProblemModal initial={modal.initial} patterns={patterns} onClose={() => setModal(null)} onSave={saveProblem} />}
      {modal?.type === "pattern" && <PatternModal onClose={() => setModal(null)} onSave={addPattern} />}
    </div>
  );
}
