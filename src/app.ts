type AbilityType = "PHYSICAL" | "MENTAL";
type Side = "OFFENSE" | "DEFENSE";
type View = "abilities" | "archetypes" | "schemes";
type ThemeMode = "auto" | "light" | "dark";

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
  side: Side;
  tags: string[];
}

const SCHEME_INTENTS: SchemeIntent[] = [
  { label: "Air it out", side: "OFFENSE", tags: ["pass-heavy"] },
  { label: "Balanced, do-everything", side: "OFFENSE", tags: ["balanced", "flexible"] },
  { label: "Go fast (tempo)", side: "OFFENSE", tags: ["tempo"] },
  { label: "Pound the ball", side: "OFFENSE", tags: ["run-heavy", "power"] },
  { label: "Run the option", side: "OFFENSE", tags: ["option"] },
  { label: "Spread it out", side: "OFFENSE", tags: ["spread-formation"] },
  { label: "Get after the passer", side: "DEFENSE", tags: ["pass-rush"] },
  { label: "Lock down the pass", side: "DEFENSE", tags: ["coverage-heavy"] },
  { label: "Match up vs. spread", side: "DEFENSE", tags: ["nickel-heavy"] },
  { label: "Stop the run", side: "DEFENSE", tags: ["run-stopping"] },
];

const THEME_ICONS: Record<ThemeMode, string> = { auto: "◐", light: "☀", dark: "☾" };
const THEME_ORDER: ThemeMode[] = ["auto", "light", "dark"];

// Position/tag groupings used to split filter chips into OFFENSE / DEFENSE / (SPECIAL TEAMS | GENERAL) sections.
const OFFENSE_POSITIONS = new Set(["QB", "RB", "FB", "WR", "TE", "OT", "OG", "C"]);
const DEFENSE_POSITIONS = new Set(["LEDGE", "DT", "REDGE", "SAM", "MIKE", "WILL", "CB", "FS", "SS"]);

type PositionGroup = "OFFENSE" | "DEFENSE" | "SPECIAL TEAMS";

function positionGroup(position: string): PositionGroup {
  if (OFFENSE_POSITIONS.has(position)) return "OFFENSE";
  if (DEFENSE_POSITIONS.has(position)) return "DEFENSE";
  return "SPECIAL TEAMS";
}

const OFFENSE_TAGS = new Set(["PASSING", "RUSHING", "RECEIVING", "BLOCKING"]);
const DEFENSE_TAGS = new Set(["DEFENSE", "COVERAGE", "TACKLING"]);

type TagGroup = "OFFENSE" | "DEFENSE" | "GENERAL";

function tagGroup(tag: string): TagGroup {
  if (OFFENSE_TAGS.has(tag)) return "OFFENSE";
  if (DEFENSE_TAGS.has(tag)) return "DEFENSE";
  return "GENERAL";
}

const STORAGE_KEY = "cfb-companion-state-v1";

interface PersistedState {
  view: View;
  theme: ThemeMode;
  abilities: { type: AbilityType | null; tag: string | null; search: string };
  archetypes: { position: string | null; search: string };
  schemes: { intentLabel: string | null; search: string };
}

function loadPersisted(): PersistedState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

let abilities: Ability[] = [];
let archetypes: Archetype[] = [];
let schemes: Scheme[] = [];
let abilityByName = new Map<string, Ability>();
let archetypesByName = new Map<string, Archetype[]>();
let archetypeUsage = new Map<Archetype, Set<string>>();
let abilityUsage = new Map<Ability, Set<string>>();

let currentView: View = "abilities";
let themeMode: ThemeMode = "auto";

let activeType: AbilityType | null = null;
let activeTag: string | null = null;
let activePosition: string | null = null;
let expandedAbilities = new Set<string>();

let activeIntent: SchemeIntent | null = null;
let expandedSchemeArchetypes = new Set<string>();
let expandedSlots = new Set<string>();

const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
const themeToggleBtn = document.getElementById("theme-toggle") as HTMLButtonElement;
const abilitiesView = document.getElementById("abilities-view") as HTMLElement;
const archetypesView = document.getElementById("archetypes-view") as HTMLElement;
const schemesView = document.getElementById("schemes-view") as HTMLElement;

