
/* FateX Companion 0.2.1 | Foundry VTT 14 | FateX */
(() => {
  "use strict";

  const NS = "fatex-companion", FLAG = "card";
  const cards = new Map();
  const MIN_W = 310, MIN_H = 240;

  let guide = null;
  let tab = "actions";
  let choice = 0;
  let result = 2;
  let adv = "new";

  const draft = {
    why: "Я знаю остров",
    approach: "Хитро",
    action: "создаю преимущество",
    when: "использую знания о местности"
  };

  const esc = v => String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const plain = v => {
    const e = document.createElement("div");
    e.innerHTML = String(v ?? "");
    return (e.textContent || "").trim();
  };

  const clamp = (n, a, b) =>
    Math.max(a, Math.min(b, n));

  const entries = (actor, type) =>
    [...(actor?.items ?? [])].filter(i =>
      i.type === type &&
      i.system?.disabled !== true
    );

  const allowed = actor =>
    !!actor && (game.user.isGM || actor.isOwner);

  const config = token =>
    token.document.getFlag(NS, FLAG);

  const key = token =>
    `${canvas.scene.id}:${token.document.id}`;

  const fail = err => {
    console.error("FateX Companion", err);
    ui.notifications.error(
      `FateX Companion: ${err.message || err}`
    );
  };

  const sceneToken = k =>
    canvas?.ready
      ? canvas.tokens.placeables.find(
          t => key(t) === k
        )
      : null;

  function normalize(data) {
    if (data?.layout === "overlay-v2") {
      return {
        layout: "overlay-v2",
        x: clamp(Number(data.x) || 0, 0, 1),
        y: clamp(Number(data.y) || 0, 0, 1),
        w: Math.max(MIN_W, Number(data.w) || 450),
        h: Math.max(MIN_H, Number(data.h) || 560)
      };
    }

    return {
      layout: "overlay-v2",
      x: 0.16,
      y: 0.12,
      w: 450,
      h: 560
    };
  }

  function position(state) {
    const d = state.preview || state.cfg;
    const sw = innerWidth;
    const sh = innerHeight;

    const w = Math.min(
      Math.max(MIN_W, d.w),
      Math.max(200, sw - 12)
    );

    const h = Math.min(
      Math.max(MIN_H, d.h),
      Math.max(180, sh - 12)
    );

    Object.assign(state.el.style, {
      left: clamp(
        d.x * sw, 0, Math.max(0, sw - 110)
      ) + "px",
      top: clamp(
        d.y * sh, 0, Math.max(0, sh - 50)
      ) + "px",
      width: w + "px",
      height: h + "px",
      transform: "none"
    });
  }

  const section = (title, html) =>
    `<h3>${title}</h3>${html}`;

  const value = item =>
    plain(item.system?.value);

  const generic = i => `
    <div class="fxc-entry">
      <b class="fxc-gold">${esc(i.name)}</b>
      <span>${esc(value(i))}</span>
    </div>
  `;

  function render(state, token) {
    const a = token.actor;
    if (!a) return;

    const previous =
      state.el.querySelector(".fxc-body")
        ?.scrollTop || 0;

    const aspects = entries(a, "aspect")
      .map(i => `
        <div class="fxc-edit"
             data-action="edit"
             data-id="${esc(i.id)}"
             title="Редактировать аспект">
          ✦ ${esc(value(i) || i.name)}
        </div>
      `).join("") ||
      '<p class="fxc-muted">Аспектов нет</p>';

    const consequences = entries(a, "consequence")
      .map((i, n) => {
        const label =
          plain(i.system?.label) ||
          (["Лёгкое", "Среднее", "Тяжёлое"][n] || i.name);

        return `
          <div class="fxc-consequence">
            <button data-action="active"
                    data-id="${esc(i.id)}"
                    title="Переключить состояние">
              ${i.system?.active ? "☑" : "☐"}
            </button>

            <div class="fxc-grow fxc-edit"
                 data-action="edit"
                 data-id="${esc(i.id)}"
                 title="Вписать текст последствия">

              <strong class="fxc-gold">
                ${esc(label)}
              </strong>

              <span>
                ${esc(
                  value(i) ||
                  "Нажмите, чтобы вписать последствие"
                )}
              </span>
            </div>
          </div>
        `;
      }).join("") ||
      '<p class="fxc-muted">Последствий нет</p>';

    const stress = entries(a, "stress")
      .map(i => {
        const size = Number(i.system?.size);
        const v = Number(i.system?.value);

        if (
          !Number.isInteger(size) ||
          size < 1 || size > 30 ||
          !Number.isInteger(v) || v < 0
        ) {
          return `
            <div>
              ${esc(i.name)}
              <button data-action="sheet">
                Изменить в листе
              </button>
            </div>
          `;
        }

        const boxes = Array.from(
          { length: size },
          (_, n) => `
            <button data-action="stress"
                    data-id="${esc(i.id)}"
                    data-box="${n}"
                    class="${
                      v & (1 << n)
                        ? "fxc-used" : ""
                    }">
              ${n + 1}
            </button>
          `
        ).join("");

        return `
          <p>${esc(i.name)}</p>
          <div class="fxc-row">${boxes}</div>
        `;
      }).join("") ||
      '<p class="fxc-muted">Шкал стресса нет</p>';

    const details = [
      ["Навыки и подходы", "skill"],
      ["Трюки", "stunt"],
      ["Дополнения", "extra"]
    ].map(([label, type]) => {
      const group = entries(a, type);
      if (!group.length) return "";

      return `
        <details data-section="${type}"
                 ${state.open.has(type) ? "open" : ""}>
          <summary>
            ${label} (${group.length})
          </summary>
          ${group.map(generic).join("")}
        </details>
      `;
    }).join("");

    const points = Number(
      a.system?.fatepoints?.current
    ) || 0;

    const refresh =
      a.system?.fatepoints?.refresh ?? "—";

    state.el.innerHTML = `
      <header class="fxc-head" data-move="1">
        <strong>${esc(a.name)}</strong>

        <button data-action="sheet">Лист</button>

        ${
          game.user.isGM
            ? `<button data-action="remove"
                       title="Убрать карточку для всех">
                 ×
               </button>`
            : ""
        }
      </header>

      <main class="fxc-body">
        <div class="fxc-overview">
          <img class="fxc-portrait"
               src="${esc(
                 a.img || "icons/svg/mystery-man.svg"
               )}"
               alt="Портрет">

          <div class="fxc-grow">
            ${section("Аспекты", aspects)}
          </div>
        </div>

        ${section("Очки судьбы", `
          <div class="fxc-row">
            <button data-action="fate"
                    data-step="-1">−</button>
            <strong>${points}</strong>
            <button data-action="fate"
                    data-step="1">+</button>
            <span class="fxc-muted">
              Обновление: ${esc(refresh)}
            </span>
          </div>
        `)}

        ${section("Стресс", stress)}
        ${section("Последствия", consequences)}

        ${details}

        <p class="fxc-muted fxc-small">
          Нажмите на аспект или описание последствия,
          чтобы изменить текст.
          Галочка последствия переключается отдельно.
        </p>
      </main>

      ${
        game.user.isGM
          ? `<div class="fxc-grip"
                  data-resize="1"
                  title="Изменить размер для всех">
             </div>`
          : ""
      }
    `;

    state.el.querySelector(
      ".fxc-body"
    ).scrollTop = previous;
  }

  // Новый редактор Foundry 14.
  // Не использует браузерный prompt().
  async function editItem(item) {
    const before = value(item);

    const result = await foundry.applications.api
      .DialogV2.input({
        window: {
          title: `FateX — ${
            item.type === "aspect"
              ? "аспект"
              : "последствие"
          }: ${item.parent?.name || ""}`
        },

        content: `
          <label>Введите текст:</label>

          <textarea name="value"
                    rows="5"
                    style="
                      width:100%;
                      min-height:130px;
                      resize:vertical;
                    ">${esc(before)}</textarea>
        `,

        ok: {
          label: "Сохранить"
        },

        rejectClose: false
      });

    if (!result) return;

    const text = String(result.value ?? "");

    if (text === before) return;

    const original = String(
      item.system?.value ?? ""
    );

    const formatted =
      /<\/?[a-z][^>]*>/i.test(original)
        ? `<p>${
            esc(text).replace(/\n/g, "<br>")
          }</p>`
        : text;

    await item.update({
      "system.value": formatted
    });

    ui.notifications.info(
      "FateX: изменение сохранено"
    );
  }

  function addCard(token) {
    const k = key(token);
    const el = document.createElement("section");

    el.className =
      "fxc fxc-scene fxc-overlay-card";

    const state = {
      el,
      cfg: normalize(config(token)),
      preview: null,
      open: new Set()
    };

    cards.set(k, state);
    document.body.appendChild(el);

    position(state);
    render(state, token);

    let drag = null;

    el.addEventListener("toggle", e => {
      const detail = e.target.closest?.(
        "details[data-section]"
      );

      if (!detail) return;

      if (detail.open) {
        state.open.add(detail.dataset.section);
      } else {
        state.open.delete(detail.dataset.section);
      }
    }, true);

    el.addEventListener("pointerdown", e => {
      if (
        !game.user.isGM ||
        e.button !== 0 ||
        e.target.closest("button")
      ) return;

      const mode = e.target.closest("[data-resize]")
        ? "resize"
        : e.target.closest("[data-move]")
          ? "move"
          : null;

      if (!mode) return;

      drag = {
        mode,
        id: e.pointerId,
        origin: { ...state.cfg },
        sx: e.clientX,
        sy: e.clientY
      };

      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    el.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.id) return;

      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      const s = drag.origin;

      state.preview = drag.mode === "move"
        ? {
            ...s,
            x: clamp(
              s.x + dx / innerWidth, 0, 1
            ),
            y: clamp(
              s.y + dy / innerHeight, 0, 1
            )
          }
        : {
            ...s,
            w: clamp(
              s.w + dx,
              MIN_W,
              Math.max(MIN_W, innerWidth - 12)
            ),
            h: clamp(
              s.h + dy,
              MIN_H,
              Math.max(MIN_H, innerHeight - 12)
            )
          };

      position(state);
    });

    const finish = async (e, save) => {
      if (!drag || e.pointerId !== drag.id) return;

      drag = null;
      const next = state.preview;
      state.preview = null;

      if (save && next) {
        try {
          await token.document.setFlag(
            NS, FLAG, next
          );
          state.cfg = next;
        } catch (err) {
          fail(err);
        }
      }

      position(state);
    };

    el.addEventListener(
      "pointerup",
      e => finish(e, true)
    );

    el.addEventListener(
      "pointercancel",
      e => finish(e, false)
    );

    el.addEventListener("click", async e => {
      const control = e.target.closest(
        "[data-action]"
      );

      if (!control) return;

      const action = control.dataset.action;
      const a = token.actor;

      if (action === "sheet") {
        a.sheet.render(true);
        return;
      }

      if (
        action === "remove" &&
        game.user.isGM
      ) {
        try {
          await token.document.unsetFlag(
            NS, FLAG
          );
        } catch (err) {
          fail(err);
        }
        return;
      }

      if (!allowed(a)) {
        ui.notifications.warn(
          "Нет прав редактировать персонажа"
        );
        return;
      }

      const item = a.items.get(
        control.dataset.id
      );

      try {
        if (action === "edit" && item) {
          await editItem(item);
        }

        else if (action === "active" && item) {
          await item.update({
            "system.active": !item.system.active
          });
        }

        else if (action === "fate") {
          const old = Number(
            a.system?.fatepoints?.current
          ) || 0;

          await a.update({
            "system.fatepoints.current": Math.max(
              0,
              old + Number(control.dataset.step)
            )
          });
        }

        else if (action === "stress" && item) {
          const idx = Number(control.dataset.box);
          const size = Number(item.system?.size);
          const bits = Number(item.system?.value);

          if (
            Number.isInteger(idx) &&
            Number.isInteger(size) &&
            Number.isInteger(bits) &&
            idx >= 0 &&
            idx < size &&
            idx < 30 &&
            bits >= 0
          ) {
            await item.update({
              "system.value": bits ^ (1 << idx)
            });
          }
        }
      } catch (err) {
        fail(err);
      }
    });
  }

  function sync() {
    const active = new Set();

    if (canvas?.ready) {
      for (const t of canvas.tokens.placeables) {
        if (!t.actor || !config(t)) continue;

        const k = key(t);
        active.add(k);

        if (!cards.has(k)) {
          addCard(t);
        } else {
          const s = cards.get(k);

          if (!s.preview) {
            s.cfg = normalize(config(t));
            position(s);
          }
        }
      }
    }

    for (const [k, s] of cards) {
      if (!active.has(k)) {
        s.el.remove();
        cards.delete(k);
      }
    }
  }

  function refreshActor(actor) {
    for (const [k, s] of cards) {
      const t = sceneToken(k);

      if (
        t?.actor &&
        (
          !actor ||
          t.actor.uuid === actor.uuid ||
          t.actor.id === actor.id
        )
      ) {
        render(s, t);
      }
    }
  }

  async function toggleSelected() {
    if (!game.user.isGM) return;

    const t = canvas.tokens.controlled[0];

    if (!t?.actor) {
      ui.notifications.warn(
        "Выделите токен персонажа"
      );
      return;
    }

    try {
      if (config(t)) {
        await t.document.unsetFlag(NS, FLAG);
      } else {
        await t.document.setFlag(
          NS, FLAG, {
            layout: "overlay-v2",
            x: clamp(
              0.16 + cards.size * 0.025,
              0, 0.8
            ),
            y: clamp(
              0.12 + cards.size * 0.025,
              0, 0.8
            ),
            w: 450,
            h: 560
          }
        );
      }

      sync();
    } catch (err) {
      fail(err);
    }
  }

  // Справочник Fate Accelerated.
  const actions = [
    {
      name: "Преодоление",
      desc: "Добиться цели или преодолеть препятствие.",
      out: [
        "Неудача или успех серьёзной ценой.",
        "Успех небольшой ценой.",
        "Цель достигнута.",
        "Цель достигнута, получено усиление."
      ]
    },
    {
      name: "Создание преимущества",
      desc: "Создать, раскрыть или использовать аспект.",
      out: [
        "Аспект не создан либо создан с бесплатным призывом для противника.",
        "При создании нового аспекта — усиление; при раскрытии существующего — один бесплатный призыв.",
        "Один бесплатный призыв созданного или раскрытого аспекта.",
        "Два бесплатных призыва."
      ],
      known: [
        "Нового бесплатного призыва нет.",
        "Один бесплатный призыв известного аспекта.",
        "Один бесплатный призыв известного аспекта.",
        "Два бесплатных призыва известного аспекта."
      ]
    },
    {
      name: "Атака",
      desc: "Нанести физический или ментальный вред.",
      out: [
        "Нет вреда.",
        "Нет вреда, атакующий получает усиление.",
        "Попадание: вред равен сдвигам.",
        "Попадание: можно уменьшить вред на 1 и получить усиление."
      ]
    },
    {
      name: "Защита",
      desc: "Помешать действию противника.",
      out: [
        "Противник добивается своего.",
        "Примените правила ничьей для действия противника.",
        "Противник не добивается своего.",
        "Противник не добивается своего, защитник получает усиление."
      ]
    }
  ];

  const outcomes = [
    "Провал",
    "Ничья",
    "Успех (+1/+2)",
    "Успех со стилем (+3 и выше)"
  ];

  const tabs = {
    actions: "Действия",
    aspects: "Аспекты",
    harm: "Стресс",
    stunts: "Трюки",
    gm: "Мастеру"
  };

  const panel = t =>
    `<div class="fxc-panel">${t}</div>`;

  const options = (items, selected) =>
    items.map((x, i) => `
      <option value="${i}"
              ${i === selected ? "selected" : ""}>
        ${esc(x)}
      </option>
    `).join("");

  const stuntText = () =>
    `Поскольку ${draft.why}, получаю +2, когда действую ${draft.approach.toLowerCase()}, ${draft.action} и ${draft.when}.`;

  function guideBody() {
    if (tab === "actions") {
      const a = actions[choice];

      const r = choice === 1 && adv === "known"
        ? a.known[result]
        : a.out[result];

      return `
        <label>Действие</label>
        <select data-field="action">
          ${options(actions.map(a => a.name), choice)}
        </select>

        <p>${esc(a.desc)}</p>

        ${
          choice === 1
            ? `
              <label>Тип аспекта</label>
              <select data-field="adv">
                <option value="new"
                  ${adv === "new" ? "selected" : ""}>
                  Новый или скрытый
                </option>
                <option value="known"
                  ${adv === "known" ? "selected" : ""}>
                  Известный
                </option>
              </select>
            `
            : ""
        }

        <label>Результат</label>
        <select data-field="outcome">
          ${options(outcomes, result)}
        </select>

        ${panel(esc(r))}
      `;
    }

    if (tab === "aspects") {
      return [
        "<b>Призыв:</b> +2 или перебросить кубики за очко судьбы либо бесплатный призыв, объяснив связь с аспектом.",
        "<b>Навязывание:</b> осложнение за очко судьбы; отказ обычно стоит очко.",
        "<b>Усиление:</b> кратковременный аспект с одним бесплатным призывом."
      ].map(panel).join("");
    }

    if (tab === "harm") {
      return [
        "<b>Стресс</b> поглощает вред в конфликте; после конфликта обычно очищается.",
        "<b>Последствия</b> — аспекты. В стандартной Fate Accelerated: лёгкое 2, среднее 4, тяжёлое 6 сдвигов.",
        "<b>Сдача:</b> до броска, который выведет героя из конфликта. Последствия оговариваются."
      ].map(panel).join("");
    }

    if (tab === "stunts") {
      return `
        <p>
          Создание черновика трюка.
          Согласуйте его с мастером.
        </p>

        <label>Особенность героя</label>
        <input data-stunt="why"
               value="${esc(draft.why)}">

        <label>Подход</label>
        <select data-stunt="approach">
          ${
            [
              "Аккуратно",
              "Умно",
              "Эффектно",
              "Сильно",
              "Быстро",
              "Хитро"
            ].map(x => `
              <option ${
                x === draft.approach
                  ? "selected" : ""
              }>${x}</option>
            `).join("")
          }
        </select>

        <label>Действие</label>
        <select data-stunt="action">
          ${
            [
              "преодолеваю препятствие",
              "создаю преимущество",
              "атакую",
              "защищаюсь"
            ].map(x => `
              <option ${
                x === draft.action
                  ? "selected" : ""
              }>${x}</option>
            `).join("")
          }
        </select>

        <label>Условие</label>
        <input data-stunt="when"
               value="${esc(draft.when)}">

        <div class="fxc-panel" data-preview></div>

        <button data-action="copy-stunt">
          Скопировать трюк
        </button>
      `;
    }

    if (tab === "gm") {
      return [
        "Броски нужны там, где исход неочевиден, а цена значима.",
        "Испытание — несколько задач; состязание — борьба за цель; конфликт — противоборство с вредом.",
        "Цена успеха: время, ресурс, неудобное положение, новая угроза.",
        "Навязывайте аспекты, когда это делает историю интереснее."
      ].map(panel).join("");
    }

    return "";
  }

  function renderGuide() {
    if (!guide) return;

    guide.querySelector(
      ".fxc-body"
    ).innerHTML = `
      <nav>
        ${
          Object.entries(tabs)
            .filter(([id]) =>
              id !== "gm" || game.user.isGM
            )
            .map(([id, label]) => `
              <button data-tab="${id}"
                      aria-pressed="${id === tab}">
                ${label}
              </button>
            `).join("")
        }
      </nav>

      ${guideBody()}

      <p class="fxc-small">
        Памятка Fate Accelerated.
        Правила вашей группы имеют приоритет.
      </p>
    `;

    const preview = guide.querySelector(
      "[data-preview]"
    );

    if (preview) {
      preview.textContent = stuntText();
    }
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
          📖 FateX Companion · Справочник
        </strong>
        <button data-close="1">×</button>
      </div>
      <div class="fxc-body"></div>
    `;

    document.body.appendChild(guide);

    guide.addEventListener("click", async e => {
      if (e.target.closest("[data-close]")) {
        toggleGuide();
        return;
      }

      const t = e.target.closest("[data-tab]");

      if (t) {
        tab = t.dataset.tab;
        renderGuide();
        return;
      }

      if (
        e.target.closest(
          '[data-action="copy-stunt"]'
        )
      ) {
        try {
          await navigator.clipboard.writeText(
            stuntText()
          );

          ui.notifications.info(
            "Трюк скопирован"
          );
        } catch {
          ui.notifications.warn(
            "Браузер запретил копирование."
          );
        }
      }
    });

    guide.addEventListener("change", e => {
      const f = e.target.dataset.field;

      if (f === "action") {
        choice = Number(e.target.value);
      }

      if (f === "outcome") {
        result = Number(e.target.value);
      }

      if (f === "adv") {
        adv = e.target.value;
      }

      if (f) renderGuide();
    });

    guide.addEventListener("input", e => {
      const k = e.target.dataset.stunt;
      if (!k) return;

      draft[k] = e.target.value;

      const p = guide.querySelector(
        "[data-preview]"
      );

      if (p) p.textContent = stuntText();
    });

    renderGuide();
  }

  function dock() {
    if (document.getElementById("fxc-dock")) {
      return;
    }

    const d = document.createElement("div");
    d.id = "fxc-dock";

    d.innerHTML = `
      <button data-action="guide">
        📖 Fate
      </button>

      ${
        game.user.isGM
          ? `<button data-action="card">
               ▣ Карточка
             </button>`
          : ""
      }
    `;

    d.addEventListener("click", e => {
      const a = e.target.closest(
        "[data-action]"
      )?.dataset.action;

      if (a === "guide") toggleGuide();
      if (a === "card") toggleSelected();
    });

    document.body.appendChild(d);
  }

  function css() {
    if (
      document.getElementById(
        "fxc-overlay-021"
      )
    ) return;

    const node = document.createElement("style");
    node.id = "fxc-overlay-021";

    node.textContent = `
      .fxc.fxc-overlay-card {
        z-index: 105 !important;
        transform: none !important;
        display: flex;
        flex-direction: column;
        font: 15px/1.5 Arial, sans-serif !important;
        min-width: 0 !important;
        min-height: 0 !important;
      }

      .fxc.fxc-overlay-card .fxc-head {
        flex: 0 0 auto;
        min-height: 44px;
        cursor: move;
        touch-action: none;
      }

      .fxc.fxc-overlay-card .fxc-body {
        flex: 1 1 auto;
        height: auto !important;
        min-height: 0;
        overflow-y: auto !important;
        overflow-x: hidden;
        overscroll-behavior: contain;
        padding: 13px;
      }

      .fxc.fxc-overlay-card .fxc-overview {
        display: grid;
        grid-template-columns:
          minmax(95px, 32%) minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }

      .fxc.fxc-overlay-card .fxc-portrait {
        width: 100%;
        height: auto;
        max-height: 240px;
        object-fit: contain;
        background: #101620;
      }

      .fxc.fxc-overlay-card h3 {
        color: #e7c78b;
        font: 700 14px/1.3 Arial, sans-serif;
        text-transform: uppercase;
        border-bottom: 1px solid #746346;
        margin: 12px 0 7px;
        padding-bottom: 4px;
      }

      .fxc.fxc-overlay-card .fxc-edit {
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: 1.5 !important;
        min-width: 0;
      }

      .fxc.fxc-overlay-card .fxc-entry {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: flex-start;
        padding: 4px 0;
      }

      .fxc.fxc-overlay-card .fxc-gold {
        color: #e7c78b;
      }

      .fxc.fxc-overlay-card
      .fxc-consequence .fxc-edit {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .fxc.fxc-overlay-card details {
        border-top: 1px solid #5b5145;
        padding: 8px 0;
      }

      .fxc.fxc-overlay-card summary {
        cursor: pointer;
        color: #e7c78b;
        font-weight: bold;
        padding: 4px 0;
      }

      .fxc.fxc-overlay-card .fxc-grip {
        z-index: 3;
        width: 24px;
        height: 24px;
      }

      .fxc.fxc-overlay-card .fxc-small {
        font-size: 12px;
        margin-top: 12px;
      }
    `;

    document.head.appendChild(node);
  }

  function init() {
    if (game.system.id !== "fatex") return;

    css();
    dock();
    sync();

    Hooks.on("canvasReady", sync);
    Hooks.on("createToken", sync);
    Hooks.on("deleteToken", sync);
    Hooks.on("updateToken", () => sync());

    Hooks.on(
      "updateActor",
      actor => refreshActor(actor)
    );

    for (const hook of [
      "createItem",
      "updateItem",
      "deleteItem"
    ]) {
      Hooks.on(hook, item => {
        if (item.parent) {
          refreshActor(item.parent);
        }
      });
    }

    window.addEventListener("resize", () => {
      for (const s of cards.values()) {
        position(s);
      }
    });

    console.info(
      "FateX Companion 0.2.1 ready"
    );
  }

  Hooks.once("ready", init);
})();
