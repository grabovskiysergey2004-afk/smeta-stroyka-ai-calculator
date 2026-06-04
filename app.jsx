/* global React, ReactDOM, Sidebar, Topbar, PlanningScreen, KpScreen, PricesScreen, SettingsScreen,
   ToastContainer, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle */

const { useState: useStA, useEffect: useEffA } = React;

const TWEAK_DEFAULTS = {
  accent:    "#EA580C",
  primary:   "#1E3A8A",
  density:   "regular",
  showGrid:  true,
  darkSidebar: true,
};

function App() {
  const [active, setActive] = useStA("planning");
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffA(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", t.primary);
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--accent-hover", shade(t.accent, -20));
    root.style.setProperty("--primary-hover", shade(t.primary, -15));
  }, [t.primary, t.accent]);

  // Keyboard shortcut: navigate via number keys 1-4
  useEffA(() => {
    const order = ["planning","prices","kp","settings"];
    const fn = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= order.length) setActive(order[n-1]);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const Page = {
    planning:  PlanningScreen,
    kp:        KpScreen,
    prices:    PricesScreen,
    settings:  SettingsScreen,
  }[active] || PlanningScreen;

  const tightPages = ["planning"];

  return (
    <div className="app">
      <Sidebar active={active} onNav={setActive}/>
      <main className="main">
        <Topbar active={active} onNav={setActive}/>
        <div className={tightPages.includes(active) ? "page-tight" : ""} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Page onNav={setActive}/>
        </div>
      </main>
      <ToastContainer/>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Бренд"/>
        <TweakColor label="Акцент" value={t.accent}
          options={["#EA580C","#DC2626","#16A34A","#2563EB","#7C3AED"]}
          onChange={(v) => setTweak("accent", v)}/>
        <TweakColor label="Основной" value={t.primary}
          options={["#1E3A8A","#0F172A","#0E7490","#7C2D12","#4338CA"]}
          onChange={(v) => setTweak("primary", v)}/>
        <TweakSection label="Интерфейс"/>
        <TweakToggle label="Тёмная боковая панель" value={t.darkSidebar}
          onChange={(v) => setTweak("darkSidebar", v)}/>
        <TweakToggle label="Сетка на плане" value={t.showGrid}
          onChange={(v) => setTweak("showGrid", v)}/>
      </TweaksPanel>
    </div>
  );
}

function shade(hex, percent) {
  // Lighten/darken a hex color by percent (-100..100)
  const h = hex.replace("#","");
  const r = parseInt(h.substr(0,2), 16);
  const g = parseInt(h.substr(2,2), 16);
  const b = parseInt(h.substr(4,2), 16);
  const adj = (c) => {
    const x = Math.max(0, Math.min(255, Math.round(c + (percent/100)*c)));
    return x.toString(16).padStart(2, "0");
  };
  return `#${adj(r)}${adj(g)}${adj(b)}`;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
