import { allCategories, type DocumentCategory } from "@/lib/document-category";

/**
 * "ALL"/"0"/"" style sentinels (and empty arrays for multi-select fields)
 * mark "no filter"; everything else is a plain form value.
 */
export type FiltersState = {
  query: string;

  // Document
  category: DocumentCategory[];
  documentType: string;
  /** Catalog keys (lib/document-types.ts), scoped by selected category in the UI */
  documentTypes: string[];
  folderName: string[];
  modifiedFrom: string;
  modifiedTo: string;
  modifiedMode: "interval" | "untilToday";

  // Identité & état civil
  genre: "ALL" | "H" | "F";
  matricule: string;
  nom: string;
  prenom: string;
  cin: string;
  ageRange: string;
  minChildren: string;
  /** Multi-select: e.g. ["2","3"] = "exactly 2 or 3 children" */
  childrenExact: string[];
  hasSpouseDocument: "ALL" | "OUI" | "NON";
  /** Enfant prénom parsed from filename (e.g. "..._Enfant_Sara...") */
  childName: string;

  // Poste & organisation
  direction: string[];
  service: string[];
  entite: string[];
  sousEntite: string[];
  zone: string[];
  agence: string[];
  poste: string;
  statut: string[];
  college: string[];
  admTech: string[];
  position: string[];
  encadrant: "ALL" | "OUI" | "NON";
  categorieRh: string[];
  niveau: string[];
  grade: string[];
  managerMatricule: string;

  // Ancienneté & dates
  situation: string[];
  ancienneteRange: string;
  dateEntreeFrom: string;
  dateEntreeTo: string;
  /** interval = depuis/jusqu'à ; untilToday = à partir de … jusqu'à aujourd'hui */
  dateEntreeMode: "interval" | "untilToday";
  dateDepartFrom: string;
  dateDepartTo: string;
  dateDepartMode: "interval" | "untilToday";
};

/** Keys whose value is a multi-select array (as opposed to a scalar sentinel string). */
const MULTI_KEYS: (keyof FiltersState)[] = [
  "category",
  "documentTypes",
  "folderName",
  "childrenExact",
  "direction",
  "service",
  "entite",
  "sousEntite",
  "zone",
  "agence",
  "statut",
  "college",
  "admTech",
  "position",
  "categorieRh",
  "niveau",
  "grade",
  "situation",
];

export const initialFiltersState: FiltersState = {
  query: "",
  category: [],
  documentType: "",
  documentTypes: [],
  folderName: [],
  modifiedFrom: "",
  modifiedTo: "",
  modifiedMode: "interval",
  genre: "ALL",
  matricule: "",
  nom: "",
  prenom: "",
  cin: "",
  ageRange: "ALL",
  minChildren: "0",
  childrenExact: [],
  hasSpouseDocument: "ALL",
  childName: "",
  direction: [],
  service: [],
  entite: [],
  sousEntite: [],
  zone: [],
  agence: [],
  poste: "",
  statut: [],
  college: [],
  admTech: [],
  position: [],
  encadrant: "ALL",
  categorieRh: [],
  niveau: [],
  grade: [],
  managerMatricule: "",
  situation: [],
  ancienneteRange: "ALL",
  dateEntreeFrom: "",
  dateEntreeTo: "",
  dateEntreeMode: "interval",
  dateDepartFrom: "",
  dateDepartTo: "",
  dateDepartMode: "interval",
};

export type FiltersAction =
  | { type: "patch"; payload: Partial<FiltersState> }
  | { type: "replace"; payload: FiltersState }
  | { type: "reset" };

export function filtersReducer(state: FiltersState, action: FiltersAction): FiltersState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.payload };
    case "replace":
      return { ...initialFiltersState, ...action.payload };
    case "reset":
      return initialFiltersState;
  }
}

function isDefaultValue(state: FiltersState, key: keyof FiltersState): boolean {
  if (MULTI_KEYS.includes(key)) {
    return (state[key] as unknown[]).length === 0;
  }
  return state[key] === initialFiltersState[key];
}

/** Modes de date : ne comptent pas comme critère tant que les dates ne sont pas remplies. */
const DATE_MODE_KEYS = new Set<keyof FiltersState>([
  "dateEntreeMode",
  "dateDepartMode",
  "modifiedMode",
]);

