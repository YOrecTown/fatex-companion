
/* FateX Companion 0.1 — Foundry VTT 14, FateX */
const FXC = (() => {
  const NS = "fatex-companion";
  const KEY = "card";
  const cards = new Map();
  let guide = null;
  let guideTab = "actions";
  let actionIndex = 0;
  let outcomeIndex = 2;
  let advantageMode = "new";

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const clean = value => {
    const div = document.createElement("div");
    div.innerHTML = String(value ?? "");
    return div.textContent.trim();
  };

  const writable = actor =>
    Boolean(game.user.isGM || actor?.isOwner);

  const flag = token =>
    token.document.getFlag(NS, KEY);

  const keyOf = token =>
    `${canvas.scene?.id}:${token.document.id}`;

  const list = (actor, type) =>
    [...actor.items].filter(i =>
      i.type === type && i.system?.disabled !== true
    );

  function notifyError(error) {
    console.error("FateX Companion:", error);
    ui.notifications.error(
      `FateX Companion: ${error.message || error}`
    );
  }

  function tokenOf(key) {
    if (!canvas?.ready) return null;
    const id = key.split(":").at(-1);
    return canvas.tokens?.placeables.find(
      t => t.document.id === id
    ) ?? null;
  }

  function boardMetrics() {
    const element = canvas.app?.canvas ??
      canvas.app?.view ??
      document.getElementById("board");

    const rect = element.getBoundingClientRect();
    const width =
      canvas.app?.renderer?.screen?.width ||
      element.width || rect.width;
    const height =
      canvas.app?.renderer?.screen?.height ||
      element.height || rect.height;

    return {
      rect,
      sx: rect.width / width,
      sy: rect.height / height
    };
  }

  function screenPosition(x, y) {
    const m = canvas.stage.worldTransform;
    const b = boardMetrics();

    return {
      left: b.rect.left +
        (m.a*x + m.c*y + m.tx)*b.sx,
      top: b.rect.top +
        (m.b*x + m.d*y + m.ty)*b.sy,
      scale: Math.max(
        0.05, Math.hypot(m.a, m.b)*b.sx
      )
    };
  }

  function positionCards() {
    if (!canvas?.ready) return;

    for (const [key, data] of cards) {
      const token = tokenOf(key);
      const cfg = token && flag(token);
      if (!cfg) continue;

      const p = screenPosition(
        data.preview?.x ?? cfg.x,
        data.preview?.y ?? cfg.y
      );
      const size = data.preview ?? cfg;

      data.el.style.left = p.left + "px";
      data.el.style.top = p.top + "px";
      data.el.style.width =
        (size.w ?? cfg.w) + "px";
      data.el.style.height =
        (size.h ?? cfg.h) + "px";
      data.el.style.transformOrigin = "top left";
      data.el.style.transform =
        `scale(${p.scale})`;
    }
  }

  function cardContent(token, el) {
    const actor = token.actor;
    if (!actor) return;

    const as = list(actor, "aspect");
    const co = list(actor, "consequence");
    const st = list(actor, "stress");

    const current = Number(
      actor.system?.fatepoints?.current || 0
    );
    const refresh = Number(
      actor.system?.fatepoints?.refresh || 0
    );

    const oldScroll =
      el.querySelector(".fxc-body")?.scrollTop || 0;

    const asHTML = as.map(i => `
      <div class="fxc-edit" data-action="edit"
           data-id="${i.id}"
           title="Редактировать аспект">
        ✦ ${esc(clean(i.system.value) || i.name)}
      </div>
    `).join("") ||
      '<span class="fxc-muted">Нет аспектов</span>';

    const coHTML = co.map(i => `
      <div class="fxc-consequence">
        <button data-action="active"
                data-id="${i.id}"
                title="Отметить или снять последствие">
          ${i.system.active ? "☑" : "☐"}
        </button>
        <div class="fxc-grow fxc-edit"
             data-action="edit"
             data-id="${i.id}"
             title="Изменить текст последствия">
          <div class="fxc-name">
            ${esc(clean(i.system.label) || i.name)}
          </div>
          <div>
            ${esc(clean(i.system.value) ||
              "Вписать последствие")}
          </div>
        </div>
      </div>
    `).join("") ||
      '<span class="fxc-muted">Нет последствий</span>';

    const stHTML = st.map(i => {
      const size = Number(i.system.size);
      const bits = Number(i.system.value);

      if (!Number.isInteger(size) || size < 1 ||
          size > 30 || !Number.isInteger(bits) ||
          bits < 0) {
        return `
          <div>${esc(i.name)}:
            <button data-action="sheet">
              Изменить в листе
            </button>
          </div>
        `;
      }

      const boxes = Array.from(
        {length: size},
        (_, n) => `
          <button data-action="stress"
                  data-id="${i.id}"
                  data-box="${n}"
                  class="${bits & (1<<n)
                    ? "fxc-used" : ""}"
                  title="Ячейка ${n+1}">
            ${n+1}
          </button>
        `
      ).join("");

      return `
        <div>${esc(i.name)}</div>
        <div class="fxc-stress">${boxes}</div>
      `;
    }).join("") ||
      `<span class="fxc-muted">
        Шкала стресса не добавлена в лист
      </span>`;

    el.innerHTML = `
      <div class="fxc-head" data-move="1">
        <strong>${esc(actor.name)}</strong>
        <button data-action="sheet">Лист</button>
        ${game.user.isGM
          ? '<button data-action="remove" title="Убрать общую карточку">×</button>'
          : ""}
      </div>

      <div class="fxc-body">
        <div class="fxc-flex">
          <img class="fxc-portrait"
               src="${esc(
                 actor.img || "icons/svg/mystery-man.svg"
               )}" alt="Портрет">
          <div class="fxc-grow">
            <div class="fxc-section">Аспекты</div>
            ${asHTML}
          </div>
        </div>

        <div class="fxc-section">Очки судьбы</div>
        <div class="fxc-row">
          <button data-action="fate"
                  data-step="-1">−</button>
          <strong>${current}</strong>
          <button data-action="fate"
                  data-step="1">+</button>
          <span class="fxc-muted">
            Обновление: ${refresh}
          </span>
        </div>

        <div class="fxc-section">Стресс</div>
        ${stHTML}

        <div class="fxc-section">Последствия</div>
        ${coHTML}

        <div class="fxc-small">
          Нажми на аспект или текст последствия
          для редактирования.
        </div>
      </div>
      ${game.user.isGM
        ? '<div class="fxc-grip" data-resize="1" title="Изменить размер для всех"></div>'
        : ""}
    `;

    el.querySelector(".fxc-body").scrollTop =
      oldScroll;
  }

  async function textEdit(item) {
    const previous = clean(item.system.value);
    const next = window.prompt(
      `Введите текст: ${item.name}`, previous
    );

    if (next === null || next === previous) return;

    const original = String(
      item.system.value ?? ""
    );

    const value = /<\/?[a-z][^>]*>/i.test(original)
      ? `<p>${esc(next).replaceAll("\n", "<br>")}</p>`
      : next;

    await item.update({"system.value": value});
  }

  function addCard(token) {
    const k = keyOf(token);
    if (cards.has(k)) return;

    const el = document.createElement("section");
    el.className = "fxc fxc-scene";
    document.body.appendChild(el);

    const state = {el, preview: null};
    cards.set(k, state);
    cardContent(token, el);

    let dragging = null;

    el.addEventListener("pointerdown", ev => {
      if (!game.user.isGM ||
          ev.target.closest("button")) return;

      const mode = ev.target.closest("[data-resize]")
        ? "resize"
        : ev.target.closest("[data-move]")
          ? "move" : null;

      if (!mode) return;

      const cfg = flag(token);
      if (!cfg) return;

      dragging = {
        mode,
        px: ev.clientX,
        py: ev.clientY,
        ...cfg
      };

      el.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });

    el.addEventListener("pointermove", ev => {
      if (!dragging) return;

      const p = screenPosition(
        dragging.x, dragging.y
      );

      const dx =
        (ev.clientX-dragging.px)/p.scale;
      const dy =
        (ev.clientY-dragging.py)/p.scale;

      state.preview = dragging.mode === "move"
        ? {
            ...dragging,
            x: dragging.x+dx,
            y: dragging.y+dy
          }
        : {
            ...dragging,
            w: Math.max(260, dragging.w+dx),
            h: Math.max(240, dragging.h+dy)
          };

      positionCards();
    });

    el.addEventListener("pointerup", async () => {
      if (!dragging) return;

      const next = state.preview;
      dragging = null;
      if (!next) return;

      try {
        await token.document.setFlag(NS, KEY, {
          x: Math.round(next.x),
          y: Math.round(next.y),
          w: Math.round(next.w),
          h: Math.round(next.h)
        });
      } catch(error) {
        notifyError(error);
      }

      state.preview = null;
      positionCards();
    });

    el.addEventListener("pointercancel", () => {
      dragging = null;
      state.preview = null;
      positionCards();
    });

    el.addEventListener("click", async ev => {
      const btn = ev.target.closest("[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const actor = token.actor;

      if (action === "sheet") {
        actor.sheet.render(true);
        return;
      }

      if (action === "remove" && game.user.isGM) {
        try {
          await token.document.unsetFlag(NS, KEY);
        } catch(e) {
          notifyError(e);
        }
        return;
      }

      if (!writable(actor)) {
        ui.notifications.warn(
          "Нет права редактировать этого персонажа"
        );
        return;
      }

      const item = actor.items.get(btn.dataset.id);

      try {
        if (action === "edit" && item)
          await textEdit(item);

        if (action === "active" && item)
          await item.update({
            "system.active": !item.system.active
          });

        if (action === "fate") {
          const n = Number(
            actor.system?.fatepoints?.current ?? 0
          );

          await actor.update({
            "system.fatepoints.current":
              Math.max(
                0, n+Number(btn.dataset.step)
              )
          });
        }

        if (action === "stress" && item) {
          const index = Number(btn.dataset.box);
          const bits = Number(item.system.value);
          const size = Number(item.system.size);

          if (Number.isInteger(bits) && bits>=0 &&
              Number.isInteger(size) &&
              index>=0 && index<size && index<30) {
            await item.update({
              "system.value": bits ^ (1<<index)
            });
          }
        }
      } catch(error) {
        notifyError(error);
      }
    });
  }

  function syncCards() {
    const active = new Set();

    if (canvas?.ready) {
      for (const t of canvas.tokens.placeables) {
        if (!flag(t) || !t.actor) continue;

        const k = keyOf(t);
        active.add(k);

        if (!cards.has(k)) addCard(t);
      }
    }

    for (const [k, state] of cards) {
      if (active.has(k)) continue;
      state.el.remove();
      cards.delete(k);
    }

    positionCards();
  }

  function refresh() {
    syncCards();

    for (const [k, state] of cards) {
      const t = tokenOf(k);
      if (t?.actor) cardContent(t, state.el);
    }
  }

  async function toggleSelectedCard() {
    if (!game.user.isGM) {
      ui.notifications.warn(
        "Карточку создаёт мастер"
      );
      return;
    }

    const t = canvas.tokens.controlled[0];

    if (!t?.actor) {
      ui.notifications.warn(
        "Выдели токен персонажа"
      );
      return;
    }

    try {
      if (flag(t)) {
        await t.document.unsetFlag(NS, KEY);
      } else {
        await t.document.setFlag(NS, KEY, {
          x: Math.round(
            t.document.x +
            (t.document.width || 1)*canvas.grid.size +
            24
          ),
          y: Math.round(t.document.y),
          w: 430,
          h: 475
        });
      }
    } catch(error) {
      notifyError(error);
    }

    syncCards();
  }

  // Справочник Fate Accelerated

  const ACTIONS = [
    {
      name: "Преодоление",
      desc: "Убрать препятствие или достичь цели: открыть дверь, выбраться, снять мешающий аспект.",
      results: [
        "Неудача либо успех серьёзной ценой.",
        "Успех небольшой ценой.",
        "Цель достигнута.",
        "Цель достигнута и получено усиление."
      ]
    },
    {
      name: "Создание преимущества",
      desc: "Создать аспект, раскрыть скрытый либо получить бесплатный призыв известного аспекта.",
      results: [
        "Не создали/не узнали аспект; либо аспект появился, но бесплатный призыв у противника.",
        "При создании нового аспекта получаете усиление; при раскрытии существующего — аспект и один бесплатный призыв.",
        "Аспект создан или раскрыт, один бесплатный призыв.",
        "Аспект создан или раскрыт, два бесплатных призыва."
      ],
      known: [
        "Новых бесплатных призывов нет.",
        "Один бесплатный призыв известного аспекта.",
        "Один бесплатный призыв известного аспекта.",
        "Два бесплатных призыва известного аспекта."
      ]
    },
    {
      name: "Атака",
      desc: "Нанести физический или ментальный вред. Разница результатов — сдвиги попадания.",
      results: [
        "Атака не нанесла вреда.",
        "Вреда нет, атакующий получает усиление.",
        "Попадание. Нанесённый вред равен сдвигам.",
        "Попадание. Можно уменьшить вред на 1 и получить усиление."
      ]
    },
    {
      name: "Защита",
      desc: "Помешать активному действию противника.",
      results: [
        "Противник добивается своего, примените результат его действия.",
        "Смотрите результат действия противника при ничьей.",
        "Противнику не удалось добиться цели.",
        "Противнику не удалось добиться цели, защитник получает усиление."
      ]
    }
  ];

  const OUTCOMES = [
    "Провал (< 0)",
    "Ничья (0)",
    "Успех (+1 или +2)",
    "Со стилем (+3 и выше)"
  ];

  const tabNames = {
    actions: "Действия",
    aspects: "Аспекты",
    harm: "Стресс",
    stunts: "Трюки",
    gm: "Мастеру"
  };

  function guideContent() {
    if (guideTab === "actions") {
      const a = ACTIONS[actionIndex];

      const actionOptions = ACTIONS.map(
        (v, i) => `
          <option value="${i}"
                  ${i===actionIndex?"selected":""}>
            ${esc(v.name)}
          </option>
        `
      ).join("");

      const outcomeOptions = OUTCOMES.map(
        (v, i) => `
          <option value="${i}"
                  ${i===outcomeIndex?"selected":""}>
            ${esc(v)}
          </option>
        `
      ).join("");

      const advSelect = actionIndex === 1 ? `
        <label>Что делаем с аспектом?</label>
        <select data-field="advantage">
          <option value="new"
                  ${advantageMode==="new"?"selected":""}>
            Создаём новый или раскрываем скрытый
          </option>
          <option value="known"
                  ${advantageMode==="known"?"selected":""}>
            Используем уже известный
          </option>
        </select>
      ` : "";

      const result =
        actionIndex === 1 &&
        advantageMode === "known"
          ? a.known[outcomeIndex]
          : a.results[outcomeIndex];

      return `
        <label>Действие</label>
        <select data-field="action">
          ${actionOptions}
        </select>

        <p>${esc(a.desc)}</p>
        ${advSelect}

        <label>Результат броска</label>
        <select data-field="outcome">
          ${outcomeOptions}
        </select>

        <div class="fxc-panel">
          ${esc(result)}
        </div>

        <div class="fxc-small">
          Результат — разница между броском с
          бонусами и сопротивлением.

          Усиление — временный аспект с одним
          бесплатным призывом.
        </div>
      `;
    }

    if (guideTab === "aspects") {
      return `
        <div class="fxc-panel">
          <b>Призыв аспекта</b> — потратить
          очко судьбы или бесплатный призыв,
          чтобы получить +2 к броску либо
          перебросить четыре кубика.
          Нужно объяснить, почему аспект помогает.
        </div>

        <div class="fxc-panel">
          <b>Навязывание</b> — аспект осложняет
          жизнь герою: мастер предлагает очко
          судьбы за принятие осложнения.
          Отказ обычно стоит очко судьбы.
        </div>

        <div class="fxc-panel">
          <b>Усиление</b> — кратковременный аспект
          с одним бесплатным призывом,
          который затем исчезает.
        </div>

        <div class="fxc-panel">
          <b>Создание преимущества</b> — основная
          возможность готовить выгодные условия,
          вместо того чтобы каждую сцену
          только атаковать.
        </div>
      `;
    }

    if (guideTab === "harm") {
      return `
        <div class="fxc-panel">
          <b>Вред</b> измеряется сдвигами.
          Стресс и последствия помогают поглотить
          попадание; если не получается,
          персонаж выведен из конфликта.
        </div>

        <div class="fxc-panel">
          <b>Последствия</b> — новые аспекты,
          отражающие травмы и проблемы.
          В стандартной Fate Accelerated лёгкое
          поглощает 2 сдвига, среднее 4,
          тяжёлое 6. Конкретные ячейки и варианты
          в FateX могут быть настроены иначе.
        </div>

        <div class="fxc-panel">
          <b>Сдача</b> возможна до броска,
          который вывел бы персонажа из конфликта.
          Игрок договаривается о цене отступления
          и сохраняет участие в определении исхода.
        </div>

        <div class="fxc-panel">
          <b>Восстановление</b> — стресс обычно
          очищается после конфликта; последствия
          требуют времени и подходящих действий
          по лечению, согласно правилам и
          настройкам группы.
        </div>
      `;
    }

    if (guideTab === "stunts") {
      return `
        <p>
          Шаблон трюка с ограниченной областью
          применения. Это черновик для
          согласования с мастером.
        </p>

        <label>Особенность героя</label>
        <input data-stunt="why"
               value="Я знаю каждый уголок острова">

        <label>Подход</label>
        <select data-stunt="approach">
          ${[
            "Аккуратно", "Умно", "Эффектно",
            "Сильно", "Быстро", "Хитро"
          ].map(v=>`<option>${v}</option>`).join("")}
        </select>

        <label>Действие</label>
        <select data-stunt="action">
          ${[
            "преодолеваю препятствия",
            "создаю преимущество",
            "атакую", "защищаюсь"
          ].map(v=>`<option>${v}</option>`).join("")}
        </select>

        <label>Обстоятельство</label>
        <input data-stunt="when"
               value="использую знание острова">

        <div class="fxc-panel"
             data-preview="1"></div>

        <button data-action="copy-stunt">
          Скопировать трюк
        </button>

        <p class="fxc-small">
          Другой шаблон Fate Accelerated:
          «Один раз за сессию я могу ...» —
          особая возможность,
          согласуемая с мастером.
        </p>
      `;
    }

    if (guideTab === "gm") {
      return `
        <div class="fxc-panel">
          <b>Когда бросать?</b>
          Если исход неясен и неудача интересна.
          Иначе разрешай действие без броска.
        </div>

        <div class="fxc-panel">
          <b>Сложность</b> — обычно от
          посредственной (+0) до легендарной (+8).
          Повышай её, когда препятствие
          действительно сложнее,
          а не чтобы искусственно остановить игроков.
        </div>

        <div class="fxc-panel">
          <b>Испытание</b> — несколько задач,
          решаемых отдельными действиями.

          <b>Состязание</b> — борьба за цель
          без взаимного урона,
          обычно до трёх побед.

          <b>Конфликт</b> — противостояние
          с атаками, стрессом и последствиями.
        </div>

        <div class="fxc-panel">
          <b>Цена успеха</b>: потеря времени,
          расход ресурса, новое осложнение,
          опасная позиция, раскрытый секрет.
          Согласуй цену с масштабом риска.
        </div>

        <div class="fxc-panel">
          <b>Противники</b>: дай им заметный аспект,
          ясную мотивацию и несколько осмысленных
          вариантов действий. Используй окружение
          и создание преимуществ, а не только атаки.
        </div>
      `;
    }

    return "";
  }

  function stuntText() {
    const get = key =>
      guide?.querySelector(
        `[data-stunt="${key}"]`
      )?.value?.trim() || "...";

    return `Поскольку ${get("why")}, получаю +2, когда действую (${get("approach")}), ${get("action")} и ${get("when")}.`;
  }

  function refreshStuntPreview() {
    const out = guide?.querySelector(
      '[data-preview="1"]'
    );
    if (out) out.textContent = stuntText();
  }

  function renderGuide() {
    if (!guide) return;

    const body = guide.querySelector(".fxc-body");

    const tabs = Object.entries(tabNames)
      .filter(([k])=>k!=="gm" || game.user.isGM)
      .map(([k,v])=>`
        <button data-tab="${k}"
                aria-pressed="${guideTab===k}">
          ${v}
        </button>
      `).join("");

    body.innerHTML = `
      <nav>${tabs}</nav>
      ${guideContent()}
      <p class="fxc-small">
        Справочник: Fate Accelerated SRD.
        Приоритет — правила и настройки
        вашей группы.
      </p>
    `;

    refreshStuntPreview();
  }

  function toggleGuide() {
    if (guide) {
      guide.remove();
      guide = null;
      return;
    }

    guide = document.createElement("section");
    guide.className = "fxc fxc-guide";

    guide.innerHTML = `
      <div class="fxc-head">
        <strong>
          FateX Companion · Памятка
        </strong>
        <button data-close="1">×</button>
      </div>
      <div class="fxc-body"></div>
    `;

    document.body.appendChild(guide);

    guide.addEventListener("click", async ev => {
      if (ev.target.closest("[data-close]")) {
        toggleGuide();
        return;
      }

      const tab = ev.target.closest("[data-tab]");

      if (tab) {
        guideTab = tab.dataset.tab;
        renderGuide();
        return;
      }

      if (ev.target.closest(
        '[data-action="copy-stunt"]'
      )) {
        const value = stuntText();

        try {
          await navigator.clipboard.writeText(value);
          ui.notifications.info("Трюк скопирован");
        } catch {
          window.prompt(
            "Скопируй текст трюка", value
          );
        }
      }
    });

    guide.addEventListener("change", ev => {
      const f = ev.target.dataset.field;

      if (f === "action")
        actionIndex = Number(ev.target.value);

      if (f === "outcome")
        outcomeIndex = Number(ev.target.value);

      if (f === "advantage")
        advantageMode = ev.target.value;

      if (f) renderGuide();
      else refreshStuntPreview();
    });

    guide.addEventListener(
      "input", refreshStuntPreview
    );

    renderGuide();
  }

  function dock() {
    if (document.getElementById("fxc-dock"))
      return;

    const d = document.createElement("div");
    d.id = "fxc-dock";

    d.innerHTML = `
      <button data-action="guide"
              title="Открыть справочник Fate">
        📖 Fate
      </button>
      ${game.user.isGM
        ? `<button data-action="card"
                   title="Создать или убрать общую карточку выбранного токена">
             ▣ Карточка
           </button>`
        : ""}
    `;

    d.addEventListener("click", ev => {
      const button = ev.target.closest("button");
      if (!button) return;

      if (button.dataset.action === "guide")
        toggleGuide();

      if (button.dataset.action === "card")
        toggleSelectedCard();
    });

    document.body.appendChild(d);
  }

  function init() {
    if (game.system.id !== "fatex") {
      console.warn(
        "FateX Companion: world system is not fatex"
      );
      return;
    }

    dock();
    syncCards();

    Hooks.on("canvasReady", syncCards);
    Hooks.on("createToken", syncCards);
    Hooks.on("deleteToken", syncCards);
    Hooks.on("updateToken", syncCards);

    Hooks.on("updateActor", refresh);
    Hooks.on("updateItem", refresh);
    Hooks.on("createItem", refresh);
    Hooks.on("deleteItem", refresh);

    const loop = () => {
      if (canvas?.ready && cards.size)
        positionCards();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    console.info("FateX Companion ready");
  }

  return {init};
})();

Hooks.once("ready", FXC.init);
