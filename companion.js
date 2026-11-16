
/*
 FateX Companion 0.2.0
 Foundry VTT 14 / FateX

 Общие плавающие карточки персонажей.
 Адаптивное содержимое, прокрутка,
 двусторонняя синхронизация и справочник.
*/

(() => {
  "use strict";

  const NS = "fatex-companion";
  const FLAG = "card";
  const MIN_W = 310;
  const MIN_H = 240;

  const cards = new Map();

  let guide = null;
  let guideTab = "actions";
  let actionChoice = 0;
  let outcomeChoice = 2;
  let advantageChoice = "new";

  let guideDraft = {
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

  const allItems = (a, t) =>
    [...(a?.items ?? [])].filter(i =>
      i.type === t &&
      i.system?.disabled !== true
    );

  const canEdit = a =>
    !!a && (game.user.isGM || a.isOwner);

  const tell = e => {
    console.error("FateX Companion:", e);
    ui.notifications.error(
      "FateX Companion: " + (e?.message || e)
    );
  };

  const clamp = (n, lo, hi) =>
    Math.max(lo, Math.min(hi, n));

  const keyOf = t =>
    `${canvas.scene.id}:${t.document.id}`;

  const cfgOf = t =>
    t.document.getFlag(NS, FLAG);

  const tokenByKey = k =>
    canvas?.ready
      ? canvas.tokens.placeables.find(
          t => keyOf(t) === k
        )
      : null;

  const screen = () => ({
    w: innerWidth,
    h: innerHeight
  });

  // Преобразование старых координат карты
  // в новые координаты экрана.
  function normal(cfg) {
    const s = screen();

    if (cfg?.layout === "overlay-v2") {
      return {
        layout: "overlay-v2",
        x: clamp(Number(cfg.x) || 0, 0, 1),
        y: clamp(Number(cfg.y) || 0, 0, 1),
        w: Math.max(
          MIN_W, Number(cfg.w) || 440
        ),
        h: Math.max(
          MIN_H, Number(cfg.h) || 560
        )
      };
    }

    const stage = canvas?.stage?.worldTransform;
    const view =
      canvas.app?.canvas ??
      canvas.app?.view ??
      document.querySelector("#board");

    const rect = view?.getBoundingClientRect();

    const rw =
      canvas.app?.renderer?.screen?.width ||
      rect?.width || s.w;

    const rh =
      canvas.app?.renderer?.screen?.height ||
      rect?.height || s.h;

    const sx = (rect?.width || s.w) / rw;
    const sy = (rect?.height || s.h) / rh;

    const px = stage
      ? (rect?.left || 0) +
        (
          stage.a * (Number(cfg?.x) || 0) +
          stage.c * (Number(cfg?.y) || 0) +
          stage.tx
        ) * sx
      : s.w * 0.17;

    const py = stage
      ? (rect?.top || 0) +
        (
          stage.b * (Number(cfg?.x) || 0) +
          stage.d * (Number(cfg?.y) || 0) +
          stage.ty
        ) * sy
      : s.h * 0.15;

    return {
      layout: "overlay-v2",
      x: clamp(px / s.w, 0, 0.9),
      y: clamp(py / s.h, 0, 0.85),
      w: 440,
      h: 560
    };
  }

  // Положение в окне браузера,
  // а не в координатах игрового поля.
  function sizing(cfg) {
    const s = screen();

    const w = Math.min(
      Math.max(MIN_W, cfg.w),
      Math.max(MIN_W, s.w - 12)
    );

    const h = Math.min(
      Math.max(MIN_H, cfg.h),
      Math.max(MIN_H, s.h - 12)
    );

    return {
      left: clamp(
        cfg.x * s.w,
        0,
        Math.max(0, s.w - 95)
      ),
      top: clamp(
        cfg.y * s.h,
        0,
        Math.max(0, s.h - 48)
      ),
      width: w,
      height: h
    };
  }

  function position(state) {
    const p = sizing(
      state.preview ?? state.cfg
    );

    Object.assign(state.el.style, {
      left: p.left + "px",
      top: p.top + "px",
      width: p.width + "px",
      height: p.height + "px"
    });
  }

  const fieldValue = i =>
    plain(i.system?.value) || "";

  function rowItem(i, icon) {
    return `
      <div class="fxc-entry">
        <span class="fxc-gold">${icon}</span>
        <div class="fxc-edit fxc-grow"
             data-action="edit"
             data-id="${esc(i.id)}"
             title="Нажмите, чтобы изменить">
          ${esc(fieldValue(i) || i.name)}
        </div>
      </div>
    `;
  }

  function genericItem(i) {
    const name = String(i.name || "");
    const value = fieldValue(i);

    return `
      <div class="fxc-entry">
        <b class="fxc-gold">${esc(name)}</b>
        <div class="fxc-grow">
          ${esc(
            value && value !== name ? value : ""
          )}
        </div>
      </div>
    `;
  }

  // Основное содержимое карточки.
  function renderCard(state, token) {
    const a = token.actor;
    if (!a) return;

    const body = state.el.querySelector(
      ".fxc-body"
    );

    const scroll = body?.scrollTop ?? 0;

    const aspects = allItems(a, "aspect");
    const cons = allItems(a, "consequence");
    const stress = allItems(a, "stress");
    const skills = allItems(a, "skill");
    const stunts = allItems(a, "stunt");
    const extras = allItems(a, "extra");

    const current = Number(
      a.system?.fatepoints?.current
    ) || 0;

    const refresh =
      a.system?.fatepoints?.refresh ?? "—";

    const consHTML = cons.map((i, index) => `
      <div class="fxc-consequence">
        <button data-action="active"
                data-id="${esc(i.id)}"
                title="Активность последствия">
          ${i.system?.active ? "☑" : "☐"}
        </button>

        <div class="fxc-grow fxc-edit"
             data-action="edit"
             data-id="${esc(i.id)}"
             title="Вписать последствие">

          <strong class="fxc-gold">
            ${esc(
              plain(i.system?.label) ||
              ["Лёгкое", "Среднее", "Тяжёлое"][index] ||
              i.name
            )}
          </strong>

          <span>
            ${esc(
              fieldValue(i) || "Не заполнено"
            )}
          </span>
        </div>
      </div>
    `).join("") || `
      <p class="fxc-muted">
        Последствий нет.
      </p>
    `;

    const stressHTML = stress.map(i => {
      const n = Number(i.system?.size);
      const value = Number(i.system?.value);

      if (
        !Number.isInteger(n) ||
        n < 1 || n > 30 ||
        !Number.isInteger(value) ||
        value < 0
      ) {
        return `
          <div class="fxc-entry">
            ${esc(i.name)}
            <button data-action="sheet">
              Открыть лист
            </button>
          </div>
        `;
      }

      const boxes = Array.from(
        { length: n },
        (_, index) => `
          <button
            data-action="stress"
            data-id="${esc(i.id)}"
            data-index="${index}"
            class="${
              value & (1 << index)
                ? "fxc-used" : ""
            }">
            ${index + 1}
          </button>
        `
      ).join("");

      return `
        <div class="fxc-entry">
          <b>${esc(i.name)}</b>
        </div>
        <div class="fxc-row">
          ${boxes}
        </div>
      `;
    }).join("") || `
      <p class="fxc-muted">
        Шкал стресса в листе нет.
      </p>
    `;

    state.el.innerHTML = `
      <header class="fxc-head"
              data-drag="1">
        <strong>${esc(a.name)}</strong>

        <button data-action="sheet"
                title="Открыть лист">
          Лист
        </button>

        ${
          game.user.isGM
            ? `<button data-action="remove"
                       title="Убрать для всех">×</button>`
            : ""
        }
      </header>

      <main class="fxc-body">
        <div class="fxc-overview">

          <img class="fxc-portrait"
               src="${esc(
                 a.img ||
                 "icons/svg/mystery-man.svg"
               )}"
               alt="Портрет">

          <div class="fxc-grow">
            <h3>Аспекты</h3>

            ${
              aspects.map(
                i => rowItem(i, "✦")
              ).join("") ||
              `<p class="fxc-muted">
                Нет аспектов.
              </p>`
            }
          </div>
        </div>

        <h3>Очки судьбы</h3>

        <div class="fxc-row">
          <button data-action="fate"
                  data-step="-1">−</button>

          <b>${current}</b>

          <button data-action="fate"
                  data-step="1">+</button>

          <span class="fxc-muted">
            Обновление: ${esc(refresh)}
          </span>
        </div>

        <h3>Стресс</h3>
        ${stressHTML}

        <h3>Последствия</h3>
        ${consHTML}

        ${
          skills.length
            ? `
              <details class="fxc-details">
                <summary>
                  Навыки и подходы
                  (${skills.length})
                </summary>
                ${skills.map(genericItem).join("")}
              </details>
            `
            : ""
        }

        ${
          stunts.length
            ? `
              <details class="fxc-details">
                <summary>
                  Трюки (${stunts.length})
                </summary>
                ${stunts.map(genericItem).join("")}
              </details>
            `
            : ""
        }

        ${
          extras.length
            ? `
              <details class="fxc-details">
                <summary>
                  Дополнения (${extras.length})
                </summary>
                ${extras.map(genericItem).join("")}
              </details>
            `
            : ""
        }

        <p class="fxc-muted fxc-hint">
          Нажмите на аспект или текст
          последствия для редактирования.
          Остальные поля можно изменить
          через кнопку «Лист».
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

    const nextBody = state.el.querySelector(
      ".fxc-body"
    );

    nextBody.scrollTop = scroll;

    for (const detail of nextBody.querySelectorAll(
      "details"
    )) {
      const name = detail.querySelector(
        "summary"
      )?.textContent.split(" (")[0].trim();

      detail.open = state.openSections.has(name);
    }
  }

  async function textEdit(item) {
    const old = plain(item.system?.value);

    const value = prompt(
      `Текст: ${item.name}`,
      old
    );

    if (value === null || value === old) return;

    const raw = String(item.system?.value ?? "");

    const next = /<\/?[a-z][^>]*>/i.test(raw)
      ? `<p>${
          esc(value).replace(/\n/g, "<br>")
        }</p>`
      : value;

    await item.update({
      "system.value": next
    });
  }

  // Создание общей плавающей карточки.
  function addCard(token) {
    const key = keyOf(token);
    const cfg = normal(cfgOf(token));

    const el = document.createElement("section");
    el.className =
      "fxc fxc-scene fxc-overlay-card";

    const state = {
      el,
      cfg,
      preview: null,
      openSections: new Set()
    };

    cards.set(key, state);
    document.body.appendChild(el);

    position(state);
    renderCard(state, token);

    let drag = null;

    el.addEventListener("toggle", e => {
      if (e.target.tagName !== "DETAILS") return;

      const name = e.target.querySelector(
        "summary"
      )?.textContent.split(" (")[0].trim();

      if (e.target.open) {
        state.openSections.add(name);
      } else {
        state.openSections.delete(name);
      }
    }, true);

    // Перетаскивание и изменение размера.
    el.addEventListener("pointerdown", e => {
      if (!game.user.isGM) return;
      if (e.target.closest("button")) return;

      const mode = e.target.closest(
        "[data-resize]"
      )
        ? "resize"
        : e.target.closest("[data-drag]")
          ? "move"
          : null;

      if (!mode || e.button !== 0) return;

      drag = {
        mode,
        id: e.pointerId,
        cfg: { ...state.cfg },
        sx: e.clientX,
        sy: e.clientY
      };

      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    el.addEventListener("pointermove", e => {
      if (!drag || drag.id !== e.pointerId) return;

      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      const s = screen();

      if (drag.mode === "move") {
        state.preview = {
          ...drag.cfg,

          x: clamp(
            drag.cfg.x + dx / s.w,
            0,
            Math.max(0, 1 - 95 / s.w)
          ),

          y: clamp(
            drag.cfg.y + dy / s.h,
            0,
            Math.max(0, 1 - 48 / s.h)
          )
        };
      } else {
        state.preview = {
          ...drag.cfg,

          w: clamp(
            drag.cfg.w + dx,
            MIN_W,
            Math.max(MIN_W, s.w - 12)
          ),

          h: clamp(
            drag.cfg.h + dy,
            MIN_H,
            Math.max(MIN_H, s.h - 12)
          )
        };
      }

      position(state);
    });

    async function finish(e, save) {
      if (!drag || drag.id !== e.pointerId) return;

      const next = state.preview;
      drag = null;

      if (save && next) {
        try {
          await token.document.setFlag(
            NS, FLAG, next
          );

          state.cfg = next;
        } catch (err) {
          tell(err);
        }
      }

      state.preview = null;
      position(state);
    }

    el.addEventListener(
      "pointerup",
      e => finish(e, true)
    );

    el.addEventListener(
      "pointercancel",
      e => finish(e, false)
    );

    // Редактирование листа с карточки.
    el.addEventListener("click", async e => {
      const node = e.target.closest(
        "[data-action]"
      );

      if (!node) return;

      const action = node.dataset.action;
      const actor = token.actor;

      if (action === "sheet") {
        actor.sheet.render(true);
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
          tell(err);
        }
        return;
      }

      if (!canEdit(actor)) {
        ui.notifications.warn(
          "Нет права изменять этого персонажа"
        );
        return;
      }

      const item = actor.items.get(
        node.dataset.id
      );

      try {
        if (action === "edit" && item) {
          await textEdit(item);
        }

        else if (action === "active" && item) {
          await item.update({
            "system.active": !item.system.active
          });
        }

        else if (action === "fate") {
          const current = Number(
            actor.system.fatepoints?.current
          ) || 0;

          await actor.update({
            "system.fatepoints.current": Math.max(
              0,
              current + Number(node.dataset.step)
            )
          });
        }

        else if (action === "stress" && item) {
          const i = Number(node.dataset.index);
          const n = Number(item.system?.size);
          const v = Number(item.system?.value);

          if (
            Number.isInteger(i) &&
            Number.isInteger(n) &&
            Number.isInteger(v) &&
            i >= 0 &&
            i < n &&
            i < 30 &&
            v >= 0
          ) {
            await item.update({
              "system.value": v ^ (1 << i)
            });
          }
        }
      } catch (err) {
        tell(err);
      }
    });
  }

  // Синхронизация карточек на сцене.
  function sync() {
    const visible = new Set();

    if (canvas?.ready) {
      for (const t of canvas.tokens.placeables) {
        if (!t.actor || !cfgOf(t)) continue;

        const k = keyOf(t);
        visible.add(k);

        if (!cards.has(k)) {
          addCard(t);
        } else {
          const state = cards.get(k);

          if (!state.preview) {
            state.cfg = normal(cfgOf(t));
            position(state);
          }
        }
      }
    }

    for (const [k, state] of cards) {
      if (visible.has(k)) continue;

      state.el.remove();
      cards.delete(k);
    }
  }

  function refreshActor(actor) {
    for (const [k, state] of cards) {
      const t = tokenByKey(k);

      if (
        t?.actor &&
        (!actor || t.actor.id === actor.id)
      ) {
        renderCard(state, t);
      }
    }
  }

  async function toggleSelected() {
    if (!game.user.isGM) return;

    const token = canvas.tokens.controlled[0];

    if (!token?.actor) {
      ui.notifications.warn(
        "Выделите токен персонажа"
      );
      return;
    }

    try {
      if (cfgOf(token)) {
        await token.document.unsetFlag(
          NS, FLAG
        );

        sync();
      } else {
        const offset = cards.size * 25;

        await token.document.setFlag(
          NS, FLAG, {
            layout: "overlay-v2",

            x: clamp(
              0.17 + offset / innerWidth,
              0, 0.75
            ),

            y: clamp(
              0.12 + offset / innerHeight,
              0, 0.7
            ),

            w: 450,
            h: 560
          }
        );

        sync();
      }
    } catch (e) {
      tell(e);
    }
  }

  // Справочник Fate Accelerated.
  const actions = [
    {
      name: "Преодоление",
      desc: "Преодолеть препятствие или добиться цели.",
      out: [
        "Неудача или успех серьёзной ценой.",
        "Успех небольшой ценой.",
        "Цель достигнута.",
        "Успех и усиление."
      ]
    },
    {
      name: "Создание преимущества",
      desc: "Создать аспект, найти скрытый или использовать известный.",
      out: [
        "Не создано или не раскрыто; либо бесплатный призыв получает противник.",
        "При создании нового — усиление; при раскрытии скрытого — один бесплатный призыв.",
        "Аспект создан или обнаружен, один бесплатный призыв.",
        "Аспект создан или обнаружен, два бесплатных призыва."
      ],
      known: [
        "Нет нового бесплатного призыва.",
        "Один бесплатный призыв.",
        "Один бесплатный призыв.",
        "Два бесплатных призыва."
      ]
    },
    {
      name: "Атака",
      desc: "Причинить вред — физический или ментальный.",
      out: [
        "Атака не причиняет вреда.",
        "Нет вреда; атакующий получает усиление.",
        "Попадание; сдвиги определяют вред.",
        "Попадание; можно уменьшить вред на один сдвиг и получить усиление."
      ]
    },
    {
      name: "Защита",
      desc: "Активно помешать другому действию.",
      out: [
        "Противник получает результат своего успешного действия.",
        "Смотрите результат соответствующего действия противника при ничьей.",
        "Противник не добивается своего.",
        "Противник не добивается своего, защитник получает усиление."
      ]
    }
  ];

  const outcomes = [
    "Провал",
    "Ничья",
    "Успех (+1 или +2)",
    "Успех со стилем (+3 и больше)"
  ];

  const tabs = {
    actions: "Действия",
    aspects: "Аспекты",
    harm: "Стресс",
    stunts: "Трюки",
    gm: "Мастеру"
  };

  const panel = v =>
    `<div class="fxc-panel">${v}</div>`;

  function select(id, values, selected) {
    return `
      <select data-field="${id}">
        ${values.map((v, i) => `
          <option value="${i}"
                  ${selected === i ? "selected" : ""}>
            ${esc(v)}
          </option>
        `).join("")}
      </select>
    `;
  }

  function guideBody() {
    if (guideTab === "actions") {
      const a = actions[actionChoice];

      const result =
        actionChoice === 1 &&
        advantageChoice === "known"
          ? a.known[outcomeChoice]
          : a.out[outcomeChoice];

      return `
        <label>Действие</label>
        ${select(
          "action",
          actions.map(x => x.name),
          actionChoice
        )}

        <p>${esc(a.desc)}</p>

        ${
          actionChoice === 1
            ? `
              <label>Работа с аспектом</label>

              <select data-field="adv">
                <option value="new"
                  ${
                    advantageChoice === "new"
                      ? "selected" : ""
                  }>
                  Новый или скрытый
                </option>

                <option value="known"
                  ${
                    advantageChoice === "known"
                      ? "selected" : ""
                  }>
                  Уже известный
                </option>
              </select>
            `
            : ""
        }

        <label>Результат</label>
        ${select(
          "outcome", outcomes, outcomeChoice
        )}

        ${panel(esc(result))}
      `;
    }

    if (guideTab === "aspects") {
      return [
        "Призыв: потратить очко судьбы или бесплатный призыв, чтобы получить +2 либо перебросить кубики. Объясните связь аспекта с действием.",
        "Навязывание: аспект осложняет жизнь героя. Приняв осложнение, игрок получает очко судьбы; отказ обычно стоит очко.",
        "Усиление: временный аспект с одним бесплатным призывом.",
        "Создание преимущества помогает подготовить выгодную ситуацию до решающего действия."
      ].map(panel).join("");
    }

    if (guideTab === "harm") {
      return [
        "Вред измеряется сдвигами. Стресс и последствия позволяют поглотить попадание.",
        "Стандартные последствия Fate Accelerated: лёгкое — 2, среднее — 4, тяжёлое — 6 сдвигов. Конкретные настройки листа FateX могут отличаться.",
        "Сдаться можно до броска, который выведет героя из конфликта. Обговорите последствия с мастером.",
        "Стресс обычно очищается после конфликта; последствия лечатся со временем."
      ].map(panel).join("");
    }

    if (guideTab === "stunts") {
      return `
        <p>
          Черновик трюка (+2 при конкретном
          подходе, действии и условии).
          Согласуйте с мастером.
        </p>

        <label>Особенность героя</label>
        <input data-stunt="why"
               value="${esc(guideDraft.why)}">

        <label>Подход</label>
        <select data-stunt="approach">
          ${
            [
              "Аккуратно", "Умно", "Эффектно",
              "Сильно", "Быстро", "Хитро"
            ].map(x => `
              <option ${
                guideDraft.approach === x
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
                guideDraft.action === x
                  ? "selected" : ""
              }>${x}</option>
            `).join("")
          }
        </select>

        <label>Условие</label>
        <input data-stunt="when"
               value="${esc(guideDraft.when)}">

        <div class="fxc-panel"
             data-stunt-preview></div>

        <button data-action="copy-stunt">
          Копировать трюк
        </button>

        <p class="fxc-muted">
          Есть и другой тип трюка:
          особая возможность раз за сессию.
        </p>
      `;
    }

    if (guideTab === "gm") {
      return [
        "Бросок нужен, когда исход неясен и его цена интересна.",
        "Испытание — несколько задач; состязание — борьба за цель без нанесения вреда; конфликт — противостояние, в котором есть атаки и последствия.",
        "Цена успеха: время, ресурс, опасная позиция, новое осложнение или раскрытый секрет.",
        "Навязывайте аспекты там, где они делают историю интереснее; предлагайте очко судьбы.",
        "Противнику достаточно запоминающегося аспекта, мотивации и нескольких осмысленных действий."
      ].map(panel).join("");
    }

    return "";
  }

  function stuntText() {
    const d = guideDraft;

    return `Поскольку ${d.why}, получаю +2, когда действую ${d.approach.toLowerCase()}, ${d.action} и ${d.when}.`;
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
            .map(([id, name]) => `
              <button data-tab="${id}"
                      aria-pressed="${
                        guideTab === id
                      }">
                ${name}
              </button>
            `).join("")
        }
      </nav>

      ${guideBody()}

      <p class="fxc-hint">
        Правила Fate Accelerated.
        Условия вашей группы имеют приоритет.
      </p>
    `;

    const p = guide.querySelector(
      "[data-stunt-preview]"
    );

    if (p) p.textContent = stuntText();
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

        <button data-action="close-guide">
          ×
        </button>
      </div>

      <div class="fxc-body"></div>
    `;

    document.body.appendChild(guide);

    guide.addEventListener("click", async e => {
      if (
        e.target.closest(
          '[data-action="close-guide"]'
        )
      ) {
        toggleGuide();
        return;
      }

      const t = e.target.closest("[data-tab]");

      if (t) {
        guideTab = t.dataset.tab;
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
          prompt(
            "Скопируйте трюк",
            stuntText()
          );
        }
      }
    });

    guide.addEventListener("change", e => {
      const field = e.target.dataset.field;

      if (field === "action") {
        actionChoice = Number(e.target.value);
      }

      if (field === "outcome") {
        outcomeChoice = Number(e.target.value);
      }

      if (field === "adv") {
        advantageChoice = e.target.value;
      }

      if (field) renderGuide();
    });

    guide.addEventListener("input", e => {
      const type = e.target.dataset.stunt;
      if (!type) return;

      guideDraft[type] = e.target.value;

      const p = guide.querySelector(
        "[data-stunt-preview]"
      );

      if (p) p.textContent = stuntText();
    });

    renderGuide();
  }

  // Кнопки управления модулем.
  function dock() {
    if (document.getElementById("fxc-dock")) {
      return;
    }

    const node = document.createElement("div");
    node.id = "fxc-dock";

    node.innerHTML = `
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

    node.addEventListener("click", e => {
      const action = e.target.closest(
        "[data-action]"
      )?.dataset.action;

      if (action === "guide") {
        toggleGuide();
      }

      if (action === "card") {
        toggleSelected();
      }
    });

    document.body.appendChild(node);
  }

  // Исправленный интерфейс без
  // масштабирования текста через CSS transform.
  function injectStyles() {
    if (
      document.getElementById(
        "fxc-overlay-style"
      )
    ) return;

    const style = document.createElement("style");
    style.id = "fxc-overlay-style";

    style.textContent = `
      .fxc.fxc-overlay-card {
        z-index: 105 !important;
        transform: none !important;
        font: 15px/1.5 Arial, sans-serif !important;
        display: flex;
        flex-direction: column;
        min-width: 0 !important;
        min-height: 0 !important;
      }

      .fxc.fxc-overlay-card .fxc-head {
        flex: 0 0 auto;
        min-height: 44px;
        cursor: move;
      }

      .fxc.fxc-overlay-card .fxc-body {
        height: auto !important;
        min-height: 0;
        flex: 1 1 auto;
        overflow-y: auto !important;
        overflow-x: hidden;
        overscroll-behavior: contain;
        padding: 13px;
      }

      .fxc.fxc-overlay-card .fxc-overview {
        display: grid;
        grid-template-columns:
          minmax(105px, 32%) minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }

      .fxc.fxc-overlay-card .fxc-portrait {
        width: 100%;
        height: auto;
        max-height: 240px;
        object-fit: contain;
        background: #0c1019;
      }

      .fxc.fxc-overlay-card h3 {
        font: 700 14px/1.3 Arial, sans-serif;
        color: #e7c78b;
        margin: 12px 0 7px;
        padding-bottom: 4px;
        border-bottom: 1px solid #746346;
        text-transform: uppercase;
      }

      .fxc.fxc-overlay-card .fxc-entry {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: flex-start;
        padding: 4px 0;
        overflow-wrap: anywhere;
      }

      .fxc.fxc-overlay-card .fxc-consequence {
        align-items: center;
        gap: 9px;
      }

      .fxc.fxc-overlay-card
      .fxc-consequence .fxc-edit {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .fxc.fxc-overlay-card .fxc-edit {
        line-height: 1.5 !important;
        min-width: 0;
        white-space: normal;
      }

      .fxc.fxc-overlay-card .fxc-row {
        margin: 5px 0 9px;
      }

      .fxc.fxc-overlay-card .fxc-details {
        border-top: 1px solid #5b5145;
        padding: 7px 0;
      }

      .fxc.fxc-overlay-card summary {
        cursor: pointer;
        color: #e7c78b;
        font-weight: 700;
        padding: 4px 0;
      }

      .fxc.fxc-overlay-card .fxc-gold {
        color: #e7c78b;
      }

      .fxc.fxc-overlay-card .fxc-hint {
        font-size: 12px;
        margin-top: 12px;
      }

      .fxc.fxc-overlay-card .fxc-grip {
        z-index: 2;
        width: 23px;
        height: 23px;
      }

      @media (max-width: 650px) {
        .fxc.fxc-overlay-card .fxc-overview {
          grid-template-columns: 1fr;
        }

        .fxc.fxc-overlay-card .fxc-portrait {
          max-width: 145px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // Запуск модуля.
  function init() {
    if (game.system.id !== "fatex") return;

    injectStyles();
    dock();
    sync();

    Hooks.on("canvasReady", sync);
    Hooks.on("createToken", sync);
    Hooks.on("deleteToken", sync);

    Hooks.on("updateToken", doc => {
      sync();

      const t = canvas?.tokens?.placeables.find(
        x => x.document.id === doc.id
      );

      if (t && cards.has(keyOf(t))) {
        renderCard(cards.get(keyOf(t)), t);
      }
    });

    Hooks.on(
      "updateActor",
      a => refreshActor(a)
    );

    for (const name of [
      "createItem",
      "updateItem",
      "deleteItem"
    ]) {
      Hooks.on(name, i => {
        if (i.parent?.id) {
          refreshActor(i.parent);
        }
      });
    }

    window.addEventListener("resize", () => {
      for (const state of cards.values()) {
        position(state);
      }
    });

    console.info(
      "FateX Companion 0.2.0 overlay ready"
    );
  }

  Hooks.once("ready", init);
})();
