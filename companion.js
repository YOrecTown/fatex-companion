
(async () => {
  try {
    const actor = canvas.tokens.controlled[0]?.actor;

    if (!actor) {
      ui.notifications.warn("Выдели токен персонажа");
      return;
    }

    const items = [...actor.items].filter(i =>
      ["aspect", "consequence"].includes(i.type)
    );

    if (!items.length) {
      ui.notifications.warn(
        "Аспекты и последствия не найдены"
      );
      return;
    }

    const esc = v => String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const selector = await foundry.applications.api
      .DialogV2.input({
        window: {
          title: "FateX — выбор поля"
        },
        content: `
          <label>Что редактируем?</label>
          <select name="itemId">
            ${items.map(i => `
              <option value="${esc(i.id)}">
                ${esc(i.type === "aspect"
                  ? "Аспект"
                  : "Последствие")}:
                ${esc(i.name)}
              </option>
            `).join("")}
          </select>
        `,
        ok: { label: "Далее" },
        rejectClose: false
      });

    if (!selector) return;

    const item = actor.items.get(selector.itemId);
    if (!item) throw new Error("Поле не найдено");

    const raw = String(item.system?.value ?? "");
    const div = document.createElement("div");
    div.innerHTML = raw;
    const oldText = div.textContent.trim();

    const result = await foundry.applications.api
      .DialogV2.input({
        window: {
          title: "Изменить: " + item.name
        },
        content: `
          <label>Текст аспекта или последствия</label>
          <textarea name="value"
            style="width:100%;min-height:110px"
          >${esc(oldText)}</textarea>
        `,
        ok: { label: "Сохранить" },
        rejectClose: false
      });

    if (!result) return;

    const value = String(result.value ?? "");
    const newValue = raw.includes("<")
      ? "<p>" + esc(value).replace(/\n/g, "<br>") + "</p>"
      : value;

    await item.update({
      "system.value": newValue
    });

    ui.notifications.info(
      "Изменения сохранены в FateX!"
    );

  } catch (error) {
    console.error("FateX Edit Test:", error);
    alert("Ошибка: " + error.message);
  }
})();