/** True when a single field has a non-default value — drives the active-filters chip bar. */
export function isFieldActive(state: FiltersState, key: keyof FiltersState): boolean {
  if (DATE_MODE_KEYS.has(key)) return false;
  return !isDefaultValue(state, key);
}

export function hasActiveCriteria(state: FiltersState): boolean {
  return (Object.keys(initialFiltersState) as (keyof FiltersState)[]).some(
    (key) => !DATE_MODE_KEYS.has(key) && !isDefaultValue(state, key),
  );
}

/** Count non-default fields among the given keys — drives the group badge count. */
export function countActive(state: FiltersState, keys: (keyof FiltersState)[]): number {
  return keys.filter((key) => !isDefaultValue(state, key)).length;
}

function parseRange(encoded: string): [string | undefined, string | undefined] {
  if (encoded === "ALL") return [undefined, undefined];
  const [min, max] = encoded.split("-");
  return [min || undefined, max || undefined];
}

export function buildSearchParams(state: FiltersState): URLSearchParams {
  const params = new URLSearchParams();

  const trimmedQuery = state.query.trim();
  if (trimmedQuery) params.set("query", trimmedQuery);
  for (const category of state.category) params.append("category", category);
  if (state.documentType.trim()) params.set("documentType", state.documentType.trim());
  for (const type of state.documentTypes) params.append("documentTypes", type);
  for (const folder of state.folderName) params.append("folderName", folder);

  if (state.genre !== "ALL") params.set("genre", state.genre);
  if (state.matricule.trim()) params.set("matricule", state.matricule.trim());
  if (state.nom.trim()) params.set("nom", state.nom.trim());
  if (state.prenom.trim()) params.set("prenom", state.prenom.trim());
  if (state.cin.trim()) params.set("cin", state.cin.trim());
  if (state.childName.trim()) params.set("childName", state.childName.trim());
  const [minAge, maxAge] = parseRange(state.ageRange);
  if (minAge) params.set("minAge", minAge);
  if (maxAge) params.set("maxAge", maxAge);
  if (Number(state.minChildren) > 0) params.set("minChildren", state.minChildren);
  for (const exact of state.childrenExact) params.append("childrenExact", exact);
  if (state.hasSpouseDocument !== "ALL") {
    params.set("hasSpouseDocument", state.hasSpouseDocument === "OUI" ? "true" : "false");
  }

  const multiEqualityFields: (keyof FiltersState)[] = [
    "direction",
    "service",
    "entite",
    "sousEntite",
    "zone",
    "agence",
    "statut",
    "college",
    "admTech",
    "position",
    "categorieRh",
    "niveau",
    "grade",
    "situation",
  ];
  for (const field of multiEqualityFields) {
    for (const value of state[field] as string[]) params.append(field, value);
  }
  if (state.poste.trim()) params.set("poste", state.poste.trim());
  if (state.managerMatricule.trim()) params.set("managerMatricule", state.managerMatricule.trim());
  if (state.encadrant !== "ALL") {
    params.set("encadrant", state.encadrant === "OUI" ? "true" : "false");
  }

  const [minAnciennete, maxAnciennete] = parseRange(state.ancienneteRange);
  if (minAnciennete) params.set("minAnciennete", minAnciennete);
  if (maxAnciennete) params.set("maxAnciennete", maxAnciennete);

  const today = new Date().toISOString().slice(0, 10);

  if (state.dateEntreeFrom) params.set("dateEntreeFrom", state.dateEntreeFrom);
  if (state.dateEntreeMode === "untilToday") {
    if (state.dateEntreeFrom || state.dateEntreeTo) {
      params.set("dateEntreeTo", today);
    }
  } else if (state.dateEntreeTo) {
    params.set("dateEntreeTo", state.dateEntreeTo);
  }

  if (state.dateDepartFrom) params.set("dateDepartFrom", state.dateDepartFrom);
  if (state.dateDepartMode === "untilToday") {
    if (state.dateDepartFrom || state.dateDepartTo) {
      params.set("dateDepartTo", today);
    }
  } else if (state.dateDepartTo) {
    params.set("dateDepartTo", state.dateDepartTo);
  }

  if (state.modifiedFrom) params.set("modifiedFrom", state.modifiedFrom);
  if (state.modifiedMode === "untilToday") {
    if (state.modifiedFrom || state.modifiedTo) {
      params.set("modifiedTo", today);
    }
  } else if (state.modifiedTo) {
    params.set("modifiedTo", state.modifiedTo);
  }

  return params;
}