const abilitySearchInput = document.getElementById("ability-search") as HTMLInputElement;
const abilitySearchClear = document.getElementById("ability-search-clear") as HTMLButtonElement;
const abilityClearFilters = document.getElementById("ability-clear-filters") as HTMLButtonElement;
const typeFiltersEl = document.getElementById("type-filters") as HTMLDivElement;
const tagFiltersOffenseEl = document.getElementById("tag-filters-offense") as HTMLDivElement;
const tagFiltersDefenseEl = document.getElementById("tag-filters-defense") as HTMLDivElement;
const tagFiltersGeneralEl = document.getElementById("tag-filters-general") as HTMLDivElement;
const abilityListEl = document.getElementById("ability-list") as HTMLDivElement;
const abilityCountEl = document.getElementById("ability-results-count") as HTMLDivElement;

const archetypeSearchInput = document.getElementById("archetype-search") as HTMLInputElement;
const archetypeSearchClear = document.getElementById("archetype-search-clear") as HTMLButtonElement;
const archetypeClearFilters = document.getElementById("archetype-clear-filters") as HTMLButtonElement;
const positionFiltersOffenseEl = document.getElementById("position-filters-offense") as HTMLDivElement;
const positionFiltersDefenseEl = document.getElementById("position-filters-defense") as HTMLDivElement;
const positionFiltersSpecialEl = document.getElementById("position-filters-special") as HTMLDivElement;
const archetypeListEl = document.getElementById("archetype-list") as HTMLDivElement;
const archetypeCountEl = document.getElementById("archetype-results-count") as HTMLDivElement;

const schemeSearchInput = document.getElementById("scheme-search") as HTMLInputElement;
const schemeSearchClear = document.getElementById("scheme-search-clear") as HTMLButtonElement;
const schemeClearFilters = document.getElementById("scheme-clear-filters") as HTMLButtonElement;
const intentFiltersOffenseEl = document.getElementById("intent-filters-offense") as HTMLDivElement;
const intentFiltersDefenseEl = document.getElementById("intent-filters-defense") as HTMLDivElement;
const schemeListEl = document.getElementById("scheme-list") as HTMLDivElement;
const schemeCountEl = document.getElementById("scheme-results-count") as HTMLDivElement;

// Apply persisted theme immediately, before data loads, to avoid a flash of the wrong theme.
(function initTheme() {
  const persisted = loadPersisted();
  themeMode = persisted?.theme ?? "auto";
  applyTheme();
})();

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

  archetypeUsage = new Map();
  schemes.forEach((s) => {
    s.slots.forEach((slot) => {
      slot.archetypes.forEach((ref) => {
        const name = archetypeRefName(ref);
        const lookupPosition = typeof ref === "string" ? slot.position : ref.fromPosition ?? slot.position;
        const archetype = resolveArchetype(name, lookupPosition);
        if (!archetype) return;
        const set = archetypeUsage.get(archetype) ?? new Set<string>();
        set.add(s.name);
        archetypeUsage.set(archetype, set);
      });
    });
  });

  abilityUsage = new Map();
  archetypes.forEach((arc) => {
    arc.abilities.forEach((abilityName) => {
      const ability = abilityByName.get(abilityName);
      if (!ability) return;
      const set = abilityUsage.get(ability) ?? new Set<string>();
      set.add(arc.name);
      abilityUsage.set(ability, set);
    });
  });

  restoreState();
  renderAll();
  switchView(currentView, false);
});

// Single dispatcher for "state changed, re-render everything." Simpler and safer
// than hand-picking which render functions a given change affects — every view's
// data set is small, so re-rendering all three on any change is imperceptible.
function renderAll(): void {
  renderTypeFilters();
  renderTagFilters();
  renderAbilities();

  renderPositionFilters();
  renderArchetypes();

  renderIntentFilters();
  renderSchemes();
}

function switchView(view: View, focusInput: boolean = true): void {
  currentView = view;
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  abilitiesView.classList.toggle("hidden", view !== "abilities");
  archetypesView.classList.toggle("hidden", view !== "archetypes");
  schemesView.classList.toggle("hidden", view !== "schemes");

  if (focusInput) {
    const inputByView: Record<View, HTMLInputElement> = {
      abilities: abilitySearchInput,
      archetypes: archetypeSearchInput,
      schemes: schemeSearchInput,
    };
    inputByView[view].focus({ preventScroll: true });
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    switchView(btn.dataset.view as View);
    saveState();
  });
});

// --- Theme ---

