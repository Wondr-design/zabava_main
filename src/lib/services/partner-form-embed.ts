import {
  PartnerFormConfig,
  PartnerFormField,
  PartnerFormRecord,
  DEFAULT_QR_EXPIRY_SECONDS,
  MAX_QR_EXPIRY_SECONDS,
} from "../data/partner-forms";

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MIN_QR_EXPIRY_SECONDS = 60;

function clampQrExpiry(seconds?: unknown) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_QR_EXPIRY_SECONDS;
  }
  const normalized = Math.floor(numeric);
  if (normalized < MIN_QR_EXPIRY_SECONDS) return MIN_QR_EXPIRY_SECONDS;
  if (normalized > MAX_QR_EXPIRY_SECONDS) return MAX_QR_EXPIRY_SECONDS;
  return normalized;
}

function formatExpiryDescription(seconds: number) {
  const hours = seconds / 3600;
  if (hours >= 48 && Number.isInteger(hours / 24)) {
    const days = Math.round(hours / 24);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (hours >= 1) {
    if (Number.isInteger(hours)) {
      return hours === 1 ? "1 hour" : `${hours} hours`;
    }
    const rounded = Math.round(hours * 10) / 10;
    return `${rounded} hours`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

function buildExpiryMessage(seconds: number) {
  const description = formatExpiryDescription(seconds);
  return `QR codes stay active for ${description}. After they expire you'll need to request a new one.`;
}

function computeHiddenFieldEntries(config: PartnerFormConfig) {
  const expirySeconds = clampQrExpiry(config.qrExpiresInSeconds);
  const hiddenFields = [...(config.hiddenFields ?? [])];
  let hasExpiryField = false;

  for (let index = 0; index < hiddenFields.length; index += 1) {
    const field = hiddenFields[index];
    if (field.name === "qrExpiresInSeconds") {
      hasExpiryField = true;
      hiddenFields[index] = {
        ...field,
        value: String(expirySeconds),
      };
      break;
    }
  }

  if (!hasExpiryField) {
    hiddenFields.push({
      name: "qrExpiresInSeconds",
      value: String(expirySeconds),
    });
  }

  return hiddenFields.map((field) => ({
    name: field.name,
    value: String(field.value ?? ""),
  }));
}

function renderHiddenFields(
  entries: Array<{ name: string; value: string }>,
  makeId: (suffix: string) => string
) {
  return entries
    .map((field) => {
      const safeId = makeId(
        `hidden-${field.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`
      );
      return `<input type="hidden" id="${escapeHtml(
        safeId
      )}" name="${escapeHtml(field.name)}" value="${escapeHtml(
        String(field.value)
      )}">`;
    })
    .join("\n");
}

function renderField(
  stepId: string,
  field: PartnerFormField,
  options: {
    prefix: string;
    config: PartnerFormConfig;
    makeId: (suffix: string) => string;
    ids: Record<string, string>;
    peopleFieldId?: string | null;
  }
) {
  const fieldLabel = escapeHtml(field.label);
  const summaryLabel = escapeHtml(field.label);
  const fieldDomId = options.makeId(field.id);
  const helper = field.helperText
    ? `<p class="small">${escapeHtml(field.helperText)}</p>`
    : "";
  const requiredAttr = field.required ? " required" : "";
  const placeholder = field.placeholder
    ? ` placeholder="${escapeHtml(field.placeholder)}"`
    : "";
  const dataset = ` data-field-id="${escapeHtml(
    field.id
  )}" data-kind="${escapeHtml(
    field.kind ?? "input"
  )}" data-summary-label="${summaryLabel}"`;
  const inputName = escapeHtml(field.name);
  const defaultValue =
    field.defaultValue !== undefined ? String(field.defaultValue) : "";
  const currency = options.config.pricing?.currency ?? "CZK";

  switch (field.kind) {
    case "radio": {
      const optionsHtml = (field.options ?? [])
        .map((option, index) => {
          const optionId = options.makeId(
            `${field.id}-${option.id ?? index}`
          );
          const checked =
            field.defaultValue !== undefined
              ? String(option.value) === String(field.defaultValue)
              : index === 0;
          const priceBadge =
            option.price !== undefined
              ? `<span class="small" style="opacity:0.8">${escapeHtml(
                  option.price.toLocaleString()
                )} ${escapeHtml(currency)}</span>`
              : "";
          return `<label class="radio"><input type="radio" id="${escapeHtml(
            optionId
          )}" name="${inputName}" value="${escapeHtml(option.value)}"${
            checked ? " checked" : ""
          }${requiredAttr}> <span>${escapeHtml(
            option.label
          )}</span>${priceBadge}</label>`;
        })
        .join("\n");
      return `<div class="field"${dataset}>
  <label>${fieldLabel}</label>
  <div class="radios">${optionsHtml}</div>
  ${helper}
</div>`;
    }
    case "select": {
      const optionsHtml = (field.options ?? [])
        .map(
          (option, index) =>
            `<option value="${escapeHtml(option.value)}"${
              field.defaultValue !== undefined &&
              String(option.value) === String(field.defaultValue)
                ? " selected"
                : index === 0 && field.defaultValue === undefined
                ? " selected"
                : ""
            }>${escapeHtml(option.label)}</option>`
        )
        .join("\n");
      return `<div class="field"${dataset}>
  <label for="${escapeHtml(fieldDomId)}">${fieldLabel}</label>
  <select name="${inputName}" id="${escapeHtml(fieldDomId)}"${requiredAttr}>
    ${optionsHtml}
  </select>
  ${helper}
</div>`;
    }
    case "textarea": {
      return `<div class="field"${dataset}>
  <label for="${escapeHtml(fieldDomId)}">${fieldLabel}</label>
  <textarea id="${escapeHtml(
    fieldDomId
  )}" name="${inputName}"${placeholder}${requiredAttr}>${escapeHtml(
        defaultValue
      )}</textarea>
  ${helper}
</div>`;
    }
    case "checkbox": {
      const checked =
        field.defaultValue !== undefined ? Boolean(field.defaultValue) : false;
      return `<div class="field"${dataset}>
  <label class="inline-checkbox" for="${escapeHtml(fieldDomId)}">
    <input id="${escapeHtml(fieldDomId)}" type="checkbox" name="${inputName}" value="yes"${
        checked ? " checked" : ""
      }${requiredAttr}>
    <span>${fieldLabel}</span>
  </label>
  ${helper}
</div>`;
    }
    case "counter": {
      const min = field.min ?? 1;
      const maxAttr = field.max ? ` max="${field.max}"` : "";
      const stepSize = field.step ?? 1;
      const value =
        field.defaultValue !== undefined
          ? Number(field.defaultValue) || min
          : min;
      const note =
        field.note ??
        `Adjust the number of people. Minimum ${min}${
          field.max ? `, maximum ${field.max}` : ""
        }.`;
      const isPrimaryCounter =
        field.id === options.peopleFieldId ||
        field.name === options.peopleFieldId;
      let countId = options.makeId(`${field.id}-count`);
      let inputId = options.makeId(`${field.id}-input`);
      let priceId = options.makeId(`${field.id}-price`);
      if (isPrimaryCounter) {
        countId = options.ids.count ?? countId;
        inputId = options.ids.peopleInput ?? inputId;
        priceId = options.ids.pricePreview ?? priceId;
      }
      return `<div class="field"${dataset}>
  <label>${fieldLabel}</label>
  <div class="people-ctr">
    <button type="button" class="ctr-btn" data-counter="${escapeHtml(
      field.id
    )}" data-action="decrement" aria-label="Decrease">−</button>
    <div class="count-box" id="${escapeHtml(countId)}" data-counter-display="${escapeHtml(
      field.id
    )}">${escapeHtml(String(value))}</div>
    <button type="button" class="ctr-btn" data-counter="${escapeHtml(
      field.id
    )}" data-action="increment" aria-label="Increase">+</button>
  </div>
  <input type="number" id="${escapeHtml(inputId)}" name="${inputName}" value="${escapeHtml(
        String(value)
      )}" min="${min}"${maxAttr} step="${stepSize}" class="hidden" data-counter-input="${escapeHtml(
        field.id
      )}">
  <div class="price-box small" id="${escapeHtml(priceId)}"${
        isPrimaryCounter ? ' data-role="price-preview"' : ""
      }>Total: —</div>
  <p class="small">${escapeHtml(note)}</p>
</div>`;
    }
    case "transport": {
      const transport = options.config.transport;
      const yesOption =
        (field.options ?? []).find(
          (opt) => opt.value === (transport?.yesValue ?? "Yes")
        ) ?? field.options?.[0];
      const noOption =
        (field.options ?? []).find(
          (opt) => opt.value === (transport?.noValue ?? "No")
        ) ??
        (field.options ?? [])[1] ??
        null;
      const radioOptions = [yesOption, noOption].filter(Boolean);
      const radiosHtml = radioOptions
        .map((option, index) => {
          if (!option) return "";
          const checked =
            field.defaultValue !== undefined
              ? String(option.value) === String(field.defaultValue)
              : index === 0;
          return `<label class="radio"><input type="radio" name="${inputName}" value="${escapeHtml(
            option.value
          )}"${checked ? " checked" : ""}> ${escapeHtml(option.label)}</label>`;
        })
        .join("\n");
      const partners = transport?.partners ?? [];
      const busList = partners
        .map((partner) => {
          const image = partner.imageUrl
            ? `<img src="${escapeHtml(partner.imageUrl)}" alt="${escapeHtml(
                partner.label
              )}" class="bus-image">`
            : "";
          const description = partner.description
            ? `<span class="small">${escapeHtml(partner.description)}</span>`
            : "";
          return `<label class="radio-inline" data-role="bus-option">
      <input type="radio" name="${escapeHtml(
        transport?.busFieldId ?? "transportBus"
      )}" value="${escapeHtml(partner.value)}">
      <span>
        ${image}
        <span>${escapeHtml(partner.label)}</span>
        ${description}
      </span>
    </label>`;
        })
        .join("\n");
      const help =
        field.note ??
        "If you choose “Yes”, pick a bus partner so we can coordinate transportation.";

      return `<div class="field"${dataset}>
  <label>${fieldLabel}</label>
  <div class="radios">
    ${radiosHtml}
  </div>
  <p class="small">${escapeHtml(help)}</p>
  <div class="field hidden" id="${escapeHtml(
    options.ids.busList ?? options.makeId("bus-list")
  )}" data-role="bus-list" data-bus-field-name="${escapeHtml(
    transport?.busFieldId ?? "transportBus"
  )}">
    <label>Select bus partner</label>
    <div class="bus-list">
      ${busList || `<p class="small">No bus partners configured.</p>`}
    </div>
  </div>
  ${helper}
</div>`;
    }
    default: {
      const inputType = field.type ?? "text";
      return `<div class="field"${dataset}>
  <label for="${escapeHtml(fieldDomId)}">${fieldLabel}</label>
  <input type="${escapeHtml(inputType)}" id="${escapeHtml(
        fieldDomId
      )}" name="${inputName}" value="${escapeHtml(
        defaultValue
      )}"${placeholder}${requiredAttr}>
  ${helper}
</div>`;
    }
  }
}

function renderStepPanels(
  config: PartnerFormConfig,
  prefix: string,
  makeId: (suffix: string) => string,
  ids: Record<string, string>,
  peopleFieldId?: string | null
) {
  const totalSteps = config.steps.length;
  return config.steps
    .map((step, index) => {
      const fields = step.fields
        .map((field) =>
          renderField(step.id, field, {
            prefix,
            config,
            makeId,
            ids,
            peopleFieldId,
          })
        )
        .join("\n");
      const actions: string[] = [];
      const stepWrapperId = makeId(`step-${index}`);
      if (index > 0) {
        const prevId = makeId(`step${index}Prev`);
        actions.push(
          `<button type="button" class="btn ghost" id="${escapeHtml(
            prevId
          )}" data-action="prev">${escapeHtml(
            step.previousLabel ?? "← Back"
          )}</button>`
        );
      }
      const isLast = index === totalSteps - 1;
      const nextId = makeId(`step${index}Next`);
      const nextLabel = step.nextLabel ?? (isLast ? "Review →" : "Next →");
      actions.push(
        `<button type="button" class="btn" id="${escapeHtml(
          nextId
        )}" data-action="next">${escapeHtml(nextLabel)}</button>`
      );

      return `<fieldset class="step-panel${
        index === 0 ? "" : " hidden"
      }" id="${escapeHtml(stepWrapperId)}" data-step="${index}">
  ${step.title ? `<h3 class="step-title">${escapeHtml(step.title)}</h3>` : ""}
  ${
    step.subtitle
      ? `<p class="step-subtitle small">${escapeHtml(step.subtitle)}</p>`
      : ""
  }
  ${
    step.description
      ? `<p class="small">${escapeHtml(step.description)}</p>`
      : ""
  }
  ${fields}
  <div class="actions">
    ${actions.join("\n    ")}
  </div>
</fieldset>`;
    })
    .join("\n");
}

function renderSummaryPanel(
  config: PartnerFormConfig,
  makeId: (suffix: string) => string,
  ids: Record<string, string>,
  expiryMessage: string | null
) {
  const fieldsetId = makeId("step-summary");
  const summaryListId = ids.summaryList ?? makeId("confirm-list");
  const confirmId = ids.confirmButton ?? makeId("confirm");
  const editId = ids.editButton ?? makeId("edit");
  const summaryNoteId = makeId("confirm-note");
  const expiryNote = expiryMessage
    ? `<p class="small" data-role="qr-expiry-note">${escapeHtml(
        expiryMessage
      )}</p>`
    : "";
  return `<fieldset class="step-panel hidden" id="${escapeHtml(
    fieldsetId
  )}" data-step="${config.steps.length}">
  <h3>${escapeHtml(config.summary.title ?? "Review your selection")}</h3>
  <div class="summary-list" id="${escapeHtml(
    summaryListId
  )}" data-role="summary-list" style="margin-top:12px"></div>
  <div class="actions" style="margin-top:16px">
    <button type="button" class="btn ghost" id="${escapeHtml(
      editId
    )}" data-action="edit">${escapeHtml(
      config.summary.editLabel ?? "Edit"
    )}</button>
    <button type="button" class="btn" id="${escapeHtml(
      confirmId
    )}" data-role="confirm">${escapeHtml(
      config.summary.confirmLabel ?? "Confirm & Generate QR"
    )}</button>
  </div>
  <p class="small" id="${escapeHtml(summaryNoteId)}">${escapeHtml(
    config.summary.note ?? "We’ll generate the QR and email it to you."
  )}</p>
  ${expiryNote}
</fieldset>`;
}

function renderStepsNav(config: PartnerFormConfig) {
  const summaryNavLabel =
    config.summary.navLabel ??
    config.summary.title ??
    config.steps[config.steps.length - 1]?.title ??
    "Review";
  const items = config.steps
    .map(
      (step, index) =>
        `<div class="step${
          index === 0 ? " active" : ""
        }" data-step="${index}">${index + 1} · ${escapeHtml(step.title)}</div>`
    )
    .join("\n");
  return `<div class="steps">
  ${items}
  <div class="step" data-step="${config.steps.length}">${
    config.steps.length + 1
  } · ${escapeHtml(summaryNavLabel)}</div>
</div>`;
}

function buildCss(config: PartnerFormConfig) {
  const theme = config.styling?.theme ?? {
    background: "#0b0f14",
    card: "#0f1720",
    accent: "#f59e0b",
    muted: "#9fb3c8",
    text: "#e6edf3",
  };
  const fontFamily =
    config.styling?.fontFamily ??
    'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial';

  return `
:root{
  --bg:${theme.background};
  --card:${theme.card};
  --muted:${theme.muted};
  --accent:${theme.accent};
  --text:${theme.text};
  --glass: rgba(255,255,255,0.03);
}
.multi-form-wrap{
  max-width:900px;
  margin:24px auto;
  padding:20px;
  border-radius:16px;
  background:linear-gradient(180deg, rgba(255,255,255,0.02), transparent 30%), var(--card);
  color:var(--text);
  box-shadow:0 10px 30px rgba(0,0,0,0.4);
  font-family: ${fontFamily};
}
.mf-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
.mf-title{font-size:20px;font-weight:700}
.mf-sub{color:var(--muted);font-size:13px}
.progress{height:8px;background:rgba(255,255,255,0.04);border-radius:999px;margin-top:12px;overflow:hidden}
.progress > span{display:block;height:100%;width:0%;background:linear-gradient(90deg, var(--accent), #fbbf24);transition:width .25s linear}
.steps{display:grid;grid-template-columns:repeat(${
    config.steps.length + 1
  },1fr);gap:10px;margin-top:16px}
.step{padding:10px;border-radius:10px;background:var(--glass);text-align:center;font-size:13px}
.step.active{outline:2px solid rgba(245,158,11,0.12);box-shadow: inset 0 1px 0 rgba(255,255,255,0.02)}
form.mf{margin-top:18px}
.field{margin-bottom:14px}
label{display:block;font-size:13px;margin-bottom:6px}
input[type="text"],input[type="email"],input[type="number"],select,textarea{
  width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);
  background:#071018;color:var(--text);box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
}
textarea{min-height:80px;resize:vertical}
.inline-checkbox{display:flex;align-items:center;gap:8px;font-size:13px}
.radios{display:flex;gap:8px;flex-wrap:wrap}
.radio,.radio-inline{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer}
.radio-inline{flex:1 1 45%}
.radio-inline img.bus-image{display:block;width:100%;max-width:120px;border-radius:8px;margin-bottom:6px}
input[type="radio"],input[type="checkbox"]{accent-color: var(--accent)}
.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
.btn{padding:10px 14px;border-radius:10px;background:var(--accent);color:#071018;border:none;font-weight:700;cursor:pointer}
.btn.ghost{background:transparent;color:var(--text);border:1px solid rgba(255,255,255,0.08)}
.small{font-size:12px;color:var(--muted)}
.hidden{display:none}
.bus-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.price-box{margin-top:8px;font-weight:700}
.confirm-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03)}
.people-ctr{display:flex;align-items:center;gap:10px}
.ctr-btn{width:40px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:var(--text);font-size:20px;line-height:1;cursor:pointer}
.count-box{min-width:64px;text-align:center;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:#071018}
.error{color:#ef4444}
.ok{color:#10b981}
@media(max-width:700px){
  .bus-list{grid-template-columns:1fr}
  .steps{grid-template-columns:1fr}
  .actions{flex-direction:column-reverse}
}
`;
}

function collectFieldMetadata(config: PartnerFormConfig) {
  const meta: Array<{
    id: string;
    name: string;
    label: string;
    kind: string;
    options?: Array<{ value: string; label: string; price?: number }>;
    required: boolean;
  }> = [];
  for (const step of config.steps) {
    for (const field of step.fields) {
      meta.push({
        id: field.id,
        name: field.name,
        label: field.label,
        kind: field.kind ?? "input",
        options: field.options?.map((option) => ({
          value: option.value,
          label: option.label,
          price: option.price,
        })),
        required: Boolean(field.required),
      });
    }
  }
  return meta;
}

export function generatePartnerFormEmbed(form: PartnerFormRecord) {
  const config = form.config;
  const prefix = config.domId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const makeId = (suffix: string) => `${prefix}-${suffix}`;
  const css = buildCss(config);
  const ids = {
    form: makeId("form"),
    emailPreview: makeId("email-preview"),
    progress: makeId("progress"),
    note: makeId("note"),
    pricePreview: makeId("price-preview"),
    count: makeId("count-box"),
    peopleInput: makeId("people-input"),
    busList: makeId("bus-list"),
    summaryList: makeId("confirm-list"),
    confirmButton: makeId("confirm"),
    editButton: makeId("edit"),
  };
  const normalizedExpiry = clampQrExpiry(config.qrExpiresInSeconds);
  const expiryMessage = buildExpiryMessage(normalizedExpiry);
  const expiryDescription = formatExpiryDescription(normalizedExpiry);
  const hiddenFieldEntries = computeHiddenFieldEntries(config);
  const hiddenFields = renderHiddenFields(hiddenFieldEntries, makeId);
  const stepsNav = renderStepsNav(config);
  const fieldMeta = collectFieldMetadata(config);
  const fieldsHtml = renderStepPanels(
    config,
    prefix,
    makeId,
    ids,
    fieldMeta.find((field) => field.id === config.pricing?.peopleFieldId)?.id ??
      config.pricing?.peopleFieldId ??
      "numPeople"
  );
  const summaryPanel = renderSummaryPanel(
    config,
    makeId,
    ids,
    expiryMessage
  );

  const ticketField =
    fieldMeta.find((field) => field.id === config.pricing?.ticketFieldId) ??
    fieldMeta.find((field) => field.kind === "radio");
  const peopleField =
    fieldMeta.find((field) => field.id === config.pricing?.peopleFieldId) ??
    fieldMeta.find((field) => field.kind === "counter");
  const transportField =
    fieldMeta.find((field) => field.id === config.pricing?.transportFieldId) ??
    fieldMeta.find((field) => field.kind === "transport");
  const emailField = fieldMeta.find(
    (field) =>
      field.kind === "input" && field.name.toLowerCase().includes("email")
  );
  const privacyField = fieldMeta.find(
    (field) => field.kind === "checkbox" && field.required
  );
  const promoField = fieldMeta.find(
    (field) => field.kind === "checkbox" && !field.required
  );

  const fieldNames = {
    ticket: ticketField?.name ?? config.pricing?.ticketFieldId ?? "ticket",
    ticketFieldId: config.pricing?.ticketFieldId ?? ticketField?.id ?? "ticket",
    people: peopleField?.name ?? config.pricing?.peopleFieldId ?? "numPeople",
    peopleFieldId:
      config.pricing?.peopleFieldId ?? peopleField?.id ?? "numPeople",
    transport: transportField?.name ?? config.pricing?.transportFieldId ?? null,
    transportFieldId:
      config.pricing?.transportFieldId ?? transportField?.id ?? null,
    transportYesValue:
      config.pricing?.transportYesValue ?? config.transport?.yesValue ?? "Yes",
    transportBus:
      config.transport?.busFieldId ??
      config.pricing?.transportBusFieldId ??
      "selectedBus",
    email: emailField?.name ?? "email",
    privacy: privacyField?.name ?? null,
    promo: promoField?.name ?? null,
  };

  const extraSummaryRows = config.summary.extraRows ?? [];

type SummaryListEntry =
  | { type: "field"; id: string }
  | { type: "bus" }
  | { type: "extra"; name: string; label: string }
  | { type: "total" }
  | { type: "points" };

  const summaryOrder: SummaryListEntry[] = fieldMeta
    .filter((field) => {
      if (fieldNames.privacy && field.name === fieldNames.privacy) {
        return false;
      }
      return true;
    })
    .map((field) => ({ type: "field" as const, id: field.id }));

  if (config.transport?.enabled) {
    summaryOrder.push({ type: "bus" });
  }

  for (const extra of extraSummaryRows) {
    summaryOrder.push({
      type: "extra",
      name: extra.name,
      label: extra.label,
    });
  }

  summaryOrder.push({ type: "total" }, { type: "points" });

  const summaryLabels = {
    totalLabel: config.summary.totalLabel ?? "Total price",
    pointsLabel: config.summary.pointsLabel ?? "Estimated points",
    busLabel: config.summary.busLabel ?? "Bus partner",
    navLabel: config.summary.navLabel ?? "Review",
  };

  const runtime = {
    domId: config.domId,
    prefix,
    ids,
    proxyUrl: config.proxyUrl,
    qrRedirectUrl: config.qrRedirectUrl,
    hiddenFields: hiddenFieldEntries,
    pricing: config.pricing ?? null,
    transport: {
      enabled: Boolean(config.transport?.enabled),
      busFee:
        config.transport?.busFee ??
        config.pricing?.transportFee ??
        (config.transport?.enabled ? 0 : 0),
      busFieldName:
        config.transport?.busFieldId ??
        config.pricing?.transportBusFieldId ??
        "selectedBus",
      partners: config.transport?.partners ?? [],
    },
    fieldNames,
    fields: fieldMeta,
    summaryOrder,
    summaryLabels,
    qrExpiresInSeconds: normalizedExpiry,
    qrExpiryDescription: expiryDescription,
    qrExpiryMessage: expiryMessage,
    strings: {
      invalidEmail: "Please enter a valid email address.",
      privacyRequired: "You must agree to continue.",
      busRequired: "Please select a bus partner.",
      sending: "Sending & generating QR…",
      sent: "Confirmed — redirecting to your QR…",
      failed: "Failed to submit — still redirecting.",
      savedEmailKey: `partner-form:${form.slug}`,
    },
  };

  const script = `
(function(){
  const CONFIG = ${JSON.stringify(runtime)};
  const wrap = document.getElementById(CONFIG.domId);
  if (!wrap) return;
  const form = wrap.querySelector("form.mf");
  if (!form) return;
  const panels = Array.from(form.querySelectorAll(".step-panel"));
  const steps = Array.from(wrap.querySelectorAll(".steps .step"));
  const progress = wrap.querySelector('[data-role="progress"]');
  const pricePreview = wrap.querySelector('[data-role="price-preview"]');
  const noteEl = wrap.querySelector('[data-role="note"]');
  const expiryNote = wrap.querySelector('[data-role="qr-expiry-note"]');
  const summaryList = wrap.querySelector('[data-role="summary-list"]');
  const confirmButton = wrap.querySelector('[data-role="confirm"]');
  const editButton = wrap.querySelector('[data-action="edit"]');
  const emailPreview = wrap.querySelector('[data-role="email-preview"]');
  const busListBlock = wrap.querySelector('[data-role="bus-list"]');
  const ticketRadios = CONFIG.fieldNames.ticket ? form.querySelectorAll('input[name="'+CONFIG.fieldNames.ticket+'"]') : [];
  const peopleInput = CONFIG.fieldNames.peopleFieldId ? form.querySelector('[data-counter-input="'+CONFIG.fieldNames.peopleFieldId+'"]') : null;
  const peopleDisplay = CONFIG.fieldNames.peopleFieldId ? form.querySelector('[data-counter-display="'+CONFIG.fieldNames.peopleFieldId+'"]') : null;
  const counterButtons = CONFIG.fieldNames.peopleFieldId ? form.querySelectorAll('[data-counter="'+CONFIG.fieldNames.peopleFieldId+'"]') : [];
  const transportRadios = CONFIG.fieldNames.transport ? form.querySelectorAll('input[name="'+CONFIG.fieldNames.transport+'"]') : [];
  const busRadios = CONFIG.fieldNames.transportBus ? wrap.querySelectorAll('input[name="'+CONFIG.fieldNames.transportBus+'"]') : [];
  const emailInput = form.querySelector('input[name="'+CONFIG.fieldNames.email+'"]');
  const privacyInput = CONFIG.fieldNames.privacy ? form.querySelector('input[name="'+CONFIG.fieldNames.privacy+'"]') : null;
  const promoInput = CONFIG.fieldNames.promo ? form.querySelector('input[name="'+CONFIG.fieldNames.promo+'"]') : null;

  if (expiryNote && CONFIG.qrExpiryMessage) {
    expiryNote.textContent = CONFIG.qrExpiryMessage;
  }

  const state = {
    step: 0,
    totals: { price: 0, points: 0 }
  };

  function setNote(text, ok){
    if (!noteEl) return;
    noteEl.textContent = text || "";
    if (!text) {
      noteEl.className = "small";
    } else {
      noteEl.className = "small " + (ok === true ? "ok" : ok === false ? "error" : "");
    }
  }

  function updateProgress(){
    const pct = Math.round((state.step / (panels.length - 1)) * 100);
    if (progress) progress.style.width = pct + "%";
    steps.forEach((stepEl, index) => {
      stepEl.classList.toggle("active", index === state.step);
    });
  }

  function showStep(next){
    state.step = Math.max(0, Math.min(next, panels.length - 1));
    panels.forEach((panel, index) => {
      panel.classList.toggle("hidden", index !== state.step);
    });
    updateProgress();
    if (state.step === panels.length - 1) {
      buildSummary();
      if (CONFIG.qrExpiryMessage) {
        setNote(CONFIG.qrExpiryMessage, null);
      } else {
        setNote("", null);
      }
    } else {
      setNote("", null);
    }
  }

  function getSelectedRadio(radios){
    for (const node of radios) {
      const input = node;
      if (input instanceof HTMLInputElement && input.checked) {
        return input.value;
      }
    }
    return null;
  }

  function setCounterValue(next){
    if (!peopleInput || !peopleDisplay) return;
    const min = Number(peopleInput.getAttribute("min") || "1");
    const maxAttr = peopleInput.getAttribute("max");
    const max = maxAttr ? Number(maxAttr) : null;
    const value = Math.max(min, max ? Math.min(next, max) : next);
    peopleInput.value = String(value);
    peopleDisplay.textContent = String(value);
    updateTotals();
  }

  function refreshTransportUI(){
    if (!busListBlock || !CONFIG.fieldNames.transport) return;
    const value = getSelectedRadio(transportRadios);
    const shouldShow = value === CONFIG.fieldNames.transportYesValue;
    busListBlock.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) {
      busRadios.forEach((node) => {
        const input = node;
        if (input instanceof HTMLInputElement) input.checked = false;
      });
    }
  }

  function updateTotals(){
    const pricing = CONFIG.pricing;
    if (!pricing) return;
    const people = peopleInput ? Math.max(1, Number(peopleInput.value || "1")) : 1;
    const ticketValue = getSelectedRadio(ticketRadios);
    const ticketEntry = pricing.ticketPricing?.find((item) => item.value === ticketValue) || pricing.ticketPricing?.[0] || null;
    const perTicket = ticketEntry?.price || 0;
    let total = perTicket * people;
    const transportSelected = CONFIG.fieldNames.transport ? getSelectedRadio(transportRadios) : null;
    if (
      CONFIG.transport.enabled &&
      transportSelected === CONFIG.fieldNames.transportYesValue
    ) {
      total += CONFIG.transport.busFee || 0;
    }
    const points = Math.floor(total / 100);
    state.totals = { price: total, points };
    if (pricePreview) {
      const currency = pricing.currency || "CZK";
      pricePreview.textContent = "Total: " + total.toLocaleString() + " " + currency + " (points: " + points + ")";
    }
  }

  function validateEmail(){
    if (!emailInput) return true;
    const value = emailInput.value.trim();
    const valid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
    if (!valid) {
      setNote(CONFIG.strings.invalidEmail, false);
      emailInput.focus();
      return false;
    }
    return true;
  }

  function validatePrivacy(){
    if (privacyInput && !privacyInput.checked) {
      setNote(CONFIG.strings.privacyRequired, false);
      privacyInput.focus();
      return false;
    }
    return true;
  }

  function validateTransport(){
    if (!CONFIG.transport.enabled || !busListBlock) return true;
    const transportSelected = CONFIG.fieldNames.transport ? getSelectedRadio(transportRadios) : null;
    if (transportSelected !== CONFIG.fieldNames.transportYesValue) return true;
    for (const node of busRadios) {
      const input = node;
      if (input instanceof HTMLInputElement && input.checked) {
        return true;
      }
    }
    setNote(CONFIG.strings.busRequired, false);
    busListBlock.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  function serializeForm(){
    const fd = new FormData(form);
    CONFIG.hiddenFields.forEach((item) => {
      fd.append(item.name, item.value);
    });
    const obj = {};
    fd.forEach((value, key) => {
      if (typeof value === "string") {
        obj[key] = value;
      }
    });
    if (emailInput) {
      const rawEmail = emailInput.value.trim();
      if (rawEmail) {
        obj[CONFIG.fieldNames.email] = rawEmail;
      } else {
        delete obj[CONFIG.fieldNames.email];
      }
    }
    obj.totalPrice = state.totals.price;
    obj.estimatedPoints = state.totals.points;
    return obj;
  }

  function displayLabelFor(fieldId, value){
    const field = CONFIG.fields.find((item) => item.id === fieldId);
    if (!field) return value;
    if (field.kind === "checkbox") {
      return value ? "Yes" : "No";
    }
    if (field.options) {
      const found = field.options.find((opt) => opt.value === value);
      if (found) return found.label;
    }
    return value;
  }

  function buildSummary(){
    if (!summaryList) return;
    const data = serializeForm();
    const fragments = [];
    for (const item of CONFIG.summaryOrder) {
      if (item.type === "field") {
        const field = CONFIG.fields.find((meta) => meta.id === item.id);
        if (!field) continue;
        const value = data[field.name];
        if (value === undefined || value === "" || value === null) continue;
        const display = displayLabelFor(item.id, value);
        fragments.push(
          '<div class="confirm-row"><div>' +
            escapeHtml(field.label) +
            '</div><div style="font-weight:700">' +
            escapeHtml(String(display)) +
            "</div></div>"
        );
      } else if (item.type === "bus") {
        const value = data[CONFIG.transport.busFieldName];
        if (!value) continue;
        const partner = CONFIG.transport.partners.find((p) => p.value === value) || null;
        const label = partner ? partner.label : value;
        fragments.push(
          '<div class="confirm-row"><div>' +
            escapeHtml(CONFIG.summaryLabels.busLabel) +
            '</div><div style="font-weight:700">' +
            escapeHtml(String(label)) +
            "</div></div>"
        );
      } else if (item.type === "total") {
        const currency = CONFIG.pricing?.currency || "CZK";
        fragments.push(
          '<div class="confirm-row"><div>' +
            escapeHtml(CONFIG.summaryLabels.totalLabel) +
            '</div><div style="font-weight:700">' +
            escapeHtml(state.totals.price.toLocaleString()) +
            " " +
            escapeHtml(currency) +
            "</div></div>"
        );
      } else if (item.type === "points") {
        fragments.push(
          '<div class="confirm-row"><div>' +
            escapeHtml(CONFIG.summaryLabels.pointsLabel) +
            '</div><div style="font-weight:700">' +
            escapeHtml(String(state.totals.points)) +
            "</div></div>"
        );
      }
    }
    summaryList.innerHTML = fragments.join("");
  }

  function escapeHtml(str){
    return String(str || "").replace(/[&<>"']/g, function(c){
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;" })[c] || c;
    });
  }

  form.querySelectorAll('[data-action="next"]').forEach((button) => {
    button.addEventListener("click", () => {
      const panel = panels[state.step];
      if (panel && panel.querySelector('input[name="'+CONFIG.fieldNames.email+'"]')) {
        if (!validateEmail() || !validatePrivacy()) return;
      }
      if (panel && panel.querySelector('[data-kind="transport"]')) {
        if (!validateTransport()) return;
      }
      showStep(state.step + 1);
    });
  });

  form.querySelectorAll('[data-action="prev"]').forEach((button) => {
    button.addEventListener("click", () => {
      showStep(state.step - 1);
    });
  });

  if (editButton) {
    editButton.addEventListener("click", () => {
      showStep(0);
    });
  }

  if (counterButtons) {
    counterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (!peopleInput) return;
        const action = button.getAttribute("data-action");
        const current = Number(peopleInput.value || "1");
        const delta = action === "increment" ? 1 : -1;
        setCounterValue(current + delta);
      });
    });
  }

  ticketRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      updateTotals();
    });
  });

  transportRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      refreshTransportUI();
      updateTotals();
    });
  });

  busRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      updateTotals();
    });
  });

  if (emailInput) {
    emailInput.addEventListener("input", () => {
      const value = emailInput.value.trim().toLowerCase();
      if (emailPreview) emailPreview.textContent = value;
      if (!value) {
        setNote("", null);
      } else if (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
        setNote("✓ Looks good!", true);
      } else {
        setNote(CONFIG.strings.invalidEmail, false);
      }
    });
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", async () => {
      if (confirmButton.disabled) return;
      confirmButton.disabled = true;
      setNote(CONFIG.strings.sending, true);
      const payload = serializeForm();
      if (emailInput && emailInput.value) {
        try {
          sessionStorage.setItem(
            CONFIG.strings.savedEmailKey,
            emailInput.value.trim().toLowerCase()
          );
        } catch (err) {
          console.warn("Unable to cache email", err);
        }
      }
      try {
        const response = await fetch(CONFIG.proxyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          mode: "cors",
          cache: "no-store"
        });
        if (response.ok) {
          setNote(CONFIG.strings.sent, true);
        } else {
          setNote(CONFIG.strings.failed, false);
        }
      } catch (err) {
        console.warn("Form submission failed", err);
        setNote(CONFIG.strings.failed, false);
      } finally {
        const redirectUrl = CONFIG.qrRedirectUrl + (payload.email ? "?email=" + encodeURIComponent(payload.email) : "");
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 400);
      }
    });
  }

  function restoreEmail(){
    if (!emailInput) return;
    try {
      const cached = sessionStorage.getItem(CONFIG.strings.savedEmailKey);
      if (cached) {
        emailInput.value = cached;
        if (emailPreview) emailPreview.textContent = cached;
      }
    } catch (err) {
      console.warn("Unable to restore cached email", err);
    }
  }

  restoreEmail();
  refreshTransportUI();
  updateTotals();
  showStep(0);
})();
`.trim();

  const safeScript = script.replace(/<\/script>/gi, "<\\/script>");

  const headerSubtitle = config.subtitle
    ? `<div class="mf-sub">${escapeHtml(config.subtitle)}</div>`
    : "";
  const headerDescription = config.description
    ? `<p class="small">${escapeHtml(config.description)}</p>`
    : "";

  return `<!-- Partner Form: ${escapeHtml(form.name)} -->
<div class="multi-form-wrap" id="${escapeHtml(
    config.domId
  )}" aria-live="polite">
  <style>
${css.trim()}
  </style>
  <div class="mf-header">
    <div>
      <div class="mf-title">${escapeHtml(config.title)}</div>
      ${headerSubtitle}
      ${headerDescription}
    </div>
    <div class="small" data-role="email-preview"></div>
  </div>
  <div class="progress" aria-hidden="true"><span data-role="progress" style="width:0%"></span></div>
  ${stepsNav}
  <form class="mf" novalidate>
    ${hiddenFields}
    ${fieldsHtml}
    <p class="small" data-role="note"></p>
    ${summaryPanel}
  </form>
</div>
<script>${safeScript}</script>`;
}
