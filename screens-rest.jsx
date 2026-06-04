/* global React, I, formatRu */
const { useState: useSt, useMemo: useMm } = React;

// Helper for buttons that don't have a real implementation in the demo —
// gives a consistent, honest toast instead of a dead click.
const mock = (title, body) => () => window.showToast({ title, body, kind: "info" });

// ============================================================
// Сметы (Estimates)
// ============================================================
const ESTIMATES = [
  { id: "EST-247", project: "Дом 142 м² · Захаров",   client: "А. Захаров",      objectType: "ИЖС",         date: "04.06.26", status: "На проверке",    statusColor: "warning", cost: 3145000, total: 3837000, profit: 692000 },
  { id: "EST-246", project: "Ремонт ЖК «Заря»",        client: "ООО «Заря»",      objectType: "Квартира",    date: "03.06.26", status: "Отправлено клиенту", statusColor: "info", cost: 1020000, total: 1250000, profit: 230000 },
  { id: "EST-245", project: "Склад А-7",               client: "ИП Степанов",     objectType: "Коммерч.",    date: "02.06.26", status: "Готово",         statusColor: "success", cost: 12100000, total: 14700000, profit: 2600000 },
  { id: "EST-244", project: "Баня · Никитино",         client: "В. Никитин",      objectType: "Малая форма", date: "01.06.26", status: "Готово",         statusColor: "success", cost: 540000, total: 680000, profit: 140000 },
  { id: "EST-243", project: "Котедж 210 м²",           client: "Семья Морозовых", objectType: "ИЖС",         date: "30.05.26", status: "Черновик",        statusColor: "neutral", cost: null, total: null, profit: null },
  { id: "EST-242", project: "Офис Левый Берег",        client: "ООО «Левый Берег»", objectType: "Коммерч.", date: "29.05.26", status: "Готово",         statusColor: "success", cost: 2840000, total: 3480000, profit: 640000 },
  { id: "EST-241", project: "Реконструкция фасада",    client: "ТСЖ «Радуга»",    objectType: "Реконстр.",   date: "28.05.26", status: "Отправлено клиенту", statusColor: "info", cost: 880000, total: 1080000, profit: 200000 },
  { id: "EST-240", project: "Гараж кирпичный",         client: "М. Сидоров",      objectType: "Малая форма", date: "27.05.26", status: "Черновик",        statusColor: "neutral", cost: null, total: null, profit: null },
  { id: "EST-239", project: "Таунхаус кв. 4-6",        client: "ООО «ЮгДевелопмент»", objectType: "ИЖС",     date: "26.05.26", status: "На проверке",    statusColor: "warning", cost: 4250000, total: 5180000, profit: 930000 },
];

function EstimatesScreen({ onNav }) {
  const generated = (window.plLoadGeneratedEstimates ? window.plLoadGeneratedEstimates() : []).map(g => ({
    id: g.id, project: g.project, client: g.client || "—", objectType: "AI · Планировка",
    date: g.createdAt ? new Date(g.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "",
    status: g.status || "Готово", statusColor: g.statusColor || "success",
    cost: Math.round(g.total * 0.82), total: g.total, profit: Math.round(g.total * 0.18),
    fromPlanning: true, _raw: g,
  }));
  const ALL = [...generated, ...ESTIMATES];
  const [selected, setSelected] = useSt(ALL[0]);
  const [statusFilter, setStatusFilter] = useSt("Все");

  const filtered = statusFilter === "Все" ? ALL : ALL.filter(e => e.status === statusFilter);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Сметы</h1>
          <p className="page-subtitle">{ESTIMATES.length} смет · 3 ожидают проверки · потенциал ₽ 31,9 M</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={mock("Фильтры", "В production — фильтр по клиенту, дате, типу, ответственному.")}><I.Filter size={14}/> Фильтры</button>
          <button className="btn btn-secondary" onClick={mock("Экспорт XLSX", "Сметы будут выгружаться в Excel в production-версии.")}><I.Download size={14}/> Экспорт XLSX</button>
          <button className="btn btn-primary" onClick={() => onNav("planning")}><I.Plus size={14}/> Новая смета</button>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {["Все", "Черновик", "На проверке", "Готово", "Отправлено клиенту"].map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setStatusFilter(s)}>
            {s}
            {s !== "Все" && <span style={{ marginLeft: 4, opacity: 0.65 }}>{ALL.filter(e => e.status === s).length}</span>}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18, alignItems: "start" }}>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Проект</th>
                <th>Клиент</th>
                <th>Тип</th>
                <th>Дата</th>
                <th>Статус</th>
                <th className="num">Себестоимость</th>
                <th className="num">Итог</th>
                <th className="num">Прибыль</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className={selected?.id === e.id ? "selected" : ""} onClick={() => setSelected(e)}>
                  <td>
                    <div className="strong">{e.project}</div>
                    <div className="dim" style={{ fontSize: 11.5 }}>{e.id}{e.fromPlanning && <span className="ai-source-pill" style={{ marginLeft: 6 }}>из Планировки</span>}</div>
                  </td>
                  <td>{e.client}</td>
                  <td><span className="dim">{e.objectType}</span></td>
                  <td className="dim">{e.date}</td>
                  <td><span className={`badge badge-${e.statusColor}`}><span className="badge-dot"/>{e.status}</span></td>
                  <td className="num">{e.cost ? `₽ ${formatRu(e.cost)}` : <span className="dim">—</span>}</td>
                  <td className="num strong">{e.total ? `₽ ${formatRu(e.total)}` : <span className="dim">—</span>}</td>
                  <td className="num" style={{ color: e.profit ? "var(--success)" : "var(--text-faint)" }}>
                    {e.profit ? `+₽ ${formatRu(e.profit)}` : "—"}
                  </td>
                  <td><button className="icon-btn" onClick={(ev) => { ev.stopPropagation(); window.showToast({ title: "Действия по смете", body: "Открыть · Дублировать · Архивировать · Экспорт", kind: "info" }); }}><I.More size={15}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && <EstimateDetail e={selected} onNav={onNav}/>}
      </div>
    </div>
  );
}

