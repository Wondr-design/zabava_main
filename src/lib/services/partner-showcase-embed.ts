import {
  PartnerShowcaseDirectory,
  PartnerShowcaseEntry,
  PartnerCategory,
} from "@/lib/data/partner-showcase";

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_STORAGE_KEYS = {
  category: "zabavaSelectedCategory",
  partner: "zabavaSelectedPartner",
} as const;

type StorageKeyOverrides = Partial<
  Record<keyof typeof DEFAULT_STORAGE_KEYS, string>
>;

function normalizeStorageKeys(overrides?: StorageKeyOverrides) {
  return {
    category: escapeHtml(
      overrides?.category ?? DEFAULT_STORAGE_KEYS.category
    ),
    partner: escapeHtml(overrides?.partner ?? DEFAULT_STORAGE_KEYS.partner),
  };
}

function filterActivePartners(entries: PartnerShowcaseEntry[]) {
  return entries.filter((entry) => entry.status === "active");
}

function mapCategoryForEmbed(category: PartnerCategory) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description ?? "",
    sortOrder: category.sortOrder,
    card: {
      title: category.cardContent?.title ?? category.name,
      subtitle: category.cardContent?.subtitle ?? "",
      description:
        category.cardContent?.description ?? category.description ?? "",
      imageUrl: category.cardContent?.heroImageUrl ?? "",
      buttonLabel: category.cardContent?.buttonLabel ?? "Explore",
      buttonUrl: category.cardContent?.buttonUrl ?? "",
      backgroundColor: category.cardContent?.backgroundColor ?? "#ffffff",
      textColor: category.cardContent?.textColor ?? "#101828",
      textSize: category.cardContent?.textSize ?? "1.5rem",
      subtitleColor: category.cardContent?.subtitleColor ?? "#475467",
      subtitleSize: category.cardContent?.subtitleSize ?? "1rem",
    },
  };
}

function mapPartnerForEmbed(entry: PartnerShowcaseEntry) {
  return {
    partnerId: entry.partnerId,
    name: entry.name,
    categories: entry.categories,
    title: entry.title ?? entry.name,
    subtitle: entry.subtitle ?? "",
    description: entry.description ?? "",
    heroImageUrl: entry.heroImageUrl ?? "",
    gallery: entry.gallery ?? [],
    highlights: entry.highlights ?? [],
    ctaPrimaryLabel: entry.ctaPrimaryLabel ?? "",
    ctaPrimaryUrl: entry.ctaPrimaryUrl ?? "",
    ctaSecondaryLabel: entry.ctaSecondaryLabel ?? "",
    ctaSecondaryUrl: entry.ctaSecondaryUrl ?? "",
    ageMin: entry.ageMin ?? null,
    ageMax: entry.ageMax ?? null,
    formUrl: entry.formUrl ?? "",
    detailUrl: entry.detailUrl ?? "",
    metadata: entry.metadata ?? {},
  };
}

interface CategoriesEmbedOptions {
  listPageUrl: string;
  storageKeys?: StorageKeyOverrides;
  heading?: string;
  description?: string;
}