function applyTheme(): void {
  if (themeMode === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", themeMode);
  }
  if (themeToggleBtn) {
    themeToggleBtn.textContent = THEME_ICONS[themeMode];
    themeToggleBtn.setAttribute("aria-label", `Theme: ${themeMode}. Tap to change.`);
  }
}

themeToggleBtn.addEventListener("click", () => {
  const nextIndex = (THEME_ORDER.indexOf(themeMode) + 1) % THEME_ORDER.length;
  themeMode = THEME_ORDER[nextIndex];
  applyTheme();
  saveState();
});

// --- Persistence ---

function saveState(): void {
  const state: PersistedState = {
    view: currentView,
    theme: themeMode,
    abilities: { type: activeType, tag: activeTag, search: abilitySearchInput.value },
    archetypes: { position: activePosition, search: archetypeSearchInput.value },
    schemes: {
      intentLabel: activeIntent ? activeIntent.label : null,
      search: schemeSearchInput.value,
    },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors (private browsing, quota, etc.)
  }
}

function restoreState(): void {
  const state = loadPersisted();
  if (!state) return;

  currentView = state.view ?? "abilities";

  activeType = state.abilities?.type ?? null;
  activeTag = state.abilities?.tag ?? null;
  abilitySearchInput.value = state.abilities?.search ?? "";

  activePosition = state.archetypes?.position ?? null;
  archetypeSearchInput.value = state.archetypes?.search ?? "";

  activeIntent = SCHEME_INTENTS.find((i) => i.label === state.schemes?.intentLabel) ?? null;
  schemeSearchInput.value = state.schemes?.search ?? "";
}

// --- Abilities view ---

function renderTypeFilters(): void {
  const types = [...new Set(abilities.map((a) => a.type))].sort();
  typeFiltersEl.innerHTML = "";
  types.forEach((type) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = type;
    chip.addEventListener("click", () => {
      activeType = activeType === type ? null : type;
      renderAll();
      saveState();
    });
    if (activeType === type) chip.classList.add("active");
    typeFiltersEl.appendChild(chip);
  });
}

function renderTagFilterGroup(container: HTMLDivElement, tags: string[]): void {
  container.innerHTML = "";
  tags.forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      activeTag = activeTag === tag ? null : tag;
      renderAll();
      saveState();
    });
    if (activeTag === tag) chip.classList.add("active");
    container.appendChild(chip);
  });
}

function renderTagFilters(): void {
  const pool = activeType ? abilities.filter((a) => a.type === activeType) : abilities;
  const allTags = [...new Set(pool.flatMap((a) => a.tags || []))];

  if (activeTag && !allTags.includes(activeTag)) activeTag = null;

  const offenseTags = allTags.filter((t) => tagGroup(t) === "OFFENSE").sort();
  const defenseTags = allTags.filter((t) => tagGroup(t) === "DEFENSE").sort();
  const generalTags = allTags.filter((t) => tagGroup(t) === "GENERAL").sort();

  renderTagFilterGroup(tagFiltersOffenseEl, offenseTags);
  renderTagFilterGroup(tagFiltersDefenseEl, defenseTags);
  renderTagFilterGroup(tagFiltersGeneralEl, generalTags);
}

function groupKeyForAbility(a: Ability): string {
  return a.tags && a.tags.length > 0 ? a.tags[0] : a.type;
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

  filtered.sort((a, b) => {
    const groupCompare = groupKeyForAbility(a).localeCompare(groupKeyForAbility(b));
    return groupCompare !== 0 ? groupCompare : a.name.localeCompare(b.name);
  });

  let lastGroup: string | null = null;

  abilityListEl.innerHTML = filtered
    .map((a) => {
      const group = groupKeyForAbility(a);
      const header = group !== lastGroup ? `<div class="section-header">${escapeHtml(group)}</div>` : "";
      lastGroup = group;

      const usedBy = [...(abilityUsage.get(a) ?? [])];

      return `
    ${header}
    <div class="ability-card">
      <div class="ability-card-top">
        <div class="ability-name">${highlightMatch(a.name, query)}</div>
        <div class="type-badge ${a.type}">${a.type}</div>
      </div>
      <p class="ability-desc">${highlightMatch(a.description, query)}</p>
      <div class="tag-row">
        ${(a.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
      </div>
      ${
        usedBy.length > 0
          ? `<div class="used-in-row">
              <span class="used-in-label">Used by:</span>
              ${usedBy.map((archetypeName) => `<button class="used-in-chip" data-archetype="${escapeHtml(archetypeName)}">${escapeHtml(archetypeName)}</button>`).join("")}
            </div>`
          : ""
      }
    </div>
  `;
    })
    .join("");

  abilityListEl.querySelectorAll<HTMLButtonElement>(".used-in-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const archetypeName = chip.dataset.archetype as string;
      activePosition = null;
      archetypeSearchInput.value = archetypeName;
      switchView("archetypes", false);
      renderAll();
      saveState();
    });
  });
}