function EstimateDetail({ e, onNav }) {
  const rows = e.cost ? [
    { sec: "Состав работ",     items: [
      { name: "Демонтажные работы", qty: 12, unit: "часов", price: 850, total: 10200 },
      { name: "Подготовка основания", qty: 142, unit: "м²", price: 320, total: 45440 },
    ]},
    { sec: "Материалы", items: [
      { name: "Газобетон D500, 400мм", qty: 56, unit: "пог.м", price: 4800, total: 268800 },
      { name: "Гипсокартон + профиль",  qty: 38, unit: "пог.м", price: 1600, total: 60800 },
      { name: "Окна REHAU Blitz",       qty: 5,  unit: "шт",    price: 18000, total: 90000 },
      { name: "Двери Софья 1.06",       qty: 5,  unit: "шт",    price: 12000, total: 60000 },
    ]},
    { sec: "Работы", items: [
      { name: "Кладка стен",        qty: 56, unit: "пог.м", price: 2200, total: 123200 },
      { name: "Монтаж окон",        qty: 5,  unit: "шт",    price: 4500, total: 22500 },
      { name: "Монтаж дверей",      qty: 5,  unit: "шт",    price: 3500, total: 17500 },
      { name: "Электрика (точки)",  qty: 64, unit: "шт",    price: 1200, total: 76800 },
    ]},
    { sec: "Доставка", items: [
      { name: "Доставка материалов · 3 рейса", qty: 3, unit: "рейс", price: 8500, total: 25500 },
    ]},
    { sec: "Дополнительные расходы", items: [
      { name: "Вывоз мусора",       qty: 4, unit: "контейнер", price: 6500, total: 26000 },
      { name: "Подъём на этаж",     qty: 1, unit: "услуга", price: 12000, total: 12000 },
    ]},
  ] : null;

  return (
    <div className="detail-pane" style={{ position: "sticky", top: 80, maxHeight: "calc(100vh - 110px)" }}>
      <div className="detail-head">
        <div className="hstack" style={{ marginBottom: 8 }}>
          <span className={`badge badge-${e.statusColor}`}><span className="badge-dot"/>{e.status}</span>
          <span className="dim" style={{ fontSize: 12 }}>{e.id}</span>
        </div>
        <h3 className="card-title" style={{ fontSize: 15, marginBottom: 4 }}>{e.project}</h3>
        <div className="dim" style={{ fontSize: 12.5 }}>{e.client} · {e.objectType} · от {e.date}</div>
      </div>
      <div className="detail-body">
        {!rows ? (
          <div className="empty-state" style={{ padding: 24, border: "1px dashed var(--border-strong)" }}>
            <I.Edit size={20} style={{ color: "var(--text-muted)" }}/>
            <h3>Черновик</h3>
            <p>Смета ещё не рассчитана</p>
            <button className="btn btn-primary btn-sm" onClick={() => onNav("planning")}><I.Calc size={13}/> Продолжить расчёт</button>
          </div>
        ) : (
          <>
            {rows.map((sec, i) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <div className="insp-title" style={{ marginBottom: 8 }}>{sec.sec}</div>
                {sec.items.map((it, j) => (
                  <div key={j} style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "4px 0", fontSize: 12.5, borderBottom: "1px solid var(--border-soft)" }}>
                    <div>
                      <div>{it.name}</div>
                      <div className="dim" style={{ fontSize: 11 }}>{it.qty} {it.unit} × ₽ {formatRu(it.price)}</div>
                    </div>
                    <div className="num strong" style={{ alignSelf: "center" }}>₽ {formatRu(it.total)}</div>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div className="calc-row"><span className="label">Сумма работ + материалов</span><span className="value">₽ {formatRu(e.cost)}</span></div>
              <div className="calc-row accent"><span className="label">Наценка 22%</span><span className="value">+ ₽ {formatRu(e.total - e.cost)}</span></div>
              <div className="calc-row total"><span className="label">Итого для клиента</span><span className="value" style={{ color: "var(--primary)" }}>₽ {formatRu(e.total)}</span></div>
              <div className="calc-row profit"><span className="label">Прибыль</span><span className="value">+ ₽ {formatRu(e.profit)}</span></div>
            </div>
          </>
        )}
      </div>
      {rows && (
        <div className="card-foot" style={{ borderRadius: 0, background: "var(--surface-2)" }}>
          <button className="btn btn-secondary btn-sm" onClick={mock("Печать сметы", "Нажмите Ctrl+P или используйте «Экспорт» в Планировке.")}><I.FilePdf size={13}/> PDF</button>
          <button className="btn btn-primary btn-sm" onClick={() => onNav("kp")}>
            <I.Proposal size={13}/> Сформировать КП
          </button>
        </div>
      )}
    </div>
  );
}

window.EstimatesScreen = EstimatesScreen;

// ============================================================
// КП (Proposals)
// ============================================================
const KPS = [
  { id: "KP-118", project: "Дом 142 м² · Захаров",   client: "А. Захаров",      total: 3837000, status: "Готово к отправке", statusColor: "warning", sent: null,         opened: null },
  { id: "KP-117", project: "Ремонт ЖК «Заря»",        client: "ООО «Заря»",      total: 1250000, status: "Просмотрено",      statusColor: "info",    sent: "вчера, 14:20", opened: "сегодня, 09:15" },
  { id: "KP-116", project: "Склад А-7",               client: "ИП Степанов",     total: 14700000, status: "В работе у клиента", statusColor: "info", sent: "3 дня назад", opened: "2 дня назад" },
  { id: "KP-115", project: "Реконструкция фасада",    client: "ТСЖ «Радуга»",    total: 1080000, status: "Подписано",        statusColor: "success", sent: "5 дней назад", opened: "4 дня назад" },
  { id: "KP-114", project: "Офис Левый Берег",        client: "ООО «Левый Берег»", total: 3480000, status: "Отклонено",      statusColor: "danger",  sent: "неделю назад", opened: "5 дн назад" },
];

function KpScreen({ onNav }) {
  const generated = (window.plLoadGeneratedProposals ? window.plLoadGeneratedProposals() : []).map(g => ({
    id: g.id, project: g.project || g.object || "Проект", client: g.client || "—", total: g.total || 0,
    status: g.status || "Готово к отправке", statusColor: g.statusColor || "warning",
    sent: g.sent || null, opened: null,
    createdAt: g.createdAt, validUntil: g.validUntil,
    fromPlanning: true,
    sourceType: g.type, source: g.source || "Планировка",
    _raw: g,
  }));
  const ALL = [...generated, ...KPS];
  const [selected, setSelected] = useSt(ALL[0]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Коммерческие предложения</h1>
          <p className="page-subtitle">{ALL.length} КП{generated.length > 0 ? ` · ${generated.length} из Планировки` : ""}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={mock("Фильтры КП", "По статусу, клиенту, сроку действия, сумме.")}><I.Filter size={14}/> Фильтры</button>
          <button className="btn btn-primary" onClick={() => onNav && onNav("planning")}><I.Plus size={14}/> Новое КП из планировки</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18, alignItems: "start" }}>
        {/* List */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "10px 14px" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Все КП</span>
            <button className="btn btn-ghost btn-sm" onClick={mock("Сортировка", "По дате · сумме · клиенту · статусу.")}><I.Sort size={13}/></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ALL.map(k => (
              <button
                key={k.id}
                onClick={() => setSelected(k)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--border-soft)",
                  background: selected?.id === k.id ? "var(--primary-soft)" : "var(--surface)",
                  borderLeft: selected?.id === k.id ? "3px solid var(--primary)" : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span className="strong" style={{ fontSize: 13 }}>
                    {k.id}
                    {k.fromPlanning && <span className="ai-source-pill" style={{ marginLeft: 6 }}>AI</span>}
                  </span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>₽ {formatRu(k.total)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 2 }}>{k.project}</div>
                <div className="dim" style={{ fontSize: 11.5, marginBottom: 6 }}>{k.client}</div>
                <div className="hstack" style={{ justifyContent: "space-between" }}>
                  <span className={`badge badge-${k.statusColor}`} style={{ fontSize: 10.5 }}><span className="badge-dot"/>{k.status}</span>
                  {k.opened && <span className="dim" style={{ fontSize: 10.5 }}><I.Eye size={10} style={{ verticalAlign: -1 }}/> {k.opened}</span>}
                  {k.fromPlanning && !k.opened && <span className="dim" style={{ fontSize: 10.5 }}>из «{k.source}»</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <KpPreview k={selected} onNav={onNav}/>
        </div>
      </div>
    </div>
  );
}

function KpPreview({ k, onNav }) {
  const isAi = k.fromPlanning;
  return (
    <div>
      {/* Toolbar above doc */}
      <div className="hstack" style={{ marginBottom: 14, justifyContent: "space-between" }}>
        <div className="hstack">
          <span className={`badge badge-${k.statusColor}`}><span className="badge-dot"/>{k.status}</span>
          {k.sent && <span className="dim" style={{ fontSize: 12 }}>Отправлено {k.sent}</span>}
          {isAi && <span className="ai-source-pill">Создано из AI-планировки</span>}
        </div>
        <div className="hstack">
          {isAi && onNav && <button className="btn btn-ghost btn-sm" onClick={() => onNav("planning")} title="Перейти к источнику"><I.ArrowRight size={12}/> К планировке</button>}
          <button className="btn btn-ghost btn-sm" onClick={mock("Редактирование КП", "Откроется визуальный редактор КП в production.")}><I.Edit size={13}/> Редактировать</button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.showToast({ title: "КП продублировано", body: "Создана копия со статусом «Черновик»." })}><I.Copy size={13}/> Дублировать</button>
          <button className="btn btn-secondary" onClick={() => window.print()}><I.FilePdf size={14}/> Печать / PDF</button>
          <button className="btn btn-primary" onClick={mock("Отправка клиенту", "Письмо с КП будет отправляться через интеграцию.")}><I.Send size={14}/> Отправить клиенту</button>
        </div>
      </div>

      <div className="kp-doc">
        <div className="header-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 38, height: 38, borderRadius: 7, background: "linear-gradient(135deg, #EA580C 0%, #C2410C 100%)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>С</div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.015em" }}>ООО «СтройКомфорт»</div>
                <div className="dim" style={{ fontSize: 11.5 }}>ИНН 7716123456 · г. Москва, ул. Ленина 42</div>
              </div>
            </div>
          </div>
          <div className="meta">
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Коммерческое предложение</div>
            <div className="num">{k.id}</div>
            <div style={{ marginTop: 6 }}>от 04 июня 2026 г.</div>
          </div>
        </div>

        <h2 style={{ margin: 0 }}>{k.project}</h2>
        <div className="dim" style={{ marginTop: 4 }}>
          Клиент: <b style={{ color: "var(--text)" }}>{k.client}</b> · Объект: г. Москва, мкр. Новокосино, ул. Суздальская
        </div>

        <h3>Описание работ</h3>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Строительство индивидуального жилого дома площадью 142 м² по типовому проекту ИЖС-142. Включает фундаментные, общестроительные, кровельные и отделочные работы, монтаж окон и дверей, прокладку базовых инженерных сетей. Работы выполняются под ключ силами штатной бригады.
        </p>

        <h3>Этапы работ</h3>
        <table>
          <thead><tr><th style={{ width: 36 }}>№</th><th>Этап</th><th style={{ width: 100 }}>Срок</th><th style={{ width: 130 }} className="num">Стоимость</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Фундамент, цоколь</td><td>10 дней</td><td className="num">₽ 482 000</td></tr>
            <tr><td>2</td><td>Возведение стен, перегородки</td><td>18 дней</td><td className="num">₽ 1 124 000</td></tr>
            <tr><td>3</td><td>Кровля, утепление</td><td>12 дней</td><td className="num">₽ 786 000</td></tr>
            <tr><td>4</td><td>Окна, двери, остекление</td><td>6 дней</td><td className="num">₽ 412 000</td></tr>
            <tr><td>5</td><td>Инженерные сети (черновые)</td><td>14 дней</td><td className="num">₽ 538 000</td></tr>
            <tr><td>6</td><td>Чистовая отделка, сдача объекта</td><td>20 дней</td><td className="num">₽ 495 000</td></tr>
            <tr className="total"><td colSpan="3">Итого</td><td className="num">₽ {formatRu(k.total)}</td></tr>
          </tbody>
        </table>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 28 }}>
          <div>
            <h3>Сроки</h3>
            <p style={{ margin: "0 0 6px" }}>Общий срок: <b>80 рабочих дней</b></p>
            <p className="dim" style={{ margin: 0, fontSize: 12.5 }}>Старт работ — в течение 5 дней после подписания договора и поступления авансового платежа.</p>

            <h3>Условия оплаты</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li>Аванс <b>30%</b> — при подписании договора</li>
              <li><b>40%</b> — по завершении этапа 3</li>
              <li><b>25%</b> — по завершении этапа 5</li>
              <li><b>5%</b> — после подписания акта сдачи</li>
            </ul>
          </div>
          <div>
            <h3>Гарантия</h3>
            <p style={{ margin: 0 }}><b>5 лет</b> на несущие конструкции, <b>2 года</b> на отделочные работы и инженерные сети.</p>

            <h3>Что входит</h3>
            <ul className="check-list">
              <li>Проектная документация и согласования</li>
              <li>Все материалы по согласованным позициям</li>
              <li>Доставка на объект, разгрузка</li>
              <li>Вывоз строительного мусора</li>
            </ul>

            <h3>Что не входит</h3>
            <ul className="check-list x-list">
              <li>Чистовая мебель и техника</li>
              <li>Подключение к городским коммуникациям</li>
              <li>Ландшафтные работы и благоустройство</li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
          <span>Предложение действительно до 18 июня 2026 г.</span>
          <span>Подготовил: Артём Петров · +7 (495) 555-01-42</span>
        </div>
      </div>
    </div>
  );
}

window.KpScreen = KpScreen;

// ============================================================
// Тендеры
// ============================================================
const TENDERS = [
  { id: "T-487", name: "Капремонт фасада школы № 1532",   customer: "Дептранс Москвы",         amount: 18400000, region: "Москва",        deadline: "до 18.06", status: "Новый",     statusColor: "info",    risk: "low",  riskLabel: "Низкий",   margin: "22%" },
  { id: "T-486", name: "Стр-во ФАП в с. Покровское",        customer: "Минздрав МО",            amount: 14200000, region: "Моск. обл.",    deadline: "до 22.06", status: "В анализе", statusColor: "warning", risk: "med", riskLabel: "Средний",  margin: "18%" },
  { id: "T-485", name: "Благоустройство парка «Заречный»",   customer: "Адм. г. Воронеж",        amount: 8950000,  region: "Воронеж",       deadline: "до 14.06", status: "Подача готова", statusColor: "success", risk: "low", riskLabel: "Низкий", margin: "25%" },
  { id: "T-484", name: "Реконструкция котельной № 7",        customer: "МУП «Тепловые сети»",    amount: 32100000, region: "Казань",        deadline: "до 28.06", status: "В анализе", statusColor: "warning", risk: "high", riskLabel: "Высокий", margin: "12%" },
  { id: "T-483", name: "Кап. ремонт МКД ул. Гагарина 47",    customer: "Фонд кап. ремонта",      amount: 6840000,  region: "Москва",        deadline: "до 11.06", status: "Отказ",     statusColor: "danger", risk: "high", riskLabel: "Высокий", margin: "8%" },
  { id: "T-482", name: "Дет. сад на 220 мест",               customer: "Минобр Башкортостана",   amount: 87600000, region: "Уфа",           deadline: "до 02.07", status: "Новый",     statusColor: "info",    risk: "med", riskLabel: "Средний", margin: "16%" },
];

function TendersScreen({ onNav }) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Тендеры</h1>
          <p className="page-subtitle">{TENDERS.length} активных · потенциал ₽ 168,1 M · AI отслеживает 14 источников</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={mock("Фильтры тендеров", "Регион, бюджет, тип объекта, дедлайн.")}><I.Filter size={14}/> Фильтры</button>
          <button className="btn btn-secondary" onClick={() => onNav("analysis")}><I.Sparkles size={14}/> AI-подбор</button>
          <button className="btn btn-primary" onClick={mock("Добавить тендер", "Загрузка из 44-ФЗ / 223-ФЗ и ручной ввод.")}><I.Plus size={14}/> Добавить тендер</button>
        </div>
      </div>

      {/* AI banner */}
      <div className="callout" style={{ marginBottom: 18 }}>
        <I.Sparkles size={16}/>
        <div style={{ flex: 1 }}>
          <b>AI нашёл 3 новых тендера</b>, подходящих под профиль компании (рег. Москва, объём ₽ 10–50M, ИЖС / коммерч.).
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onNav("analysis")}>Посмотреть подборку</button>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="left">
            <button className="btn btn-ghost btn-sm" onClick={mock("Фильтр по статусу")}><I.Filter size={13}/> Все статусы</button>
            <button className="btn btn-ghost btn-sm" onClick={mock("Период")}><I.Calendar size={13}/> 30 дней</button>
            <button className="btn btn-ghost btn-sm" onClick={mock("Фильтр по сумме")}><I.Money size={13}/> Сумма</button>
          </div>
          <div className="right">
            <button className="btn btn-ghost btn-sm" onClick={mock("Сортировка")}><I.Sort size={13}/></button>
            <button className="btn btn-ghost btn-sm" onClick={mock("Действия", "Скрыть, переименовать, экспортировать.")}><I.More size={13}/></button>
          </div>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Тендер</th>
              <th>Заказчик</th>
              <th className="num">Сумма</th>
              <th>Регион</th>
              <th>Дедлайн</th>
              <th>Статус</th>
              <th>Риск</th>
              <th className="num">Маржа</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {TENDERS.map(t => (
              <tr key={t.id} onClick={() => onNav("analysis")}>
                <td>
                  <div className="strong">{t.name}</div>
                  <div className="dim" style={{ fontSize: 11.5 }}>{t.id} · 44-ФЗ</div>
                </td>
                <td><span className="dim">{t.customer}</span></td>
                <td className="num strong">₽ {formatRu(t.amount)}</td>
                <td className="dim">{t.region}</td>
                <td className="dim">{t.deadline}</td>
                <td><span className={`badge badge-${t.statusColor}`}><span className="badge-dot"/>{t.status}</span></td>
                <td>
                  <span className={`badge ${t.risk === "low" ? "badge-success" : t.risk === "med" ? "badge-warning" : "badge-danger"}`}>
                    <span className="badge-dot"/>{t.riskLabel}
                  </span>
                </td>
                <td className="num strong" style={{ color: parseInt(t.margin) >= 18 ? "var(--success)" : parseInt(t.margin) >= 12 ? "var(--text)" : "var(--danger)" }}>{t.margin}</td>
                <td><button className="icon-btn" onClick={(ev) => { ev.stopPropagation(); window.showToast({ title: "Действия по проекту", body: "Открыть · Архивировать · Дублировать", kind: "info" }); }}><I.More size={15}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Featured tender card */}
      <div style={{ marginTop: 20 }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>Карточка тендера</h3>
        <div className="card">
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, marginBottom: 16 }}>
              <div>
                <div className="hstack" style={{ marginBottom: 8 }}>
                  <span className="badge badge-info"><span className="badge-dot"/>Новый</span>
                  <span className="dim" style={{ fontSize: 12 }}>44-ФЗ № 0173200001425000487</span>
                </div>
                <h2 style={{ fontSize: 18, margin: "4px 0", fontFamily: "var(--font-display)", letterSpacing: "-0.015em" }}>Капремонт фасада школы № 1532</h2>
                <div className="dim">Заказчик: Департамент капитального ремонта г. Москвы</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="dim" style={{ fontSize: 11.5 }}>Начальная цена контракта</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>₽ 18 400 000</div>
                <div style={{ color: "var(--success)", fontSize: 12, fontWeight: 500 }}>прогноз маржи 22%</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
              <Meta label="Регион" value="Москва, ЦАО"/>
              <Meta label="Срок подачи" value="до 18.06.2026"/>
              <Meta label="Длительность работ" value="120 дней"/>
              <Meta label="Обеспечение заявки" value="₽ 184 000"/>
            </div>

            <div className="hstack" style={{ gap: 8 }}>
              <button className="btn btn-primary" onClick={mock("Загрузка документации тендера", "Принимаем PDF, ZIP, DOCX.")}><I.Upload size={14}/> Загрузить документацию</button>
              <button className="btn btn-secondary" onClick={() => onNav("analysis")}><I.Sparkles size={14}/> AI-анализ</button>
              <button className="btn btn-ghost" onClick={mock("Открытие zakupki.gov.ru", "Ссылка на источник тендера откроется в новой вкладке.")}><I.Eye size={14}/> Открыть на zakupki.gov.ru</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="dim" style={{ fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500, fontSize: 13 }}>{value}</div>
    </div>
  );
}