export function generateShowcaseCategoriesEmbed(
  directory: PartnerShowcaseDirectory,
  options: CategoriesEmbedOptions
) {
  const categories = directory.categories.map(mapCategoryForEmbed);
  const listPageUrl = options.listPageUrl.trim();
  if (!listPageUrl) {
    throw new Error("listPageUrl is required for categories embed");
  }
  const storageKeys = normalizeStorageKeys(options.storageKeys);
  const containerId = createId("zabava-categories");
  const heading = options.heading
    ? `<h2 class="zabava-sc-heading">${escapeHtml(options.heading)}</h2>`
    : "";
  const description = options.description
    ? `<p class="zabava-sc-lead">${escapeHtml(options.description)}</p>`
    : "";

  return `<!-- Zabava categories embed -->
<div class="zabava-sc-root">
  ${heading}
  ${description}
  <div class="zabava-sc-grid" id="${containerId}"></div>
</div>
</style>
</style>
<script>
(function() {
  const categories = ${safeJson(categories)};
  const listUrl = ${JSON.stringify(listPageUrl)};
  const storageKey = ${JSON.stringify(storageKeys.category)};
  const container = document.getElementById(${JSON.stringify(containerId)});
  if (!container) return;

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function handleNavigate(slug, preferredUrl) {
    try {
      if (window.sessionStorage) {
        sessionStorage.setItem(storageKey, slug);
      }
    } catch (err) {
      console.warn("Unable to access sessionStorage", err);
    }
    const target = preferredUrl && preferredUrl.trim() ? preferredUrl : listUrl;
    window.location.href = target;
  }

  container.innerHTML = categories
    .map((category) => {
      const card = category.card || {};
      const mediaClass = card.imageUrl ? 'zabava-sc-media' : 'zabava-sc-media is-empty';
      const mediaStyle = card.imageUrl
        ? ' style="background-image:url(' + JSON.stringify(card.imageUrl) + ');"'
        : '';
      const buttonLabel = card.buttonLabel && card.buttonLabel.trim()
        ? card.buttonLabel
        : 'Explore';
      const description = card.description || '';
      const subtitle = card.subtitle || '';
      const buttonUrl = card.buttonUrl || '';
      const bgColor = card.backgroundColor || '#ffffff';
      const textColor = card.textColor || '#101828';
      const subtitleColor = card.subtitleColor || '#475467';
      const textSize = card.textSize || '1.2rem';
      const subtitleSize = card.subtitleSize || '0.95rem';
      return [
        '<article class="zabava-sc-card" data-category-card data-slug="' + htmlEscape(category.slug) + '" data-url="' + htmlEscape(buttonUrl) + '" tabindex="0" style="background:' + htmlEscape(bgColor) + ';color:' + htmlEscape(textColor) + ';">',
          '<div class="' + mediaClass + '"' + mediaStyle + '></div>',
          '<div class="zabava-sc-content">',
            '<h3 class="zabava-sc-title" style="font-size:' + htmlEscape(textSize) + ';color:' + htmlEscape(textColor) + ';">' + htmlEscape(card.title || category.name || '') + '</h3>',
            (subtitle ? '<p class="zabava-sc-subtitle" style="font-size:' + htmlEscape(subtitleSize) + ';color:' + htmlEscape(subtitleColor) + ';">' + htmlEscape(subtitle) + '</p>' : ''),
            (description ? '<p class="zabava-sc-desc" style="color:' + htmlEscape(textColor) + ';">' + htmlEscape(description) + '</p>' : ''),
            (buttonLabel
              ? '<button type="button" class="zabava-sc-btn" data-action="open">' + htmlEscape(buttonLabel) + '</button>'
              : ''),
          '</div>',
        '</article>'
      ].join('');
    })
    .join('');

  container.addEventListener('click', function(event) {
    const button = event.target.closest('[data-action="open"]');
    if (button) {
      const card = button.closest('[data-category-card]');
      if (!card) return;
      const slug = card.getAttribute('data-slug');
      const url = card.getAttribute('data-url') || '';
      if (slug) handleNavigate(slug, url);
      return;
    }
    const card = event.target.closest('[data-category-card]');
    if (!card) return;
    const slug = card.getAttribute('data-slug');
    const url = card.getAttribute('data-url') || '';
    if (slug) handleNavigate(slug, url);
  });

  container.addEventListener('keydown', function(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[data-slug]');
    if (!target) return;
    event.preventDefault();
    const slug = target.getAttribute('data-slug');
    const url = target.getAttribute('data-url') || '';
    if (slug) handleNavigate(slug, url);
  });
})();
</script>`;
}

interface ListEmbedOptions {
  detailPageUrl: string;
  storageKeys?: StorageKeyOverrides;
  emptyMessage?: string;
  categoriesPageUrl?: string;
  defaultImageUrl?: string;
}

