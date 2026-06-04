/* global React, I */
var { useState, useEffect, useRef, useMemo, useCallback } = React;

// ============================================================
// Toast system (global helper)
// ============================================================
window.__toasts = window.__toasts || [];
window.__toastListeners = window.__toastListeners || [];
window.showToast = (toast) => {
  const id = Math.random().toString(36).slice(2);
  const t = { id, ...toast };
  window.__toasts.push(t);
  window.__toastListeners.forEach(fn => fn([...window.__toasts]));
  setTimeout(() => {
    window.__toasts = window.__toasts.filter(x => x.id !== id);
    window.__toastListeners.forEach(fn => fn([...window.__toasts]));
  }, toast.duration || 4500);
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const fn = (next) => setToasts(next);
    window.__toastListeners.push(fn);
    return () => { window.__toastListeners = window.__toastListeners.filter(f => f !== fn); };
  }, []);
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast" style={t.kind === "info" ? { borderLeftColor: "var(--info)" } : {}}>
          <div className="toast-icon" style={t.kind === "info" ? { background: "var(--info-soft)", color: "var(--info)" } : {}}>
            {t.kind === "info" ? <I.Info size={13}/> : <I.Check size={13}/>}
          </div>
          <div>
            <b>{t.title}</b>
            {t.body && <p>{t.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

window.ToastContainer = ToastContainer;

// ============================================================
// Sidebar
// ============================================================
const NAV = [
  { id: "planning",  label: "Планировка", icon: "Ruler", badge: "AI" },
  { id: "prices",    label: "Прайс-листы", icon: "PriceTag" },
  { id: "kp",        label: "КП",         icon: "Proposal", badge: 5 },
  { id: "settings",  label: "Настройки",  icon: "Settings" },
];

function Sidebar({ active, onNav }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">С</div>
        <div>
          <div className="brand-name">Stroika</div>
          <div className="brand-tagline">AI смета · v2.4</div>
        </div>
      </div>

      <div className="workspace">
        <button className="workspace-select">
          <div className="workspace-avatar">СК</div>
          <div className="workspace-info">
            <b>СтройКомфорт</b>
            <span>Workspace</span>
          </div>
          <I.Chevron size={14} style={{ color: "#6B7385" }}/>
        </button>
      </div>

      <nav className="nav-section">
        <div className="nav-label">Меню</div>
        {NAV.map(item => {
          const Icn = I[item.icon];
          return (
            <button
              key={item.id}
              className={`nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => onNav(item.id)}
            >
              <Icn size={16} className="nav-icon"/>
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">АП</div>
          <div className="user-info">
            <b>Артём Петров</b>
            <span>Сметчик · СтройКомфорт</span>
          </div>
          <I.Chevron size={14} style={{ color: "#6B7385" }}/>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;

// ============================================================
// Topbar
// ============================================================
const TITLES = {
  planning:  { title: "Планировка", crumbs: ["Планировка"] },
  kp:        { title: "Коммерческие предложения", crumbs: ["КП"] },
  prices:    { title: "Прайс-лист", crumbs: ["Прайсы"] },
  settings:  { title: "Настройки", crumbs: ["Настройки"] },
};

function Topbar({ active, onNav }) {
  const meta = TITLES[active] || TITLES.planning;
  const notify = () => window.showToast({ title: "Уведомлений нет", body: "Здесь будут события по проектам, КП и тендерам.", kind: "info" });
  const help   = () => window.showToast({ title: "Помощь", body: "Подсказки и горячие клавиши — в Tweaks-панели и кнопках с tooltip.", kind: "info" });
  const search = (e) => {
    if (e.key === "Enter") {
      window.showToast({ title: "Поиск в production-версии", body: "В демо доступна навигация по сайдбару (клавиши 1–4).", kind: "info" });
    }
  };
  return (
    <header className="topbar">
      <div className="crumbs">
        {meta.crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <I.ChevronRight size={12}/>}
            <span style={i === meta.crumbs.length - 1 ? { color: "var(--text)", fontWeight: 500 } : {}}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="search">
        <I.Search size={14}/>
        <input placeholder="Поиск проектов, смет, материалов…" onKeyDown={search}/>
        <kbd>⌘K</kbd>
      </div>
      <button className="icon-btn" title="Помощь" onClick={help}><I.Help size={16}/></button>
      <button className="icon-btn" title="Уведомления" onClick={notify}><I.Bell size={16}/><span className="dot"/></button>
      <button className="btn btn-accent btn-sm" onClick={() => onNav("planning")}>
        <I.Plus size={14}/> Новый проект
      </button>
    </header>
  );
}

window.Topbar = Topbar;
