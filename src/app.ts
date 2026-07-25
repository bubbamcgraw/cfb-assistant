type AbilityType = "PHYSICAL" | "MENTAL";
type Side = "OFFENSE" | "DEFENSE";
type View = "abilities" | "archetypes" | "schemes";

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

interface SchemeArchetypeNote {
  name: string;
  note: string;
  fromPosition?: string;
}

type SchemeArchetypeRef = string | SchemeArchetypeNote;

interface SchemeSlot {
  position: string;
  archetypes: SchemeArchetypeRef[];
}

interface Scheme {
  name: string;
  side: Side;
  description: string;
  tags: string[];
  slots: SchemeSlot[];
}

interface SchemeIntent {
  label: string;
  tags: string[];
}

const SCHEME_INTENTS: SchemeIntent[] = [
  { label: "Pound the ball", tags: ["run-heavy", "power"] },
  { label: "Air it out", tags: ["pass-heavy"] },
  { label: "Run the option", tags: ["option"] },
  { label: "Go fast (tempo)", tags: ["tempo"] },
  { label: "Balanced, do-everything", tags: ["balanced", "flexible"] },
  { label: "Spread it out", tags: ["spread-formation"] },
  { label: "Stop the run", tags: ["run-stopping"] },
  { label: "Get after the passer", tags: ["pass-rush"] },
  { label: "Lock down the pass", tags: ["coverage-heavy"] },
  { label: "Match up vs. spread", tags: ["nickel-heavy"] },
];

let abilities: Ability[] = [];
let archetypes: Archetype[] = [];
let schemes: Scheme[] = [];
let abilityByName = new Map<string, Ability>();
let archetypesByName = new Map<string, Archetype[]>();

let activeType: AbilityType | null = null;
let activeTag: string | null = null;
let activePosition: string | null = null;
let expandedAbilities = new Set<string>();

let activeSide: Side | null = null;
let activeSchemePosition: string | null = null;
let activeIntent: SchemeIntent | null = null;
let expandedSchemeArchetypes = new Set<string>();

const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
const abilitiesView = document.getElementById("abilities-view") as HTMLElement;
const archetypesView = document.getElementById("archetypes-view") as HTMLElement;
const schemesView = document.getElementById("schemes-view") as HTMLElement;

const abilitySearchInput = document.getElementById("ability-search") as HTMLInputElement;
const typeFiltersEl = document.getElementById("type-filters") as HTMLDivElement;
const tagFiltersEl = document.getElementById("tag-filters") as HTMLDivElement;
const abilityListEl = document.getElementById("ability-list") as HTMLDivElement;
const abilityCountEl = document.getElementById("ability-results-count") as HTMLDivElement;

const archetypeSearchInput = document.getElementById("archetype-search") as HTMLInputElement;
const positionFiltersEl = document.getElementById("position-filters") as HTMLDivElement;
const archetypeListEl = document.getElementById("archetype-list") as HTMLDivElement;
const archetypeCountEl = document.getElementById("archetype-results-count") as HTMLDivElement;

const schemeSearchInput = document.getElementById("scheme-search") as HTMLInputElement;
const intentFiltersEl = document.getElementById("intent-filters") as HTMLDivElement;
const sideFiltersEl = document.getElementById("side-filters") as HTMLDivElement;
const schemePositionFiltersEl = document.getElementById("scheme-position-filters") as HTMLDivElement;
const schemeListEl = document.getElementById("scheme-list") as HTMLDivElement;
const schemeCountEl = document.getElementById("scheme-results-count") as HTMLDivElement;

Promise.all([
  fetch("data/abilities.json").then((res) => res.json() as Promise<Ability[]>),
  fetch("data/archetypes.json").then((res) => res.json() as Promise<Archetype[]>),
  fetch("data/schemes.json").then((res) => res.json() as Promise<Scheme[]>),
]).then(([abilitiesData, archetypesData, schemesData]) => {
  abilities = abilitiesData;
  archetypes = archetypesData;
  schemes = schemesData;
  abilityByName = new Map(abilities.map((a) => [a.name, a]));

  archetypesByName = new Map();
  archetypes.forEach((a) => {
    const list = archetypesByName.get(a.name) ?? [];
    list.push(a);
    archetypesByName.set(a.name, list);
  });

  renderTypeFilters();
  renderTagFilters();
  renderAbilities();

  renderPositionFilters();
  renderArchetypes();

  renderIntentFilters();
  renderSideFilters();
  renderSchemePositionFilters();
  renderSchemes();
});

function switchView(view: View): void {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  abilitiesView.classList.toggle("hidden", view !== "abilities");
  archetypesView.classList.toggle("hidden", view !== "archetypes");
  schemesView.classList.toggle("hidden", view !== "schemes");
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

// --- Schemes view ---

function renderIntentFilters(): void {
  intentFiltersEl.innerHTML = "";
  SCHEME_INTENTS.forEach((intent) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = intent.label;
    chip.addEventListener("click", () => {
      activeIntent = activeIntent === intent ? null : intent;
      renderIntentFilters();
      renderSchemes();
    });
    if (activeIntent === intent) chip.classList.add("active");
    intentFiltersEl.appendChild(chip);
  });
}