window.TendersScreen = TendersScreen;

// ============================================================
// AI Анализ тендера
// ============================================================
function TenderAnalysisScreen({ onNav }) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="hstack" style={{ marginBottom: 6 }}>
            <span className="badge badge-info"><span className="badge-dot"/>44-ФЗ</span>
            <span className="dim" style={{ fontSize: 12 }}>№ 0173200001425000487</span>
            <span className="badge badge-success"><I.Sparkles size={11}/> AI готов · 12с</span>
          </div>
          <h1 className="page-title">Капремонт фасада школы № 1532</h1>
          <p className="page-subtitle">Деп. кап. ремонта г. Москвы · ₽ 18 400 000 · подача до 18.06.2026</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={mock("Скачать отчёт", "Сводный AI-отчёт по тендеру.")}><I.Download size={14}/> Скачать отчёт</button>
          <button className="btn btn-secondary" onClick={() => onNav("tenders")}><I.ChevronLeft size={14}/> К списку</button>
        </div>
      </div>

      {/* Recommendation banner */}
      <div className="card" style={{ background: "linear-gradient(90deg, rgba(21,128,61,0.05) 0%, rgba(21,128,61,0.02) 100%)", border: "1px solid #BBF7D0", marginBottom: 18 }}>
        <div className="card-body" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--success)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <I.CheckCircle size={22}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, color: "var(--success)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Рекомендация</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em" }}>Участвовать · уверенность 84%</div>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
              Тендер соответствует профилю компании. Маржа выше средней (22%), документация прозрачная, заказчик надёжный — 47 успешных контрактов за 3 года.
            </p>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6 }}>
            <button className="btn btn-primary" onClick={mock("Подача заявки", "Сценарий участия будет в production.")}>Подать заявку <I.ArrowRight size={14}/></button>
            <button className="btn btn-ghost btn-sm" onClick={() => window.showToast({ title: "Сохранено в «Подумать»" })}>Сохранить в «Подумать»</button>
          </div>
        </div>
      </div>

      {/* Main analysis grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
        <div className="vstack" style={{ gap: 18 }}>
          {/* Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><I.Sparkles size={14} style={{ verticalAlign: -2, marginRight: 6, color: "var(--primary)" }}/> Краткая выжимка</h3>
              <span className="dim" style={{ fontSize: 11 }}>сгенерировано AI · 12 сек назад</span>
            </div>
            <div className="card-body">
              <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
                <b>Предмет закупки:</b> капитальный ремонт фасада здания школы № 1532 (г. Москва, ул. Стартовая, д. 8). Объём работ — <b>3 280 м²</b> фасадных поверхностей.
              </p>
              <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
                <b>Состав работ:</b> демонтаж старой штукатурки, утепление минватой 100мм, нанесение базового слоя, финишная отделка декоративной штукатуркой «короед», окрашивание силикатной краской, замена отливов и водосточной системы.
              </p>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                <b>Срок выполнения:</b> 120 календарных дней с момента заключения контракта. Авансирование — <b>30%</b> после подписания.
              </p>
            </div>
          </div>

          {/* Requirements */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Требования к участнику</h3>
            </div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <RequirementRow ok label="Опыт по 44-ФЗ" value="≥ 3 контрактов на сумму от ₽ 9,2M" check="Соответствует: 14 контрактов"/>
              <RequirementRow ok label="СРО строителей" value="Допуск к работам по фасадам" check="Соответствует: НОСТРОЙ № 1247"/>
              <RequirementRow ok label="Финансовое обеспечение" value="₽ 184 000 (1% от НМЦК)" check="Покрыто резервом"/>
              <RequirementRow warn label="Лицензия высотных работ" value="Допуск к работам на высоте ≥ 5м" check="Истекает 22.07 — продлить"/>
            </div>
          </div>

          {/* Risks */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Риски и спорные условия</h3>
              <span className="dim" style={{ fontSize: 11 }}>3 риска: 1 высокий · 2 средних</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="risk-card high">
                <I.AlertTriangle size={18} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }}/>
                <div className="body">
                  <b>Штраф за просрочку — 0,5% в сутки</b>
                  <p>При просрочке более 30 дней — расторжение договора в одностороннем порядке. Лимит штрафа не установлен — это нестандартное условие. Рекомендуем заложить буфер 14 дней в плане работ.</p>
                </div>
              </div>
              <div className="risk-card med">
                <I.AlertTriangle size={18} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }}/>
                <div className="body">
                  <b>Сезонность работ</b>
                  <p>Срок завершения — 16 октября. Фасадные работы при температуре ниже +5°C запрещены. При смещении старта возможен срыв из-за погоды.</p>
                </div>
              </div>
              <div className="risk-card med">
                <I.AlertTriangle size={18} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }}/>
                <div className="body">
                  <b>Заказчик удерживает 5% до истечения 12 мес. гарантии</b>
                  <p>В договоре прописана отсрочка финального платежа в размере ₽ 920 000 на 12 месяцев. Учтите в кассовом плане.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Обязательные документы</h3>
              <span className="dim" style={{ fontSize: 11 }}>8 из 9 готовы</span>
            </div>
            <table className="t" style={{ borderTop: "none" }}>
              <tbody>
                {[
                  ["Заявка по форме приложения 1",            "ok"],
                  ["Выписка из ЕГРЮЛ (не старше 6 мес.)",     "ok"],
                  ["Декларация о соответствии (ст. 31 44-ФЗ)", "ok"],
                  ["Платёжное поручение — обеспечение",        "ok"],
                  ["Опыт исполнения контрактов",                "ok"],
                  ["Выписка СРО",                              "ok"],
                  ["Согласие на обработку ПД",                  "ok"],
                  ["Гарантийное письмо банка",                  "ok"],
                  ["Допуск к работам на высоте ≥ 5м",           "missing"],
                ].map(([name, status], i) => (
                  <tr key={i}>
                    <td style={{ width: 28 }}>
                      {status === "ok"
                        ? <I.CheckCircle size={15} style={{ color: "var(--success)" }}/>
                        : <I.AlertTriangle size={15} style={{ color: "var(--warning)" }}/>}
                    </td>
                    <td>{name}</td>
                    <td className="num">
                      {status === "ok"
                        ? <span className="badge badge-success" style={{ fontSize: 10.5 }}>готов</span>
                        : <span className="badge badge-warning" style={{ fontSize: 10.5 }}>требует загрузки</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right rail */}
        <div className="vstack" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-header"><h3 className="card-title">Ключевые цифры</h3></div>
            <div className="card-body">
              <div className="calc-row"><span className="label">НМЦК</span><span className="value">₽ 18,4 M</span></div>
              <div className="calc-row"><span className="label">Себестоимость (AI)</span><span className="value">₽ 14,3 M</span></div>
              <div className="calc-row"><span className="label">Прогноз маржи</span><span className="value" style={{ color: "var(--success)" }}>22% · ₽ 4,1 M</span></div>
              <div className="calc-row"><span className="label">Шаг снижения</span><span className="value">0,5%</span></div>
              <div className="calc-row"><span className="label">Площадь работ</span><span className="value">3 280 м²</span></div>
              <div className="calc-row"><span className="label">Срок работ</span><span className="value">120 дней</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">Сроки</h3></div>
            <div className="card-body">
              <Timeline items={[
                { d: "сегодня",   t: "Загружена документация", state: "done" },
                { d: "до 12.06",  t: "Подготовка заявки",       state: "now" },
                { d: "до 16.06",  t: "Согласование с юристом",  state: "todo" },
                { d: "18.06",     t: "Подача заявки",            state: "todo" },
                { d: "20.06",     t: "Подведение итогов",        state: "todo" },
                { d: "01.07",     t: "Заключение контракта",     state: "todo" },
              ]}/>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">Заказчик</h3></div>
            <div className="card-body">
              <div className="hstack" style={{ marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg)", display: "grid", placeItems: "center" }}><I.Building size={18}/></div>
                <div>
                  <b style={{ fontSize: 13 }}>Деп. кап. ремонта г. Москвы</b>
                  <div className="dim" style={{ fontSize: 11.5 }}>ИНН 7710474400</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <div><b style={{ color: "var(--text)" }}>47</b> успешных контрактов за 3 года</div>
                <div><b style={{ color: "var(--text)" }}>2</b> расторжения · оба по соглашению</div>
                <div><b style={{ color: "var(--success)" }}>Среднее время оплаты:</b> 12 дней</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementRow({ label, value, check, ok, warn }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
        background: ok ? "var(--success-soft)" : "var(--warning-soft)",
        color: ok ? "var(--success)" : "var(--warning)",
      }}>
        {ok ? <I.Check size={12} stroke={3}/> : <I.AlertTriangle size={12}/>}
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
        <div style={{ fontSize: 13, marginBottom: 2 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: ok ? "var(--success)" : "var(--warning)" }}>{check}</div>
      </div>
    </div>
  );
}

function Timeline({ items }) {
  return (
    <div style={{ position: "relative", paddingLeft: 18 }}>
      <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 1, background: "var(--border)" }}/>
      {items.map((it, i) => (
        <div key={i} style={{ position: "relative", paddingBottom: i < items.length - 1 ? 12 : 0 }}>
          <div style={{
            position: "absolute", left: -16, top: 4, width: 10, height: 10, borderRadius: "50%",
            background: it.state === "done" ? "var(--success)" : it.state === "now" ? "var(--accent)" : "var(--surface)",
            border: it.state === "todo" ? "2px solid var(--border-strong)" : "none",
          }}/>
          <div style={{ fontSize: 12.5, fontWeight: it.state === "now" ? 600 : 500 }}>{it.t}</div>
          <div className="dim" style={{ fontSize: 11.5 }}>{it.d}</div>
        </div>
      ))}
    </div>
  );
}

