import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type SourceHealth = {
  name: string;
  sourceType: string;
  status: "unconfigured" | "current" | "stale" | "error";
  expectedCadence: string;
  note: string;
};

type Meta = {
  environment: string;
  forecastStatus: "not_ready" | "ready" | "stale";
  currentModelVersion: string | null;
};

const navItems = ["Overview", "Forecasts", "Polls", "Markets", "Ledger", "Methodology"];

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function App() {
  const [active, setActive] = useState("Overview");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      loadJson<Meta>("/api/v1/meta"),
      loadJson<{ items: SourceHealth[] }>("/api/v1/sources"),
    ])
      .then(([loadedMeta, loadedSources]) => {
        setMeta(loadedMeta);
        setSources(loadedSources.items);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load API status"));
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">BallotScope</div>
            <div className="brand-tagline">Election intelligence, with receipts.</div>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => setActive(item)}>
              {item}
            </button>
          ))}
        </nav>
        <div className="status-pill"><span className="status-dot" /> {meta?.forecastStatus === "ready" ? "Live model" : "Build mode"}</div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">{active.toUpperCase()} · MVP FOUNDATION</div>
          <h1>See the forecast.<br /><em>Follow the evidence.</em></h1>
          <p className="hero-copy">A transparent election-intelligence workspace designed to show what the model thinks, what the evidence says, and why the estimate changes.</p>
          {error && <div className="inline-alert">API status unavailable: {error}</div>}
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setActive("Forecasts")}>Explore forecasts <span>→</span></button>
            <button className="text-button" onClick={() => setActive("Methodology")}>Read methodology <span>↗</span></button>
          </div>
        </section>

        <section className="dashboard-grid" aria-label="Forecast status">
          <article className="feature-card dark-card wide-card">
            <div className="card-kicker">HOUSE CONTROL</div>
            <div className="empty-metric">—<span>awaiting audited run</span></div>
            <div className="card-footer"><span>Probability</span><span className="muted">Not published</span></div>
          </article>
          <article className="feature-card cream-card">
            <div className="card-kicker">SENATE CONTROL</div>
            <div className="empty-metric dark-text">—<span>awaiting audited run</span></div>
            <div className="card-footer"><span>Probability</span><span className="muted dark-muted">Not published</span></div>
          </article>
          <article className="feature-card outline-card">
            <div className="card-kicker">MODEL LEDGER</div>
            <div className="ledger-preview"><div><strong>—</strong><span>latest update</span></div><div className="ledger-line"><i /><i /><i /><i /><i /></div></div>
            <div className="card-footer"><span>Immutable history</span><span className="arrow">→</span></div>
          </article>
        </section>

        <section className="split-section">
          <div className="map-panel">
            <div className="section-heading"><div><div className="eyebrow">NATIONAL VIEW</div><h2>Race map</h2></div><span className="panel-label">GEOGRAPHY NOT INGESTED</span></div>
            <div className="map-placeholder"><div className="map-grid" /><div className="map-message"><span className="map-icon">⌁</span><strong>District geography will appear here</strong><span>Versioned Census boundaries are required before a map or race list can be published.</span></div></div>
          </div>
          <div className="side-panel">
            <div className="section-heading"><div><div className="eyebrow">SOURCE HEALTH</div><h2>Evidence spine</h2></div><span className="panel-label">{sources.length ? `${sources.length} SOURCES` : "LOADING"}</span></div>
            <div className="source-list">
              {sources.slice(0, 6).map((source) => <div className="source-row" key={source.name}><span className="source-status" /><div><strong>{source.name}</strong><span>{source.expectedCadence}</span></div><span className="source-state">{source.status}</span></div>)}
              {!sources.length && <div className="skeleton-list"><i /><i /><i /></div>}
            </div>
            <button className="full-link" onClick={() => setActive("Methodology")}>View source status <span>→</span></button>
          </div>
        </section>

        <section className="principles-section">
          <div className="eyebrow">THE BALLOTSCOPE PROMISE</div>
          <div className="principles-heading"><h2>Nothing disappears.<br /><em>Every move has a receipt.</em></h2><p>Forecasts are append-only. Markets stay separate. The model explains itself with structured, testable attribution before any prose is written.</p></div>
          <div className="principle-grid"><div><span>01</span><h3>Evidence first</h3><p>Raw inputs are preserved when licensing permits and linked back to normalized records.</p></div><div><span>02</span><h3>Model ≠ market</h3><p>Market prices are an independent comparison signal, never a hidden model input.</p></div><div><span>03</span><h3>History stays live</h3><p>Past estimates retain their timestamp, model version, and input-bundle hash.</p></div></div>
        </section>
      </main>

      <footer><span>BallotScope · MVP foundation v0.1</span><span>Environment: {meta?.environment ?? "connecting"} · Model: {meta?.currentModelVersion ?? "not released"}</span></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
