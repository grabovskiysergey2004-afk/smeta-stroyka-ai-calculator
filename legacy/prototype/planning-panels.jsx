/* global React, window, I */
var { useState: useStaP, useMemo: useMemoP2 } = React;
var fmt = window.plFormatRu;
var wallLen2 = window.plWallLen;
var PRICE = window.PL_PRICE;
var TEMPLATES = window.PL_TEMPLATES;
var TOOLSETS = window.PL_TOOLSETS;

// ============================================================
// PlanToolbar — left vertical tool palette, adapts to mode
// ============================================================
function PlanToolbar({ mode, tool, setTool, onClear, onDelete, hasSelection, onResetProject }) {
  const toolset = TOOLSETS[mode] || TOOLSETS.plan;
  return (
    <div className="plan-toolbar">
      {toolset.map((item, i) => {
        if (item.sep) return <div key={`s-${i}`} className="tool-divider"/>;
        const Icn = I[item.icon] || I.Wall;
        return (
          <button key={item.id} className={`tool ${tool === item.id ? "active" : ""}`} onClick={() => setTool(item.id)}>
            <Icn size={18} stroke={1.6}/>
            <span className="tool-tip">{item.label} {item.kbd && <kbd>{item.kbd}</kbd>}</span>
          </button>
        );
      })}
      <div className="tool-divider"/>
      <button className="tool" disabled={!hasSelection} onClick={onDelete} style={{ opacity: hasSelection ? 1 : 0.4 }}>
        <I.Trash size={17}/>
        <span className="tool-tip">Удалить <kbd>⌫</kbd></span>
      </button>
      <button className="tool" onClick={() => window.showToast({ title: "Отменено", kind: "info" })}>
        <I.Undo size={17}/>
        <span className="tool-tip">Отменить <kbd>⌘Z</kbd></span>
      </button>
      <button className="tool" onClick={onClear}>
        <I.Eraser size={17}/>
        <span className="tool-tip">Очистить уровень</span>
      </button>
      {onResetProject && (
        <button className="tool" onClick={onResetProject}>
          <I.Trash size={17}/>
          <span className="tool-tip">Сбросить проект</span>
        </button>
      )}
      <div style={{ flex: 1 }}/>
      <button className="tool" onClick={() => window.showToast({ title: "Шаблон сохранён", body: "Доступен в библиотеке" })}>
        <I.Save size={17}/>
        <span className="tool-tip">Сохранить шаблон</span>
      </button>
    </div>
  );
}