window.TenderAnalysisScreen = TenderAnalysisScreen;

// ============================================================
// Прайсы
// ============================================================
const PRICE_CATS = [
  { name: "Фундамент",     count: 24 },
  { name: "Стены",         count: 38 },
  { name: "Перегородки",   count: 18 },
  { name: "Кровля",        count: 27 },
  { name: "Окна",          count: 22 },
  { name: "Двери",         count: 31 },
  { name: "Электрика",     count: 56 },
  { name: "Сантехника",    count: 47 },
  { name: "Отделка",       count: 84 },
  { name: "Доставка",      count: 8 },
  { name: "Доп. расходы",  count: 14 },
];
const PRICE_ROWS = [
  { cat: "Стены", name: "Газобетон D500, 400мм",       unit: "пог.м", mat: 4800, work: 2200, k: 1.0, updated: "01.06.26" },
  { cat: "Стены", name: "Кирпич керамический, 380мм",   unit: "пог.м", mat: 6200, work: 2800, k: 1.1, updated: "28.05.26" },
  { cat: "Стены", name: "Брус клеёный, 200мм",          unit: "пог.м", mat: 9400, work: 3100, k: 1.0, updated: "20.05.26" },
  { cat: "Перегородки", name: "Гипсокартон + профиль 120мм", unit: "пог.м", mat: 1600, work: 1100, k: 1.0, updated: "01.06.26" },
  { cat: "Перегородки", name: "Газобетон D500, 100мм",  unit: "пог.м", mat: 1900, work: 1250, k: 1.0, updated: "01.06.26" },
  { cat: "Окна",  name: "REHAU Blitz, 2-камерное",       unit: "шт",    mat: 18000, work: 4500, k: 1.0, updated: "27.05.26" },
  { cat: "Окна",  name: "VEKA Softline 70, 3-камерное",  unit: "шт",    mat: 24000, work: 4500, k: 1.0, updated: "27.05.26" },
  { cat: "Двери", name: "Софья 1.06, экошпон",           unit: "шт",    mat: 12000, work: 3500, k: 1.0, updated: "15.05.26" },
  { cat: "Двери", name: "Torex Super OMEGA 11",           unit: "шт",    mat: 62000, work: 8500, k: 1.0, updated: "15.05.26" },
  { cat: "Отделка", name: "Ламинат 33 кл., AC5",         unit: "м²",    mat: 1450, work:  850, k: 1.0, updated: "30.05.26" },
  { cat: "Отделка", name: "Декоративная штукатурка «короед»", unit: "м²", mat: 480, work: 620, k: 1.0, updated: "30.05.26" },
  { cat: "Электрика", name: "Розетка с заземлением Legrand", unit: "шт", mat: 480, work: 720, k: 1.0, updated: "22.05.26" },
];

