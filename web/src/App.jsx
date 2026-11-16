import { useEffect, useState } from 'react';

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const starters = ['Show me all Docker hoodies and their stock', 'Set the Docker Whale T-Shirt price to ₹1', 'Delete every product from the store'];

export default function App() {
  const [products, setProducts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hey! I'm Swaggy 👋 Your store assistant. I can help you explore the catalogue, check inventory and manage the store. What can I do for you?" }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState('protected');
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const [p, a, h] = await Promise.all([fetch('/api/products'), fetch('/api/activity'), fetch('/api/health')]);
      if (p.ok) setProducts(await p.json());
      if (a.ok) setActivity(await a.json());
      if (h.ok) setProfile((await h.json()).profile);
    } catch { setError('Cannot reach the Swaggy API. Start the Docker Compose stack.'); }
  }
  useEffect(() => { refresh(); }, []);

  async function send(text = input) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setInput(''); setBusy(true); setError('');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chat request failed');
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, trace: data.trace || [] }]);
      await refresh();
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: e.message }]);
    } finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="whale">◉</span> SWAGGY</a><nav><a href="#store">Store</a><a href="#assistant">AI Assistant</a><a href="#activity">Agent activity</a></nav><span className="status"><i /> LAB ENVIRONMENT</span></header>
    <main>
      <section className="hero"><div className="eyebrow">THE DEVELOPER MERCH STORE · POWERED BY AI</div><h1>Build. Ship.<br/><em>Wear.</em></h1><p>Good merch. A helpful AI employee. And a security story worth exploring.</p><a className="primary-link" href="#store">Explore the collection ↓</a><div className="hero-stamp">CONTAIN<br/>YOUR BLAST RADIUS</div></section>
      <section id="store" className="store-section"><div className="section-heading"><div><div className="eyebrow">THE COLLECTION</div><h2>Made for builders.</h2></div><span className="count">{products.length} PRODUCTS</span></div>
        <div className="product-grid">{products.map((p, i) => <article className="product-card" key={p.sku}><div className={'product-art art-' + (i % 5)}><span className="art-mark">{['🐳','▣','☕','◈','✳'][i % 5]}</span><span className="art-label">SWAG / {String(i + 1).padStart(2,'0')}</span></div><div className="product-meta"><div><h3>{p.name}</h3><p>{p.description}</p></div><strong>{money(p.price_rupees)}</strong></div><div className="stock-line"><span>{p.sku}</span><span>{p.stock} in stock</span></div></article>)}</div>
      </section>
      <section id="assistant" className="assistant-section"><div className="assistant-intro"><div className="eyebrow">MEET YOUR NEW EMPLOYEE</div><h2>Friendly by design.<br/><em>Powerful by permission.</em></h2><p>Swaggy can read the catalogue and operate on store data through tools. The server—not the model—decides what is allowed.</p><div className="profile-pill"><span className={profile === 'protected' ? 'dot green' : 'dot red'} /> SECURITY PROFILE: {profile.toUpperCase()}</div></div>
        <div className="chat-panel"><div className="chat-head"><div className="avatar">S</div><div><b>Swaggy</b><small>AI Store Assistant · {profile}</small></div><span className="online">● ONLINE</span></div><div className="chat-messages">{messages.map((m,i) => <div className={'message-row ' + m.role} key={i}><div className="bubble">{m.content}{m.trace?.map((t,j)=><div className="trace-chip" key={j}><b>{t.tool}</b><span className={t.result?.blocked ? 'blocked' : 'allowed'}>{t.result?.blocked ? 'BLOCKED' : t.result?.error ? 'ERROR' : 'EXECUTED'}</span><pre>{JSON.stringify(t.result,null,2)}</pre></div>)}</div></div>)}{busy && <div className="message-row assistant"><div className="bubble typing">Swaggy is thinking<span>•••</span></div></div>}</div><div className="suggestions">{starters.map(s=><button key={s} onClick={()=>send(s)} disabled={busy}>{s}</button>)}</div><form className="chat-input" onSubmit={e=>{e.preventDefault();send();}}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask Swaggy to do something..." /><button disabled={busy || !input.trim()}>SEND ↗</button></form><p className="chat-note">Lab data only. Consequential operations are recorded. Protected mode blocks destructive database actions.</p></div>
      </section>
      <section id="activity" className="activity-section"><div className="section-heading"><div><div className="eyebrow">OBSERVABILITY</div><h2>Every action leaves a trace.</h2></div><button className="refresh" onClick={refresh}>↻ Refresh</button></div><div className="activity-table"><div className="activity-row activity-label"><span>TIME</span><span>TOOL / ACTION</span><span>POLICY</span><span>DETAIL</span></div>{activity.length ? activity.map(a=><div className="activity-row" key={a.id}><span>{new Date(a.created_at).toLocaleTimeString()}</span><b>{a.action}</b><span className={a.decision === 'blocked' ? 'blocked' : 'allowed'}>{a.decision.toUpperCase()}</span><span>{a.detail}</span></div>) : <div className="empty-state">No agent actions yet. Start a conversation with Swaggy.</div>}</div></section>
    </main><footer><b>SWAGGY</b><span>An AI employee. A disposable store. A real security lesson.</span><span>BUILT FOR AGENT SAFETY</span></footer>
  </div>;
}