export function generateShowcaseListEmbed(
  directory: PartnerShowcaseDirectory,
  options: ListEmbedOptions
) {
  const partners = filterActivePartners(directory.partners).map(
    mapPartnerForEmbed
  );
  const categories = directory.categories.map(mapCategoryForEmbed);
  const storageKeys = normalizeStorageKeys(options.storageKeys);
  const detailPageUrl = options.detailPageUrl.trim();
  if (!detailPageUrl) {
    throw new Error("detailPageUrl is required for list embed");
  }
  const containerId = createId("zabava-list");
  const filterId = createId("zabava-filters");
  const defaultImageUrl = options.defaultImageUrl ?? "";
  const emptyMessage =
    options.emptyMessage ??
    "No partners match your filters just yet. Try a different category or age range.";
  const categoriesPageUrl = options.categoriesPageUrl ?? "";

  return `<!-- Zabava partner list embed -->
<div class="zabava-sl-root">
  <div class="zabava-sl-filters" id="${filterId}"></div>
  <div class="zabava-sl-grid" id="${containerId}"></div>
</div>
.zabava-sc-root {
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #101828;
  display: grid;
  gap: 1.5rem;
}
.zabava-sc-heading {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 700;
  text-align: center;
  color: #0f172a;
}
.zabava-sc-lead {
  margin: 0 auto;
  max-width: 640px;
  text-align: center;
  font-size: 1rem;
  color: #475467;
}
.zabava-sc-grid {
  margin: 0 auto;
  width: 100%;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}
.zabava-sc-card {
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12);
  transition: transform 200ms ease, box-shadow 200ms ease;
  cursor: pointer;
}
.zabava-sc-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 22px 40px rgba(15, 23, 42, 0.16);
}
.zabava-sc-card:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 4px;
}
.zabava-sc-media {
  width: 100%;
  height: 180px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-color: #0f172a;
}
.zabava-sc-media.is-empty {
  background-image: linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(14, 165, 233, 0.2));
}
.zabava-sc-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem;
}
.zabava-sc-title {
  margin: 0;
  font-weight: 600;
}
.zabava-sc-subtitle {
  margin: 0;
}
.zabava-sc-desc {
  margin: 0;
  line-height: 1.6;
}
.zabava-sc-btn {
  margin-top: 0.5rem;
  align-self: flex-start;
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.3rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.zabava-sc-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.25);
}
.zabava-sc-btn:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.6);
  outline-offset: 2px;
}
.zabava-sc-card[data-url=''] .zabava-sc-btn {
  display: none;
}
.zabava-sc-card[data-url=''] {
  cursor: default;
}
.zabava-sc-card[data-url='']:hover {
  transform: none;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12);
}
.zabava-sl-root {
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #0f172a;
  display: grid;
  gap: 1.5rem;
}
.zabava-sl-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  background: rgba(241, 245, 249, 0.7);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  padding: 1rem 1.25rem;
}
.zabava-sl-filters > div {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.zabava-sl-select,
.zabava-sl-input {
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  font-size: 0.95rem;
  min-width: 160px;
  background: white;
  color: inherit;
}
.zabava-sl-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.zabava-sl-card {
  background: white;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
  display: grid;
  grid-template-rows: 180px auto;
}
.zabava-sl-banner {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}
.zabava-sl-banner::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0) 40%, rgba(15, 23, 42, 0.35));
}
.zabava-sl-body {
  padding: 1.5rem;
  display: grid;
  gap: 0.9rem;
}
.zabava-sl-name {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: #0f172a;
}
.zabava-sl-sub {
  margin: 0;
  font-size: 0.95rem;
  color: #475467;
}
.zabava-sl-chipline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.zabava-sl-chip {
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  font-size: 0.75rem;
  font-weight: 600;
}
.zabava-sl-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.zabava-sl-btn {
  flex: 1;
  min-width: 160px;
  text-align: center;
  border-radius: 12px;
  border: none;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.zabava-sl-btn.primary {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: white;
}
.zabava-sl-btn.secondary {
  background: rgba(15, 23, 42, 0.04);
  color: #0f172a;
}
.zabava-sl-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.zabava-sl-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 18px rgba(15, 23, 42, 0.12);
}
.zabava-sl-empty {
  text-align: center;
  padding: 2rem;
  font-size: 1rem;
  color: #475467;
  background: rgba(248, 250, 252, 0.8);
  border-radius: 20px;
}
@media (max-width: 640px) {
  .zabava-sl-filters {
    flex-direction: column;
    align-items: stretch;
  }
  .zabava-sl-filters > div {
    width: 100%;
    justify-content: space-between;
  }
  .zabava-sl-select,
  .zabava-sl-input {
    flex: 1;
  }
  .zabava-sl-actions {
    flex-direction: column;
  }
  .zabava-sl-btn {
    width: 100%;
  }
}
</style>
<script>
(function() {
  const partners = ${safeJson(partners)};
  const categories = ${safeJson(categories)};
  const storageKeys = ${safeJson(storageKeys)};
  const detailPageUrl = ${JSON.stringify(detailPageUrl)};
  const categoriesPageUrl = ${JSON.stringify(categoriesPageUrl)};
  const defaultImageUrl = ${JSON.stringify(defaultImageUrl)};
  const emptyMessage = ${JSON.stringify(emptyMessage)};
  const container = document.getElementById(${JSON.stringify(containerId)});
  const filterContainer = document.getElementById(${JSON.stringify(filterId)});
  if (!container || !filterContainer) return;

  const CATEGORY_ALL = "__all__";

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cssUrl(value) {
    if (!value) return 'none';
    return 'url("' + String(value).replace(/"/g, '\\\\"') + '")';
  }

  let filters = {
    category: CATEGORY_ALL,
    minAge: "",
    maxAge: "",
  };

  function readStoredCategory() {
    try {
      if (!window.sessionStorage) return null;
      const stored = sessionStorage.getItem(storageKeys.category);
      if (!stored) return null;
      return stored;
    } catch (error) {
      console.warn("Unable to read stored category", error);
      return null;
    }
  }

  function storePartner(partnerId) {
    try {
      if (!window.sessionStorage) return;
      sessionStorage.setItem(storageKeys.partner, partnerId);
    } catch (error) {
      console.warn("Unable to store partner selection", error);
    }
  }

  const storedCategory = readStoredCategory();
  if (storedCategory) {
    filters.category = storedCategory;
  }

  function renderFilters() {
    const categoryOptions = ['<option value="' + CATEGORY_ALL + '">All categories</option>']
      .concat(
        categories.map((category) => {
          const selected = filters.category === category.slug ? ' selected' : '';
          return '<option value="' + htmlEscape(category.slug) + '"' + selected + '>' + htmlEscape(category.name) + '</option>';
        })
      )
      .join('');

    filterContainer.innerHTML = [
      '<div>',
        '<label style="font-size:0.85rem;color:#475467">Category</label>',
        '<select class="zabava-sl-select" data-filter="category">' + categoryOptions + '</select>',
      '</div>',
      '<div>',
        '<label style="font-size:0.85rem;color:#475467">Age min</label>',
        '<input class="zabava-sl-input" type="number" min="0" max="120" placeholder="Any" data-filter="age-min" value="' + (filters.minAge || '') + '"/>',
      '</div>',
      '<div>',
        '<label style="font-size:0.85rem;color:#475467">Age max</label>',
        '<input class="zabava-sl-input" type="number" min="0" max="120" placeholder="Any" data-filter="age-max" value="' + (filters.maxAge || '') + '"/>',
      '</div>',
      categoriesPageUrl
        ? '<a class="zabava-sl-btn secondary" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;padding:0.65rem 1.2rem;" href="' + htmlEscape(categoriesPageUrl) + '">Browse categories</a>'
        : ''
    ].join('');

    filterContainer.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      const filter = target.getAttribute('data-filter');
      if (filter === 'category') {
        filters.category = target.value;
        try {
          if (window.sessionStorage) {
            sessionStorage.setItem(storageKeys.category, target.value);
          }
        } catch (error) {
          console.warn("Unable to store category choice", error);
        }
        renderList();
      } else if (filter === 'age-min') {
        filters.minAge = target.value;
        renderList();
      } else if (filter === 'age-max') {
        filters.maxAge = target.value;
        renderList();
      }
    });
  }

  function partnerMatchesFilters(partner) {
    if (filters.category !== CATEGORY_ALL) {
      const matchesCategory = partner.categories.includes(filters.category);
      if (!matchesCategory) return false;
    }
    const minAge = Number(filters.minAge);
    const maxAge = Number(filters.maxAge);
    const hasMin = !Number.isNaN(minAge);
    const hasMax = !Number.isNaN(maxAge);
    if (hasMin) {
      if (partner.ageMax !== null && partner.ageMax < minAge) return false;
      if (partner.ageMin !== null && partner.ageMin > minAge) return false;
    }
    if (hasMax) {
      if (partner.ageMin !== null && partner.ageMin > maxAge) return false;
      if (partner.ageMax !== null && partner.ageMax < maxAge) return false;
    }
    return true;
  }

  function renderList() {
    const visiblePartners = partners.filter(partnerMatchesFilters);
    if (visiblePartners.length === 0) {
      container.innerHTML = '<div class="zabava-sl-empty">' + htmlEscape(emptyMessage) + '</div>';
      return;
    }

    container.innerHTML = visiblePartners
      .map((partner) => {
        const detailDisabled = !detailPageUrl;
        const formLink = partner.ctaPrimaryUrl || partner.formUrl;
        const formDisabled = !formLink;
        const bannerUrl = partner.heroImageUrl || defaultImageUrl;
        const primaryLabel = (partner.ctaPrimaryLabel || "").trim() || "Generate QR";
        const detailLabel = (partner.ctaSecondaryLabel || "").trim() || "View details";
        const ageRange = partner.ageMin !== null || partner.ageMax !== null
          ? [
              partner.ageMin !== null ? partner.ageMin : "Any",
              partner.ageMax !== null ? partner.ageMax : "Any",
            ].join(" – ")
          : "";
        const chips = []
          .concat(
            partner.categories
              .map((slug) => {
                const category = categories.find((entry) => entry.slug === slug || entry.id === slug);
                return category ? '<span class="zabava-sl-chip">' + htmlEscape(category.name) + '</span>' : '';
              })
              .filter(Boolean)
          )
          .concat(ageRange ? '<span class="zabava-sl-chip">Age ' + htmlEscape(ageRange) + '</span>' : [])
          .join('');

        return [
          '<article class="zabava-sl-card" data-partner="' + htmlEscape(partner.partnerId) + '">',
            '<div class="zabava-sl-banner" style="background-image:' + cssUrl(bannerUrl) + ';"></div>',
            '<div class="zabava-sl-body">',
              '<h3 class="zabava-sl-name">' + htmlEscape(partner.name) + '</h3>',
              partner.subtitle ? '<p class="zabava-sl-sub">' + htmlEscape(partner.subtitle) + '</p>' : '',
              chips ? '<div class="zabava-sl-chipline">' + chips + '</div>' : '',
              '<div class="zabava-sl-actions">',
                '<button class="zabava-sl-btn primary" data-action="form" ' + (formDisabled ? 'disabled' : '') + '>' + htmlEscape(primaryLabel) + '</button>',
                '<button class="zabava-sl-btn secondary" data-action="detail" ' + (detailDisabled ? 'disabled' : '') + '>' + htmlEscape(detailLabel) + '</button>',
              '</div>',
            '</div>',
          '</article>'
        ].join('');
      })
      .join('');
  }

  container.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const card = actionButton.closest('[data-partner]');
    if (!card) return;
    const partnerId = card.getAttribute('data-partner');
    const partner = partners.find((entry) => entry.partnerId === partnerId);
    if (!partner) return;
    const action = actionButton.getAttribute('data-action');
    if (action === 'form') {
      const formLink = partner.ctaPrimaryUrl || partner.formUrl;
      if (!formLink) return;
      storePartner(partner.partnerId);
      window.open(formLink, '_blank', 'noopener');
    } else if (action === 'detail') {
      if (!detailPageUrl) return;
      storePartner(partner.partnerId);
      window.location.href = detailPageUrl;
    }
  });

  renderFilters();
  renderList();
})();
</script>`;
}