function PricesScreen() {
  const [cat, setCat] = useSt("Все");
  const rows = cat === "Все" ? PRICE_ROWS : PRICE_ROWS.filter(r => r.cat === cat);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Прайс-лист</h1>
          <p className="page-subtitle">«Базовый · Июнь 2026» · 369 позиций · последнее обновление 1 час назад</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={mock("Загрузка Excel/CSV", "В production — импорт прайса с автоматическим маппингом колонок.")}><I.Upload size={14}/> Загрузить Excel / CSV</button>
          <button className="btn btn-secondary" onClick={mock("AI-обновление цен", "Автоматический пересчёт по поставщикам и индексам Минстроя.")}><I.Sparkles size={14}/> Обновить цены</button>
          <button className="btn btn-secondary" onClick={() => window.showToast({ title: "Прайс сохранён", body: "369 позиций · 1 категория изменена." })}><I.Save size={14}/> Сохранить прайс</button>
          <button className="btn btn-primary" onClick={mock("Добавить позицию", "Откроется форма создания позиции прайса.")}><I.Plus size={14}/> Добавить позицию</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18 }}>
        {/* Categories sidebar */}
        <div className="card" style={{ padding: 6 }}>
          <button
            onClick={() => setCat("Все")}
            style={{ display: "flex", width: "100%", padding: "8px 12px", borderRadius: 6, fontSize: 13, color: cat === "Все" ? "var(--text)" : "var(--text-secondary)", background: cat === "Все" ? "var(--bg)" : "transparent", fontWeight: cat === "Все" ? 600 : 400 }}
          >
            <span style={{ flex: 1, textAlign: "left" }}>Все категории</span>
            <span className="dim">{PRICE_CATS.reduce((s, c) => s + c.count, 0)}</span>
          </button>
          <div style={{ height: 1, background: "var(--border-soft)", margin: "6px 0" }}/>
          {PRICE_CATS.map(c => (
            <button key={c.name}
              onClick={() => setCat(c.name)}
              style={{ display: "flex", width: "100%", padding: "8px 12px", borderRadius: 6, fontSize: 13, color: cat === c.name ? "var(--text)" : "var(--text-secondary)", background: cat === c.name ? "var(--bg)" : "transparent", fontWeight: cat === c.name ? 600 : 400 }}>
              <span style={{ flex: 1, textAlign: "left" }}>{c.name}</span>
              <span className="dim">{c.count}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <div className="table-toolbar">
            <div className="left">
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", width: 240 }}>
                <I.Search size={13} style={{ color: "var(--text-muted)" }}/>
                <input style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, flex: 1 }} placeholder="Поиск по позициям…"/>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={mock("Фильтр по поставщику")}><I.Filter size={13}/> Поставщик</button>
              <button className="btn btn-ghost btn-sm" onClick={mock("Фильтр по дате обновления")}><I.Calendar size={13}/> Обновлено</button>
            </div>
            <div className="right">
              <span className="dim" style={{ fontSize: 12 }}>{rows.length} позиций</span>
            </div>
          </div>
          <table className="t">
            <thead>
              <tr>
                <th>Категория</th>
                <th>Позиция</th>
                <th>Ед.</th>
                <th className="num">Материал, ₽</th>
                <th className="num">Работа, ₽</th>
                <th className="num">Коэф.</th>
                <th>Обновлено</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><span className="badge badge-neutral">{r.cat}</span></td>
                  <td className="strong">{r.name}</td>
                  <td className="dim">{r.unit}</td>
                  <td className="num">{formatRu(r.mat)}</td>
                  <td className="num">{formatRu(r.work)}</td>
                  <td className="num">{r.k.toFixed(2)}</td>
                  <td className="dim">{r.updated}</td>
                  <td><button className="icon-btn" onClick={(ev) => { ev.stopPropagation(); window.showToast({ title: "Действия по позиции", body: "Изменить · Архивировать · История цен", kind: "info" }); }}><I.More size={15}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PricesScreen = PricesScreen;

// ============================================================
// Проекты
// ============================================================
const PROJECTS = [
  { client: "А. Захаров",            object: "Дом 142 м²",            address: "МО, Новокосино, ул. Суздальская",         type: "ИЖС",          stage: "В расчёте",      stageColor: "info",    sum: 3837000, owner: "Артём П.", activity: "2 мин назад" },
  { client: "ООО «Заря»",            object: "Ремонт 3-комн.",         address: "г. Москва, ЖК «Заря», корп. 5",            type: "Квартира",     stage: "КП отправлено",  stageColor: "warning", sum: 1250000, owner: "Мария С.", activity: "1 ч назад" },
  { client: "ИП Степанов",            object: "Склад А-7, 1200 м²",     address: "МО, Подольск, пром. зона Кутузово",        type: "Коммерческий", stage: "На согласовании", stageColor: "warning", sum: 14700000, owner: "Артём П.", activity: "3 ч назад" },
  { client: "В. Никитин",             object: "Баня 36 м²",             address: "МО, дер. Никитино, уч. 14",                type: "Малая форма",  stage: "В работе",       stageColor: "success", sum: 680000,  owner: "Игорь К.", activity: "вчера" },
  { client: "Семья Морозовых",        object: "Котедж 210 м²",          address: "МО, Истра, КП «Сосновый Берег»",           type: "ИЖС",          stage: "Новый",          stageColor: "neutral", sum: null,    owner: "Артём П.", activity: "сегодня" },
  { client: "ООО «Левый Берег»",      object: "Офис open-space",        address: "г. Москва, бизнес-центр «Левый Берег»",    type: "Коммерческий", stage: "Завершён",       stageColor: "success", sum: 3480000, owner: "Мария С.", activity: "10 дней назад" },
  { client: "ТСЖ «Радуга»",           object: "Реконструкция фасада",   address: "г. Москва, ул. Радужная, 18",              type: "Реконструкция",stage: "В работе",       stageColor: "success", sum: 1080000, owner: "Игорь К.", activity: "вчера" },
  { client: "ООО «Прометей»",         object: "Цех 480 м²",             address: "Тула, промзона «Восход»",                   type: "Коммерческий", stage: "Потерян",        stageColor: "danger",  sum: 6200000, owner: "Артём П.", activity: "неделю назад" },
];

function ProjectsScreen({ onNav }) {
  const stages = [
    { name: "Новый",          count: 2,  color: "var(--neutral)" },
    { name: "В расчёте",      count: 6,  color: "#3B82F6" },
    { name: "КП отправлено",  count: 5,  color: "#1E3A8A" },
    { name: "На согласовании", count: 3,  color: "var(--accent)" },
    { name: "В работе",       count: 7,  color: "var(--success)" },
    { name: "Завершён",       count: 14, color: "#15803D" },
    { name: "Потерян",        count: 3,  color: "var(--danger)" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Проекты</h1>
          <p className="page-subtitle">{PROJECTS.length + 16} активных проектов · потенциал ₽ 87,4 M</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={mock("Фильтры")}><I.Filter size={14}/> Фильтры</button>
          <button className="btn btn-secondary" onClick={mock("Переключить вид", "Доступны: Таблица / Канбан / Карта.")}>Вид: Таблица <I.Chevron size={12}/></button>
          <button className="btn btn-primary" onClick={() => onNav && onNav("planning")}><I.Plus size={14}/> Новый проект</button>
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="card" style={{ marginBottom: 18, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {stages.map((s, i) => (
            <div key={i} style={{ flex: s.count, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ height: 6, background: s.color, borderRadius: 3 }}/>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{s.name}</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{s.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Объект</th>
              <th>Адрес</th>
              <th>Тип</th>
              <th>Стадия</th>
              <th className="num">Сумма</th>
              <th>Ответственный</th>
              <th>Активность</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {PROJECTS.map((p, i) => (
              <tr key={i} onClick={() => onNav("planning")}>
                <td className="strong">{p.client}</td>
                <td>{p.object}</td>
                <td className="dim" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.address}</td>
                <td><span className="badge badge-neutral">{p.type}</span></td>
                <td><span className={`badge badge-${p.stageColor}`}><span className="badge-dot"/>{p.stage}</span></td>
                <td className="num strong">{p.sum ? `₽ ${formatRu(p.sum)}` : <span className="dim">—</span>}</td>
                <td>
                  <div className="hstack" style={{ gap: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600 }}>
                      {p.owner.split(" ").map(s => s[0]).join("")}
                    </div>
                    <span>{p.owner}</span>
                  </div>
                </td>
                <td className="dim">{p.activity}</td>
                <td><button className="icon-btn" onClick={(ev) => { ev.stopPropagation(); window.showToast({ title: "Действия по проекту", body: "Открыть · Архивировать · Дублировать", kind: "info" }); }}><I.More size={15}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.ProjectsScreen = ProjectsScreen;

// ============================================================
// Настройки
// ============================================================
function SettingsScreen() {
  const [activeSection, setActiveSection] = useSt(0);
  const sections = ["Профиль компании", "Команда (4)", "Тарифы и оплата", "Интеграции", "Шаблоны КП", "Шаблоны смет", "Уведомления", "Безопасность"];
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Настройки</h1>
          <p className="page-subtitle">Профиль компании, команда, интеграции, шаблоны</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "start" }}>
        <div className="card" style={{ padding: 6 }}>
          {sections.map((s, i) => (
            <button key={i}
              onClick={() => {
                setActiveSection(i);
                if (i > 0) window.showToast({ title: s, body: "Раздел будет доступен в production-версии.", kind: "info" });
              }}
              style={{
                display: "block", width: "100%", padding: "8px 12px", borderRadius: 6,
                textAlign: "left", fontSize: 13,
                background: i === activeSection ? "var(--bg)" : "transparent",
                fontWeight: i === activeSection ? 600 : 400,
                color: i === activeSection ? "var(--text)" : "var(--text-secondary)"
              }}>
              {s}
            </button>
          ))}
        </div>

        <div className="vstack" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-header"><h3 className="card-title">Профиль компании</h3></div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field"><label className="field-label">Название</label><input className="input" defaultValue="ООО «СтройКомфорт»"/></div>
              <div className="field"><label className="field-label">ИНН</label><input className="input" defaultValue="7716123456"/></div>
              <div className="field"><label className="field-label">КПП</label><input className="input" defaultValue="771601001"/></div>
              <div className="field"><label className="field-label">ОГРН</label><input className="input" defaultValue="1147746123456"/></div>
              <div className="field" style={{ gridColumn: "span 2" }}><label className="field-label">Юридический адрес</label><input className="input" defaultValue="г. Москва, ул. Ленина 42, оф. 305"/></div>
              <div className="field"><label className="field-label">Расчётный счёт</label><input className="input" defaultValue="40702 810 5 0000 0123456"/></div>
              <div className="field"><label className="field-label">Банк</label><input className="input" defaultValue="ПАО Сбербанк"/></div>
            </div>
            <div className="card-foot">
              <span className="dim" style={{ fontSize: 12 }}>Эти данные подставляются в КП и договоры автоматически.</span>
              <button className="btn btn-primary btn-sm" onClick={() => window.showToast({ title: "Профиль сохранён", body: "Реквизиты будут подставляться в новые КП." })}><I.Save size={13}/> Сохранить</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Базовые настройки сметы</h3>
            </div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              <div className="field"><label className="field-label">Наценка по умолчанию</label><div className="input-with-suffix"><input className="input" defaultValue="22"/><span className="suffix">%</span></div></div>
              <div className="field"><label className="field-label">НДС</label><div className="input-with-suffix"><input className="input" defaultValue="20"/><span className="suffix">%</span></div></div>
              <div className="field"><label className="field-label">Срок действия КП</label><div className="input-with-suffix"><input className="input" defaultValue="14"/><span className="suffix">дней</span></div></div>
              <div className="field"><label className="field-label">Стандартная гарантия</label><div className="input-with-suffix"><input className="input" defaultValue="60"/><span className="suffix">мес.</span></div></div>
              <div className="field"><label className="field-label">Аванс</label><div className="input-with-suffix"><input className="input" defaultValue="30"/><span className="suffix">%</span></div></div>
              <div className="field"><label className="field-label">Валюта</label><select className="select"><option>Российский рубль (₽)</option></select></div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Интеграции</h3>
              <span className="dim" style={{ fontSize: 12 }}>3 активных</span>
            </div>
            <div className="card-body" style={{ display: "grid", gap: 10 }}>
              <Integration name="zakupki.gov.ru"  desc="Мониторинг тендеров 44-ФЗ и 223-ФЗ" status="ok"/>
              <Integration name="1C: Бухгалтерия" desc="Синхронизация контрагентов и проектов" status="ok"/>
              <Integration name="Telegram"          desc="Уведомления о новых тендерах и КП"     status="ok"/>
              <Integration name="amoCRM"           desc="Передача лидов в воронку"               status="off"/>
              <Integration name="Битрикс24"         desc="Синхронизация задач и проектов"         status="off"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Integration({ name, desc, status }) {
  const toggle = () => window.showToast({
    title: status === "ok" ? `${name} · настройка` : `${name} · подключение`,
    body: "Откроется OAuth-flow в production-версии.",
    kind: "info",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg)", display: "grid", placeItems: "center", fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0 }}>
        {name[0]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
        <div className="dim" style={{ fontSize: 12 }}>{desc}</div>
      </div>
      {status === "ok"
        ? <><span className="badge badge-success"><span className="badge-dot"/>Подключено</span><button className="btn btn-ghost btn-sm" onClick={toggle}>Настроить</button></>
        : <button className="btn btn-secondary btn-sm" onClick={toggle}>Подключить</button>
      }
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
