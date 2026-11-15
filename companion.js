
/* FateX Companion 0.1.1 — Foundry 14 / FateX */
const FXC = (() => {
  const NS = "fatex-companion", KEY = "card";
  const BASE_W = 430, BASE_H = 475;
  const MIN_ZOOM = 0.5, MAX_ZOOM = 3;
  const cards = new Map();
  let guide = null, tab = "actions", action = 0, outcome = 2, advMode = "new";

  const esc = x => String(x ?? "").replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const plain = x => {
    const el = document.createElement("div");
    el.innerHTML = String(x ?? "");
    return el.textContent.trim();
  };
  const canEdit = a => game.user.isGM || !!a?.isOwner;
  const items = (a, type) => [...a.items].filter(i =>
    i.type === type && i.system?.disabled !== true);
  const cardFlag = t => t.document.getFlag(NS, KEY);
  const cardKey = t => `${canvas.scene.id}:${t.document.id}`;
  const fail = e => {
    console.error("FateX Companion:", e);
    ui.notifications.error(`FateX Companion: ${e.message || e}`);
  };
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const zoomOf = cfg => clamp(Number(cfg?.w || BASE_W) / BASE_W, MIN_ZOOM, MAX_ZOOM);

  function findToken(key) {
    if (!canvas?.ready) return null;
    const id = key.split(":").at(-1);
    return canvas.tokens.placeables.find(t => t.document.id === id) || null;
  }
  function camera() {
    const view = canvas.app?.canvas || canvas.app?.view || document.getElementById("board");
    if (!view) return null;
    const r = view.getBoundingClientRect();
    const w = canvas.app?.renderer?.screen?.width || view.width || r.width;
    const h = canvas.app?.renderer?.screen?.height || view.height || r.height;
    const m = canvas.stage.worldTransform;
    return {r, m, sx:r.width/w, sy:r.height/h,
      scale:Math.max(0.01, Math.hypot(m.a,m.b)*r.width/w)};
  }
  function toScreen(x,y,c) {
    const {m,r,sx,sy} = c;
    return {x:r.left+(m.a*x+m.c*y+m.tx)*sx,
      y:r.top+(m.b*x+m.d*y+m.ty)*sy};
  }
  function positionCards() {
    if (!canvas?.ready || !cards.size) return;
    const c = camera();
    if (!c) return;
    for (const [key,state] of cards) {
      const token = findToken(key);
      const cfg = token && cardFlag(token);
      if (!cfg) continue;
      const current = state.preview || cfg;
      const p = toScreen(Number(current.x)||0, Number(current.y)||0, c);
      state.el.style.left = `${p.x}px`;
      state.el.style.top = `${p.y}px`;
      state.el.style.width = `${BASE_W}px`;
      state.el.style.height = `${BASE_H}px`;
      state.el.style.transformOrigin = "top left";
      state.el.style.transform = `scale(${c.scale * zoomOf(current)})`;
    }
  }

  function renderCard(token, el) {
    const a = token.actor;
    if (!a) return;
    const oldScroll = el.querySelector(".fxc-body")?.scrollTop || 0;
    const aspects = items(a,"aspect").map(i => `
      <div class="fxc-edit" data-action="edit" data-id="${esc(i.id)}"
        title="Редактировать аспект">✦ ${esc(plain(i.system.value)||i.name)}</div>`).join("")
      || '<span class="fxc-muted">Аспекты не найдены</span>';
    const consequences = items(a,"consequence").map(i => `
      <div class="fxc-consequence">
        <button data-action="active" data-id="${esc(i.id)}" title="Отметить последствие">
          ${i.system.active ? "☑" : "☐"}</button>
        <div class="fxc-grow fxc-edit" data-action="edit" data-id="${esc(i.id)}"
          title="Нажми, чтобы вписать конкретное последствие">
          <div class="fxc-name">${esc(plain(i.system.label)||i.name)}</div>
          <div>${esc(plain(i.system.value)||"Вписать последствие")}</div>
        </div>
      </div>`).join("") || '<span class="fxc-muted">Последствий нет</span>';
    const stress = items(a,"stress").map(i => {
      const n = Number(i.system.size), v = Number(i.system.value);
      if (!Number.isInteger(n) || n<1 || n>30 || !Number.isInteger(v) || v<0)
        return `<div>${esc(i.name)}: открой лист персонажа</div>`;
      const boxes = Array.from({length:n},(_,b)=>`
        <button data-action="stress" data-id="${esc(i.id)}" data-box="${b}"
          class="${v&(1<<b)?"fxc-used":""}">${b+1}</button>`).join("");
      return `<div>${esc(i.name)}</div><div class="fxc-stress">${boxes}</div>`;
    }).join("") || '<span class="fxc-muted">Шкалы стресса пока нет в листе</span>';
    const points = Number(a.system.fatepoints?.current ?? 0);
    const refresh = Number(a.system.fatepoints?.refresh ?? 0);
    el.innerHTML = `
      <div class="fxc-head" data-drag="1">
        <strong>${esc(a.name)}</strong>
        <button data-action="sheet">Лист</button>
        ${game.user.isGM ? '<button data-action="remove" title="Убрать карточку">×</button>' : ''}
      </div>
      <div class="fxc-body">
        <div class="fxc-flex">
          <img class="fxc-portrait" src="${esc(a.img||"icons/svg/mystery-man.svg")}" alt="Портрет">
          <div class="fxc-grow"><div class="fxc-section">Аспекты</div>${aspects}</div>
        </div>
        <div class="fxc-section">Очки судьбы</div>
        <div class="fxc-row"><button data-action="fate" data-step="-1">−</button>
          <strong>${points}</strong><button data-action="fate" data-step="1">+</button>
          <span class="fxc-muted">Обновление: ${refresh}</span></div>
        <div class="fxc-section">Стресс</div>${stress}
        <div class="fxc-section">Последствия</div>${consequences}
        <p class="fxc-small">Нажми на название аспекта или текст последствия для редактирования.</p>
      </div>
      ${game.user.isGM ? '<div class="fxc-grip" data-resize="1" title="Изменить общий масштаб"></div>' : ''}`;
    el.querySelector(".fxc-body").scrollTop = oldScroll;
  }

  async function editValue(item) {
    const previous = plain(item.system.value);
    const next = prompt(`Изменить: ${item.name}`, previous);
    if (next === null || next === previous) return;
    const raw = String(item.system.value || "");
    const value = /<\/?[a-z][^>]*>/i.test(raw)
      ? `<p>${esc(next).replaceAll("\n","<br>")}</p>` : next;
    await item.update({"system.value":value});
  }
  function addCard(token) {
    const key = cardKey(token);
    if (cards.has(key)) return;
    const el = document.createElement("section");
    el.className = "fxc fxc-scene";
    document.body.appendChild(el);
    const state = {el,preview:null};
    cards.set(key,state);
    renderCard(token,el);
    let drag = null;
    el.addEventListener("pointerdown", ev => {
      if (!game.user.isGM || ev.target.closest("button")) return;
      const mode = ev.target.closest("[data-resize]") ? "resize"
        : ev.target.closest("[data-drag]") ? "move" : null;
      if (!mode) return;
      const cfg = cardFlag(token);
      if (!cfg) return;
      drag = {mode,px:ev.clientX,py:ev.clientY,
        x:cfg.x,y:cfg.y,w:cfg.w,h:cfg.h};
      el.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    el.addEventListener("pointermove", ev => {
      if (!drag) return;
      const c = camera();
      if (!c) return;
      const dx = (ev.clientX-drag.px)/c.scale;
      const dy = (ev.clientY-drag.py)/c.scale;
      if (drag.mode === "move") {
        state.preview = {x:drag.x+dx,y:drag.y+dy,w:drag.w,h:drag.h};
      } else {
        // Only one scale factor; width and height always remain proportional.
        const initial = zoomOf(drag);
        const delta = (dx/BASE_W + dy/BASE_H)/2;
        const zoom = clamp(initial+delta,MIN_ZOOM,MAX_ZOOM);
        state.preview = {x:drag.x,y:drag.y,
          w:BASE_W*zoom,h:BASE_H*zoom};
      }
      positionCards();
    });
    el.addEventListener("pointerup", async () => {
      if (!drag) return;
      const next = state.preview;
      drag = null;
      if (!next) return;
      try {
        await token.document.setFlag(NS,KEY,{
          x:Math.round(next.x),y:Math.round(next.y),
          w:Math.round(next.w),h:Math.round(next.h)
        });
      } catch(e) {fail(e);}
      state.preview = null;
      positionCards();
    });
    el.addEventListener("pointercancel", () => {
      drag = null; state.preview = null; positionCards();
    });
    el.addEventListener("click", async ev => {
      const btn = ev.target.closest("[data-action]");
      if (!btn) return;
      const act = btn.dataset.action, a = token.actor;
      if (act === "sheet") {a.sheet.render(true);return;}
      if (act === "remove" && game.user.isGM) {
        try {await token.document.unsetFlag(NS,KEY);} catch(e) {fail(e);}
        return;
      }
      if (!canEdit(a)) {ui.notifications.warn("Нет прав редактирования");return;}
      const item = a.items.get(btn.dataset.id);
      try {
        if (act === "edit" && item) await editValue(item);
        if (act === "active" && item)
          await item.update({"system.active":!item.system.active});
        if (act === "fate") {
          const n = Number(a.system.fatepoints?.current ?? 0);
          await a.update({"system.fatepoints.current":Math.max(0,n+Number(btn.dataset.step))});
        }
        if (act === "stress" && item) {
          const b = Number(btn.dataset.box),n = Number(item.system.size);
          const v = Number(item.system.value);
          if (Number.isInteger(v)&&v>=0&&Number.isInteger(n)&&b>=0&&b<n&&b<30)
            await item.update({"system.value":v^(1<<b)});
        }
      } catch(e) {fail(e);}
    });
  }
  function sync() {
    const seen = new Set();
    if (canvas?.ready) for (const t of canvas.tokens.placeables) {
      if (!cardFlag(t)||!t.actor) continue;
      seen.add(cardKey(t));
      addCard(t);
    }
    for (const [key,state] of cards) if (!seen.has(key)) {
      state.el.remove(); cards.delete(key);
    }
    positionCards();
  }
  function refresh() {
    sync();
    for (const [key,state] of cards) {
      const t = findToken(key);
      if (t?.actor) renderCard(t,state.el);
    }
  }
  async function toggleCard() {
    if (!game.user.isGM) return;
    const t = canvas.tokens.controlled[0];
    if (!t?.actor) {ui.notifications.warn("Выдели токен персонажа");return;}
    try {
      if (cardFlag(t)) await t.document.unsetFlag(NS,KEY);
      else await t.document.setFlag(NS,KEY,{
        x:Math.round(t.document.x+(t.document.width||1)*canvas.grid.size+24),
        y:Math.round(t.document.y),w:BASE_W,h:BASE_H
      });
      sync();
    } catch(e) {fail(e);}
  }

  // Compact Russian Fate Accelerated reference.
  const actions = [
    {name:"Преодоление",desc:"Добиться цели или устранить препятствие.",out:[
      "Неудача либо успех серьёзной ценой.","Успех небольшой ценой.",
      "Цель достигнута.","Цель достигнута и получено усиление."]},
    {name:"Создание преимущества",desc:"Создать, раскрыть либо использовать аспект.",out:[
      "Не создали аспект, либо создали, но свободный призыв получает противник.",
      "При создании нового аспекта — усиление; при раскрытии существующего — свободный призыв.",
      "Аспект создан или раскрыт, один свободный призыв.",
      "Аспект создан или раскрыт, два свободных призыва."],known:[
      "Новых свободных призывов нет.","Один свободный призыв известного аспекта.",
      "Один свободный призыв известного аспекта.","Два свободных призыва известного аспекта."]},
    {name:"Атака",desc:"Нанести физический или ментальный вред.",out:[
      "Нет вреда.","Нет вреда, но атакующий получает усиление.",
      "Попадание: вред равен сдвигам.",
      "Попадание: можно уменьшить вред на 1, чтобы получить усиление."]},
    {name:"Защита",desc:"Помешать действию противника.",out:[
      "Противник добивается своего.","Примените ничью для действия противника.",
      "Противник не добивается своего.","Противник не добивается своего, защитник получает усиление."]}
  ];
  const outcomes = ["Провал","Ничья","Успех (+1/+2)","Успех со стилем (+3 и более)"];
  const tabs = {actions:"Действия",aspects:"Аспекты",harm:"Стресс",stunts:"Трюки",gm:"Мастеру"};
  const panel = text => `<div class="fxc-panel">${text}</div>`;
  function guideBody() {
    if (tab === "actions") {
      const a = actions[action];
      const result = action === 1 && advMode === "known" ? a.known[outcome] : a.out[outcome];
      return `<label>Действие</label><select data-field="action">${actions.map((x,i)=>
        `<option value="${i}" ${i===action?'selected':''}>${esc(x.name)}</option>`).join("")}</select>
        <p>${esc(a.desc)}</p>
        ${action===1?`<label>Тип преимущества</label><select data-field="adv">
          <option value="new" ${advMode==='new'?'selected':''}>Новый или скрытый аспект</option>
          <option value="known" ${advMode==='known'?'selected':''}>Уже известный аспект</option>
        </select>`:""}
        <label>Результат</label><select data-field="outcome">${outcomes.map((x,i)=>
          `<option value="${i}" ${i===outcome?'selected':''}>${esc(x)}</option>`).join("")}</select>
        ${panel(esc(result))}<p class="fxc-small">Результат — разница между броском с бонусами и сопротивлением.</p>`;
    }
    if (tab === "aspects") return [
      "<b>Призыв:</b> потрать очко судьбы или бесплатный призыв, чтобы получить +2 либо перебросить кубики. Объясни связь аспекта с действием.",
      "<b>Навязывание:</b> аспект приносит осложнение. Игрок получает очко судьбы, если принимает предложение.",
      "<b>Усиление:</b> временное преимущество с одним бесплатным призывом.",
      "<b>Создание преимущества:</b> подготовь выгодные условия до решающего действия."
    ].map(panel).join("");
    if (tab === "harm") return [
      "<b>Вред:</b> определяется сдвигами. Ячейки стресса и последствия позволяют его поглотить.",
      "<b>Последствия:</b> лёгкое обычно поглощает 2 сдвига, среднее 4, тяжёлое 6. Это аспекты, влияющие на сюжет.",
      "<b>Сдача:</b> объявляется до броска, который вывел бы персонажа из конфликта; условия отступления обсуждаются.",
      "<b>Восстановление:</b> стресс обычно очищается после конфликта; последствия требуют времени и лечения."
    ].map(panel).join("");
    if (tab === "stunts") return `<p>Шаблон трюка (+2 в узкой ситуации). Требуется согласование с мастером.</p>
      <label>Особенность героя</label><input data-stunt="why" value="Я знаю каждый уголок острова">
      <label>Подход</label><select data-stunt="approach">${[
        "Аккуратно","Умно","Эффектно","Сильно","Быстро","Хитро"
      ].map(x=>`<option>${x}</option>`).join("")}</select>
      <label>Действие</label><select data-stunt="action">${[
        "преодолеваю препятствия","создаю преимущество","атакую","защищаюсь"
      ].map(x=>`<option>${x}</option>`).join("")}</select>
      <label>Обстоятельство</label><input data-stunt="when" value="использую знание острова">
      <div class="fxc-panel" data-preview="1"></div>
      <button data-action="copy-stunt">Копировать черновик</button>
      <p class="fxc-small">Альтернатива: особая способность «Раз за сессию я могу...», по согласованию с мастером.</p>`;
    if (tab === "gm") return [
      "<b>Бросай кубики,</b> когда исход неясен, а последствия значимы.",
      "<b>Сложности:</b> от посредственной (+0) до легендарной (+8). Выбирай по трудности задачи.",
      "<b>Испытание:</b> несколько задач. <b>Состязание:</b> борьба за цель. <b>Конфликт:</b> противоборство с вредом.",
      "<b>Цена успеха:</b> потерянное время, расход ресурса, осложнение, опасная позиция или раскрытый секрет.",
      "<b>Противники:</b> дай им аспект, мотивацию и возможность использовать окружение."
    ].map(panel).join("");
    return "";
  }
  function stuntText() {
    const val = k => guide?.querySelector(`[data-stunt="${k}"]`)?.value?.trim() || "...";
    return `Поскольку ${val('why')}, получаю +2, когда действую (${val('approach')}), ${val('action')} и ${val('when')}.`;
  }
  function updatePreview() {
    const p = guide?.querySelector('[data-preview="1"]');
    if (p) p.textContent = stuntText();
  }
  function renderGuide() {
    if (!guide) return;
    guide.querySelector(".fxc-body").innerHTML = `<nav>${Object.entries(tabs)
      .filter(([k])=>k!=="gm"||game.user.isGM)
      .map(([k,v])=>`<button data-tab="${k}" aria-pressed="${tab===k}">${v}</button>`).join("")}</nav>
      ${guideBody()}<p class="fxc-small">Fate Accelerated: краткая памятка. Приоритет у правил вашей группы.</p>`;
    updatePreview();
  }
  function toggleGuide() {
    if (guide) {guide.remove();guide=null;return;}
    guide = document.createElement("section");
    guide.className = "fxc fxc-guide";
    guide.innerHTML = `<div class="fxc-head"><strong>FateX Companion · Памятка</strong>
      <button data-close="1">×</button></div><div class="fxc-body"></div>`;
    document.body.appendChild(guide);
    guide.addEventListener("click",async ev => {
      if (ev.target.closest("[data-close]")) {toggleGuide();return;}
      const t = ev.target.closest("[data-tab]");
      if (t) {tab=t.dataset.tab;renderGuide();return;}
      if (ev.target.closest('[data-action="copy-stunt"]')) {
        const value=stuntText();
        try {await navigator.clipboard.writeText(value);
          ui.notifications.info("Трюк скопирован");}
        catch {prompt("Скопируй текст трюка",value);}
      }
    });
    guide.addEventListener("change",ev => {
      const f=ev.target.dataset.field;
      if (f==="action") action=Number(ev.target.value);
      if (f==="outcome") outcome=Number(ev.target.value);
      if (f==="adv") advMode=ev.target.value;
      if (f) renderGuide(); else updatePreview();
    });
    guide.addEventListener("input",updatePreview);
    renderGuide();
  }
  function dock() {
    if (document.getElementById("fxc-dock")) return;
    const el=document.createElement("div");
    el.id="fxc-dock";
    el.innerHTML = `<button data-action="guide">📖 Fate</button>
      ${game.user.isGM?'<button data-action="card">▣ Карточка</button>':''}`;
    el.addEventListener("click",ev=>{
      const btn=ev.target.closest("button");
      if (btn?.dataset.action==="guide") toggleGuide();
      if (btn?.dataset.action==="card") toggleCard();
    });
    document.body.appendChild(el);
  }
  function init() {
    if (game.system.id!=="fatex") return;
    dock();sync();
    Hooks.on("canvasReady",sync);
    Hooks.on("createToken",sync);
    Hooks.on("deleteToken",sync);
    Hooks.on("updateToken",sync);
    Hooks.on("updateActor",refresh);
    Hooks.on("updateItem",refresh);
    Hooks.on("createItem",refresh);
    Hooks.on("deleteItem",refresh);
    const frame = () => {
      if (canvas?.ready && cards.size) positionCards();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    console.info("FateX Companion 0.1.1 loaded");
  }
  return {init};
})();
Hooks.once("ready", FXC.init);