abilitySearchInput.addEventListener("input", () => {
  renderAll();
  saveState();
});

abilitySearchClear.addEventListener("click", () => {
  abilitySearchInput.value = "";
  renderAll();
  saveState();
});

abilityClearFilters.addEventListener("click", () => {
  activeType = null;
  activeTag = null;
  abilitySearchInput.value = "";
  renderAll();
  saveState();
});

// --- Archetypes view ---

function renderPositionFilterGroup(container: HTMLDivElement, positions: string[]): void {
  container.innerHTML = "";
  positions.forEach((position) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = position;
    chip.addEventListener("click", () => {
      activePosition = activePosition === position ? null : position;
      renderAll();
      saveState();
    });
    if (activePosition === position) chip.classList.add("active");
    container.appendChild(chip);
  });
}

function renderPositionFilters(): void {
  const allPositions = [...new Set(archetypes.flatMap((a) => a.positions))];

  const offensePositions = allPositions.filter((p) => positionGroup(p) === "OFFENSE").sort();
  const defensePositions = allPositions.filter((p) => positionGroup(p) === "DEFENSE").sort();
  const specialPositions = allPositions.filter((p) => positionGroup(p) === "SPECIAL TEAMS").sort();

  renderPositionFilterGroup(positionFiltersOffenseEl, offensePositions);
  renderPositionFilterGroup(positionFiltersDefenseEl, defensePositions);
  renderPositionFilterGroup(positionFiltersSpecialEl, specialPositions);
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

  filtered.sort((a, b) => {
    const groupCompare = a.positions[0].localeCompare(b.positions[0]);
    return groupCompare !== 0 ? groupCompare : a.name.localeCompare(b.name);
  });

  let lastGroup: string | null = null;

  archetypeListEl.innerHTML = filtered
    .map((a, i) => {
      const group = a.positions[0];
      const header = group !== lastGroup ? `<div class="section-header">${escapeHtml(group)}</div>` : "";
      lastGroup = group;

      const usedIn = [...(archetypeUsage.get(a) ?? [])];
      return `
    ${header}
    <div class="archetype-card">
      <div class="archetype-card-top">
        <div class="archetype-name">${highlightMatch(a.name, query)}</div>
        <div class="position-row">
          ${a.positions.map((p) => `<span class="position-badge">${escapeHtml(p)}</span>`).join("")}
        </div>
      </div>
      <div class="archetype-abilities">
        ${a.abilities.map((abilityName) => renderAbilityChip(a.name, i, abilityName)).join("")}
      </div>
      ${
        usedIn.length > 0
          ? `<div class="used-in-row">
              <span class="used-in-label">Used in:</span>
              ${usedIn.map((schemeName) => `<button class="used-in-chip" data-scheme="${escapeHtml(schemeName)}">${escapeHtml(schemeName)}</button>`).join("")}
            </div>`
          : ""
      }
    </div>
  `;
    })
    .join("");

  archetypeListEl.querySelectorAll<HTMLButtonElement>(".ability-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const key = chip.dataset.key as string;
      if (expandedAbilities.has(key)) {
        expandedAbilities.delete(key);
      } else {
        expandedAbilities.add(key);
      }
      renderAll();
    });
  });

  archetypeListEl.querySelectorAll<HTMLButtonElement>(".used-in-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const schemeName = chip.dataset.scheme as string;
      activeIntent = null;
      schemeSearchInput.value = schemeName;
      switchView("schemes", false);
      renderAll();
      saveState();
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

archetypeSearchInput.addEventListener("input", () => {
  renderAll();
  saveState();
});

archetypeSearchClear.addEventListener("click", () => {
  archetypeSearchInput.value = "";
  renderAll();
  saveState();
});

archetypeClearFilters.addEventListener("click", () => {
  activePosition = null;
  archetypeSearchInput.value = "";
  renderAll();
  saveState();
});

// --- Schemes view ---

function renderIntentFilterGroup(container: HTMLDivElement, intents: SchemeIntent[]): void {
  container.innerHTML = "";
  intents.forEach((intent) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = intent.label;
    chip.addEventListener("click", () => {
      activeIntent = activeIntent === intent ? null : intent;
      renderAll();
      saveState();
    });
    if (activeIntent === intent) chip.classList.add("active");
    container.appendChild(chip);
  });
}