function renderSideFilters(): void {
  const sides = [...new Set(schemes.map((s) => s.side))];
  sideFiltersEl.innerHTML = "";
  sides.forEach((side) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = side;
    chip.addEventListener("click", () => {
      activeSide = activeSide === side ? null : side;
      renderSideFilters();
      renderSchemePositionFilters();
      renderSchemes();
    });
    if (activeSide === side) chip.classList.add("active");
    sideFiltersEl.appendChild(chip);
  });
}

function renderSchemePositionFilters(): void {
  const pool = activeSide ? schemes.filter((s) => s.side === activeSide) : schemes;
  const positions = [...new Set(pool.flatMap((s) => s.slots.map((slot) => slot.position)))];

  if (activeSchemePosition && !positions.includes(activeSchemePosition)) activeSchemePosition = null;

  schemePositionFiltersEl.innerHTML = "";
  positions.forEach((position) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = position;
    chip.addEventListener("click", () => {
      activeSchemePosition = activeSchemePosition === position ? null : position;
      renderSchemePositionFilters();
      renderSchemes();
    });
    if (activeSchemePosition === position) chip.classList.add("active");
    schemePositionFiltersEl.appendChild(chip);
  });
}

function renderSchemes(): void {
  const query = schemeSearchInput.value.trim().toLowerCase();

  const filtered = schemes.filter((s) => {
    if (activeSide && s.side !== activeSide) return false;
    if (activeSchemePosition && !s.slots.some((slot) => slot.position === activeSchemePosition)) return false;
    if (activeIntent && !s.tags.some((tag) => activeIntent!.tags.includes(tag))) return false;
    if (query) {
      const names = s.slots.map((slot) => slot.archetypes.map(archetypeRefName).join(" ")).join(" ");
      const positions = s.slots.map((slot) => slot.position).join(" ");
      const haystack = `${s.name} ${s.description} ${s.tags.join(" ")} ${positions} ${names}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  schemeCountEl.textContent = `${filtered.length} of ${schemes.length} schemes`;

  if (filtered.length === 0) {
    schemeListEl.innerHTML = `<div class="empty-state">No schemes match your search.</div>`;
    return;
  }

  schemeListEl.innerHTML = filtered
    .map(
      (s, si) => `
    <div class="scheme-card">
      <div class="scheme-card-top">
        <div class="scheme-name">${escapeHtml(s.name)}</div>
        <div class="side-badge ${s.side}">${s.side}</div>
      </div>
      <p class="scheme-desc">${escapeHtml(s.description)}</p>
      ${s.slots
        .map(
          (slot, sli) => `
        <div class="scheme-slot">
          <span class="position-badge">${escapeHtml(slot.position)}</span>
          <div class="scheme-slot-archetypes">
            ${slot.archetypes
              .map((ref, ai) => renderSchemeArchetypeChip(s.name, si, sli, slot.position, ai, ref))
              .join("")}
          </div>
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  schemeListEl.querySelectorAll<HTMLButtonElement>(".archetype-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const key = chip.dataset.key as string;
      if (expandedSchemeArchetypes.has(key)) {
        expandedSchemeArchetypes.delete(key);
      } else {
        expandedSchemeArchetypes.add(key);
      }
      renderSchemes();
    });
  });
}

function archetypeRefName(ref: SchemeArchetypeRef): string {
  return typeof ref === "string" ? ref : ref.name;
}

function resolveArchetype(name: string, position: string): Archetype | undefined {
  const candidates = archetypesByName.get(name);
  if (!candidates || candidates.length === 0) return undefined;
  return candidates.find((a) => a.positions.includes(position)) ?? candidates[0];
}

function renderSchemeArchetypeChip(schemeName: string, si: number, sli: number, slotPosition: string, ai: number, ref: SchemeArchetypeRef): string {
  const name = archetypeRefName(ref);
  const note = typeof ref === "string" ? null : ref.note;
  const lookupPosition = typeof ref === "string" ? slotPosition : ref.fromPosition ?? slotPosition;
  const key = `${schemeName}-${si}-${sli}-${ai}-${name}`;
  const archetype = resolveArchetype(name, lookupPosition);
  const expanded = expandedSchemeArchetypes.has(key);

  let html = `<button class="archetype-chip" data-key="${escapeHtml(key)}">${ai + 1}. ${escapeHtml(name)}`;
  if (note) {
    html += ` <span class="flex-tag">flex</span>`;
  }
  html += `</button>`;
  if (note) {
    html += `<div class="flex-note">${escapeHtml(note)}</div>`;
  }
  if (expanded && archetype) {
    html += `<div class="archetype-chip-desc">${archetype.abilities.map(escapeHtml).join(", ")}</div>`;
  } else if (expanded) {
    html += `<div class="archetype-chip-desc">No matching archetype found in archetypes.json.</div>`;
  }
  return html;
}

schemeSearchInput.addEventListener("input", renderSchemes);

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