interface DetailEmbedOptions {
  storageKeys?: StorageKeyOverrides;
  categoriesPageUrl?: string;
  defaultImageUrl?: string;
  emptyMessage?: string;
  partnerId?: string;
}

export function generateShowcaseDetailEmbed(
  directory: PartnerShowcaseDirectory,
  options: DetailEmbedOptions = {}
) {
  const partners = filterActivePartners(directory.partners).map(
    mapPartnerForEmbed
  );
  const categories = directory.categories.map(mapCategoryForEmbed);
  const storageKeys = normalizeStorageKeys(options.storageKeys);
  const containerId = createId("zabava-detail");
  const defaultImageUrl = options.defaultImageUrl ?? "";
  const categoriesPageUrl = options.categoriesPageUrl ?? "";
  const emptyMessage =
    options.emptyMessage ??
    "Select a partner from the list to see their details.";
  const targetPartnerId = options.partnerId
    ? escapeHtml(options.partnerId)
    : "";

  return `<!-- Zabava partner detail embed -->
<div class="zabava-sd-root" id="${containerId}">
  <div class="zabava-sd-empty">${escapeHtml(emptyMessage)}</div>
</div>
<style>
.zabava-sd-root {
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #0f172a;
  display: grid;
  gap: 2rem;
}
.zabava-sd-empty {
  padding: 2.5rem;
  border-radius: 24px;
  background: rgba(248, 250, 252, 0.85);
  text-align: center;
  font-size: 1rem;
  color: #475467;
}
.zabava-sd-header {
  display: grid;
  gap: 1rem;
}
.zabava-sd-hero {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 28px;
  overflow: hidden;
  position: relative;
}
.zabava-sd-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.zabava-sd-title {
  margin: 0;
  font-size: 2.4rem;
  font-weight: 700;
}
.zabava-sd-subtitle {
  margin: 0;
  font-size: 1.1rem;
  color: #475467;
}
.zabava-sd-body {
  display: grid;
  gap: 2rem;
  grid-template-columns: minmax(0, 2fr);
}
.zabava-sd-description {
  font-size: 1rem;
  line-height: 1.7;
  color: #334155;
}
.zabava-sd-highlights {
  display: grid;
  gap: 1rem;
}
.zabava-sd-highlight {
  border-radius: 20px;
  padding: 1.25rem;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.12);
}
.zabava-sd-highlight h4 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: #0f172a;
}
.zabava-sd-highlight p {
  margin: 0.5rem 0 0;
  color: #475467;
  font-size: 0.95rem;
}
.zabava-sd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.zabava-sd-btn {
  padding: 0.85rem 1.2rem;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  min-width: 180px;
  text-align: center;
}
.zabava-sd-btn.primary {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: white;
}
.zabava-sd-btn.secondary {
  background: rgba(15, 23, 42, 0.04);
  color: #0f172a;
}
.zabava-sd-chipline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.zabava-sd-chip {
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  font-size: 0.8rem;
  font-weight: 600;
}
.zabava-sd-gallery {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}
.zabava-sd-gallery img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 16px;
}
@media (min-width: 1024px) {
  .zabava-sd-body {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 2.5rem;
  }
}
@media (max-width: 640px) {
  .zabava-sd-title {
    font-size: 1.9rem;
  }
}
</style>
<script>
(function() {
  const partners = ${safeJson(partners)};
  const categories = ${safeJson(categories)};
  const storageKeys = ${safeJson(storageKeys)};
  const defaultImageUrl = ${JSON.stringify(defaultImageUrl)};
  const categoriesPageUrl = ${JSON.stringify(categoriesPageUrl)};
  const initialPartnerId = ${targetPartnerId ? JSON.stringify(targetPartnerId) : "null"};
  const container = document.getElementById(${JSON.stringify(containerId)});
  if (!container) return;

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readStoredPartner() {
    try {
      if (!window.sessionStorage) return null;
      const stored = sessionStorage.getItem(storageKeys.partner);
      if (!stored) return null;
      return stored;
    } catch (error) {
      console.warn("Unable to read stored partner", error);
      return null;
    }
  }

  if (initialPartnerId) {
    try {
      if (window.sessionStorage) {
        sessionStorage.setItem(storageKeys.partner, initialPartnerId);
      }
    } catch (error) {
      console.warn("Unable to persist selected partner", error);
    }
  }

  function renderPartner(partner) {
    const chips = [];
    for (const slug of partner.categories) {
      const category = categories.find((entry) => entry.slug === slug || entry.id === slug);
      if (category) {
        chips.push('<span class="zabava-sd-chip">' + htmlEscape(category.name) + '</span>');
      }
    }
    if (partner.ageMin !== null || partner.ageMax !== null) {
      const label = 'Ages ' + [
        partner.ageMin !== null ? partner.ageMin : 'Any',
        partner.ageMax !== null ? partner.ageMax : 'Any'
      ].join(' – ');
      chips.push('<span class="zabava-sd-chip">' + htmlEscape(label) + '</span>');
    }

    const galleryImages = (partner.gallery || [])
      .map((item) => '<img src="' + htmlEscape(item.imageUrl) + '" alt="' + htmlEscape(item.caption || partner.name) + '"/>')
      .join('');

    const highlights = (partner.highlights || [])
      .map((highlight) => [
        '<article class="zabava-sd-highlight">',
          '<h4>' + htmlEscape(highlight.title) + '</h4>',
          highlight.description ? '<p>' + htmlEscape(highlight.description) + '</p>' : '',
        '</article>'
      ].join(''))
      .join('');

    const heroUrl = partner.heroImageUrl || defaultImageUrl;
    const primaryLabel = (partner.ctaPrimaryLabel || "").trim() || "Generate QR";
    const secondaryLabel = (partner.ctaSecondaryLabel || "").trim() || "More details";
    const primaryLink = partner.ctaPrimaryUrl || partner.formUrl;

    container.innerHTML = [
      categoriesPageUrl ? '<a style="color:#2563eb;font-weight:600;text-decoration:none;" href="' + htmlEscape(categoriesPageUrl) + '">← Back to categories</a>' : '',
      '<header class="zabava-sd-header">',
        heroUrl
          ? '<figure class="zabava-sd-hero"><img src="' + htmlEscape(heroUrl) + '" alt="' + htmlEscape(partner.name) + ' hero image"/></figure>'
          : '',
        '<div>',
          '<h1 class="zabava-sd-title">' + htmlEscape(partner.title) + '</h1>',
          partner.subtitle ? '<p class="zabava-sd-subtitle">' + htmlEscape(partner.subtitle) + '</p>' : '',
          chips.length ? '<div class="zabava-sd-chipline">' + chips.join('') + '</div>' : '',
        '</div>',
      '</header>',
      '<section class="zabava-sd-actions">',
        primaryLink
          ? '<button class="zabava-sd-btn primary" data-action="form">' + htmlEscape(primaryLabel) + '</button>'
          : '',
        partner.ctaSecondaryUrl
          ? '<a class="zabava-sd-btn secondary" data-action="secondary" href="' + htmlEscape(partner.ctaSecondaryUrl) + '" target="_blank" rel="noopener">' + htmlEscape(secondaryLabel) + '</a>'
          : '',
      '</section>',
      '<section class="zabava-sd-body">',
        '<article>',
          partner.description ? '<div class="zabava-sd-description">' + htmlEscape(partner.description) + '</div>' : '',
          highlights ? '<div class="zabava-sd-highlights">' + highlights + '</div>' : '',
        '</article>',
        galleryImages
          ? '<aside><div class="zabava-sd-gallery">' + galleryImages + '</div></aside>'
          : '',
      '</section>',
    ].join('');

    const primaryButton = container.querySelector('[data-action="form"]');
    if (primaryButton && primaryLink) {
      primaryButton.addEventListener('click', () => {
        try {
          if (window.sessionStorage) {
            sessionStorage.setItem(storageKeys.partner, partner.partnerId);
          }
        } catch (error) {
          console.warn("Unable to store partner selection", error);
        }
        window.open(primaryLink, '_blank', 'noopener');
      });
    }
  }

  const storedPartner = readStoredPartner();
  const preferredPartnerId = storedPartner || initialPartnerId;
  const fallback = partners[0];
  const partner =
    partners.find((entry) => entry.partnerId === preferredPartnerId) ??
    fallback;

  if (!partner) {
    container.innerHTML = '<div class="zabava-sd-empty">${escapeHtml(
      emptyMessage
    )}</div>';
    return;
  }

  renderPartner(partner);
})();
</script>`;
}
