type AbilityType = "PHYSICAL" | "MENTAL";
type View = "abilities" | "archetypes";

interface Ability {
  type: AbilityType;
  name: string;
  description: string;
  tags: string[];
}

interface Archetype {
  name: string;
  positions: string[];
  abilities: string[];
}

let abilities: Ability[] = [];
let archetypes: Archetype[] = [];
let abilityByName = new Map<string, Ability>();

let activeType: AbilityType | null = null;
let activeTag: string | null = null;
let activePosition: string | null = null;
let expandedAbilities = new Set<string>();

const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
const abilitiesView = document.getElementById("abilities-view") as HTMLElement;
const archetypesView = document.getElementById("archetypes-view") as HTMLElement;

const abilitySearchInput = document.getElementById("ability-search") as HTMLInputElement;
const typeFiltersEl = document.getElementById("type-filters") as HTMLDivElement;
const tagFiltersEl = document.getElementById("tag-filters") as HTMLDivElement;
const abilityListEl = document.getElementById("ability-list") as HTMLDivElement;
const abilityCountEl = document.getElementById("ability-results-count") as HTMLDivElement;

const archetypeSearchInput = document.getElementById("archetype-search") as HTMLInputElement;
const positionFiltersEl = document.getElementById("position-filters") as HTMLDivElement;
const archetypeListEl = document.getElementById("archetype-list") as HTMLDivElement;
const archetypeCountEl = document.getElementById("archetype-results-count") as HTMLDivElement;

Promise.all([
  fetch("data/abilities.json").then((res) => res.json() as Promise<Ability[]>),
  fetch("data/archetypes.json").then((res) => res.json() as Promise<Archetype[]>),
]).then(([abilitiesData, archetypesData]) => {
  abilities = abilitiesData;
  archetypes = archetypesData;
  abilityByName = new Map(abilities.map((a) => [a.name, a]));

  renderTypeFilters();
  renderTagFilters();
  renderAbilities();

  renderPositionFilters();
  renderArchetypes();
});

function switchView(view: View): void {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  abilitiesView.classList.toggle("hidden", view !== "abilities");
  archetypesView.classList.toggle("hidden", view !== "archetypes");
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    switchView(btn.dataset.view as View);
  });
});

// --- Abilities view ---

function renderTypeFilters(): void {
  const types = [...new Set(abilities.map((a) => a.type))];
  typeFiltersEl.innerHTML = "";
  types.forEach((type) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = type;
    chip.addEventListener("click", () => {
      activeType = activeType === type ? null : type;
      renderTypeFilters();
      renderTagFilters();
      renderAbilities();
    });
    if (activeType === type) chip.classList.add("active");
    typeFiltersEl.appendChild(chip);
  });
}

function renderTagFilters(): void {
  const pool = activeType ? abilities.filter((a) => a.type === activeType) : abilities;
  const tags = [...new Set(pool.flatMap((a) => a.tags || []))].sort();

  if (activeTag && !tags.includes(activeTag)) activeTag = null;

  tagFiltersEl.innerHTML = "";
  tags.forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      activeTag = activeTag === tag ? null : tag;
      renderTagFilters();
      renderAbilities();
    });
    if (activeTag === tag) chip.classList.add("active");
    tagFiltersEl.appendChild(chip);
  });
}

function renderAbilities(): void {
  const query = abilitySearchInput.value.trim().toLowerCase();

  const filtered = abilities.filter((a) => {
    if (activeType && a.type !== activeType) return false;
    if (activeTag && !(a.tags || []).includes(activeTag)) return false;
    if (query) {
      const haystack = `${a.name} ${a.description}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  abilityCountEl.textContent = `${filtered.length} of ${abilities.length} abilities`;

  if (filtered.length === 0) {
    abilityListEl.innerHTML = `<div class="empty-state">No abilities match your search.</div>`;
    return;
  }

  abilityListEl.innerHTML = filtered
    .map(
      (a) => `
    <div class="ability-card">
      <div class="ability-card-top">
        <div class="ability-name">${escapeHtml(a.name)}</div>
        <div class="type-badge ${a.type}">${a.type}</div>
      </div>
      <p class="ability-desc">${escapeHtml(a.description)}</p>
      <div class="tag-row">
        ${(a.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
      </div>
    </div>
  `
    )
    .join("");
}

abilitySearchInput.addEventListener("input", renderAbilities);

// --- Archetypes view ---

function renderPositionFilters(): void {
  const positions = [...new Set(archetypes.flatMap((a) => a.positions))];
  positionFiltersEl.innerHTML = "";
  positions.forEach((position) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = position;
    chip.addEventListener("click", () => {
      activePosition = activePosition === position ? null : position;
      renderPositionFilters();
      renderArchetypes();
    });
    if (activePosition === position) chip.classList.add("active");
    positionFiltersEl.appendChild(chip);
  });
}

function renderArchetypes(): void {
  const query = archetypeSearchInput.value.trim().toLowerCase();

  const filtered = archetypes.filter((a) => {
    if (activePosition && !a.positions.includes(activePosition)) return false;
    if (query) {
      const haystack = `${a.name} ${a.positions.join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  archetypeCountEl.textContent = `${filtered.length} of ${archetypes.length} archetypes`;

  if (filtered.length === 0) {
    archetypeListEl.innerHTML = `<div class="empty-state">No archetypes match your search.</div>`;
    return;
  }

  archetypeListEl.innerHTML = filtered
    .map(
      (a, i) => `
    <div class="archetype-card">
      <div class="archetype-card-top">
        <div class="archetype-name">${escapeHtml(a.name)}</div>
        <div class="position-row">
          ${a.positions.map((p) => `<span class="position-badge">${escapeHtml(p)}</span>`).join("")}
        </div>
      </div>
      <div class="archetype-abilities">
        ${a.abilities.map((abilityName) => renderAbilityChip(a.name, i, abilityName)).join("")}
      </div>
    </div>
  `
    )
    .join("");

  archetypeListEl.querySelectorAll<HTMLButtonElement>(".ability-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const key = chip.dataset.key as string;
      if (expandedAbilities.has(key)) {
        expandedAbilities.delete(key);
      } else {
        expandedAbilities.add(key);
      }
      renderArchetypes();
    });
  });
}

function renderAbilityChip(archetypeName: string, index: number, abilityName: string): string {
  const key = `${archetypeName}-${index}-${abilityName}`;
  const ability = abilityByName.get(abilityName);
  const expanded = expandedAbilities.has(key);

  let html = `<button class="ability-chip" data-key="${escapeHtml(key)}">${escapeHtml(abilityName)}</button>`;
  if (expanded && ability) {
    html += `<div class="ability-chip-desc">${escapeHtml(ability.description)}</div>`;
  } else if (expanded) {
    html += `<div class="ability-chip-desc">No matching ability found in abilities.json.</div>`;
  }
  return html;
}

archetypeSearchInput.addEventListener("input", renderArchetypes);

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