function renderIntentFilters(): void {
  renderIntentFilterGroup(
    intentFiltersOffenseEl,
    SCHEME_INTENTS.filter((i) => i.side === "OFFENSE")
  );
  renderIntentFilterGroup(
    intentFiltersDefenseEl,
    SCHEME_INTENTS.filter((i) => i.side === "DEFENSE")
  );
}

function renderSchemes(): void {
  const query = schemeSearchInput.value.trim().toLowerCase();

  const filtered = schemes.filter((s) => {
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

  const sideOrder: Record<Side, number> = { OFFENSE: 0, DEFENSE: 1 };
  filtered.sort((a, b) => {
    const sideCompare = sideOrder[a.side] - sideOrder[b.side];
    return sideCompare !== 0 ? sideCompare : a.name.localeCompare(b.name);
  });

  let lastSide: Side | null = null;

  schemeListEl.innerHTML = filtered
    .map((s, si) => {
      const header = s.side !== lastSide ? `<div class="section-header">${escapeHtml(s.side)}</div>` : "";
      lastSide = s.side;

      return `
    ${header}
    <div class="scheme-card">
      <div class="scheme-card-top">
        <div class="scheme-name">${highlightMatch(s.name, query)}</div>
        <div class="side-badge ${s.side}">${s.side}</div>
      </div>
      <p class="scheme-desc">${highlightMatch(s.description, query)}</p>
      ${s.slots.map((slot, sli) => renderSchemeSlot(s.name, si, sli, slot)).join("")}
    </div>`;
    })
    .join("");

  schemeListEl.querySelectorAll<HTMLButtonElement>(".archetype-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const key = chip.dataset.key as string;
      if (expandedSchemeArchetypes.has(key)) {
        expandedSchemeArchetypes.delete(key);
      } else {
        expandedSchemeArchetypes.add(key);
      }
      renderAll();
    });
  });

  schemeListEl.querySelectorAll<HTMLButtonElement>(".slot-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slotKey = btn.dataset.slotKey as string;
      if (expandedSlots.has(slotKey)) {
        expandedSlots.delete(slotKey);
      } else {
        expandedSlots.add(slotKey);
      }
      renderAll();
    });
  });
}

function renderSchemeSlot(schemeName: string, si: number, sli: number, slot: SchemeSlot): string {
  const slotKey = `${schemeName}-${si}-${sli}`;
  const expanded = expandedSlots.has(slotKey) || slot.archetypes.length <= 1;
  const visibleRefs = expanded ? slot.archetypes : slot.archetypes.slice(0, 1);

  const toggle =
    slot.archetypes.length > 1
      ? `<button class="slot-toggle" data-slot-key="${escapeHtml(slotKey)}">${
          expanded ? "Show less" : `+${slot.archetypes.length - 1} more`
        }</button>`
      : "";

  return `
    <div class="scheme-slot">
      <span class="position-badge">${escapeHtml(slot.position)}</span>
      <div class="scheme-slot-archetypes">
        ${visibleRefs.map((ref, ai) => renderSchemeArchetypeChip(schemeName, si, sli, slot.position, ai, ref)).join("")}
        ${toggle}
      </div>
    </div>`;
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

schemeSearchInput.addEventListener("input", () => {
  renderAll();
  saveState();
});

schemeSearchClear.addEventListener("click", () => {
  schemeSearchInput.value = "";
  renderAll();
  saveState();
});

schemeClearFilters.addEventListener("click", () => {
  activeIntent = null;
  schemeSearchInput.value = "";
  renderAll();
  saveState();
});

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

function highlightMatch(text: string, query: string): string {
  const escapedText = escapeHtml(text);
  if (!query) return escapedText;
  const escapedQuery = escapeHtml(query);
  const idx = escapedText.toLowerCase().indexOf(escapedQuery.toLowerCase());
  if (idx === -1) return escapedText;
  return (
    escapedText.slice(0, idx) +
    "<mark>" +
    escapedText.slice(idx, idx + escapedQuery.length) +
    "</mark>" +
    escapedText.slice(idx + escapedQuery.length)
  );
}