/** Rebuild filter state from URL search params (e.g. after "Lancer la requête"). */
export function parseSearchParams(params: URLSearchParams): FiltersState {
  const next: FiltersState = { ...initialFiltersState };

  const query = params.get("query");
  if (query) next.query = query;

  const categories = params.getAll("category").filter((c): c is DocumentCategory =>
    (allCategories as string[]).includes(c),
  );
  if (categories.length) next.category = categories;

  const documentType = params.get("documentType");
  if (documentType) next.documentType = documentType;

  const documentTypes = params.getAll("documentTypes");
  if (documentTypes.length) next.documentTypes = documentTypes;

  const folderName = params.getAll("folderName");
  if (folderName.length) next.folderName = folderName;

  const modifiedFrom = params.get("modifiedFrom");
  if (modifiedFrom) next.modifiedFrom = modifiedFrom;
  const modifiedTo = params.get("modifiedTo");
  if (modifiedTo) next.modifiedTo = modifiedTo;

  const genre = params.get("genre");
  if (genre === "H" || genre === "F") next.genre = genre;

  const matricule = params.get("matricule");
  if (matricule) next.matricule = matricule;
  const nom = params.get("nom");
  if (nom) next.nom = nom;
  const prenom = params.get("prenom");
  if (prenom) next.prenom = prenom;

  const cin = params.get("cin");
  if (cin) next.cin = cin;

  const childName = params.get("childName");
  if (childName) next.childName = childName;

  const minAge = params.get("minAge");
  const maxAge = params.get("maxAge");
  if (minAge || maxAge) next.ageRange = `${minAge ?? ""}-${maxAge ?? ""}`;

  const minChildren = params.get("minChildren");
  if (minChildren) next.minChildren = minChildren;

  const childrenExact = params.getAll("childrenExact");
  if (childrenExact.length) next.childrenExact = childrenExact;

  const hasSpouseDocument = params.get("hasSpouseDocument");
  if (hasSpouseDocument === "true") next.hasSpouseDocument = "OUI";
  if (hasSpouseDocument === "false") next.hasSpouseDocument = "NON";

  const multiEqualityFields: (keyof FiltersState)[] = [
    "direction",
    "service",
    "entite",
    "sousEntite",
    "zone",
    "agence",
    "statut",
    "college",
    "admTech",
    "position",
    "categorieRh",
    "niveau",
    "grade",
    "situation",
  ];
  for (const field of multiEqualityFields) {
    const values = params.getAll(field);
    if (values.length) (next[field] as string[]) = values;
  }

  const poste = params.get("poste");
  if (poste) next.poste = poste;

  const managerMatricule = params.get("managerMatricule");
  if (managerMatricule) next.managerMatricule = managerMatricule;

  const encadrant = params.get("encadrant");
  if (encadrant === "true") next.encadrant = "OUI";
  if (encadrant === "false") next.encadrant = "NON";

  const minAnciennete = params.get("minAnciennete");
  const maxAnciennete = params.get("maxAnciennete");
  if (minAnciennete || maxAnciennete) {
    next.ancienneteRange = `${minAnciennete ?? ""}-${maxAnciennete ?? ""}`;
  }

  const dateEntreeFrom = params.get("dateEntreeFrom");
  if (dateEntreeFrom) next.dateEntreeFrom = dateEntreeFrom;
  const dateEntreeTo = params.get("dateEntreeTo");
  if (dateEntreeTo) next.dateEntreeTo = dateEntreeTo;
  const dateDepartFrom = params.get("dateDepartFrom");
  if (dateDepartFrom) next.dateDepartFrom = dateDepartFrom;
  const dateDepartTo = params.get("dateDepartTo");
  if (dateDepartTo) next.dateDepartTo = dateDepartTo;

  return next;
}