// ============================================================
// PlanInspector — right panel
// ============================================================
function PlanInspector({ tab, setTab, selected, walls, stats, mode, level, calculated, onCalculate, onOpenKp, showResult, onDismissResult, onUpdateLevel,
  onUpdateWallLen, onUpdateWallType, onUpdateRoom, onUpdateWindow, onUpdateDoor, onDeleteSelected,
  selectedIds, selectedObjects, layers, setLayers, onLayerToggle, data,
  onPatchObject, onDuplicateSelected, onAddParapetByContour,
  onCreateRectRoof, onApplyDemoRoof, onCheckRoof, onSelectAndFit, roofCheckRunAt,
  estimateDraft, warnings,
  project, estimateScope, setEstimateScope, onSwitchLevel, onCreateRoofFromContour, onCheckProject, onShowProjectEstimate,
  onOpenResultCenter, onOpenKpModal, onOpenExport, lastProposalId, projectStatus,
  backgrounds, onPatchBackground, onDeleteBackground, onStartCalibration, onFitToBackgrounds, onOpenImport, onSetTool, onLoadPdfDemo }) {
  const multi = (selectedIds || []).length > 1;
  const single = !multi && selected;
  // Build aggregated project view if >1 level
  const showProjectSummary = !multi && !single && project && project.levels && project.levels.length > 1 && level && level.type !== "industrial_roof";
  // Compute aggregated stats for project summary
  const projSummary = React.useMemo(() => {
    if (!project) return null;
    let totalArea = 0, totalRoofArea = 0, totalWalls = 0, totalWindows = 0, totalDoors = 0, totalGates = 0, totalWarnings = 0;
    const byLevel = project.levels.map(l => {
      const d = project.levelsData[l.id] || {};
      const isRoof = l.type === "roof" || l.type === "industrial_roof";
      let area = 0;
      if (isRoof) {
        const c = d.roof?.contour || [];
        area = c.length >= 3 ? window.plPolygonArea(c) : 0;
        totalRoofArea += area;
      } else {
        area = (d.rooms || []).reduce((s, r) => s + r.w * r.h, 0);
        totalArea += area;
        totalWalls += (d.walls || []).filter(w => w.type === "external").reduce((s, w) => s + window.plWallLen(w), 0);
        totalWindows += (d.windows || []).length;
        const allDoors = (d.doors || []);
        totalDoors += allDoors.filter(x => !x.gate).length;
        totalGates += allDoors.filter(x => x.gate).length;
      }
      const w = window.plGetValidationWarnings ? window.plGetValidationWarnings(d, l.type) : [];
      totalWarnings += w.length;
      return { id: l.id, name: l.name, type: l.type, area, warnings: w.length, active: l.id === project.activeLevelId };
    });
    return { byLevel, totalArea, totalRoofArea, totalWalls, totalWindows, totalDoors, totalGates, totalWarnings };
  }, [project]);
  return (
    <aside className="inspector">
      <div className="inspector-tabs">
        <button className={`inspector-tab ${tab === "params"  ? "active" : ""}`} onClick={() => setTab("params")}>Параметры</button>
        <button className={`inspector-tab ${tab === "layers"  ? "active" : ""}`} onClick={() => setTab("layers")}>Слои <span className="tab-count">{(layers || []).length}</span></button>
        <button className={`inspector-tab ${tab === "warns"   ? "active" : ""}`} onClick={() => setTab("warns")}>Замечания {warnings?.length ? <span className="tab-count">{warnings.length}</span> : null}</button>
        <button className={`inspector-tab ${tab === "calc"    ? "active" : ""}`} onClick={() => setTab("calc")}>Расчёт</button>
        <button className={`inspector-tab ${tab === "ai"      ? "active" : ""}`} onClick={() => setTab("ai")}>AI</button>
      </div>
      <div className="inspector-body">
        {tab === "params" && (
          multi
            ? <MultiSelectParams selectedObjects={selectedObjects || []} layers={layers || []} onPatchObject={onPatchObject} onDuplicateSelected={onDuplicateSelected} onDeleteSelected={onDeleteSelected}/>
            : single
              ? <ParamsForSelection selected={selected} walls={walls} layers={layers || []} mode={mode}
                  onUpdateWallLen={onUpdateWallLen} onUpdateWallType={onUpdateWallType}
                  onUpdateRoom={onUpdateRoom} onUpdateWindow={onUpdateWindow} onUpdateDoor={onUpdateDoor}
                  onPatchObject={onPatchObject} onDuplicateSelected={onDuplicateSelected}
                  onDeleteSelected={onDeleteSelected}/>
              : (level && (level.type === "roof" || level.type === "industrial_roof"))
                ? <>
                    {backgrounds && backgrounds.length > 0 && <BackgroundsPanel backgrounds={backgrounds}
                      onPatchBackground={onPatchBackground} onDeleteBackground={onDeleteBackground}
                      onStartCalibration={onStartCalibration} onFitToBackgrounds={onFitToBackgrounds}
                      onOpenImport={onOpenImport} onSetTool={onSetTool} onLoadPdfDemo={onLoadPdfDemo}/>}
                    <RoofDashboard level={level} data={data} warnings={warnings} estimateDraft={estimateDraft}
                      onUpdateLevel={onUpdateLevel}
                      onAddParapetByContour={onAddParapetByContour}
                      onCreateRectRoof={onCreateRectRoof}
                      onApplyDemoRoof={onApplyDemoRoof}
                      onCheckRoof={onCheckRoof}
                      onSelectAndFit={onSelectAndFit}
                      roofCheckRunAt={roofCheckRunAt}
                      onOpenResultCenter={onOpenResultCenter}
                      onOpenKpModal={onOpenKpModal}
                      onOpenExport={onOpenExport}
                      projectStatus={projectStatus}/>
                  </>
                : (showProjectSummary && projSummary)
                  ? <>
                      {backgrounds && backgrounds.length > 0 && <BackgroundsPanel backgrounds={backgrounds}
                        onPatchBackground={onPatchBackground} onDeleteBackground={onDeleteBackground}
                        onStartCalibration={onStartCalibration} onFitToBackgrounds={onFitToBackgrounds}
                        onOpenImport={onOpenImport} onSetTool={onSetTool} onLoadPdfDemo={onLoadPdfDemo}/>}
                      <ProjectSummaryPanel project={project}
                        summaryByLevel={projSummary.byLevel}
                        totalArea={projSummary.totalArea}
                        totalWalls={projSummary.totalWalls}
                        totalWindows={projSummary.totalWindows}
                        totalDoors={projSummary.totalDoors}
                        totalGates={projSummary.totalGates}
                        totalRoofArea={projSummary.totalRoofArea}
                        totalWarnings={projSummary.totalWarnings}
                        onSwitchLevel={onSwitchLevel}
                        onCreateRoofFromContour={onCreateRoofFromContour}
                        onCheckProject={onCheckProject}
                        onShowEstimate={onShowProjectEstimate}
                        onOpenResultCenter={onOpenResultCenter}
                        onOpenKpModal={onOpenKpModal}
                        onOpenExport={onOpenExport}
                        projectStatus={projectStatus}/>
                    </>
                  : <>
                      {backgrounds && backgrounds.length > 0 && <BackgroundsPanel backgrounds={backgrounds}
                        onPatchBackground={onPatchBackground} onDeleteBackground={onDeleteBackground}
                        onStartCalibration={onStartCalibration} onFitToBackgrounds={onFitToBackgrounds}
                        onOpenImport={onOpenImport} onSetTool={onSetTool} onLoadPdfDemo={onLoadPdfDemo}/>}
                      <LevelParams level={level} mode={mode} onUpdateLevel={onUpdateLevel} warnings={warnings} estimateDraft={estimateDraft} onAddParapetByContour={onAddParapetByContour} onCreateRoofFromContour={onCreateRoofFromContour}
                        onOpenResultCenter={onOpenResultCenter} onOpenKpModal={onOpenKpModal} onOpenExport={onOpenExport} projectStatus={projectStatus}/>
                    </>
        )}
        {tab === "layers" && <LayersPanel layers={layers || []} data={data} onLayerToggle={onLayerToggle}/>}
        {tab === "warns"  && <WarningsPanel warnings={warnings || []} onJump={onSelectAndFit} level={level} roofCheckRunAt={roofCheckRunAt}/>}
        {tab === "calc"   && <CalcPanel stats={stats} level={level} showResult={showResult} onDismiss={onDismissResult} onOpenKp={onOpenKp} estimateDraft={estimateDraft} project={project} estimateScope={estimateScope} setEstimateScope={setEstimateScope} onOpenResultCenter={onOpenResultCenter} onOpenKpModal={onOpenKpModal} onOpenExport={onOpenExport} projectStatus={projectStatus}/>}
        {tab === "ai"     && <AiSuggestions level={level}/>}
      </div>
      <div className="insp-footer">
        {!showResult && (
          <button className="btn btn-accent btn-lg" style={{ justifyContent: "center" }} onClick={onCalculate}>
            <I.Calc size={16}/> Рассчитать смету
          </button>
        )}
        {showResult && (
          <button className="btn btn-primary btn-lg" style={{ justifyContent: "center" }} onClick={onOpenKp}>
            <I.Proposal size={16}/> Сформировать КП
          </button>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}><I.Save size={14}/> Сохранить</button>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}><I.Download size={14}/> Экспорт</button>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// LayersPanel
// ============================================================
function LayersPanel({ layers, data, onLayerToggle }) {
  // count objects per layer
  const counts = useMemoP2(() => {
    const c = {};
    const all = window.plIterAllObjects ? window.plIterAllObjects(data || {}) : [];
    for (const e of all) {
      const lid = (e.obj && e.obj.layerId) || (window.PL_LAYER_OF && window.PL_LAYER_OF[e.kind]);
      if (!lid) continue;
      c[lid] = (c[lid] || 0) + 1;
    }
    return c;
  }, [data]);
  if (!layers || layers.length === 0) {
    return <div className="insp-empty"><div><div className="insp-empty-icon"><I.Layers size={22}/></div><p>На уровне не задано ни одного слоя.</p></div></div>;
  }
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Слои · {layers.length}</div>
        <div className="layers-list">
          {layers.map(l => (
            <div key={l.id} className={`layer-row ${l.visible === false ? "hidden" : ""} ${l.locked ? "locked" : ""}`}>
              <button className="lr-eye" onClick={() => onLayerToggle(l.id, { visible: l.visible === false ? true : false })} title={l.visible === false ? "Показать" : "Скрыть"}>
                {l.visible === false ? <I.Close size={13}/> : <I.Eye size={13}/>}
              </button>
              <button className="lr-lock" onClick={() => onLayerToggle(l.id, { locked: !l.locked })} title={l.locked ? "Разблокировать" : "Заблокировать"}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d={l.locked ? "M7 11V7a5 5 0 0 1 10 0v4" : "M7 11V7a5 5 0 0 1 9.9-1"}/>
                </svg>
              </button>
              <span className="lr-swatch" style={{ background: l.color }}/>
              <span className="lr-name">{l.name}</span>
              <span className="lr-count">{counts[l.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="insp-section">
        <div className="insp-title">Прозрачность слоя</div>
        {layers.filter(l => l.visible !== false).map(l => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color }}/>
            <span style={{ flex: 1, color: "var(--text-secondary)" }}>{l.name}</span>
            <input type="range" min="0.1" max="1" step="0.05" value={l.opacity != null ? l.opacity : 1}
              onChange={(e) => onLayerToggle(l.id, { opacity: parseFloat(e.target.value) })}
              style={{ width: 80 }}/>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", width: 28, textAlign: "right" }}>{Math.round((l.opacity != null ? l.opacity : 1) * 100)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================
// WarningsPanel — full list, jumps to objects (grouped on roof)
// ============================================================
function WarningsPanel({ warnings, onJump, level, roofCheckRunAt }) {
  const isRoof = level && (level.type === "roof" || level.type === "industrial_roof");
  if (!warnings.length) return (
    <>
      {isRoof && (
        <div className="insp-section">
          <div className="callout success">
            <I.CheckCircle size={18}/>
            <div>
              <b style={{ display: "block", marginBottom: 2 }}>Кровля готова к черновому расчёту</b>
              <span style={{ fontSize: 12.5, opacity: 0.9 }}>Замечаний нет</span>
            </div>
          </div>
        </div>
      )}
      <div className="insp-empty"><div><div className="insp-empty-icon"><I.CheckCircle size={22}/></div><p>Замечаний нет — проект чистый.</p></div></div>
    </>
  );
  if (isRoof && window.plGroupRoofWarnings) {
    const status = window.plGetRoofStatus ? window.plGetRoofStatus(warnings, window.plPolygonArea(level.roof?.contour || []) || 0) : null;
    const groups = window.plGroupRoofWarnings(warnings);
    return (
      <>
        {status && (
          <div className="insp-section">
            <div className={`callout ${status.tone === "ok" ? "success" : status.tone === "warn" ? "warn" : ""}`} style={status.tone === "error" ? { background: "#FFF5F5", borderColor: "rgba(220,38,38,0.25)", color: "#7F1D1D" } : null}>
              <I.Info size={18}/>
              <div>
                <b style={{ display: "block", marginBottom: 2 }}>{status.label}</b>
                <span style={{ fontSize: 12.5, opacity: 0.9 }}>{roofCheckRunAt ? `Последняя проверка ${roofCheckRunAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Кликните на замечание — объект выделится"}</span>
              </div>
            </div>
          </div>
        )}
        {Object.entries(groups).filter(([, list]) => list.length > 0).map(([grp, list]) => (
          <div key={grp} className="insp-section">
            <div className="insp-title">{grp} · {list.length}</div>
            <div className="vstack" style={{ gap: 4 }}>
              {list.map((w, i) => (
                <div key={i} className={`warn-line tone-${w.level}`} style={{ cursor: w.targetId ? "pointer" : "default" }}
                  onClick={() => w.targetId && onJump && onJump(w.targetId)}>
                  <span className={`dot tone-${w.level}`}/>
                  <span style={{ flex: 1 }}>{w.text}</span>
                  {w.targetId && <I.ArrowRight size={11} style={{ color: "var(--text-muted)" }}/>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }
  return (
    <div className="insp-section">
      <div className="insp-title">Замечания · {warnings.length}</div>
      <div className="vstack" style={{ gap: 4 }}>
        {warnings.map((w, i) => (
          <div key={i} className={`warn-line tone-${w.level}`} style={{ cursor: w.targetId ? "pointer" : "default" }}
            onClick={() => w.targetId && onJump && onJump(w.targetId)}>
            <span className={`dot tone-${w.level}`}/>
            <span style={{ flex: 1 }}>{w.text}</span>
            {w.targetId && <I.ArrowRight size={11} style={{ color: "var(--text-muted)" }}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Level / no-selection default panel
// ============================================================
function LevelParams({ level, mode, onUpdateLevel, warnings, estimateDraft, onAddParapetByContour, onCreateRoofFromContour, onOpenResultCenter, onOpenKpModal, onOpenExport, projectStatus }) {
  if (!level) return <EmptyParams/>;
  const lt = window.PL_LEVEL_TYPES[level.type] || { label: "Уровень", iconName: "Folder" };
  const Icn = I[lt.iconName] || I.Folder;
  const isRoof = level.type === "roof" || level.type === "industrial_roof";
  const isGarage = level.type === "garage";

  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Активный уровень</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: lt.bg, display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
            <Icn size={18}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{level.name}</div>
            <div className="dim" style={{ fontSize: 11.5 }}>{lt.label} · {level.id}</div>
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field-label">Название</label>
            <input className="input" value={level.name} onChange={(e) => onUpdateLevel({ name: e.target.value })}/>
          </div>
          <div className="field">
            <label className="field-label">Высота</label>
            <div className="input-with-suffix"><input className="input" defaultValue={isRoof ? "0" : "2.80"}/><span className="suffix">м</span></div>
          </div>
        </div>
      </div>

      {!isRoof && (
        <>
          <div className="insp-section">
            <div className="insp-title">Подсказка</div>
            <div className="callout">
              <I.Info size={14}/>
              <div style={{ fontSize: 12.5 }}>
                Зажмите мышь и потяните, чтобы нарисовать стену. <b>W</b> — внешняя, <b>P</b> — перегородка.
                Окна и двери (<b>O</b>/<b>D</b>) — кликом по стене.
              </div>
            </div>
          </div>
          {onCreateRoofFromContour && (
            <div className="insp-section">
              <div className="insp-title">Быстрые действия</div>
              <div className="roof-actions">
                {projectStatus && (
                  <div className={`rc-status-pill tone-${projectStatus.tone}`} style={{ alignSelf: "flex-start", marginBottom: 4 }}>
                    <span className="rc-status-dot"/>{projectStatus.label}
                  </div>
                )}
                {onOpenResultCenter && (
                  <button className="roof-action primary" onClick={onOpenResultCenter}>
                    <I.Sparkles size={14}/> Открыть результат
                    {warnings && warnings.length > 0 && <span className="roof-action-badge">{warnings.length}</span>}
                  </button>
                )}
                {onOpenKpModal && (
                  <button className="roof-action" onClick={onOpenKpModal}>
                    <I.Estimate size={14}/> Сформировать КП
                  </button>
                )}
                <button className="roof-action" onClick={onCreateRoofFromContour}>
                  <I.House size={14}/> Создать кровлю по контуру
                </button>
                {onOpenExport && (
                  <button className="roof-action" onClick={() => onOpenExport("all")}>
                    <I.Download size={14}/> Экспорт PDF
                  </button>
                )}
              </div>
            </div>
          )}
          {isGarage && (
            <div className="insp-section">
              <div className="insp-title">Учёт в смете</div>
              <CheckboxRow checked={true} label="Включить гараж в общую смету"/>
              <CheckboxRow checked={false} label="Считать гараж отдельно"/>
              <CheckboxRow checked={false} label="Отдельная кровля гаража"/>
            </div>
          )}
        </>
      )}

      {warnings && warnings.length > 0 && (
        <div className="insp-section">
          <div className="insp-title">Замечания ({warnings.length})</div>
          <div className="vstack" style={{ gap: 4 }}>
            {warnings.slice(0, 6).map((w, i) => (
              <div key={i} className={`warn-line tone-${w.level}`}>
                <span className={`dot tone-${w.level}`}/>
                <span>{w.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {estimateDraft && estimateDraft.length > 0 && (
        <div className="insp-section">
          <div className="insp-title">Черновая смета · {estimateDraft.length} строк</div>
          <div className="est-table">
            <div className="est-head">
              <span>Позиция</span><span>Кол-во</span><span>Сумма</span>
            </div>
            {estimateDraft.map(r => (
              <div key={r.id} className="est-row" title={`${r.group} · мат. ${fmt(r.mat)} + раб. ${fmt(r.work)}`}>
                <span className="est-name">{r.name}</span>
                <span className="est-qty">{fmt(r.qty)} {r.unit}</span>
                <span className="est-sum">₽ {fmt(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isRoof && (
        <>
          <div className="insp-section">
            <div className="insp-title">Параметры кровли</div>
            <div className="grid-2">
              <div className="field">
                <label className="field-label">Тип</label>
                <select className="select">
                  <option>Плоская промышленная</option>
                  <option>Двускатная</option>
                  <option>Вальмовая</option>
                  <option>Односкатная</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Уклон</label>
                <div className="input-with-suffix"><input className="input" defaultValue={level.roof?.slope || "1.5"}/><span className="suffix">%</span></div>
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label className="field-label">Материал покрытия</label>
                <select className="select">
                  <option>{level.roof?.material || "ПВХ-мембрана Logicroof 1.5мм"}</option>
                  <option>ТПО-мембрана Sintofoil RM</option>
                  <option>Битумно-полимерная мембрана Техноэласт</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Высота парапета</label>
                <div className="input-with-suffix"><input className="input" defaultValue={level.roof?.parapetHeight || "0.5"}/><span className="suffix">м</span></div>
              </div>
              <div className="field">
                <label className="field-label">Запас материала</label>
                <div className="input-with-suffix"><input className="input" defaultValue="10"/><span className="suffix">%</span></div>
              </div>
            </div>
          </div>

          <div className="insp-section">
            <div className="insp-title">Элементы кровли</div>
            <div className="vstack" style={{ gap: 6 }}>
              <CounterRow icon="Aerator"   label="Аэраторы"            count={level.roof?.aerators?.length || 0}/>
              <CounterRow icon="Drain"     label="Водосточные воронки" count={level.roof?.drains?.length || 0}/>
              <CounterRow icon="Partition" label="Сегменты кровли"     count={level.roof?.segments?.length || 0}/>
              <CounterRow icon="Wall"      label="Парапет (отрезков)"  count={level.roof?.parapets?.length || 0}/>
              <CounterRow icon="Opening"   label="Примыкания"          count={level.roof?.junctions?.length || 0}/>
              <CounterRow icon="Door"      label="Инж. выходы"         count={level.roof?.engouts?.length || 0}/>
              <CounterRow icon="ArrowRight"label="Уклоны"              count={level.roof?.slopes?.length || 0}/>
            </div>
            {onAddParapetByContour && (level.roof?.contour?.length || 0) >= 3 && (
              <button className="btn btn-secondary btn-sm" style={{ width: "100%", marginTop: 8, justifyContent: "center" }} onClick={onAddParapetByContour}>
                <I.Plus size={13}/> Создать парапет по контуру
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ============================================================
// RoofDashboard — rich "no selection" view for roof / industrial_roof levels.
// Shows badge, summary KPIs, quick actions (rect roof presets, demo roof,
// parapet by contour, check roof), segments list, warnings preview, estimate.
// ============================================================
const ROOF_RECT_PRESETS = [
  { w: 20, h: 25, area: 500,  label: "20×25" },
  { w: 30, h: 40, area: 1200, label: "30×40" },
  { w: 40, h: 50, area: 2000, label: "40×50" },
  { w: 50, h: 60, area: 3000, label: "50×60" },
];
const ROOF_SEG_STATUS_COLORS = {
  "Готово":            { fg: "#15803D", bg: "#E7F5EC" },
  "В работе":          { fg: "#9A3412", bg: "#FFF1E6" },
  "Требует ремонта":   { fg: "#B45309", bg: "#FFFBEB" },
  "Не обследовано":    { fg: "#4A5365", bg: "#EEF0F3" },
  "Исключить из сметы":{ fg: "#94A3B8", bg: "#F4F6F8" },
};

function RoofDashboard({ level, data, warnings, estimateDraft, onUpdateLevel, onAddParapetByContour, onCreateRectRoof, onApplyDemoRoof, onCheckRoof, onSelectAndFit, roofCheckRunAt, onOpenResultCenter, onOpenKpModal, onOpenExport, projectStatus }) {
  const summary = window.plGetRoofSummary ? window.plGetRoofSummary(data) : null;
  const status = window.plGetRoofStatus ? window.plGetRoofStatus(warnings || [], summary?.area || 0) : null;
  const isIndustrial = level.type === "industrial_roof";
  const [rectW, setRectW] = useStaP(40);
  const [rectH, setRectH] = useStaP(50);
  const [withParapet, setWithParapet] = useStaP(true);
  const [segFilter, setSegFilter] = useStaP("all");
  const segments = data.roof?.segments || [];
  const visibleSegs = segFilter === "all" ? segments : segments.filter(s => (s.status || "Не обследовано") === segFilter);
  const counts = {};
  for (const s of segments) {
    const st = s.status || "Не обследовано";
    counts[st] = (counts[st] || 0) + 1;
  }

  return (
    <>
      {/* Header / Badge */}
      <div className="insp-section">
        <div className="roof-badge">
          <span className="roof-badge-pip"/>
          <span>{isIndustrial ? "Промышленная кровля" : "Кровля"} · 2D-план · расчётный режим</span>
        </div>
        <div className="roof-name-row">
          <input className="input" value={level.name} onChange={(e) => onUpdateLevel({ name: e.target.value })}
            style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)", padding: "8px 10px" }}/>
        </div>
        <div className="roof-kpi-grid">
          <RoofKPI label="Площадь"   value={(summary?.area || 0).toFixed(0)} suffix="м²" tone="primary"/>
          <RoofKPI label="Периметр"  value={(summary?.perimeter || 0).toFixed(0)} suffix="м"/>
          <RoofKPI label="Парапет"   value={(summary?.parapetLen || 0).toFixed(0)} suffix="м.п."/>
          <RoofKPI label="Сегменты"  value={summary?.segmentsCount || 0}/>
          <RoofKPI label="Аэраторы"  value={summary?.aeratorsCount || 0}/>
          <RoofKPI label="Воронки"   value={summary?.drainsCount || 0}/>
          <RoofKPI label="Уклоны"    value={summary?.slopesCount || 0}/>
          <RoofKPI label="Примык."   value={(summary?.junctionLen || 0).toFixed(0)} suffix="м.п."/>
          <RoofKPI label="Инж.выходы"value={summary?.engoutsCount || 0}/>
        </div>
        {status && (
          <div className={`roof-status roof-status-${status.tone}`}>
            {status.tone === "ok" ? <I.CheckCircle size={14}/> : <I.Info size={14}/>}
            <span style={{ flex: 1 }}>{status.label}</span>
            {warnings?.length > 0 && <span className="roof-status-count">{warnings.length}</span>}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="insp-section">
        <div className="insp-title">Быстрые действия</div>
        <div className="roof-actions">
          {onOpenResultCenter && (
            <button className="roof-action primary" onClick={onOpenResultCenter}>
              <I.Sparkles size={14}/> Открыть результат
              {warnings?.length > 0 && <span className="roof-action-badge">{warnings.length}</span>}
            </button>
          )}
          {onOpenKpModal && (
            <button className="roof-action" onClick={onOpenKpModal}>
              <I.Estimate size={14}/> Сформировать КП по кровле
            </button>
          )}
          <button className="roof-action" onClick={onCheckRoof}>
            <I.CheckCircle size={14}/> Проверить кровлю
            {warnings?.length > 0 && <span className="roof-action-badge">{warnings.length}</span>}
          </button>
          <button className="roof-action" onClick={onAddParapetByContour} disabled={!summary || summary.contourPts < 3} title={summary?.contourPts >= 3 ? "" : "Сначала обведите контур"}>
            <I.Wall size={14}/> Парапет по контуру
          </button>
          <button className="roof-action" onClick={onApplyDemoRoof}>
            <I.Sparkles size={14}/> Демо: кровля 2000 м²
          </button>
          {onOpenExport && (
            <button className="roof-action" onClick={() => onOpenExport("roof")}>
              <I.Download size={14}/> Экспорт кровельной карты
            </button>
          )}
        </div>
      </div>

      {/* Rectangular roof builder */}
      <div className="insp-section">
        <div className="insp-title">Прямоугольная кровля</div>
        <div className="roof-rect-presets">
          {ROOF_RECT_PRESETS.map(p => {
            const active = rectW === p.w && rectH === p.h;
            return (
              <button key={p.label} className={`roof-rect-preset ${active ? "active" : ""}`}
                onClick={() => { setRectW(p.w); setRectH(p.h); }}>
                <span className="rrp-label">{p.label}</span>
                <span className="rrp-area">{p.area} м²</span>
              </button>
            );
          })}
        </div>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <div className="field">
            <label className="field-label">Ширина</label>
            <div className="input-with-suffix"><input className="input" type="number" min="3" step="0.5" value={rectW} onChange={(e) => setRectW(Math.max(3, parseFloat(e.target.value) || 0))}/><span className="suffix">м</span></div>
          </div>
          <div className="field">
            <label className="field-label">Длина</label>
            <div className="input-with-suffix"><input className="input" type="number" min="3" step="0.5" value={rectH} onChange={(e) => setRectH(Math.max(3, parseFloat(e.target.value) || 0))}/><span className="suffix">м</span></div>
          </div>
        </div>
        <label className="roof-checkbox-line" onClick={() => setWithParapet(v => !v)}>
          <span className="roof-checkbox-box" data-on={withParapet ? "1" : "0"}>{withParapet && <I.Check size={11} stroke={3}/>}</span>
          Сразу создать парапет по контуру
        </label>
        <button className="btn btn-accent btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          onClick={() => onCreateRectRoof && onCreateRectRoof(rectW, rectH, withParapet)}>
          <I.Plus size={13}/> Создать кровлю {rectW}×{rectH} ({(rectW*rectH).toFixed(0)} м²)
        </button>
      </div>

      {/* Segments list */}
      {segments.length > 0 && (
        <div className="insp-section">
          <div className="insp-title">Сегменты · {segments.length}</div>
          <div className="roof-seg-filter">
            <button className={`rsf ${segFilter === "all" ? "active" : ""}`} onClick={() => setSegFilter("all")}>Все · {segments.length}</button>
            {Object.entries(counts).slice(0, 3).map(([st, n]) => (
              <button key={st} className={`rsf ${segFilter === st ? "active" : ""}`} onClick={() => setSegFilter(st)}>{st} · {n}</button>
            ))}
          </div>
          <div className="vstack" style={{ gap: 4, marginTop: 8 }}>
            {visibleSegs.map(seg => {
              const st = seg.status || "Не обследовано";
              const colors = ROOF_SEG_STATUS_COLORS[st] || ROOF_SEG_STATUS_COLORS["Не обследовано"];
              const area = (seg.w * seg.h).toFixed(1);
              return (
                <button key={seg.id} className="roof-seg-row" onClick={() => onSelectAndFit && onSelectAndFit(seg.id)}>
                  <span className="rsr-name">{seg.name || seg.id}</span>
                  <span className="rsr-area">{area} м²</span>
                  <span className="rsr-status" style={{ color: colors.fg, background: colors.bg }}>{st}</span>
                </button>
              );
            })}
            {visibleSegs.length === 0 && (
              <div className="dim" style={{ fontSize: 12, padding: "8px 0" }}>Нет сегментов с этим статусом</div>
            )}
          </div>
        </div>
      )}

      {/* Roof params */}
      <div className="insp-section">
        <div className="insp-title">Параметры кровли</div>
        <div className="grid-2">
          <div className="field">
            <label className="field-label">Тип</label>
            <select className="select" defaultValue={isIndustrial ? "Плоская промышленная" : "Двускатная"}>
              <option>Плоская промышленная</option>
              <option>Двускатная</option>
              <option>Вальмовая</option>
              <option>Односкатная</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Уклон</label>
            <div className="input-with-suffix"><input className="input" defaultValue={summary?.slope ?? "1.5"}/><span className="suffix">%</span></div>
          </div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label className="field-label">Материал покрытия</label>
            <select className="select" defaultValue={summary?.material || ""}>
              <option>{summary?.material || "ПВХ-мембрана Logicroof 1.5мм"}</option>
              <option>ТПО-мембрана Sintofoil RM</option>
              <option>Битумно-полимерная мембрана Техноэласт</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Высота парапета</label>
            <div className="input-with-suffix"><input className="input" defaultValue={summary?.parapetHeight ?? "0.5"}/><span className="suffix">м</span></div>
          </div>
          <div className="field">
            <label className="field-label">Запас материала</label>
            <div className="input-with-suffix"><input className="input" defaultValue="10"/><span className="suffix">%</span></div>
          </div>
        </div>
      </div>

      {/* Warnings preview */}
      {warnings && warnings.length > 0 && (
        <div className="insp-section">
          <div className="insp-title">Замечания ({warnings.length})</div>
          <div className="vstack" style={{ gap: 4 }}>
            {warnings.slice(0, 5).map((w, i) => (
              <div key={i} className={`warn-line tone-${w.level}`} style={{ cursor: w.targetId ? "pointer" : "default" }}
                onClick={() => w.targetId && onSelectAndFit && onSelectAndFit(w.targetId)}>
                <span className={`dot tone-${w.level}`}/>
                <span style={{ flex: 1 }}>{w.text}</span>
              </div>
            ))}
            {warnings.length > 5 && (
              <div className="dim" style={{ fontSize: 11.5, padding: "4px 0" }}>и ещё {warnings.length - 5}…</div>
            )}
          </div>
        </div>
      )}

      {/* Estimate draft */}
      {estimateDraft && estimateDraft.length > 0 && (
        <div className="insp-section">
          <div className="insp-title">Черновик сметы · {estimateDraft.length} строк</div>
          <div className="est-table">
            <div className="est-head"><span>Позиция</span><span>Кол-во</span><span>Сумма</span></div>
            {estimateDraft.map(r => (
              <div key={r.id} className="est-row" title={`${r.group} · мат. ${fmt(r.mat)} + раб. ${fmt(r.work)}`}>
                <span className="est-name">{r.name}</span>
                <span className="est-qty">{fmt(r.qty)} {r.unit}</span>
                <span className="est-sum">₽ {fmt(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RoofKPI({ label, value, suffix, tone }) {
  return (
    <div className={`roof-kpi ${tone === "primary" ? "is-primary" : ""}`}>
      <div className="rk-label">{label}</div>
      <div className="rk-value">
        <span>{value}</span>
        {suffix && <span className="rk-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function CheckboxRow({ checked, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13, cursor: "pointer" }}>
      <span style={{
        width: 16, height: 16, borderRadius: 4,
        background: checked ? "var(--primary)" : "var(--surface)",
        border: `1.5px solid ${checked ? "var(--primary)" : "var(--border-strong)"}`,
        display: "grid", placeItems: "center", color: "#fff", flexShrink: 0
      }}>
        {checked && <I.Check size={11} stroke={3}/>}
      </span>
      {label}
    </label>
  );
}

function CounterRow({ icon, label, count, unit }) {
  const Icn = I[icon] || I.Room;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "1px solid var(--border-soft)", borderRadius: 6, background: "var(--surface-2)" }}>
      <Icn size={14} stroke={1.6} style={{ color: "var(--text-secondary)" }}/>
      <span style={{ flex: 1, fontSize: 12.5 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{count}</span>
      {unit && <span className="dim" style={{ fontSize: 11 }}>{unit}</span>}
    </div>
  );
}

function EmptyParams() {
  return (
    <div className="insp-empty">
      <div>
        <div className="insp-empty-icon"><I.Ruler size={22}/></div>
        <p>Выберите элемент на плане или используйте инструмент <b>«Стена»</b>, чтобы нарисовать новую.</p>
      </div>
    </div>
  );
}

function ParamsForSelection({ selected, walls, layers, mode, onUpdateWallLen, onUpdateWallType, onUpdateRoom, onUpdateWindow, onUpdateDoor, onPatchObject, onDuplicateSelected, onDeleteSelected }) {
  const k = window.plClassifyObject ? window.plClassifyObject(selected) : null;
  const onLayerChange = (lid) => onPatchObject && onPatchObject(selected.id, { layerId: lid });

  if (k === "aerator") return <AeratorParams a={selected} layers={layers} onLayerChange={onLayerChange} onPatch={(p) => onPatchObject(selected.id, p)} onDuplicate={onDuplicateSelected} onDelete={onDeleteSelected}/>;
  if (k === "drain")   return <DrainParams d={selected} layers={layers} onLayerChange={onLayerChange} onPatch={(p) => onPatchObject(selected.id, p)} onDuplicate={onDuplicateSelected} onDelete={onDeleteSelected}/>;
  if (k === "slope")   return <SlopeParams s={selected} onPatch={(p) => onPatchObject(selected.id, p)} onDelete={onDeleteSelected}/>;
  if (k === "segment") return <SegmentParams seg={selected} layers={layers} onLayerChange={onLayerChange} onPatch={(p) => onPatchObject(selected.id, p)} onDuplicate={onDuplicateSelected} onDelete={onDeleteSelected}/>;
  if (k === "parapet") return <ParapetParams p={selected} onPatch={(pp) => onPatchObject(selected.id, pp)} onDelete={onDeleteSelected}/>;
  if (k === "junction")return <JunctionParams j={selected} onPatch={(p) => onPatchObject(selected.id, p)} onDelete={onDeleteSelected}/>;
  if (k === "engout")  return <EngoutParams e={selected} onPatch={(p) => onPatchObject(selected.id, p)} onDelete={onDeleteSelected}/>;
  if (k === "dimension") return <DimensionParams d={selected} onPatch={(p) => onPatchObject(selected.id, p)} onDelete={onDeleteSelected}/>;
  if (k === "note")    return <NoteParams n={selected} onPatch={(p) => onPatchObject(selected.id, p)} onDelete={onDeleteSelected}/>;
  if (k === "wall_external" || k === "wall_internal")
    return <WallParams w={selected} onUpdateWallLen={onUpdateWallLen} onUpdateWallType={onUpdateWallType} onPatch={(p) => onPatchObject(selected.id, p)} onDuplicate={onDuplicateSelected} onDelete={onDeleteSelected}/>;
  if (k === "window")  return <WindowParams w={selected} walls={walls} onUpdateWindow={onUpdateWindow} onPatch={(p) => onPatchObject(selected.id, p)} onDuplicate={onDuplicateSelected} onDelete={onDeleteSelected}/>;
  if (k === "opening") return <OpeningParams o={selected} walls={walls} onPatch={(p) => onPatchObject(selected.id, p)} onDelete={onDeleteSelected}/>;
  if (k === "door")    return <DoorParams d={selected} onUpdateDoor={onUpdateDoor} onPatch={(p) => onPatchObject(selected.id, p)} onDuplicate={onDuplicateSelected} onDelete={onDeleteSelected}/>;
  if (k === "room")    return <RoomParams r={selected} onUpdateRoom={onUpdateRoom} onPatch={(p) => onPatchObject(selected.id, p)} onDuplicate={onDuplicateSelected} onDelete={onDeleteSelected}/>;
  return <EmptyParams/>;
}

// ============================================================
// Multi-select inspector
// ============================================================
function MultiSelectParams({ selectedObjects, layers, onPatchObject, onDuplicateSelected, onDeleteSelected }) {
  const types = {};
  for (const { kind } of selectedObjects) types[kind] = (types[kind] || 0) + 1;
  const KIND_LABELS = {
    wall_external: "Внешн. стена", wall_internal: "Перегородка",
    window: "Окно", door: "Дверь", opening: "Проём", room: "Помещение",
    dimension: "Размер", note: "Заметка",
    segment: "Сегмент", slope: "Уклон", aerator: "Аэратор", drain: "Воронка",
    parapet: "Парапет", junction: "Примыкание", engout: "Инж. выход",
  };
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Выбрано · {selectedObjects.length} элементов</div>
        <div className="vstack" style={{ gap: 4 }}>
          {Object.entries(types).map(([k, n]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 8px", background: "var(--surface-2)", borderRadius: 4 }}>
              <span style={{ color: "var(--text-secondary)" }}>{KIND_LABELS[k] || k}</span>
              <span style={{ fontWeight: 600 }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="insp-section">
        <div className="insp-title">Групповые действия</div>
        <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 6, justifyContent: "center" }} onClick={() => {
          selectedObjects.forEach(({ obj }) => onPatchObject(obj.id, { includeInEstimate: true }));
        }}><I.Check size={13}/> Включить в смету</button>
        <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 6, justifyContent: "center" }} onClick={() => {
          selectedObjects.forEach(({ obj }) => onPatchObject(obj.id, { includeInEstimate: false }));
        }}><I.Close size={13}/> Исключить из сметы</button>
        <div className="field" style={{ marginTop: 8 }}>
          <label className="field-label">Переместить на слой</label>
          <select className="select" defaultValue="" onChange={(e) => {
            if (!e.target.value) return;
            selectedObjects.forEach(({ obj }) => onPatchObject(obj.id, { layerId: e.target.value }));
            e.target.value = "";
          }}>
            <option value="">— выбрать слой —</option>
            {(layers || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>
      <div className="insp-section" style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={onDuplicateSelected}><I.Copy size={13}/> Дублировать</button>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center", color: "#DC2626" }} onClick={onDeleteSelected}><I.Trash size={13}/> Удалить</button>
      </div>
    </>
  );
}

// ----- helpers for controlled numeric fields -----
function NumberField({ label, value, suffix, onChange, disabled, step = 0.1 }) {
  const [local, setLocal] = useStaP(String(value));
  useStaPEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="input-with-suffix">
        <input className="input" type="number" step={step} value={local}
          disabled={disabled}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { const v = parseFloat(local); if (!isNaN(v) && onChange) onChange(v); else setLocal(String(value)); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        />
        <span className="suffix">{suffix}</span>
      </div>
    </div>
  );
}
function TextField({ label, value, onChange }) {
  const [local, setLocal] = useStaP(value || "");
  useStaPEffect(() => { setLocal(value || ""); }, [value]);
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input className="input" value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange && onChange(local)}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      />
    </div>
  );
}
function SelectField({ label, value, options, onChange }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <select className="select" value={value || ""} onChange={(e) => onChange && onChange(e.target.value)}>
        {options.map(o => typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
const useStaPEffect = React.useEffect;
function DeleteBlock({ onDuplicate, onDelete }) {
  if (!onDelete && !onDuplicate) return null;
  return (
    <div className="insp-section" style={{ display: "flex", gap: 6 }}>
      {onDuplicate && <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={onDuplicate}><I.Copy size={13}/> Дублировать</button>}
      {onDelete && <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center", color: "#DC2626" }} onClick={onDelete}><I.Trash size={13}/> Удалить</button>}
    </div>
  );
}

function LayerSelect({ value, layers, onChange }) {
  if (!layers || !layers.length) return null;
  return (
    <SelectField label="Слой" value={value || ""} onChange={onChange}
      options={layers.map(l => ({ value: l.id, label: l.name }))}/>
  );
}
function IncludeRow({ value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13, cursor: "pointer" }}>
      <span style={{
        width: 16, height: 16, borderRadius: 4,
        background: value ? "var(--primary)" : "var(--surface)",
        border: `1.5px solid ${value ? "var(--primary)" : "var(--border-strong)"}`,
        display: "grid", placeItems: "center", color: "#fff", flexShrink: 0
      }} onClick={() => onChange && onChange(!value)}>
        {value && <I.Check size={11} stroke={3}/>}
      </span>
      <span onClick={() => onChange && onChange(!value)}>Включить в смету</span>
    </label>
  );
}

function WallParams({ w, onUpdateWallLen, onUpdateWallType, onPatch, onDuplicate, onDelete }) {
  const len = wallLen2(w);
  const isExt = w.type === "external";
  const include = w.includeInEstimate !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Тип элемента</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: isExt ? "var(--wall-external)" : "var(--wall-internal)", flexShrink: 0 }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{isExt ? "Внешняя стена" : "Перегородка"}</div>
            <div className="dim" style={{ fontSize: 11.5 }}>{w.id}</div>
          </div>
        </div>
        <div className="seg-control" style={{ marginBottom: 10 }}>
          <button className={isExt ? "active" : ""} onClick={() => onUpdateWallType && onUpdateWallType("external")}>Внешняя</button>
          <button className={!isExt ? "active" : ""} onClick={() => onUpdateWallType && onUpdateWallType("internal")}>Перегородка</button>
        </div>
        <div className="grid-2">
          <NumberField label="Длина" value={+len.toFixed(2)} suffix="м" onChange={onUpdateWallLen}/>
          <NumberField label="Высота" value={2.80} suffix="м"/>
          <NumberField label="Толщина" value={isExt ? 0.40 : 0.12} suffix="м" step={0.01}/>
          <NumberField label="Площадь" value={+(len * 2.8).toFixed(2)} suffix="м²" disabled/>
        </div>
      </div>
      <div className="insp-section">
        <div className="insp-title">Материал и цены</div>
        <SelectField label="Материал" value="" options={isExt
          ? ["Газобетон D500, 400мм", "Кирпич керамический, 380мм", "Брус клеёный, 200мм"]
          : ["Гипсокартон на каркасе, 120мм", "Газобетон D500, 100мм"]}/>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <NumberField label="Материал, ₽/м" value={isExt ? 4800 : 1600} suffix="₽" step={100}/>
          <NumberField label="Работы, ₽/м" value={isExt ? 2200 : 1100} suffix="₽" step={100}/>
        </div>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDuplicate={onDuplicate} onDelete={onDelete}/>
    </>
  );
}

function WindowParams({ w, walls, onUpdateWindow, onPatch, onDuplicate, onDelete }) {
  const wall = walls.find(x => x.id === w.on);
  const width = w.b - w.a;
  const include = w.includeInEstimate !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Тип элемента</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--window)", display: "grid", placeItems: "center", color: "#fff" }}><I.Window size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>Окно</div><div className="dim" style={{ fontSize: 11.5 }}>На стене {wall?.id}</div></div>
        </div>
        <div className="grid-2">
          <NumberField label="Ширина" value={+width.toFixed(2)} suffix="м" onChange={(v) => onUpdateWindow && onUpdateWindow({ b: w.a + Math.max(0.4, v) })}/>
          <NumberField label="Высота" value={w.height || 1.50} suffix="м" onChange={(v) => onPatch && onPatch({ height: v })}/>
          <NumberField label="Смещение" value={+w.a.toFixed(2)} suffix="м" onChange={(v) => onUpdateWindow && onUpdateWindow({ a: v, b: v + width })}/>
        </div>
      </div>
      <div className="insp-section">
        <SelectField label="Профиль" value="" options={["REHAU Blitz 60, 2-камерное", "VEKA Softline 70"]}/>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <NumberField label="Цена" value={18000} suffix="₽" step={500}/>
          <NumberField label="Монтаж" value={4500} suffix="₽" step={100}/>
        </div>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDuplicate={onDuplicate} onDelete={onDelete}/>
    </>
  );
}

function DoorParams({ d, onUpdateDoor, onPatch, onDuplicate, onDelete }) {
  const isGate = d.gate;
  const kind = isGate ? "gate" : d.front ? "front" : d.tech ? "tech" : "interior";
  const include = d.includeInEstimate !== false;
  const width = d.b - d.a;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Тип элемента</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: isGate ? "#7C2D12" : d.front ? "var(--accent)" : "var(--surface-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: (isGate || d.front) ? "#fff" : "var(--text-secondary)" }}><I.Door size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>{isGate ? "Ворота" : d.front ? "Входная дверь" : d.tech ? "Тех. дверь" : "Межкомнатная дверь"}</div><div className="dim" style={{ fontSize: 11.5 }}>{d.id} · откр. {d.swing === "out" ? "наружу" : "внутрь"}</div></div>
        </div>
        <div className="seg-control" style={{ marginBottom: 10, flexWrap: "wrap" }}>
          <button className={kind === "interior" ? "active" : ""} onClick={() => onUpdateDoor && onUpdateDoor({ gate: false, front: false, tech: false })}>Межком.</button>
          <button className={kind === "front" ? "active" : ""} onClick={() => onUpdateDoor && onUpdateDoor({ gate: false, front: true, tech: false })}>Входная</button>
          <button className={kind === "tech" ? "active" : ""} onClick={() => onUpdateDoor && onUpdateDoor({ gate: false, front: false, tech: true })}>Тех.</button>
          <button className={kind === "gate" ? "active" : ""} onClick={() => {
            // Switching to gate: set wider default width if currently narrow
            if (width < 2.5) onUpdateDoor && onUpdateDoor({ gate: true, front: true, b: d.a + 3.0 });
            else onUpdateDoor && onUpdateDoor({ gate: true, front: true });
          }}>Ворота</button>
        </div>
        <div className="grid-2">
          <NumberField label="Ширина" value={+width.toFixed(2)} suffix="м" onChange={(v) => onUpdateDoor && onUpdateDoor({ b: d.a + Math.max(0.4, v) })}/>
          <NumberField label="Высота" value={isGate ? 2.50 : 2.10} suffix="м"/>
          <NumberField label="Смещение" value={+d.a.toFixed(2)} suffix="м" onChange={(v) => onUpdateDoor && onUpdateDoor({ a: v, b: v + width })}/>
          <SelectField label="Открывание" value={d.swing || "in"} options={[{value:"in",label:"Внутрь"},{value:"out",label:"Наружу"}]} onChange={(v) => onUpdateDoor && onUpdateDoor({ swing: v })}/>
        </div>
      </div>
      <div className="insp-section">
        <SelectField label="Модель" value="" options={isGate
          ? ["Секционные DoorHan RSD01", "Откатные Alutech"]
          : d.front ? ["Torex Super OMEGA 11"]
          : ["Софья 1.06 · экошпон", "Bravo Porta 23X"]}/>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDuplicate={onDuplicate} onDelete={onDelete}/>
    </>
  );
}

function OpeningParams({ o, walls, onPatch, onDelete }) {
  const wall = walls.find(x => x.id === o.on);
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Тип элемента</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center" }}><I.Opening size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>Проём (без двери)</div><div className="dim" style={{ fontSize: 11.5 }}>На стене {wall?.id}</div></div>
        </div>
        <div className="grid-2">
          <NumberField label="Ширина" value={+(o.b - o.a).toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ b: o.a + Math.max(0.4, v) })}/>
          <NumberField label="Высота" value={o.height || 2.10} suffix="м" onChange={(v) => onPatch && onPatch({ height: v })}/>
        </div>
      </div>
      <DeleteBlock onDelete={onDelete}/>
    </>
  );
}

function RoomParams({ r, onUpdateRoom, onPatch, onDuplicate, onDelete }) {
  const area = +(r.w * r.h).toFixed(1);
  const perimeter = +(2 * (r.w + r.h)).toFixed(1);
  const include = r.includeInEstimate !== false;
  const ROOM_TYPES = window.PL_ROOM_TYPES || ["Жилая","Кухня","Санузел","Коридор","Тех. помещение","Гараж","Склад"];
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Помещение</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: r.color, display: "grid", placeItems: "center" }}><I.Room size={16}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
            <div className="dim" style={{ fontSize: 11.5 }}>{area} м² · {perimeter} м</div>
          </div>
        </div>
        <TextField label="Название" value={r.name} onChange={(v) => onUpdateRoom && onUpdateRoom({ name: v })}/>
        <SelectField label="Тип помещения" value={r.roomType || "Жилая"}
          onChange={(v) => onUpdateRoom && onUpdateRoom({ roomType: v })}
          options={ROOM_TYPES}/>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <NumberField label="Ширина" value={+r.w.toFixed(2)} suffix="м" onChange={(v) => onUpdateRoom && onUpdateRoom({ w: Math.max(0.3, v) })}/>
          <NumberField label="Длина" value={+r.h.toFixed(2)} suffix="м" onChange={(v) => onUpdateRoom && onUpdateRoom({ h: Math.max(0.3, v) })}/>
          <NumberField label="Площадь" value={area} suffix="м²" disabled/>
          <NumberField label="Периметр" value={perimeter} suffix="м" disabled/>
          <NumberField label="Высота" value={r.height || 2.80} suffix="м" onChange={(v) => onUpdateRoom && onUpdateRoom({ height: v })}/>
          <NumberField label="X" value={+r.x.toFixed(2)} suffix="м" onChange={(v) => onUpdateRoom && onUpdateRoom({ x: v })}/>
        </div>
      </div>
      <div className="insp-section">
        <div className="insp-title">Отделка</div>
        <SelectField label="Пол" value={r.floorMat || ""} options={["Ламинат 33 класс", "Керамогранит", "Наливной"]} onChange={(v) => onUpdateRoom && onUpdateRoom({ floorMat: v })}/>
        <div style={{ height: 8 }}/>
        <SelectField label="Стены" value={r.wallMat || ""} options={["Покраска под обои", "Декоративная штукатурка", "Плитка"]} onChange={(v) => onUpdateRoom && onUpdateRoom({ wallMat: v })}/>
        <div style={{ height: 8 }}/>
        <SelectField label="Потолок" value={r.ceilMat || ""} options={["Натяжной матовый", "Гипсокартон + покраска"]} onChange={(v) => onUpdateRoom && onUpdateRoom({ ceilMat: v })}/>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onUpdateRoom && onUpdateRoom({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDuplicate={onDuplicate} onDelete={onDelete}/>
    </>
  );
}

const ROOF_ELEM_STATUS = ["Запланирован", "Установлен", "Заменить", "Исключить"];

function AeratorParams({ a, layers, onLayerChange, onPatch, onDuplicate, onDelete }) {
  const include = a.includeInEstimate !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Аэратор</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}><I.Aerator size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>Кровельный аэратор</div><div className="dim" style={{ fontSize: 11.5 }}>{a.id}</div></div>
        </div>
        <SelectField label="Тип" value={a.aeratorType || "Wirplast K-3"} onChange={(v) => onPatch && onPatch({ aeratorType: v })} options={["Wirplast K-3", "Vilpe Alipai 110", "Технониколь КТВ"]}/>
        <div style={{ height: 8 }}/>
        <SelectField label="Статус" value={a.status || "Запланирован"} onChange={(v) => onPatch && onPatch({ status: v })} options={ROOF_ELEM_STATUS}/>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <NumberField label="Диаметр" value={a.diameter || 110} suffix="мм" step={10} onChange={(v) => onPatch && onPatch({ diameter: v })}/>
          <TextField label="Зона" value={a.zone || ""} onChange={(v) => onPatch && onPatch({ zone: v })}/>
          <NumberField label="X" value={+a.x.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ x: v })}/>
          <NumberField label="Y" value={+a.y.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ y: v })}/>
        </div>
        <div style={{ marginTop: 8 }}>
          <TextField label="Комментарий" value={a.comment || ""} onChange={(v) => onPatch && onPatch({ comment: v })}/>
        </div>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDuplicate={onDuplicate} onDelete={onDelete}/>
    </>
  );
}

function DrainParams({ d, layers, onLayerChange, onPatch, onDuplicate, onDelete }) {
  const include = d.includeInEstimate !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Водосточная воронка</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(8,145,178,0.15)", color: "#0891B2", display: "grid", placeItems: "center" }}><I.Drain size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>Воронка кровельная</div><div className="dim" style={{ fontSize: 11.5 }}>{d.id}</div></div>
        </div>
        <SelectField label="Тип" value={d.drainType || "HL62.1"} onChange={(v) => onPatch && onPatch({ drainType: v })} options={["HL62.1 с обогревом", "TopWet TWE 110", "Технониколь Smart"]}/>
        <div style={{ height: 8 }}/>
        <SelectField label="Статус" value={d.status || "Запланирован"} onChange={(v) => onPatch && onPatch({ status: v })} options={ROOF_ELEM_STATUS}/>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <NumberField label="Диаметр" value={d.diameter || 110} suffix="мм" step={10} onChange={(v) => onPatch && onPatch({ diameter: v })}/>
          <NumberField label="Пропускная сп." value={d.capacity || 4.5} suffix="л/с" step={0.5} onChange={(v) => onPatch && onPatch({ capacity: v })}/>
          <TextField label="Зона водоотвода" value={d.zone || ""} onChange={(v) => onPatch && onPatch({ zone: v })}/>
        </div>
        <div style={{ marginTop: 8 }}>
          <TextField label="Комментарий" value={d.comment || ""} onChange={(v) => onPatch && onPatch({ comment: v })}/>
        </div>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDuplicate={onDuplicate} onDelete={onDelete}/>
    </>
  );
}

function SlopeParams({ s, onPatch, onDelete }) {
  const percent = s.percent != null ? s.percent : parseFloat((s.label || "1.5").toString().replace("%","")) || 1.5;
  const len = +Math.hypot(s.x2 - s.x1, s.y2 - s.y1).toFixed(2);
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Уклон</div>
        <div className="grid-2">
          <NumberField label="Уклон, %" value={percent} suffix="%" step={0.1} onChange={(v) => onPatch && onPatch({ percent: v, label: `${v}%` })}/>
          <NumberField label="Длина" value={len} suffix="м" disabled/>
          <TextField label="Привязать к сегменту" value={s.segmentId || ""} onChange={(v) => onPatch && onPatch({ segmentId: v })}/>
          <TextField label="Подпись" value={s.label || `${percent}%`} onChange={(v) => onPatch && onPatch({ label: v })}/>
        </div>
        <div style={{ marginTop: 8 }}>
          <TextField label="Комментарий" value={s.comment || ""} onChange={(v) => onPatch && onPatch({ comment: v })}/>
        </div>
      </div>
      <DeleteBlock onDelete={onDelete}/>
    </>
  );
}

// ============================================================
// NEW: Segment / Parapet / Junction / Engout / Dimension / Note
// ============================================================
const ROOF_SEG_STATUS = ["Не обследовано", "Требует ремонта", "В работе", "Готово", "Исключить из сметы"];

function SegmentParams({ seg, layers, onLayerChange, onPatch, onDuplicate, onDelete }) {
  const area = +(seg.w * seg.h).toFixed(1);
  const include = seg.includeInEstimate !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Сегмент кровли</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(124,58,237,0.12)", color: "#7C3AED", display: "grid", placeItems: "center" }}><I.Partition size={16}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{seg.name || seg.id}</div>
            <div className="dim" style={{ fontSize: 11.5 }}>{area} м²</div>
          </div>
        </div>
        <TextField label="Название" value={seg.name || ""} onChange={(v) => onPatch && onPatch({ name: v })}/>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <NumberField label="X" value={+seg.x.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ x: v })}/>
          <NumberField label="Y" value={+seg.y.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ y: v })}/>
          <NumberField label="Ширина" value={+seg.w.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ w: Math.max(0.3, v) })}/>
          <NumberField label="Длина"   value={+seg.h.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ h: Math.max(0.3, v) })}/>
          <NumberField label="Площадь" value={area} suffix="м²" disabled/>
          <NumberField label="Уклон"   value={seg.slope || 1.5} suffix="%" step={0.1} onChange={(v) => onPatch && onPatch({ slope: v })}/>
        </div>
        <div style={{ marginTop: 8 }}>
          <SelectField label="Материал" value={seg.material || ""}
            onChange={(v) => onPatch && onPatch({ material: v })}
            options={["ПВХ-мембрана Logicroof 1.5мм", "ТПО-мембрана Sintofoil RM", "Битумно-полимерная мембрана"]}/>
          <div style={{ height: 8 }}/>
          <SelectField label="Статус" value={seg.status || "Не обследовано"} options={ROOF_SEG_STATUS} onChange={(v) => onPatch && onPatch({ status: v })}/>
          <div style={{ height: 8 }}/>
          <TextField label="Комментарий" value={seg.comment || ""} onChange={(v) => onPatch && onPatch({ comment: v })}/>
        </div>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDuplicate={onDuplicate} onDelete={onDelete}/>
    </>
  );
}

function ParapetParams({ p, onPatch, onDelete }) {
  const len = +Math.hypot(p.x2 - p.x1, p.y2 - p.y1).toFixed(2);
  const include = p.includeInEstimate !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Парапет</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(124,45,18,0.12)", color: "#7C2D12", display: "grid", placeItems: "center" }}><I.Wall size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>Парапет</div><div className="dim" style={{ fontSize: 11.5 }}>{p.id} · {len} м</div></div>
        </div>
        <div className="grid-2">
          <NumberField label="Длина" value={len} suffix="м" disabled/>
          <NumberField label="Высота" value={p.height || 0.5} suffix="м" step={0.05} onChange={(v) => onPatch && onPatch({ height: v })}/>
        </div>
        <div style={{ marginTop: 8 }}>
          <SelectField label="Материал" value={p.material || ""}
            onChange={(v) => onPatch && onPatch({ material: v })}
            options={["Парапет металлический", "Бетонный с фартуком", "Кирпичный + фартук"]}/>
          <div style={{ height: 8 }}/>
          <SelectField label="Узел" value={p.nodeType || "стандарт"} onChange={(v) => onPatch && onPatch({ nodeType: v })} options={["стандарт", "усиленный", "с компенсатором"]}/>
        </div>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDelete={onDelete}/>
    </>
  );
}

function JunctionParams({ j, onPatch, onDelete }) {
  const len = +Math.hypot(j.x2 - j.x1, j.y2 - j.y1).toFixed(2);
  const TYPES = window.PL_JUNCTION_TYPES || ["к стене"];
  const include = j.includeInEstimate !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Примыкание</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(154,52,18,0.12)", color: "#9A3412", display: "grid", placeItems: "center" }}><I.Opening size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>Узел примыкания</div><div className="dim" style={{ fontSize: 11.5 }}>{j.id} · {len} м</div></div>
        </div>
        <div className="grid-2">
          <NumberField label="Длина" value={len} suffix="м" disabled/>
          <NumberField label="Высота" value={j.height || 0.3} suffix="м" step={0.05} onChange={(v) => onPatch && onPatch({ height: v })}/>
        </div>
        <div style={{ marginTop: 8 }}>
          <SelectField label="Тип примыкания" value={j.junctionType || "к стене"} options={TYPES} onChange={(v) => onPatch && onPatch({ junctionType: v })}/>
          <div style={{ height: 8 }}/>
          <SelectField label="Материал" value={j.material || ""}
            onChange={(v) => onPatch && onPatch({ material: v })}
            options={["Узел примыкания", "Мастика + армирование", "Фартук оцинк."]}/>
          <div style={{ height: 8 }}/>
          <TextField label="Комментарий" value={j.comment || ""} onChange={(v) => onPatch && onPatch({ comment: v })}/>
        </div>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDelete={onDelete}/>
    </>
  );
}

function EngoutParams({ e, onPatch, onDelete }) {
  const TYPES = window.PL_ENGOUT_TYPES || ["Шахта"];
  const include = e.includeInEstimate !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Инженерный выход</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(74,83,101,0.12)", color: "#4A5365", display: "grid", placeItems: "center" }}><I.Door size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>{e.engoutType || "Узел"}</div><div className="dim" style={{ fontSize: 11.5 }}>{e.id}</div></div>
        </div>
        <SelectField label="Тип" value={e.engoutType || TYPES[0]} options={TYPES} onChange={(v) => onPatch && onPatch({ engoutType: v })}/>
        <div style={{ height: 8 }}/>
        <SelectField label="Статус" value={e.status || "Запланирован"} onChange={(v) => onPatch && onPatch({ status: v })} options={ROOF_ELEM_STATUS}/>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <NumberField label="Ширина" value={e.width || 1} suffix="м" step={0.1} onChange={(v) => onPatch && onPatch({ width: v })}/>
          <NumberField label="Длина" value={e.height || 1} suffix="м" step={0.1} onChange={(v) => onPatch && onPatch({ height: v })}/>
          <NumberField label="Диаметр" value={e.diameter || 0} suffix="м" step={0.05} onChange={(v) => onPatch && onPatch({ diameter: v })}/>
          <NumberField label="X" value={+e.x.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ x: v })}/>
        </div>
        <div style={{ marginTop: 8 }}>
          <TextField label="Комментарий" value={e.comment || ""} onChange={(v) => onPatch && onPatch({ comment: v })}/>
        </div>
      </div>
      <div className="insp-section">
        <IncludeRow value={include} onChange={(v) => onPatch && onPatch({ includeInEstimate: v })}/>
      </div>
      <DeleteBlock onDelete={onDelete}/>
    </>
  );
}

function DimensionParams({ d, onPatch, onDelete }) {
  const len = +Math.hypot(d.x2 - d.x1, d.y2 - d.y1).toFixed(3);
  const include = d.includeInExport !== false;
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Размерная линия</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(124,45,18,0.12)", color: "#7C2D12", display: "grid", placeItems: "center" }}><I.Ruler size={16}/></div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>Размер</div><div className="dim" style={{ fontSize: 11.5 }}>{d.id} · {len.toFixed(2)} м</div></div>
        </div>
        <TextField label="Подпись" value={d.label || ""} onChange={(v) => onPatch && onPatch({ label: v })}/>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <NumberField label="Точность" value={d.precision != null ? d.precision : 2} suffix="зн." step={1} onChange={(v) => onPatch && onPatch({ precision: Math.max(0, Math.min(4, Math.round(v))) })}/>
          <NumberField label="Длина" value={len} suffix="м" disabled/>
        </div>
      </div>
      <div className="insp-section">
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13, cursor: "pointer" }}
          onClick={() => onPatch && onPatch({ includeInExport: !include })}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: include ? "var(--primary)" : "var(--surface)", border: `1.5px solid ${include ? "var(--primary)" : "var(--border-strong)"}`, display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>
            {include && <I.Check size={11} stroke={3}/>}
          </span>
          Включить в экспорт
        </label>
      </div>
      <DeleteBlock onDelete={onDelete}/>
    </>
  );
}

function NoteParams({ n, onPatch, onDelete }) {
  const colors = ["#B45309", "#DC2626", "#15803D", "#1E3A8A", "#7C3AED"];
  return (
    <>
      <div className="insp-section">
        <div className="insp-title">Заметка</div>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: n.color || "#B45309", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>N</div>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>{n.author || "Заметка"}</div><div className="dim" style={{ fontSize: 11.5 }}>{n.id}</div></div>
        </div>
        <div className="field">
          <label className="field-label">Текст</label>
          <textarea className="textarea" rows={3} defaultValue={n.text || ""}
            onBlur={(e) => onPatch && onPatch({ text: e.target.value })}
            style={{ resize: "vertical", minHeight: 64 }}/>
        </div>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <NumberField label="X" value={+n.x.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ x: v })}/>
          <NumberField label="Y" value={+n.y.toFixed(2)} suffix="м" onChange={(v) => onPatch && onPatch({ y: v })}/>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label className="field-label">Цвет</label>
          <div style={{ display: "flex", gap: 6 }}>
            {colors.map(c => (
              <button key={c} onClick={() => onPatch && onPatch({ color: c })}
                style={{ width: 24, height: 24, borderRadius: 4, background: c, border: (n.color || "#B45309") === c ? "2px solid var(--text)" : "2px solid transparent" }}/>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <TextField label="Автор" value={n.author || ""} onChange={(v) => onPatch && onPatch({ author: v })}/>
        </div>
      </div>
      <DeleteBlock onDelete={onDelete}/>
    </>
  );
}

// ============================================================
// CalcPanel — Авторасчёт
// ============================================================
function CalcPanel({ stats, level, showResult, onDismiss, onOpenKp, estimateDraft, project, estimateScope, setEstimateScope, onOpenResultCenter, onOpenKpModal, onOpenExport, projectStatus }) {
  const isRoof = level?.type === "roof" || level?.type === "industrial_roof";
  // Multi-level project — compute combined draft
  const hasMulti = project && project.levels && project.levels.length > 1;
  const projectDraft = useMemoP2(() => {
    if (!hasMulti || !window.plGetEstimateDraft) return null;
    const out = [];
    for (const l of project.levels) {
      const d = project.levelsData[l.id]; if (!d) continue;
      const rows = window.plGetEstimateDraft(d, l.type) || [];
      for (const r of rows) out.push({ ...r, id: `${l.id}-${r.id}`, group: `${l.name} · ${r.group}` });
    }
    return out;
  }, [project, hasMulti]);
  const useProjectScope = hasMulti && estimateScope === "project";
  const draft = useProjectScope ? projectDraft : estimateDraft;
  const totalDraft = (draft || []).reduce((s, r) => s + (r.include !== false ? r.total : 0), 0);
  return (
    <>
      {(onOpenResultCenter || onOpenKpModal || onOpenExport) && (
        <div className="insp-section">
          <div className="rc-cta-stack">
            {projectStatus && (
              <div className={`rc-status-pill tone-${projectStatus.tone}`} style={{ alignSelf: "flex-start" }}>
                <span className="rc-status-dot"/>{projectStatus.label}
              </div>
            )}
            {onOpenResultCenter && (
              <button className="btn btn-accent btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={onOpenResultCenter}>
                <I.Sparkles size={13}/> Открыть результат
              </button>
            )}
            <div className="rc-cta-row">
              {onOpenKpModal && <button className="btn btn-ghost btn-sm" onClick={onOpenKpModal}><I.Estimate size={13}/> Сформировать КП</button>}
              {onOpenExport && <button className="btn btn-ghost btn-sm" onClick={() => onOpenExport("estimate")}><I.Download size={13}/> Экспорт PDF</button>}
            </div>
          </div>
        </div>
      )}
      {showResult && (
        <div className="insp-section">
          <div className="callout success">
            <I.CheckCircle size={18}/>
            <div>
              <b style={{ display: "block", marginBottom: 2 }}>Смета рассчитана</b>
              <span style={{ fontSize: 12.5, opacity: 0.9 }}>{isRoof ? "Покрытие · элементы · парапет" : "47 позиций · применён прайс «Июнь 2026»"}</span>
            </div>
            <button onClick={onDismiss} style={{ marginLeft: "auto", color: "inherit", opacity: 0.6 }}><I.Close size={14}/></button>
          </div>
        </div>
      )}
      {hasMulti && (
        <div className="insp-section">
          <div className="seg-control" style={{ marginBottom: 0 }}>
            <button className={estimateScope === "level" ? "active" : ""} onClick={() => setEstimateScope && setEstimateScope("level")}>
              Текущий уровень
            </button>
            <button className={estimateScope === "project" ? "active" : ""} onClick={() => setEstimateScope && setEstimateScope("project")}>
              Весь проект · {project.levels.length}
            </button>
          </div>
        </div>
      )}
      <div className="insp-section">
        <div className="insp-title">Геометрия{useProjectScope ? " · текущий уровень" : ""}</div>
        {isRoof ? (
          <>
            <div className="calc-row"><span className="label">Площадь кровли</span><span className="value">{stats.roofArea?.toFixed(1) || 0} м²</span></div>
            <div className="calc-row"><span className="label">Периметр</span><span className="value">{stats.roofPerimeter?.toFixed(1) || 0} м</span></div>
            <div className="calc-row"><span className="label">Аэраторов</span><span className="value">{stats.aeratorCount || 0} шт</span></div>
            <div className="calc-row"><span className="label">Воронок</span><span className="value">{stats.drainCount || 0} шт</span></div>
            <div className="calc-row"><span className="label">Парапет</span><span className="value">{stats.roofPerimeter?.toFixed(1) || 0} м</span></div>
          </>
        ) : (
          <>
            <div className="calc-row"><span className="label">Общая площадь</span><span className="value">{stats.totalArea.toFixed(1)} м²</span></div>
            <div className="calc-row"><span className="label">Периметр</span><span className="value">{stats.perimeter.toFixed(1)} м</span></div>
            <div className="calc-row"><span className="label">Внешние стены</span><span className="value">{stats.extLen.toFixed(1)} м</span></div>
            <div className="calc-row"><span className="label">Перегородки</span><span className="value">{stats.intLen.toFixed(1)} м</span></div>
            <div className="calc-row"><span className="label">Окон</span><span className="value">{stats.winCount} шт</span></div>
            <div className="calc-row"><span className="label">Дверей</span><span className="value">{stats.doorCount} шт</span></div>
          </>
        )}
      </div>
      {draft && draft.length > 0 && (
        <div className="insp-section">
          <div className="insp-title">Состав {useProjectScope ? "по проекту" : "сметы"} · {draft.length} позиций</div>
          <div className="est-table">
            <div className="est-head"><span>Позиция</span><span>Кол-во</span><span>Сумма</span></div>
            {draft.map(r => (
              <div key={r.id} className="est-row">
                <span className="est-name">{r.name}</span>
                <span className="est-qty">{fmt(r.qty)} {r.unit}</span>
                <span className="est-sum">₽ {fmt(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="insp-section">
        <div className="insp-title">Стоимость</div>
        <div className="calc-row"><span className="label">Материалы</span><span className="value">₽ {fmt(stats.matCost)}</span></div>
        <div className="calc-row"><span className="label">Работы</span><span className="value">₽ {fmt(stats.workCost)}</span></div>
        <div className="calc-row total"><span className="label">Себестоимость</span><span className="value">₽ {fmt(stats.cost)}</span></div>
        <div className="calc-row accent" style={{ marginTop: 6 }}>
          <span className="label">Наценка <span style={{ color: "var(--text-faint)" }}>· 22%</span></span>
          <span className="value">₽ {fmt(stats.margin)}</span>
        </div>
        <div className="calc-row total">
          <span className="label">Итоговая стоимость</span>
          <span className="value" style={{ color: "var(--primary)", fontSize: 17 }}>₽ {fmt(stats.total)}</span>
        </div>
        <div className="calc-row profit" style={{ marginTop: 4 }}>
          <span className="label">Потенц. прибыль</span>
          <span className="value">+ ₽ {fmt(stats.margin)}</span>
        </div>
      </div>
    </>
  );
}

function AiSuggestions({ level }) {
  const isRoof = level?.type === "roof" || level?.type === "industrial_roof";
  const items = isRoof ? [
    { title: "Запас материала", body: "Для кровли 2000 м² рекомендуем 12% запаса материала вместо 10% — учёт сложности геометрии и примыканий.", action: "Применить" },
    { title: "Нормативные требования", body: "По СП 17.13330 для кровли 2000 м² требуется минимум 8 воронок. У вас 10 — норма соблюдена.", action: "Подробнее" },
    { title: "Зимняя эксплуатация", body: "Установить воронки с обогревом — снижает риски ледяных пробок на 92%.", action: "Сравнить" },
  ] : [
    { title: "Оптимизация теплопотерь", body: "В проекте есть внешние стены без утеплителя. Добавление 100мм минваты сэкономит до 24% на отоплении.", action: "Применить" },
    { title: "Подходящий аналог по прайсу", body: "Газобетон D400 снизит стоимость материалов без потери прочности.", action: "Сравнить" },
  ];
  return (
    <>
      <div className="insp-section">
        <div className="hstack" style={{ marginBottom: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center" }}><I.Sparkles size={13}/></div>
          <b style={{ fontSize: 13 }}>AI нашёл {items.length} улучшения</b>
        </div>
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>На основе анализа геометрии и нормативов.</p>
      </div>
      <div className="insp-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", background: "var(--surface-2)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>{it.title}</div>
            <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{it.body}</p>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--primary)", fontWeight: 600 }}>{it.action} <I.ArrowRight size={11}/></button>
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================
// Templates gallery
// ============================================================
function TemplatesGallery({ activeId, onApply, onBlank }) {
  const cats = useMemoP2(() => {
    const map = {};
    for (const tpl of TEMPLATES) {
      if (!map[tpl.category]) map[tpl.category] = [];
      map[tpl.category].push(tpl);
    }
    return map;
  }, []);
  return (
    <div className="templates-gallery">
      <div className="templates-header">
        <div>
          <h2 className="page-title" style={{ fontSize: 20, marginBottom: 4 }}>Готовые планировки</h2>
          <p className="page-subtitle">Стартуйте с готового решения или нарисуйте с нуля</p>
        </div>
        <div className="hstack">
          <button className="btn btn-secondary btn-sm"><I.Filter size={13}/> Все типы</button>
          <button className="btn btn-accent btn-sm" onClick={onBlank}><I.Plus size={13}/> Пустой холст</button>
        </div>
      </div>

      {Object.keys(cats).map(catName => (
        <div key={catName} style={{ marginBottom: 24 }}>
          <div className="tpl-cat-header">
            <h3 className="tpl-cat-title">{catName}</h3>
            <span className="dim" style={{ fontSize: 12 }}>{cats[catName].length}</span>
          </div>
          <div className="templates-grid">
            {cats[catName].map(tpl => (
              <TemplateCard key={tpl.id} tpl={tpl} active={activeId === tpl.id} onApply={() => onApply(tpl)}/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateCard({ tpl, active, onApply }) {
  const totalLevels = tpl.levels.length;
  return (
    <div className={`template-card ${active ? "active" : ""}`}>
      {tpl.badge && <div className="template-badge">{tpl.badge}</div>}
      {active && <div className="template-active-pill"><I.Check size={11} stroke={3}/> Применён</div>}
      <div className="template-thumb">
        <TemplateThumbnail tpl={tpl}/>
      </div>
      <div className="template-meta">
        <div className="template-name">{tpl.name}</div>
        <div className="template-sub">{tpl.category}</div>
        <div className="template-stats">
          <span><I.House size={11}/> {tpl.area} м²</span>
          {totalLevels > 1 ? <span><I.Building size={11}/> {totalLevels} ур.</span>
                          : <span><I.Room size={11}/> {tpl.rooms} комн.</span>}
        </div>
        <button className={`btn ${active ? "btn-secondary" : "btn-primary"} btn-sm`} style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={onApply}>
          {active ? "Применён" : "Применить шаблон"}
        </button>
      </div>
    </div>
  );
}

function TemplateThumbnail({ tpl }) {
  const lvl = tpl.levels[0];
  const inst = window.plInstantiateTemplate(tpl);
  const firstLvl = inst.levels[0];
  // Compute bounds across the level (walls or roof contour)
  let xs = [], ys = [];
  if (firstLvl.walls.length) {
    xs = firstLvl.walls.flatMap(w => [w.x1, w.x2]);
    ys = firstLvl.walls.flatMap(w => [w.y1, w.y2]);
  } else if (firstLvl.roof?.contour?.length) {
    xs = firstLvl.roof.contour.map(p => p.x);
    ys = firstLvl.roof.contour.map(p => p.y);
  } else {
    xs = [0, 10]; ys = [0, 10];
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const pad = Math.max(w, h) * 0.08;
  return (
    <svg viewBox={`${minX - pad} ${minY - pad} ${w + pad*2} ${h + pad*2}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {/* Rooms */}
      {firstLvl.rooms.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color}/>
      ))}
      {/* Roof contour */}
      {firstLvl.roof?.contour && firstLvl.roof.contour.length > 0 && (
        <polygon points={firstLvl.roof.contour.map(p => `${p.x},${p.y}`).join(" ")}
          fill="rgba(124,58,237,0.05)" stroke="#0B1220" strokeWidth={Math.max(w, h) * 0.012}/>
      )}
      {/* Walls */}
      {firstLvl.walls.map(wl => {
        const t = wl.type === "external" ? Math.max(w, h) * 0.018 : Math.max(w, h) * 0.008;
        const col = wl.type === "external" ? "#1F2937" : "#94A3B8";
        if (window.plWallIsH(wl)) {
          return <rect key={wl.id} x={Math.min(wl.x1, wl.x2) - t/2} y={wl.y1 - t/2} width={Math.abs(wl.x2 - wl.x1) + t} height={t} fill={col}/>;
        }
        return <rect key={wl.id} x={wl.x1 - t/2} y={Math.min(wl.y1, wl.y2) - t/2} width={t} height={Math.abs(wl.y2 - wl.y1) + t} fill={col}/>;
      })}
      {/* Windows */}
      {firstLvl.windows.map(win => {
        const wall = firstLvl.walls.find(wl => wl.id === win.on);
        if (!wall) return null;
        const t = Math.max(w, h) * 0.022;
        if (window.plWallIsH(wall)) {
          return <line key={win.id} x1={win.a} y1={wall.y1} x2={win.b} y2={wall.y1} stroke="#2563EB" strokeWidth={t}/>;
        }
        return <line key={win.id} x1={wall.x1} y1={win.a} x2={wall.x1} y2={win.b} stroke="#2563EB" strokeWidth={t}/>;
      })}
      {/* Aerators on roof */}
      {firstLvl.roof?.aerators?.slice(0, 24).map((a, i) => (
        <circle key={`a${i}`} cx={a.x} cy={a.y} r={Math.max(w, h) * 0.011} fill="#1E3A8A" opacity={0.7}/>
      ))}
      {/* Drains */}
      {firstLvl.roof?.drains?.slice(0, 12).map((d, i) => (
        <circle key={`d${i}`} cx={d.x} cy={d.y} r={Math.max(w, h) * 0.013} fill="none" stroke="#0891B2" strokeWidth={Math.max(w, h) * 0.005}/>
      ))}
      {/* Room labels */}
      {firstLvl.rooms.filter(r => r.w * r.h >= 5).map((r, i) => (
        <text key={`l${i}`} x={r.x + r.w/2} y={r.y + r.h/2 + 0.15} textAnchor="middle"
          fontSize={Math.min(r.w, r.h) * 0.18} fill="#4A5365" fontFamily="var(--font-display)">
          {r.name.length > 12 ? r.name.slice(0, 10) + "…" : r.name}
        </text>
      ))}
    </svg>
  );
}

Object.assign(window, {
  PlanToolbar, PlanInspector, LevelParams, TemplatesGallery, TemplateCard, TemplateThumbnail,
  RoofDashboard,
});

// ============================================================
// QUICK START WIZARD — modal that walks the user from scenario
// to preset and creates the project in one go.
// ============================================================
function QuickStartModal({ open, onClose, onApplyTpl, onApplyEmpty, onPickFile, onLoadDemoBg }) {
  const [step, setStep] = useStaP(1);
  const [scnId, setScnId] = useStaP(null);
  const [presetId, setPresetId] = useStaP(null);
  const [customDims, setCustomDims] = useStaP({ w: 10, h: 12, gw: 6, gh: 4 });
  useStaPEffect(() => { if (!open) { setStep(1); setScnId(null); setPresetId(null); } }, [open]);
  if (!open) return null;
  const scn = (window.PL_SCENARIOS || []).find(s => s.id === scnId);
  const preset = scn?.presets.find(p => p.id === presetId);

  function pickScn(id) { setScnId(id); setPresetId(null); setStep(2); }
  function pickPreset(id) { setPresetId(id); setStep(3); }
  function apply() {
    if (!scn || !preset) return;
    if (scn.id === "empty") { onApplyEmpty(); onClose(); return; }
    if (preset.fileImport) { onPickFile && onPickFile(); return; }
    if (preset.demoBackground) { onLoadDemoBg && onLoadDemoBg(); return; }
    const tpl = preset.custom ? preset.build(customDims) : preset.build();
    onApplyTpl(tpl, { scenarioTip: scn.id });
    onClose();
  }
  return (
    <div className="qs-backdrop" onClick={onClose}>
      <div className="qs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qs-head">
          <div>
            <div className="qs-eyebrow">Быстрый старт</div>
            <div className="qs-title">{step === 1 ? "Что считаем?" : step === 2 ? `${scn?.label} · размер` : `${scn?.label} · подтверждение`}</div>
          </div>
          <button className="qs-close" onClick={onClose}><I.Close size={16}/></button>
        </div>
        <div className="qs-steps">
          <span className={`qs-step ${step >= 1 ? "active" : ""}`}>1. Сценарий</span>
          <span className="qs-step-sep">→</span>
          <span className={`qs-step ${step >= 2 ? "active" : ""}`}>2. Размер</span>
          <span className="qs-step-sep">→</span>
          <span className={`qs-step ${step >= 3 ? "active" : ""}`}>3. Создать</span>
        </div>
        <div className="qs-body">
          {step === 1 && (
            <div className="qs-scenarios">
              {(window.PL_SCENARIOS || []).map(s => {
                const Icn = I[s.icon] || I.House;
                return (
                  <button key={s.id} className="qs-scenario" onClick={() => pickScn(s.id)}>
                    <div className="qs-scn-icon"><Icn size={20}/></div>
                    <div className="qs-scn-meta">
                      <div className="qs-scn-label">{s.label}</div>
                      <div className="qs-scn-sub">{s.summary}</div>
                    </div>
                    <I.ChevronRight size={14}/>
                  </button>
                );
              })}
            </div>
          )}
          {step === 2 && scn && (
            <>
              <div className="qs-presets">
                {scn.presets.map(p => (
                  <button key={p.id} className={`qs-preset ${presetId === p.id ? "active" : ""}`} onClick={() => setPresetId(p.id)}>
                    {p.badge && <span className="qs-preset-badge">{p.badge}</span>}
                    <span className="qs-preset-label">{p.label}</span>
                    <span className="qs-preset-hint">{p.hint || ""}</span>
                  </button>
                ))}
              </div>
              {preset?.custom && (
                <div className="qs-custom">
                  <div className="qs-custom-title">Свой размер, м</div>
                  <div className="grid-2" style={{ marginTop: 6 }}>
                    <div className="field">
                      <label className="field-label">Ширина</label>
                      <div className="input-with-suffix"><input className="input" type="number" min="3" step="0.5" value={customDims.w} onChange={(e) => setCustomDims(d => ({ ...d, w: parseFloat(e.target.value) || 0 }))}/><span className="suffix">м</span></div>
                    </div>
                    <div className="field">
                      <label className="field-label">Длина</label>
                      <div className="input-with-suffix"><input className="input" type="number" min="3" step="0.5" value={customDims.h} onChange={(e) => setCustomDims(d => ({ ...d, h: parseFloat(e.target.value) || 0 }))}/><span className="suffix">м</span></div>
                    </div>
                  </div>
                  {scn.id === "house_garage" && (
                    <div className="grid-2" style={{ marginTop: 8 }}>
                      <div className="field">
                        <label className="field-label">Гараж · Ширина</label>
                        <div className="input-with-suffix"><input className="input" type="number" min="3" step="0.5" value={customDims.gw} onChange={(e) => setCustomDims(d => ({ ...d, gw: parseFloat(e.target.value) || 0 }))}/><span className="suffix">м</span></div>
                      </div>
                      <div className="field">
                        <label className="field-label">Гараж · Длина</label>
                        <div className="input-with-suffix"><input className="input" type="number" min="3" step="0.5" value={customDims.gh} onChange={(e) => setCustomDims(d => ({ ...d, gh: parseFloat(e.target.value) || 0 }))}/><span className="suffix">м</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="qs-step-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}><I.ChevronLeft size={13}/> Назад</button>
                <button className="btn btn-primary btn-sm" disabled={!presetId} onClick={() => setStep(3)}>Далее <I.ChevronRight size={13}/></button>
              </div>
            </>
          )}
          {step === 3 && scn && preset && (
            <div className="qs-confirm">
              <div className="qs-confirm-card">
                <div className="qs-confirm-label">Сценарий</div>
                <div className="qs-confirm-value">{scn.label}</div>
              </div>
              <div className="qs-confirm-card">
                <div className="qs-confirm-label">Параметры</div>
                <div className="qs-confirm-value">{preset.custom ? `${customDims.w} × ${customDims.h}${scn.id === "house_garage" ? ` + ${customDims.gw} × ${customDims.gh}` : ""}` : preset.label}</div>
              </div>
              <div className="qs-confirm-hint">
                <I.Info size={13}/>
                <span>После создания: подгонка под объект, нужный режим, открытие dashboard.</span>
              </div>
              <div className="qs-step-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(2)}><I.ChevronLeft size={13}/> Назад</button>
                <button className="btn btn-accent btn-lg" onClick={apply}><I.Sparkles size={14}/> Создать объект</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DEMO MODE modal — list of pre-built showcases
// ============================================================
function DemoModeModal({ open, onClose, onApplyTpl, onLoadDemoBg, onLoadPdfDemo }) {
  if (!open) return null;
  const demos = window.PL_DEMO_SCENARIOS || [];
  return (
    <div className="qs-backdrop" onClick={onClose}>
      <div className="qs-modal qs-modal-demo" onClick={(e) => e.stopPropagation()}>
        <div className="qs-head">
          <div>
            <div className="qs-eyebrow"><I.Sparkles size={11}/> Demo Mode</div>
            <div className="qs-title">Готовые демо для продаж</div>
          </div>
          <button className="qs-close" onClick={onClose}><I.Close size={16}/></button>
        </div>
        <div className="qs-body">
          <p className="dim" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
            Откройте подготовленный объект за один клик. Покажите план, расчёт и КП без сборки на встрече.
          </p>
          <div className="qs-demo-list">
            {demos.map(d => (
              <button key={d.id} className="qs-demo-card" onClick={() => {
                if (d.demoBackground) { onLoadDemoBg && onLoadDemoBg(); onClose(); return; }
                if (d.demoPdf) { onLoadPdfDemo && onLoadPdfDemo(); onClose(); return; }
                onApplyTpl(d.build(), { scenarioTip: d.scenarioTip, demoMode: true });
                onClose();
              }}>
                <div className="qs-demo-icon">{d.badge === "AI" ? <span style={{ fontSize: 9, fontWeight: 800 }}>AI</span> : <I.Sparkles size={14}/>}</div>
                <div className="qs-demo-meta">
                  <div className="qs-demo-label">{d.label}</div>
                  <div className="qs-demo-hint">{d.hint}</div>
                </div>
                <I.ChevronRight size={13}/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Scenario Tip — small dismissable onboarding card on canvas
// ============================================================
const SCENARIO_TIPS = {
  pdf_takeoff: { title: "PDF-проект распознан", steps: [
    "Просмотрите список листов — фильтруйте по типу.",
    "Откройте «Извлечённые данные» → экспликация, спецификация, ведомости.",
    "Перейдите в «Кандидаты» → принимайте/отклоняйте найденные стены, проёмы, помещения.",
    "Нажмите «Конвертировать → объекты» — стены и комнаты появятся на холсте.",
  ]},
  import_drawing: { title: "Чертёж загружен", steps: [
    "Нажмите «Задать масштаб» и укажите известный отрезок (например, фасад 12 м).",
    "Введите реальную длину — подложка автоматически растянется.",
    "Включите инструмент «Стена» или «Контур» и обведите объект поверх скана.",
    "Откройте «Расчёт» — черновик сметы соберётся по обведённым элементам.",
  ]},
  house: { title: "Дом готов — что дальше?", steps: [
    "Отредактируйте стены, комнаты, окна и двери.",
    "Нажмите «Создать кровлю по контуру», чтобы добавить кровлю.",
    "Откройте «Расчёт» — черновик сметы появится автоматически.",
  ]},
  house_garage: { title: "Дом + Гараж", steps: [
    "Переключайтесь между уровнями 1 этаж / Гараж.",
    "В инспекторе уровня «Гараж» можно включить/исключить из общей сметы.",
    "Создайте кровлю по контуру дома, затем — отдельно по гаражу при необходимости.",
  ]},
  two_floor: { title: "2 этажа", steps: [
    "Кликните «2 этаж», чтобы редактировать второй уровень.",
    "Подложка 1 этажа отображается полупрозрачной — её нельзя редактировать со 2 этажа.",
    "Не забудьте «Создать кровлю по контуру» после второго этажа.",
  ]},
  warehouse: { title: "Склад / Цех", steps: [
    "Уточните габариты и зоны (Цех, Офис).",
    "Сетка 5–10 м удобна для промышленных объектов.",
    "Создайте промышленную кровлю по контуру через quick action.",
  ]},
  ind_roof: { title: "Промышленная кровля", steps: [
    "Проверьте контур, разделите кровлю на сегменты.",
    "Расставьте воронки, аэраторы, уклоны.",
    "Нажмите «Проверить кровлю» — соберите замечания и черновик сметы.",
  ]},
};

function ScenarioHint({ scenarioId, onDismiss }) {
  const tip = SCENARIO_TIPS[scenarioId];
  if (!tip) return null;
  return (
    <div className="scn-hint">
      <div className="scn-hint-head">
        <div className="scn-hint-title"><I.Sparkles size={12}/> {tip.title}</div>
        <button className="scn-hint-close" onClick={onDismiss}><I.Close size={12}/></button>
      </div>
      <ol className="scn-hint-list">
        {tip.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

// ============================================================
// PROJECT SUMMARY — multi-level overview shown in inspector when
// no selection on a "floor" level and the project has >1 level.
// ============================================================
function ProjectSummaryPanel({ project, summaryByLevel, totalArea, totalWalls, totalWindows, totalDoors, totalGates, totalRoofArea, totalWarnings, onSwitchLevel, onCreateRoofFromContour, onCheckProject, onShowEstimate, onOpenResultCenter, onOpenKpModal, onOpenExport, projectStatus }) {
  if (!project) return null;
  return (
    <>
      <div className="insp-section">
        <div className="qs-eyebrow"><I.Folder size={11}/> Проект</div>
        <div className="qs-title" style={{ fontSize: 16, marginTop: 4 }}>Сводка по проекту</div>
        {projectStatus && (
          <div className={`rc-status-pill tone-${projectStatus.tone}`} style={{ marginTop: 8 }}>
            <span className="rc-status-dot"/>
            {projectStatus.label}
          </div>
        )}
        <div className="roof-kpi-grid" style={{ marginTop: 10 }}>
          <RoofKPI label="Уровней"  value={project.levels.length}/>
          <RoofKPI label="Площадь"  value={(totalArea || 0).toFixed(0)} suffix="м²" tone="primary"/>
          <RoofKPI label="Кровля"   value={(totalRoofArea || 0).toFixed(0)} suffix="м²"/>
          <RoofKPI label="Внеш. стены" value={(totalWalls || 0).toFixed(0)} suffix="м"/>
          <RoofKPI label="Окна"     value={totalWindows || 0}/>
          <RoofKPI label="Двери"    value={totalDoors || 0}/>
        </div>
        {totalGates > 0 && (
          <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>В т.ч. ворот: <b>{totalGates}</b></div>
        )}
      </div>
      <div className="insp-section">
        <div className="insp-title">Уровни</div>
        <div className="proj-level-list">
          {summaryByLevel.map(row => {
            const lt = window.PL_LEVEL_TYPES[row.type] || { iconName: "House" };
            const Icn = I[lt.iconName] || I.House;
            return (
              <button key={row.id} className={`proj-level-row ${row.active ? "active" : ""}`} onClick={() => onSwitchLevel(row.id)}>
                <Icn size={12} style={{ color: "var(--text-secondary)", flexShrink: 0 }}/>
                <span className="plr-name">{row.name}</span>
                <span className="plr-area">{row.area.toFixed(0)} м²</span>
                {row.warnings > 0 && <span className="plr-warn">{row.warnings}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="insp-section">
        <div className="insp-title">Что дальше</div>
        <div className="roof-actions">
          {onOpenResultCenter && (
            <button className="roof-action primary" onClick={onOpenResultCenter}>
              <I.Sparkles size={14}/> Открыть результат
              {totalWarnings > 0 && <span className="roof-action-badge">{totalWarnings}</span>}
            </button>
          )}
          {onOpenKpModal && (
            <button className="roof-action" onClick={onOpenKpModal}>
              <I.Estimate size={14}/> Сформировать КП
            </button>
          )}
          {onCreateRoofFromContour && (
            <button className="roof-action" onClick={onCreateRoofFromContour}>
              <I.House size={14}/> Создать кровлю по контуру
            </button>
          )}
          <button className="roof-action" onClick={onCheckProject}>
            <I.CheckCircle size={14}/> Проверить проект
            {totalWarnings > 0 && <span className="roof-action-badge">{totalWarnings}</span>}
          </button>
          {onOpenExport && (
            <button className="roof-action" onClick={() => onOpenExport("all")}>
              <I.Download size={14}/> Экспорт
            </button>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  QuickStartModal, DemoModeModal, ScenarioHint, ProjectSummaryPanel,
});

// ============================================================
// CalibrationModal — pops up after the user finishes the calibration line
// ============================================================
function CalibrationModal({ measured, editing, onConfirm, onCancel }) {
  const [val, setVal] = useStaP("");
  useStaPEffect(() => {
    const i = document.getElementById("calib-len-input");
    if (i) { i.focus(); setTimeout(() => i.select(), 30); }
  }, []);
  const numericVal = parseFloat(String(val).replace(",", "."));
  const valid = isFinite(numericVal) && numericVal > 0;
  const ratio = valid ? numericVal / measured : null;
  function submit() {
    if (!valid) return;
    onConfirm(numericVal);
  }
  const PRESETS = [1, 2, 5, 10, 12];
  return (
    <div className="qs-backdrop" onClick={onCancel}>
      <div className="qs-modal calib-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qs-head">
          <div>
            <div className="qs-eyebrow"><I.Ruler size={11}/> Калибровка масштаба</div>
            <div className="qs-title">{editing ? "Изменить длину отрезка" : "Какая реальная длина отрезка?"}</div>
          </div>
          <button className="qs-close" onClick={onCancel}><I.Close size={16}/></button>
        </div>
        <div className="qs-body">
          <div className="calib-row">
            <div className="calib-cell">
              <div className="calib-cell-label">Отметили на чертеже</div>
              <div className="calib-cell-value muted">{measured.toFixed(2)} м</div>
            </div>
            <I.ArrowRight size={14} style={{ color: "var(--text-faint)" }}/>
            <div className="calib-cell">
              <div className="calib-cell-label">Реальная длина</div>
              <div className="calib-input-wrap">
                <input id="calib-len-input" className="calib-big-input" type="text" inputMode="decimal"
                  value={val} onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && valid) submit(); }}
                  placeholder="0.00"/>
                <span className="calib-suffix">м</span>
              </div>
            </div>
          </div>
          <div className="calib-presets">
            <span className="calib-presets-label">Подсказки:</span>
            {PRESETS.map(p => (
              <button key={p} className={`calib-preset ${numericVal === p ? "active" : ""}`} onClick={() => setVal(String(p))}>{p} м</button>
            ))}
          </div>
          {valid && (
            <div className="calib-scale">
              <span className="calib-scale-pill">
                <I.Check size={11}/> Масштаб 1:{(1 / ratio).toFixed(0)} · подложка будет {ratio > 1 ? "увеличена" : ratio < 1 ? "уменьшена" : "не изменена"} в {(Math.max(ratio, 1/ratio)).toFixed(2)}×
              </span>
            </div>
          )}
          <div className="qs-step-actions">
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>Отмена</button>
            <button className="btn btn-accent btn-sm" disabled={!valid} onClick={submit}>
              <I.Check size={13}/> Применить масштаб
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BackgroundsPanel — inspector block for managing underlays on a level
// ============================================================
function BackgroundsPanel({ backgrounds, onPatchBackground, onDeleteBackground, onStartCalibration, onFitToBackgrounds, onOpenImport, onSetTool, onLoadPdfDemo }) {
  const list = backgrounds || [];
  if (list.length === 0) return null;
  // Local slider state for smooth dragging without history spam.
  // sliderState[bgId] = current dragging value (number 10-100); undefined = use bg.opacity
  const [sliderState, setSliderState] = useStaP({});
  return (
    <>
      {list.map(bg => {
        const baseOpacity = bg.opacity != null ? bg.opacity : 0.6;
        const displayPct = sliderState[bg.id] != null ? sliderState[bg.id] : Math.round(baseOpacity * 100);
        return (
          <div key={bg.id} className="insp-section">
            <div className="qs-eyebrow"><I.Upload size={11}/> Подложка чертежа</div>
            <div className="bg-card-head">
              <div className="bg-card-name" title={bg.name}>{bg.name || "Без названия"}</div>
              <div className={`bg-card-pill ${bg.scaleCalibrated ? "ok" : "warn"}`}>
                {bg.scaleCalibrated ? "масштаб задан" : "без масштаба"}
              </div>
            </div>
            <div className="bg-toggle-row">
              <button className={`bg-toggle ${bg.visible ? "on" : ""}`}
                onClick={() => onPatchBackground(bg.id, { visible: !bg.visible })}
                title={bg.visible ? "Скрыть подложку" : "Показать подложку"}>
                <I.Eye size={12}/> {bg.visible ? "Видна" : "Скрыта"}
              </button>
              <button className={`bg-toggle ${bg.locked ? "on" : ""}`}
                onClick={() => onPatchBackground(bg.id, { locked: !bg.locked })}
                title={bg.locked ? "Разблокировать" : "Заблокировать"}>
                {bg.locked ? "🔒" : "🔓"} {bg.locked ? "Locked" : "Unlocked"}
              </button>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <div className="bg-slider-row">
                <label className="field-label" style={{ flex: 1 }}>Прозрачность</label>
                <span className="bg-slider-val">{displayPct}%</span>
              </div>
              <input className="bg-slider" type="range" min="10" max="100" step="5"
                value={displayPct}
                onInput={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setSliderState(s => ({ ...s, [bg.id]: v }));
                  // Live preview without history
                  onPatchBackground(bg.id, { opacity: v / 100 }, { skipHistory: true });
                }}
                onChange={(e) => {
                  // Commit final value, push history once
                  const v = parseInt(e.target.value, 10);
                  onPatchBackground(bg.id, { opacity: v / 100 });
                  setSliderState(s => { const c = { ...s }; delete c[bg.id]; return c; });
                }}
              />
            </div>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <NumberField label="Ширина" suffix="м" value={bg.width}    onChange={(v) => onPatchBackground(bg.id, { width: Math.max(0.2, v) })}/>
              <NumberField label="Высота" suffix="м" value={bg.height}   onChange={(v) => onPatchBackground(bg.id, { height: Math.max(0.2, v) })}/>
              <NumberField label="X"      suffix="м" value={bg.x}        onChange={(v) => onPatchBackground(bg.id, { x: v })}/>
              <NumberField label="Y"      suffix="м" value={bg.y}        onChange={(v) => onPatchBackground(bg.id, { y: v })}/>
              <NumberField label="Поворот" suffix="°" value={bg.rotation || 0} onChange={(v) => onPatchBackground(bg.id, { rotation: v })}/>
              {bg.scaleCalibrated && (
                <div className="field">
                  <label className="field-label">px / м</label>
                  <div className="bg-readonly">{bg.pixelsPerMeter ? bg.pixelsPerMeter.toFixed(0) : "—"}</div>
                </div>
              )}
            </div>
            <div className="bg-actions">
              <button className="roof-action" onClick={() => onStartCalibration(bg.id)}>
                <I.Ruler size={13}/> {bg.scaleCalibrated ? "Перезадать масштаб" : "Задать масштаб"}
              </button>
              <button className="roof-action" onClick={onFitToBackgrounds}>
                <I.Fit size={13}/> Вписать в экран
              </button>
              {onLoadPdfDemo && (
                <button className="roof-action" onClick={onLoadPdfDemo} title="Запустить AI-разбор демо-PDF">
                  <I.Sparkles size={13}/> AI-предобработка чертежа
                </button>
              )}
              <button className="roof-action danger" onClick={() => onDeleteBackground(bg.id)}>
                <I.Trash size={13}/> Удалить подложку
              </button>
            </div>
            {bg.scaleCalibrated && onSetTool && (
              <div className="bg-trace">
                <div className="bg-trace-title">Обводка поверх подложки</div>
                <div className="bg-trace-actions">
                  <button className="bg-trace-btn" onClick={() => onSetTool("wall")}>Обвести стены</button>
                  <button className="bg-trace-btn" onClick={() => onSetTool("contour")}>Обвести кровлю</button>
                  <button className="bg-trace-btn" onClick={() => onSetTool("room")}>Добавить зоны</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {onOpenImport && (
        <div className="insp-section">
          <button className="roof-action" onClick={onOpenImport} style={{ width: "100%" }}>
            <I.Plus size={13}/> Добавить ещё подложку
          </button>
        </div>
      )}
    </>
  );
}

Object.assign(window, { CalibrationModal, BackgroundsPanel });

// ============================================================
// RESULT CENTER — main "что готово показать клиенту" hub.
// Tabs: Сводка / Смета / Материалы / КП / Экспорт.
// ============================================================
const RESULT_TABS = [
  { id: "summary",   label: "Сводка",         icon: "Dashboard" },
  { id: "estimate",  label: "Черновик сметы", icon: "Calc" },
  { id: "materials", label: "Материалы",      icon: "Layers" },
  { id: "proposal",  label: "КП",             icon: "Estimate" },
  { id: "export",    label: "Экспорт",        icon: "Download" },
];

function ResultCenterModal({ open, onClose, project, projectStats, allRows, status, warnings,
  onOpenKpModal, onOpenExport, onUpdateRowPrice, onToggleRowInclude, onOpenProposalPreview, lastProposalId, scope, setScope, lastExportAt }) {
  const [tab, setTab] = useStaP("summary");
  useStaPEffect(() => { if (!open) setTab("summary"); }, [open]);
  if (!open) return null;
  const totalIncluded = (allRows || []).reduce((s, r) => s + (r.include !== false ? r.total : 0), 0);
  const totalExcluded = (allRows || []).reduce((s, r) => s + (r.include === false ? r.total : 0), 0);
  return (
    <div className="qs-backdrop" onClick={onClose}>
      <div className="rc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rc-head">
          <div className="rc-head-left">
            <div className="rc-eyebrow"><I.Sparkles size={11}/> Центр результата</div>
            <div className="rc-title">{project.name || "Проект"}</div>
            <div className="rc-sub">{project.levels.length} уровень(ей) · {scope === "project" ? "Весь проект" : "Текущий уровень"}</div>
          </div>
          <div className="rc-head-right">
            <span className={`rc-status-pill tone-${status.tone}`}>
              <span className="rc-status-dot"/>
              {status.label}
            </span>
            <button className="qs-close" onClick={onClose}><I.Close size={16}/></button>
          </div>
        </div>
        {/* Progress chain */}
        <div className="rc-chain">
          {[
            { id: "draft",     label: "Черновик",        ok: true },
            { id: "calc",      label: "Расчёт",          ok: ["calc","ready","review","proposed","exported"].includes(status.code) || allRows.length > 0 },
            { id: "review",    label: "Проверка",        ok: status.code === "review" || status.code === "ready" || status.code === "proposed" || status.code === "exported" },
            { id: "proposal",  label: "КП сформировано", ok: status.code === "proposed" || status.code === "exported" || !!lastProposalId },
            { id: "exported",  label: "Отправлено / Экспорт", ok: status.code === "exported" || !!lastExportAt },
          ].map((s, i, arr) => (
            <React.Fragment key={s.id}>
              <div className={`rc-step ${s.ok ? "done" : ""}`}>
                <span className="rc-step-dot">{s.ok ? <I.Check size={10}/> : i + 1}</span>
                <span className="rc-step-label">{s.label}</span>
              </div>
              {i < arr.length - 1 && <div className={`rc-step-bar ${s.ok ? "done" : ""}`}/>}
            </React.Fragment>
          ))}
        </div>
        <div className="rc-tabs">
          {RESULT_TABS.map(t => {
            const Icn = I[t.icon] || I.Dashboard;
            return (
              <button key={t.id} className={`rc-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                <Icn size={13}/> {t.label}
              </button>
            );
          })}
          <div style={{ marginLeft: "auto" }}>
            {project.levels.length > 1 && (
              <div className="rc-scope">
                <button className={scope === "level" ? "active" : ""} onClick={() => setScope("level")}>Уровень</button>
                <button className={scope === "project" ? "active" : ""} onClick={() => setScope("project")}>Весь проект</button>
              </div>
            )}
          </div>
        </div>
        <div className="rc-body">
          {tab === "summary"   && <ResultSummaryTab project={project} stats={projectStats} status={status} warnings={warnings} allRows={allRows} totalIncluded={totalIncluded}/>}
          {tab === "estimate"  && <ResultEstimateTab allRows={allRows} onUpdateRowPrice={onUpdateRowPrice} onToggleRowInclude={onToggleRowInclude} totalIncluded={totalIncluded} totalExcluded={totalExcluded} warnings={warnings}/>}
          {tab === "materials" && <ResultMaterialsTab allRows={allRows}/>}
          {tab === "proposal"  && <ResultProposalTab project={project} totalIncluded={totalIncluded} onOpenKpModal={onOpenKpModal} onOpenProposalPreview={onOpenProposalPreview} lastProposalId={lastProposalId}/>}
          {tab === "export"    && <ResultExportTab project={project} onOpenExport={onOpenExport} lastExportAt={lastExportAt}/>}
        </div>
      </div>
    </div>
  );
}

function ResultSummaryTab({ project, stats, status, warnings, allRows, totalIncluded }) {
  return (
    <div className="rc-grid">
      <div className="rc-col">
        <div className="rc-card">
          <div className="rc-card-title">Статус</div>
          <div className={`rc-status-pill tone-${status.tone}`} style={{ marginTop: 6 }}>
            <span className="rc-status-dot"/>
            {status.label}
          </div>
          <p className="rc-card-hint">Расчёт предварительный. Финальную проверку выполняет специалист.</p>
        </div>
        <div className="rc-card">
          <div className="rc-card-title">Итого по проекту</div>
          <div className="rc-bigvalue">₽ {fmt(Math.round(totalIncluded))}</div>
          <div className="rc-card-hint">включено в смету · {allRows.filter(r => r.include !== false).length} из {allRows.length} позиций</div>
        </div>
        <div className="rc-card">
          <div className="rc-card-title">Геометрия</div>
          <div className="rc-kv-list">
            {stats.totalArea > 0   && <div className="rc-kv"><span>Площадь полов</span><b>{stats.totalArea.toFixed(0)} м²</b></div>}
            {stats.totalRoofArea > 0 && <div className="rc-kv"><span>Площадь кровли</span><b>{stats.totalRoofArea.toFixed(0)} м²</b></div>}
            {stats.totalWalls > 0  && <div className="rc-kv"><span>Внешние стены</span><b>{stats.totalWalls.toFixed(1)} м</b></div>}
            {stats.totalWindows > 0 && <div className="rc-kv"><span>Окон</span><b>{stats.totalWindows}</b></div>}
            {stats.totalDoors > 0   && <div className="rc-kv"><span>Дверей</span><b>{stats.totalDoors}</b></div>}
            {stats.totalGates > 0   && <div className="rc-kv"><span>Ворот</span><b>{stats.totalGates}</b></div>}
          </div>
        </div>
      </div>
      <div className="rc-col">
        <div className="rc-card">
          <div className="rc-card-title">Уровни ({stats.byLevel.length})</div>
          <div className="rc-level-table">
            <div className="rc-level-head"><span>Уровень</span><span>Площадь</span><span>Позиций</span><span>Сумма</span></div>
            {stats.byLevel.map(l => {
              const lt = window.PL_LEVEL_TYPES[l.type] || { iconName: "House" };
              const Icn = I[lt.iconName] || I.House;
              return (
                <div key={l.id} className="rc-level-row">
                  <span className="rc-level-name"><Icn size={11}/> {l.name}{l.warnings > 0 && <span className="rc-level-warn">{l.warnings}</span>}</span>
                  <span>{l.area.toFixed(0)} м²</span>
                  <span>{l.items}</span>
                  <span className="rc-level-sum">₽ {fmt(Math.round(l.total))}</span>
                </div>
              );
            })}
          </div>
        </div>
        {warnings && warnings.length > 0 && (
          <div className="rc-card">
            <div className="rc-card-title">Замечания ({warnings.length})</div>
            <div className="vstack" style={{ gap: 4, marginTop: 6 }}>
              {warnings.slice(0, 6).map((w, i) => (
                <div key={i} className={`warn-line tone-${w.level}`}>
                  <span className={`dot tone-${w.level}`}/>
                  <span style={{ flex: 1 }}>{w.text}</span>
                </div>
              ))}
              {warnings.length > 6 && <div className="dim" style={{ fontSize: 11, padding: "2px 0" }}>и ещё {warnings.length - 6}…</div>}
            </div>
          </div>
        )}
        <div className="rc-card rc-checklist">
          <div className="rc-card-title">Перед отправкой проверьте</div>
          <ul className="rc-check-list">
            <li>Актуальность прайсов</li>
            <li>Материалы и коэффициенты запаса</li>
            <li>Состав работ, доставку, монтаж</li>
            <li>НДС / без НДС, условия оплаты, сроки</li>
            <li>Гарантию и условия</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResultEstimateTab({ allRows, onUpdateRowPrice, onToggleRowInclude, totalIncluded, totalExcluded, warnings }) {
  const groups = {};
  for (const r of allRows) {
    const g = r.group || "Прочее";
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  }
  return (
    <div className="rc-estimate">
      <div className="rc-est-toolbar">
        <div className="rc-est-summary">
          <div className="rc-est-stat"><span>Позиций</span><b>{allRows.length}</b></div>
          <div className="rc-est-stat"><span>Включено</span><b className="ok">₽ {fmt(Math.round(totalIncluded))}</b></div>
          {totalExcluded > 0 && <div className="rc-est-stat"><span>Исключено</span><b className="muted">₽ {fmt(Math.round(totalExcluded))}</b></div>}
          {warnings?.length > 0 && <div className="rc-est-stat"><span>Замечаний</span><b className="warn">{warnings.length}</b></div>}
        </div>
      </div>
      {Object.entries(groups).map(([gName, rows]) => {
        const sub = rows.reduce((s, r) => s + (r.include !== false ? r.total : 0), 0);
        return (
          <div key={gName} className="rc-est-group">
            <div className="rc-est-group-head">
              <div className="rc-est-group-title">{gName}</div>
              <div className="rc-est-group-sub">₽ {fmt(Math.round(sub))}</div>
            </div>
            <div className="rc-est-table">
              <div className="rc-est-row rc-est-th">
                <span></span>
                <span>Позиция</span>
                <span>Кол-во</span>
                <span>Цена ед.</span>
                <span>Сумма</span>
              </div>
              {rows.map(r => (
                <div key={r.id} className={`rc-est-row ${r.include === false ? "excluded" : ""}`}>
                  <button className={`rc-est-check ${r.include !== false ? "on" : ""}`}
                    onClick={() => onToggleRowInclude && onToggleRowInclude(r.id)}
                    title={r.include !== false ? "Исключить из сметы" : "Включить в смету"}>
                    {r.include !== false ? <I.Check size={11} stroke={3}/> : null}
                  </button>
                  <span className="rc-est-name">
                    <div>{r.name}</div>
                    <div className="rc-est-source">{r.source || "Демо-прайс"}{r.levelName ? ` · ${r.levelName}` : ""}</div>
                  </span>
                  <span className="rc-est-qty">{fmt(r.qty)} {r.unit}</span>
                  <span className="rc-est-price">
                    <input className="rc-price-input" type="number" step="50"
                      value={Math.round((r.mat + r.work) || 0)}
                      onChange={(e) => onUpdateRowPrice && onUpdateRowPrice(r.id, parseFloat(e.target.value) || 0)}/>
                    <span className="rc-est-currency">₽</span>
                  </span>
                  <span className="rc-est-sum">₽ {fmt(Math.round(r.total))}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="rc-est-footer">
        <div className="rc-est-footer-meta">Предварительный расчёт. Финальную проверку выполняет специалист.</div>
        <div className="rc-est-grand">
          <span>Итого включено</span>
          <b>₽ {fmt(Math.round(totalIncluded))}</b>
        </div>
      </div>
    </div>
  );
}

function ResultMaterialsTab({ allRows }) {
  const materials = {};
  for (const r of (allRows || [])) {
    if (r.include === false) continue;
    const key = r.name + "|" + r.unit;
    if (!materials[key]) materials[key] = { name: r.name, unit: r.unit, qty: 0, total: 0, source: r.source };
    materials[key].qty   += r.qty;
    materials[key].total += r.total;
  }
  const list = Object.values(materials).sort((a, b) => b.total - a.total);
  return (
    <div className="rc-materials">
      <div className="rc-card-title" style={{ marginBottom: 10 }}>Материалы и работы · {list.length} позиций</div>
      <div className="rc-mat-table">
        <div className="rc-mat-row rc-mat-th"><span>Позиция</span><span>Кол-во</span><span>Источник</span><span>Сумма</span></div>
        {list.map((m, i) => (
          <div key={i} className="rc-mat-row">
            <span className="rc-mat-name">{m.name}</span>
            <span>{fmt(m.qty)} {m.unit}</span>
            <span className="dim" style={{ fontSize: 11.5 }}>{m.source || "Демо-прайс"}</span>
            <span className="rc-est-sum">₽ {fmt(Math.round(m.total))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultProposalTab({ project, totalIncluded, onOpenKpModal, onOpenProposalPreview, lastProposalId }) {
  return (
    <div className="rc-proposal">
      <div className="rc-card">
        <div className="rc-card-title">Коммерческое предложение</div>
        <p className="rc-card-hint" style={{ marginTop: 4 }}>
          Соберите КП на основе текущего проекта и сметы. Документ откроется в preview и доступен для печати/PDF.
        </p>
        <div className="rc-bigvalue" style={{ marginTop: 14 }}>₽ {fmt(Math.round(totalIncluded))}</div>
        <div className="rc-card-hint">итого по черновику</div>
        <div className="rc-prop-actions">
          {lastProposalId
            ? <>
                <button className="btn btn-accent btn-sm" onClick={() => onOpenProposalPreview && onOpenProposalPreview(lastProposalId)}>
                  <I.Estimate size={13}/> Открыть последнее КП
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onOpenKpModal}>
                  <I.Plus size={13}/> Сформировать новое КП
                </button>
              </>
            : <button className="btn btn-accent btn-lg" onClick={onOpenKpModal}>
                <I.Sparkles size={14}/> Сформировать КП
              </button>
          }
        </div>
      </div>
      <div className="rc-card">
        <div className="rc-card-title">Что войдёт в КП</div>
        <ul className="rc-check-list">
          <li>Шапка компании и реквизиты</li>
          <li>Данные клиента и объекта</li>
          <li>Краткое описание и состав работ</li>
          <li>Таблица сметных позиций с итогом</li>
          <li>Этапы работ, сроки, условия оплаты</li>
          <li>Гарантии · что входит / что не входит</li>
        </ul>
      </div>
    </div>
  );
}

function ResultExportTab({ project, onOpenExport, lastExportAt }) {
  const variants = [
    { id: "estimate", label: "Сметная сводка",  icon: "Calc",     desc: "Таблица позиций + итог + warnings" },
    { id: "proposal", label: "Коммерческое предложение", icon: "Estimate", desc: "КП на бланке с реквизитами" },
    { id: "roof",     label: "Кровельная карта", icon: "House",    desc: "Сегменты · воронки · парапеты · аэраторы" },
    { id: "all",      label: "Проект целиком",  icon: "Folder",   desc: "Все документы в одном пакете" },
  ];
  return (
    <div className="rc-export">
      <div className="rc-card-title" style={{ marginBottom: 10 }}>Выберите, что экспортировать</div>
      <div className="rc-export-grid">
        {variants.map(v => {
          const Icn = I[v.icon] || I.FileText;
          return (
            <button key={v.id} className="rc-export-card" onClick={() => onOpenExport && onOpenExport(v.id)}>
              <div className="rc-export-icon"><Icn size={18}/></div>
              <div>
                <div className="rc-export-label">{v.label}</div>
                <div className="rc-export-desc">{v.desc}</div>
              </div>
              <I.ChevronRight size={13}/>
            </button>
          );
        })}
      </div>
      {lastExportAt && (
        <div className="dim" style={{ fontSize: 12, marginTop: 10 }}>
          Последний экспорт: {lastExportAt.toLocaleString("ru-RU")}
        </div>
      )}
      <div className="rc-card" style={{ marginTop: 14 }}>
        <div className="rc-card-title">Перед отправкой</div>
        <ul className="rc-check-list">
          <li>Проверьте актуальность прайсов и материалов</li>
          <li>Убедитесь, что warnings = 0</li>
          <li>Уточните НДС / без НДС, условия оплаты, сроки</li>
          <li>Согласуйте гарантии и состав работ</li>
        </ul>
      </div>
    </div>
  );
}

Object.assign(window, { ResultCenterModal });

// ============================================================
// KP GENERATION modal + KP PREVIEW (print-ready)
// ============================================================
function KpGenerationModal({ open, onClose, project, defaultTotal, scope, onGenerate }) {
  const [form, setForm] = useStaP({
    client: "",
    object: "",
    validUntil: defaultValidUntilISO(),
    payment: "50% предоплата, 50% по факту",
    warranty: "12 месяцев · материалы и работы",
    sections: { works: true, materials: true, stages: true, terms: true, includes: true, excludes: true },
  });
  useStaPEffect(() => {
    if (open && project) {
      setForm(f => ({
        ...f,
        object: project.name || "Объект",
        client: f.client || "",
      }));
    }
  }, [open, project]);
  if (!open) return null;
  function toggleSection(k) { setForm(f => ({ ...f, sections: { ...f.sections, [k]: !f.sections[k] } })); }
  function submit() {
    const kpId = "KP-" + Date.now().toString(36).slice(-6).toUpperCase();
    const kp = {
      id: kpId,
      project: project.name || "Проект",
      client: form.client || "Заказчик",
      object: form.object,
      total: Math.round(defaultTotal),
      status: "Готово к отправке",
      statusColor: "warning",
      sent: null,
      createdAt: new Date().toISOString(),
      validUntil: form.validUntil,
      payment: form.payment,
      warranty: form.warranty,
      sections: form.sections,
      sourceLevelId: project.activeLevelId,
      source: "Планировка",
      scope,
      type: project.levels.find(l => l.id === project.activeLevelId)?.type || "floor",
    };
    onGenerate(kp);
  }
  return (
    <div className="qs-backdrop" onClick={onClose}>
      <div className="qs-modal kp-gen-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qs-head">
          <div>
            <div className="qs-eyebrow"><I.Sparkles size={11}/> КП из планировки</div>
            <div className="qs-title">Создание коммерческого предложения</div>
          </div>
          <button className="qs-close" onClick={onClose}><I.Close size={16}/></button>
        </div>
        <div className="qs-body">
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Клиент</label>
              <input className="input" value={form.client} onChange={(e) => setForm(f => ({ ...f, client: e.target.value }))} placeholder="Иванов И. И. / ООО «Заказчик»"/>
            </div>
            <div className="field">
              <label className="field-label">Объект</label>
              <input className="input" value={form.object} onChange={(e) => setForm(f => ({ ...f, object: e.target.value }))}/>
            </div>
            <div className="field">
              <label className="field-label">КП действует до</label>
              <input className="input" type="date" value={form.validUntil} onChange={(e) => setForm(f => ({ ...f, validUntil: e.target.value }))}/>
            </div>
            <div className="field">
              <label className="field-label">Условия оплаты</label>
              <input className="input" value={form.payment} onChange={(e) => setForm(f => ({ ...f, payment: e.target.value }))}/>
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label className="field-label">Гарантия</label>
              <input className="input" value={form.warranty} onChange={(e) => setForm(f => ({ ...f, warranty: e.target.value }))}/>
            </div>
          </div>
          <div className="kp-gen-summary">
            <div>
              <div className="qs-eyebrow">Предварительная сумма</div>
              <div className="rc-bigvalue" style={{ marginTop: 4 }}>₽ {fmt(Math.round(defaultTotal))}</div>
            </div>
            <div className="dim" style={{ fontSize: 11.5, maxWidth: 200, textAlign: "right" }}>
              Сумма из черновика сметы. Может быть изменена в preview после генерации.
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="field-label" style={{ display: "block", marginBottom: 6 }}>Включить разделы</label>
            <div className="kp-sec-row">
              {[
                ["works", "Состав работ"],
                ["materials", "Материалы"],
                ["stages", "Этапы и сроки"],
                ["terms", "Условия оплаты"],
                ["includes", "Что входит"],
                ["excludes", "Что не входит"],
              ].map(([k, label]) => (
                <label key={k} className={`kp-sec-chip ${form.sections[k] ? "on" : ""}`} onClick={() => toggleSection(k)}>
                  <span className="kp-sec-box" data-on={form.sections[k] ? "1" : "0"}>{form.sections[k] && <I.Check size={9} stroke={3}/>}</span>
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="qs-confirm-hint" style={{ marginTop: 14 }}>
            <I.Info size={13}/>
            <span>Расчёт предварительный. Финальную проверку выполняет специалист.</span>
          </div>
          <div className="qs-step-actions">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Отмена</button>
            <button className="btn btn-accent btn-sm" onClick={submit}>
              <I.Sparkles size={13}/> Сформировать КП
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function defaultValidUntilISO() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// KP PREVIEW MODAL — full document, print-ready
// ============================================================
function KpPreviewModal({ open, onClose, kp, project, allRows, onPrint, onSavedExport, onCopyText }) {
  if (!open || !kp) return null;
  return (
    <div className="qs-backdrop kp-preview-backdrop" onClick={onClose}>
      <div className="kp-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kp-preview-toolbar no-print">
          <div className="kp-preview-tb-left">
            <div className="qs-eyebrow"><I.Estimate size={11}/> Preview КП</div>
            <div className="kp-preview-tb-title">{kp.id} · {kp.object || kp.project}</div>
          </div>
          <div className="kp-preview-tb-right">
            <button className="btn btn-ghost btn-sm" onClick={onCopyText}><I.Edit size={13}/> Скопировать текст</button>
            <button className="btn btn-ghost btn-sm" onClick={onSavedExport}><I.Download size={13}/> Скачать HTML</button>
            <button className="btn btn-accent btn-sm" onClick={onPrint}><I.FilePdf size={13}/> Печать / PDF</button>
            <button className="qs-close" onClick={onClose}><I.Close size={16}/></button>
          </div>
        </div>
        <div className="kp-preview-scroll">
          <PrintDocumentKp kp={kp} project={project} allRows={allRows}/>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PRINT TEMPLATES — used inside KpPreviewModal AND inside the
// hidden <div className="print-document"> mounted near root that
// captures whichever export the user chose.
// ============================================================
function PrintDocumentKp({ kp, project, allRows }) {
  const today = kp.createdAt ? new Date(kp.createdAt) : new Date();
  const validUntil = kp.validUntil ? new Date(kp.validUntil) : null;
  const rows = (allRows || []).filter(r => r.include !== false);
  const grand = rows.reduce((s, r) => s + r.total, 0);
  // Group rows
  const groups = {};
  for (const r of rows) {
    const g = r.group || "Прочее";
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  }
  return (
    <div className="print-document doc-kp">
      <header className="doc-head">
        <div className="doc-logo">
          <div className="doc-logo-mark">SK</div>
          <div>
            <div className="doc-logo-name">СтройКомфорт</div>
            <div className="doc-logo-sub">Подрядная организация · с 2014 г.</div>
          </div>
        </div>
        <div className="doc-head-meta">
          <div><b>{kp.id}</b></div>
          <div>от {today.toLocaleDateString("ru-RU")}</div>
          {validUntil && <div>действует до {validUntil.toLocaleDateString("ru-RU")}</div>}
        </div>
      </header>
      <h1 className="doc-title">Коммерческое предложение</h1>
      <div className="doc-subtitle">
        {kp.type === "industrial_roof" ? "Расчёт работ и материалов по промышленной кровле"
          : kp.type === "roof" ? "Расчёт работ и материалов по кровле"
          : kp.type === "garage" ? "Расчёт работ и материалов по гаражному блоку"
          : "Предварительное коммерческое предложение по объекту"}
      </div>
      <section className="doc-meta-grid">
        <div><div className="doc-mlabel">Клиент</div><div className="doc-mval">{kp.client}</div></div>
        <div><div className="doc-mlabel">Объект</div><div className="doc-mval">{kp.object || kp.project}</div></div>
        <div><div className="doc-mlabel">Условия оплаты</div><div className="doc-mval">{kp.payment}</div></div>
        <div><div className="doc-mlabel">Гарантия</div><div className="doc-mval">{kp.warranty}</div></div>
      </section>
      <section className="doc-section">
        <h2 className="doc-h2">Краткое описание</h2>
        <p className="doc-p">
          Настоящее коммерческое предложение составлено на основании планировочной модели объекта, выполненной в системе Stroika.
          Состав работ и материалов рассчитан автоматически по контуру и параметрам, заданным в проекте.
        </p>
      </section>
      {kp.sections?.works && (
        <section className="doc-section">
          <h2 className="doc-h2">Состав работ и стоимость</h2>
          <table className="doc-table">
            <thead>
              <tr><th>Раздел</th><th>Позиция</th><th>Кол-во</th><th>Цена ед.</th><th>Сумма</th></tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([g, list]) => list.map((r, i) => (
                <tr key={r.id}>
                  {i === 0 && <td rowSpan={list.length} className="doc-cat">{g}</td>}
                  <td>{r.name}{r.levelName ? <span className="doc-lvl"> · {r.levelName}</span> : null}</td>
                  <td className="num">{fmt(r.qty)} {r.unit}</td>
                  <td className="num">₽ {fmt(Math.round((r.mat + r.work) || 0))}</td>
                  <td className="num"><b>₽ {fmt(Math.round(r.total))}</b></td>
                </tr>
              )))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="doc-total-label">ИТОГО</td>
                <td className="num doc-total"><b>₽ {fmt(Math.round(grand))}</b></td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}
      {kp.sections?.stages && (
        <section className="doc-section">
          <h2 className="doc-h2">Этапы работ</h2>
          <ol className="doc-stages">
            <li><b>Подготовка площадки</b> — 3–5 дней</li>
            <li><b>Основные работы</b> — 14–35 дней (зависит от объёма)</li>
            <li><b>Отделка / финиш</b> — 7–14 дней</li>
            <li><b>Сдача-приёмка</b> — 1–2 дня</li>
          </ol>
        </section>
      )}
      {kp.sections?.terms && (
        <section className="doc-section">
          <h2 className="doc-h2">Условия оплаты и сроки</h2>
          <p className="doc-p">{kp.payment}. Срок выхода на объект — 5 рабочих дней с момента подписания договора.</p>
        </section>
      )}
      {kp.sections?.includes && (
        <section className="doc-section">
          <h2 className="doc-h2">Что входит в стоимость</h2>
          <ul className="doc-ul">
            <li>Материалы из расчёта</li>
            <li>Работы по монтажу</li>
            <li>Вывоз строительного мусора в пределах объекта</li>
            <li>Гарантийное обслуживание</li>
          </ul>
        </section>
      )}
      {kp.sections?.excludes && (
        <section className="doc-section">
          <h2 className="doc-h2">Что не входит</h2>
          <ul className="doc-ul">
            <li>Согласование проектной документации в гос. органах</li>
            <li>Электромонтажные работы внутренних сетей</li>
            <li>Чистовая отделка (если не оговорено отдельно)</li>
            <li>Доставка нестандартных материалов</li>
          </ul>
        </section>
      )}
      <footer className="doc-foot">
        <div className="doc-foot-grand">
          <span>Итоговая сумма:</span>
          <b>₽ {fmt(Math.round(grand))}</b>
        </div>
        <div className="doc-foot-disclaimer">
          Расчёт предварительный, требует финальной проверки специалиста. Цены могут быть скорректированы после уточнения объёмов и спецификаций.
        </div>
        <div className="doc-foot-sign">
          <div>
            <div className="doc-foot-sign-name">______________________</div>
            <div className="doc-foot-sign-label">Исполнитель</div>
          </div>
          <div>
            <div className="doc-foot-sign-name">______________________</div>
            <div className="doc-foot-sign-label">Заказчик</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PrintDocumentEstimate({ project, allRows, stats }) {
  const grand = (allRows || []).filter(r => r.include !== false).reduce((s, r) => s + r.total, 0);
  const groups = {};
  for (const r of (allRows || [])) {
    const g = r.group || "Прочее";
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  }
  return (
    <div className="print-document doc-estimate">
      <header className="doc-head">
        <div className="doc-logo">
          <div className="doc-logo-mark">SK</div>
          <div>
            <div className="doc-logo-name">Stroika · Сметная сводка</div>
            <div className="doc-logo-sub">Автоматический расчёт по планировке</div>
          </div>
        </div>
        <div className="doc-head-meta">
          <div><b>{project.name}</b></div>
          <div>от {new Date().toLocaleDateString("ru-RU")}</div>
        </div>
      </header>
      <h1 className="doc-title">Сметная сводка</h1>
      <section className="doc-meta-grid">
        <div><div className="doc-mlabel">Уровней</div><div className="doc-mval">{project.levels.length}</div></div>
        <div><div className="doc-mlabel">Общая площадь</div><div className="doc-mval">{(stats?.totalArea || 0).toFixed(0)} м²</div></div>
        <div><div className="doc-mlabel">Площадь кровли</div><div className="doc-mval">{(stats?.totalRoofArea || 0).toFixed(0)} м²</div></div>
        <div><div className="doc-mlabel">Позиций</div><div className="doc-mval">{(allRows || []).length}</div></div>
      </section>
      <section className="doc-section">
        <table className="doc-table">
          <thead>
            <tr><th>Раздел</th><th>Позиция</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([g, list]) => list.map((r, i) => (
              <tr key={r.id} style={r.include === false ? { opacity: 0.4, textDecoration: "line-through" } : null}>
                {i === 0 && <td rowSpan={list.length} className="doc-cat">{g}</td>}
                <td>{r.name}{r.levelName ? <span className="doc-lvl"> · {r.levelName}</span> : null}</td>
                <td className="num">{fmt(r.qty)} {r.unit}</td>
                <td className="num">₽ {fmt(Math.round((r.mat + r.work) || 0))}</td>
                <td className="num"><b>₽ {fmt(Math.round(r.total))}</b></td>
              </tr>
            )))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="doc-total-label">ИТОГО</td>
              <td className="num doc-total"><b>₽ {fmt(Math.round(grand))}</b></td>
            </tr>
          </tfoot>
        </table>
      </section>
      <footer className="doc-foot">
        <div className="doc-foot-disclaimer">
          Сводка предварительная. Финальную проверку выполняет специалист.
        </div>
      </footer>
    </div>
  );
}

function PrintDocumentRoofCard({ project }) {
  const roofLevel = project.levels.find(l => l.type === "roof" || l.type === "industrial_roof");
  const d = roofLevel ? project.levelsData[roofLevel.id] : null;
  const summary = d && window.plGetRoofSummary ? window.plGetRoofSummary(d) : null;
  if (!roofLevel || !summary) {
    return (
      <div className="print-document doc-roof">
        <div className="doc-empty">В этом проекте нет уровня «Кровля» / «Промышленная кровля».</div>
      </div>
    );
  }
  const segments = d.roof?.segments || [];
  return (
    <div className="print-document doc-roof">
      <header className="doc-head">
        <div className="doc-logo">
          <div className="doc-logo-mark">SK</div>
          <div>
            <div className="doc-logo-name">Кровельная карта</div>
            <div className="doc-logo-sub">{project.name}</div>
          </div>
        </div>
        <div className="doc-head-meta">
          <div><b>{roofLevel.name}</b></div>
          <div>от {new Date().toLocaleDateString("ru-RU")}</div>
        </div>
      </header>
      <h1 className="doc-title">Технологическая карта кровли</h1>
      <section className="doc-meta-grid doc-meta-grid-6">
        <div><div className="doc-mlabel">Площадь</div><div className="doc-mval">{summary.area.toFixed(0)} м²</div></div>
        <div><div className="doc-mlabel">Периметр</div><div className="doc-mval">{summary.perimeter.toFixed(1)} м</div></div>
        <div><div className="doc-mlabel">Парапет</div><div className="doc-mval">{summary.parapetLen.toFixed(1)} м</div></div>
        <div><div className="doc-mlabel">Сегменты</div><div className="doc-mval">{summary.segmentsCount}</div></div>
        <div><div className="doc-mlabel">Воронки</div><div className="doc-mval">{summary.drainsCount}</div></div>
        <div><div className="doc-mlabel">Аэраторы</div><div className="doc-mval">{summary.aeratorsCount}</div></div>
      </section>
      <section className="doc-section">
        <h2 className="doc-h2">Материал покрытия</h2>
        <p className="doc-p"><b>{summary.material}</b> · уклон {summary.slope}% · высота парапета {summary.parapetHeight} м</p>
      </section>
      {segments.length > 0 && (
        <section className="doc-section">
          <h2 className="doc-h2">Сегменты ({segments.length})</h2>
          <table className="doc-table">
            <thead><tr><th>Сегмент</th><th>Площадь</th><th>Материал</th><th>Статус</th></tr></thead>
            <tbody>
              {segments.map(s => (
                <tr key={s.id}>
                  <td>{s.name || s.id}</td>
                  <td className="num">{((s.w || 0) * (s.h || 0)).toFixed(1)} м²</td>
                  <td>{s.material || "—"}</td>
                  <td>{s.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <footer className="doc-foot">
        <div className="doc-foot-disclaimer">
          Карта предварительная. Окончательные объёмы уточняются на объекте.
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// EXPORT MODAL — picks variant, shows preview, fires window.print()
// ============================================================
function ExportModal({ open, onClose, variant, project, allRows, stats, kp }) {
  if (!open) return null;
  const labels = {
    estimate: "Сметная сводка",
    proposal: "Коммерческое предложение",
    roof:     "Кровельная карта",
    all:      "Проект целиком (все документы)",
  };
  function doPrint() {
    document.body.classList.add("printing");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("printing"), 200);
    }, 50);
  }
  return (
    <div className="qs-backdrop" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qs-head">
          <div>
            <div className="qs-eyebrow"><I.Download size={11}/> Экспорт</div>
            <div className="qs-title">{labels[variant] || "Документ"}</div>
          </div>
          <button className="qs-close" onClick={onClose}><I.Close size={16}/></button>
        </div>
        <div className="export-toolbar">
          <div className="dim" style={{ fontSize: 12 }}>
            Откроется системный диалог печати. Выберите «Сохранить как PDF» или принтер.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Закрыть</button>
            <button className="btn btn-accent btn-sm" onClick={doPrint}><I.FilePdf size={13}/> Открыть печать</button>
          </div>
        </div>
        <div className="export-preview">
          {(variant === "estimate" || variant === "all") && <PrintDocumentEstimate project={project} allRows={allRows} stats={stats}/>}
          {(variant === "proposal" || variant === "all") && kp && <PrintDocumentKp kp={kp} project={project} allRows={allRows}/>}
          {(variant === "proposal" || variant === "all") && !kp && (
            <div className="doc-empty">Сначала сформируйте КП на вкладке «КП».</div>
          )}
          {(variant === "roof" || variant === "all") && <PrintDocumentRoofCard project={project}/>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { KpGenerationModal, KpPreviewModal, ExportModal, PrintDocumentKp, PrintDocumentEstimate, PrintDocumentRoofCard });

// ============================================================
// PDF ANALYSIS MODAL — UX-прототип AI/vector PDF-предобработки.
// 4 tabs: Листы / Извлечённые данные / Кандидаты / Черновик сметы.
// ============================================================
const PDF_ANALYSIS_TABS = [
  { id: "sheets",     label: "Листы",            icon: "Estimate" },
  { id: "extracted",  label: "Извлечённые данные", icon: "Layers" },
  { id: "candidates", label: "Кандидаты на холсте", icon: "Wall" },
  { id: "estimate",   label: "Черновик сметы",     icon: "Calc" },
];

function PdfAnalysisModal({ open, onClose, analysis, candidates, onUpdateCandidate, onAcceptAll, onRejectAll, onCommit, onUseAsBackground, onJumpToCandidate }) {
  const [tab, setTab] = useStaP("sheets");
  const [sheetFilter, setSheetFilter] = useStaP("all");
  useStaPEffect(() => { if (!open) setTab("sheets"); }, [open]);
  if (!open || !analysis) return null;
  const sheets = analysis.sheets || [];
  const filteredSheets = sheetFilter === "all" ? sheets : sheets.filter(s => s.type === sheetFilter);

  const counts = {
    walls:    (candidates.walls || []).length,
    openings: (candidates.openings || []).length,
    rooms:    (candidates.rooms || []).length,
    annots:   (candidates.annotations || []).length,
  };
  const total = counts.walls + counts.openings + counts.rooms + counts.annots;
  const accepted = [...(candidates.walls||[]), ...(candidates.openings||[]), ...(candidates.rooms||[]), ...(candidates.annotations||[])]
    .filter(c => c.status === "accepted" || c.status === "new").length;
  const rejected = [...(candidates.walls||[]), ...(candidates.openings||[]), ...(candidates.rooms||[]), ...(candidates.annotations||[])]
    .filter(c => c.status === "rejected").length;

  return (
    <div className="qs-backdrop" onClick={onClose}>
      <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-head">
          <div>
            <div className="qs-eyebrow"><I.Sparkles size={11}/> AI-предобработка PDF · MVP</div>
            <div className="rc-title">{analysis.fileName}</div>
            <div className="pdf-head-meta">
              <span>{analysis.pages} страниц</span>
              <span>·</span>
              <span>{analysis.fileSize}</span>
              <span>·</span>
              <span className="pdf-head-confidence">
                <span className="pdf-conf-dot" style={{ background: confidenceColor(analysis.overallConfidence) }}/>
                Уверенность анализа · {Math.round(analysis.overallConfidence * 100)}%
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onUseAsBackground && (
              <button className="btn btn-ghost btn-sm" onClick={onUseAsBackground} title="Использовать первую страницу как подложку без анализа">
                <I.Upload size={13}/> Использовать как подложку
              </button>
            )}
            <button className="qs-close" onClick={onClose}><I.Close size={16}/></button>
          </div>
        </div>
        <div className="pdf-tabs">
          {PDF_ANALYSIS_TABS.map(t => {
            const Icn = I[t.icon] || I.Dashboard;
            return (
              <button key={t.id} className={`rc-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                <Icn size={13}/> {t.label}
                {t.id === "candidates" && total > 0 && <span className="pdf-tab-badge">{total}</span>}
                {t.id === "sheets" && sheets.length > 0 && <span className="pdf-tab-badge dim">{sheets.length}</span>}
              </button>
            );
          })}
        </div>
        <div className="pdf-body">
          {tab === "sheets" && (
            <PdfSheetsTab sheets={sheets} sheetFilter={sheetFilter} setSheetFilter={setSheetFilter} filteredSheets={filteredSheets} onJumpAnalyze={() => setTab("candidates")}/>
          )}
          {tab === "extracted" && <PdfExtractedTab tables={analysis.tables}/>}
          {tab === "candidates" && <PdfCandidatesTab candidates={candidates} counts={counts} accepted={accepted} rejected={rejected}
            onUpdateCandidate={onUpdateCandidate} onAcceptAll={onAcceptAll} onRejectAll={onRejectAll}
            onCommit={onCommit} onJumpToCandidate={onJumpToCandidate}/>}
          {tab === "estimate" && <PdfEstimateTab rows={analysis.estimateRows}/>}
        </div>
        <div className="pdf-footer">
          <div className="pdf-footer-hint">
            <I.Info size={13}/>
            <span>Демо UX-прототип. Реальный PDF-парсер появится в production-версии.</span>
          </div>
          <div className="pdf-footer-actions">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Закрыть</button>
            <button className="btn btn-accent btn-sm" onClick={onCommit} disabled={total === 0}>
              <I.Sparkles size={13}/> Конвертировать в объекты ({accepted})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function confidenceColor(c) {
  if (c >= 0.9) return "#15803D";
  if (c >= 0.78) return "#7C3AED";
  if (c >= 0.6) return "#EA580C";
  return "#DC2626";
}

function PdfSheetsTab({ sheets, sheetFilter, setSheetFilter, filteredSheets, onJumpAnalyze }) {
  const types = [...new Set(sheets.map(s => s.type))];
  return (
    <>
      <div className="pdf-sheet-filter">
        <button className={`rsf ${sheetFilter === "all" ? "active" : ""}`} onClick={() => setSheetFilter("all")}>Все · {sheets.length}</button>
        {types.map(t => {
          const meta = window.PDF_SHEET_TYPES[t] || { label: t };
          const n = sheets.filter(s => s.type === t).length;
          return (
            <button key={t} className={`rsf ${sheetFilter === t ? "active" : ""}`} onClick={() => setSheetFilter(t)}>
              {meta.label} · {n}
            </button>
          );
        })}
      </div>
      <div className="pdf-sheets-list">
        {filteredSheets.map(s => {
          const meta = window.PDF_SHEET_TYPES[s.type] || { label: s.type, color: "#475569" };
          return (
            <div key={s.num} className="pdf-sheet-card">
              <div className="pdf-sheet-thumb" style={{ borderColor: meta.color }}>
                <div className="pdf-sheet-num">{s.num.toString().padStart(2, "0")}</div>
                <div className="pdf-sheet-thumb-fold"/>
              </div>
              <div className="pdf-sheet-body">
                <div className="pdf-sheet-title">{s.title}</div>
                <div className="pdf-sheet-tags">
                  <span className="pdf-sheet-type-pill" style={{ background: meta.color + "22", color: meta.color }}>{meta.label}</span>
                  <span className="pdf-conf-pill">
                    <span className="pdf-conf-dot" style={{ background: confidenceColor(s.confidence) }}/>
                    {Math.round(s.confidence * 100)}%
                  </span>
                  {s.tags?.includes("traceable") && <span className="pdf-sheet-tag">подходит для обводки</span>}
                  {s.tags?.includes("tables")    && <span className="pdf-sheet-tag">есть таблицы</span>}
                  {s.tags?.includes("dims")      && <span className="pdf-sheet-tag">есть размеры</span>}
                </div>
              </div>
              <div className="pdf-sheet-actions">
                <button className="pdf-sheet-act" title="Открыть как подложку"><I.Upload size={12}/></button>
                {s.tags?.includes("traceable") && (
                  <button className="pdf-sheet-act primary" onClick={onJumpAnalyze} title="Анализировать">
                    <I.Sparkles size={12}/>
                  </button>
                )}
                <button className="pdf-sheet-act" title="Пропустить"><I.Close size={12}/></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="pdf-info-block">
        <div className="pdf-info-title">Как работает</div>
        <ul className="pdf-info-list">
          <li><b>Векторные PDF</b> анализируются лучше всего.</li>
          <li><b>Сканы и фото</b> требуют ручной проверки.</li>
          <li>Система предлагает <b>кандидаты</b>, специалист подтверждает.</li>
          <li><b>Финальную смету</b> проверяет человек.</li>
        </ul>
      </div>
    </>
  );
}

function PdfExtractedTab({ tables }) {
  if (!tables) return <div className="dim" style={{ padding: 20 }}>Данные не извлечены.</div>;
  return (
    <div className="pdf-tables">
      {Object.entries(tables).map(([key, t]) => (
        <div key={key} className="pdf-table-card">
          <div className="pdf-table-head">
            <div>
              <div className="pdf-table-title">{t.title}</div>
              <div className="pdf-table-sub dim">источник: лист {t.sheet} · {t.rows.length} строк</div>
            </div>
            <button className="btn btn-ghost btn-sm"><I.Download size={12}/> CSV</button>
          </div>
          <div className="pdf-table-scroll">
            <table className="pdf-data-table">
              <thead>
                <tr>{t.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {t.rows.map((row, i) => (
                  <tr key={i} className={row[0] === "ИТОГО" ? "total" : ""}>
                    {row.map((cell, j) => <td key={j} className={j === row.length - 1 ? "num" : ""}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function PdfCandidatesTab({ candidates, counts, accepted, rejected, onUpdateCandidate, onAcceptAll, onRejectAll, onCommit, onJumpToCandidate }) {
  const lists = [
    { key: "walls",       label: "Стены и перегородки", icon: "Wall",   items: candidates.walls || [] },
    { key: "openings",    label: "Окна и двери",        icon: "Window", items: candidates.openings || [] },
    { key: "rooms",       label: "Помещения",           icon: "Room",   items: candidates.rooms || [] },
    { key: "annotations", label: "Аннотации и точки",   icon: "Estimate", items: candidates.annotations || [] },
  ];
  return (
    <>
      <div className="pdf-cand-summary">
        <div className="pdf-cand-stat">
          <div className="pdf-cand-num">{counts.walls}</div>
          <div className="pdf-cand-lbl">Стен</div>
        </div>
        <div className="pdf-cand-stat">
          <div className="pdf-cand-num">{counts.openings}</div>
          <div className="pdf-cand-lbl">Окон / дверей</div>
        </div>
        <div className="pdf-cand-stat">
          <div className="pdf-cand-num">{counts.rooms}</div>
          <div className="pdf-cand-lbl">Помещений</div>
        </div>
        <div className="pdf-cand-stat">
          <div className="pdf-cand-num">{counts.annots}</div>
          <div className="pdf-cand-lbl">Точек/нот</div>
        </div>
        <div className="pdf-cand-spacer"/>
        <div className="pdf-cand-summary-meta">
          <div className="dim" style={{ fontSize: 11 }}>Принято</div>
          <div className="pdf-cand-num" style={{ color: "var(--success)" }}>{accepted}</div>
        </div>
        <div className="pdf-cand-summary-meta">
          <div className="dim" style={{ fontSize: 11 }}>Отклонено</div>
          <div className="pdf-cand-num" style={{ color: "var(--text-muted)" }}>{rejected}</div>
        </div>
      </div>
      <div className="pdf-cand-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={onAcceptAll}><I.Check size={12}/> Принять всё</button>
        <button className="btn btn-ghost btn-sm" onClick={onRejectAll}><I.Close size={12}/> Отклонить всё</button>
        <span style={{ flex: 1 }}/>
        <button className="btn btn-accent btn-sm" onClick={onCommit}><I.Sparkles size={12}/> Конвертировать → объекты</button>
      </div>
      {lists.map(group => {
        if (!group.items.length) return null;
        const Icn = I[group.icon] || I.Wall;
        return (
          <div key={group.key} className="pdf-cand-group">
            <div className="pdf-cand-group-head">
              <div className="pdf-cand-group-title"><Icn size={13}/> {group.label} · {group.items.length}</div>
            </div>
            <div className="pdf-cand-list">
              {group.items.map(c => {
                const lowConf = c.confidence < PDF_LOW_CONF;
                return (
                  <div key={c.id} className={`pdf-cand-row status-${c.status}`}>
                    <button className={`pdf-cand-row-name ${c.status === "rejected" ? "rejected" : ""}`}
                      onClick={() => onJumpToCandidate && onJumpToCandidate(c)} title="Показать на холсте">
                      <span className="pdf-cand-bullet" style={{ background: lowConf ? "#EA580C" : (group.key === "walls" && c.type === "external") ? "#1E40AF" : group.key === "rooms" ? "#7C3AED" : "#2563EB" }}/>
                      <span>{candidateLabel(group.key, c)}</span>
                    </button>
                    <span className="pdf-cand-source dim">{c.sourceLabel || `с.${c.sourceSheet}`}</span>
                    <span className="pdf-conf-pill" title={`Уверенность ${(c.confidence * 100).toFixed(0)}%`}>
                      <span className="pdf-conf-dot" style={{ background: confidenceColor(c.confidence) }}/>
                      {Math.round(c.confidence * 100)}%
                    </span>
                    <div className="pdf-cand-actions">
                      <button className={`pdf-cand-tog ${c.status === "accepted" || c.status === "new" ? "on" : ""}`}
                        onClick={() => onUpdateCandidate(c.id, group.key, { status: "accepted" })}
                        title="Принять">
                        <I.Check size={10} stroke={3}/>
                      </button>
                      <button className={`pdf-cand-tog ${c.status === "rejected" ? "on rej" : ""}`}
                        onClick={() => onUpdateCandidate(c.id, group.key, { status: "rejected" })}
                        title="Отклонить">
                        <I.Close size={10} stroke={3}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function candidateLabel(kind, c) {
  if (kind === "walls") {
    const len = Math.hypot(c.x2 - c.x1, c.y2 - c.y1).toFixed(1);
    return `${c.type === "external" ? "Внешняя стена" : "Перегородка"} · ${len} м`;
  }
  if (kind === "openings") {
    const w = (c.w != null ? c.w : Math.hypot(c.x2 - c.x1, c.y2 - c.y1)).toFixed(2);
    return `${c.kind === "door" ? "Дверь" : "Окно"} · ${w} м`;
  }
  if (kind === "rooms") {
    return `${c.name} · ${(c.w * c.h).toFixed(1)} м²`;
  }
  if (kind === "annotations") {
    return c.text || c.label || "Аннотация";
  }
  return "Кандидат";
}

function PdfEstimateTab({ rows }) {
  if (!rows || !rows.length) return <div className="dim" style={{ padding: 20 }}>Нет позиций.</div>;
  const groups = {};
  for (const r of rows) {
    const g = r.group || "Прочее";
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  }
  const total = rows.filter(r => r.include !== false).reduce((s, r) => s + r.total, 0);
  return (
    <div className="rc-estimate">
      <div className="rc-est-toolbar">
        <div className="rc-est-summary">
          <div className="rc-est-stat"><span>Позиций</span><b>{rows.length}</b></div>
          <div className="rc-est-stat"><span>Включено</span><b className="ok">₽ {fmt(Math.round(total))}</b></div>
          <div className="rc-est-stat"><span>Источник</span><b style={{ color: "var(--primary)" }}>PDF-предобработка</b></div>
        </div>
      </div>
      {Object.entries(groups).map(([gName, list]) => {
        const sub = list.reduce((s, r) => s + r.total, 0);
        return (
          <div key={gName} className="rc-est-group">
            <div className="rc-est-group-head">
              <div className="rc-est-group-title">{gName}</div>
              <div className="rc-est-group-sub">₽ {fmt(Math.round(sub))}</div>
            </div>
            <div className="rc-est-table">
              <div className="rc-est-row rc-est-th">
                <span></span>
                <span>Позиция</span>
                <span>Кол-во</span>
                <span>Цена ед.</span>
                <span>Сумма</span>
              </div>
              {list.map(r => (
                <div key={r.id} className="rc-est-row">
                  <span className="ai-source-pill">PDF</span>
                  <span className="rc-est-name">
                    <div>{r.name}</div>
                    <div className="rc-est-source">{r.source || "PDF"}</div>
                  </span>
                  <span className="rc-est-qty">{fmt(r.qty)} {r.unit}</span>
                  <span className="rc-est-qty">₽ {fmt(r.mat + r.work)}</span>
                  <span className="rc-est-sum">₽ {fmt(Math.round(r.total))}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="rc-est-footer">
        <div className="rc-est-footer-meta">
          AI-предобработка PDF · позиции добавятся в основной черновик сметы после конвертации кандидатов в объекты.
        </div>
        <div className="rc-est-grand">
          <span>Итого по PDF</span>
          <b>₽ {fmt(Math.round(total))}</b>
        </div>
      </div>
    </div>
  );
}

// Monetization hint card — embedded in Result Center
function PdfMonetizationCard() {
  return (
    <div className="rc-card pdf-monet-card">
      <div className="rc-card-title">
        <I.Sparkles size={12} style={{ verticalAlign: -1, marginRight: 4, color: "var(--accent)" }}/>
        AI-предобработка PDF
      </div>
      <ul className="rc-check-list" style={{ paddingLeft: 18 }}>
        <li><b>Входит:</b> подложка и ручная обводка</li>
        <li><b>Дополнительно:</b> распознавание листов, ведомостей и кандидатов</li>
        <li><b>Сложные PDF:</b> авторазбор проекта — отдельный модуль</li>
      </ul>
      <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>Demo MVP. В production — реальный векторный парсер.</div>
    </div>
  );
}

const PDF_LOW_CONF = 0.78;

Object.assign(window, { PdfAnalysisModal, PdfMonetizationCard });
