# Excel workbook — `Etat personnel exercice.xlsx`

> Three sheets: **Base**, **Arborescence**, **Codification**.  
> Read with `data_only=True` — row 1 of Base contains column numbers; **row 2 is the header**.

---

## Sheet 1: Base

### Purpose

HR master data (“état personnel”) — the **employee dimension** for search and display.  
One row per employee. In production this likely comes from HRIS export; in the exercise: **10 rows** (matricules 100001–100010).

### Link to Drive

```
Base.Matricule  ===  Dossiers Digitaux/{matricule}/
```

### Column reference

| # | Column | Type / notes | Search relevance |
|---|--------|--------------|------------------|
| 0 | Matricule | Number → string (6 digits) | Primary key; folder name |
| 1 | Prénom | Text | Name search |
| 2 | Nom | Text | Name search |
| 3 | Genre | `H` / `F` | Filter |
| 4 | CIN | Text | Identity |
| 5 | Date d'Ancienneté | Date | Display |
| 6 | Date d'Entrée | Date | Display / filter |
| 7 | Anc | Number (years) | Seniority |
| 8 | Date de Naissance | Date | Age derivation |
| 9 | Age | Number | Display |
| 10 | Date Départ | Date (nullable) | Leavers |
| 11 | Dossier | Text (`Dossier`) | Flag |
| 12 | Statut | `CDI`, `CDD`, `ST`, `ANAPEC`, … | Filter |
| 13 | Collège | `C`, `M`, `E`, `HC`, … | Filter |
| 14 | Catégorie | Number | HR classification |
| 15 | Date Catégorie | Date | |
| 16 | Niveau | Number | |
| 17 | Date Niveau | Date | |
| 18 | Degré | Number | |
| 19 | Grade | Number (nullable) | |
| 20 | Date Grade | Date (nullable) | |
| 21 | Encadrant | `Oui` / `Non` | Manager flag |
| 22 | Direction | Text | Org filter |
| 23 | Matricule Responsable Hiérarchique | Number | Org tree |
| 24 | Prénom Responsable Hiérarchique | Text | Display |
| 25 | Nom Responsable Hiérarchique | Text | Display |
| 26 | Service | Text | Org filter |
| 27 | Entité | Text | Org filter |
| 28 | Sous-Entité | Text | Org filter |
| 29 | Zone | Text | Location |
| 30 | Agence | Text | Location |
| 31 | Poste | Text | Search / display |
| 32 | Adm./Tech. | `Adm.` / `Tech.` | Filter |
| 33 | Position | `N`, `N-1`, `N-2`, … | Hierarchy level |
| 34 | Nbr Personnes Gérées Directement | Number | Stats |
| 35 | Nbr Personnes Gérées Indirectement | Number | Stats |
| 36 | Diplôme | Text | Search |
| 37 | Adresse | Text | |
| 38 | E-Mail | Text | |
| 39 | Contact | Text (phone) | |
| 40 | Situation | `Actif`, … | Filter |
| 41 | Centre de Destination | Text (rare) | |
| 42 | FA | `Oui` / `Non` | Unknown acronym — confirm with RH |
| 43 | Observations | Text (rare) | Free text |

### Sample rows (exercise)

| Matricule | Name | Direction | Manager mat. | Poste |
|-----------|------|-----------|--------------|-------|
| 100001 | Youssef El Amrani | Clientèle | 100010 | Responsable Contrôle |
| 100002 | Sara Bennani | Clientèle | 100001 | Chargée d'études |
| 100003 | Omar Alaoui | Technique | 100020 | Chef Service Réseaux |
| 100010 | Nadia Benali | Clientèle | 100007 | Responsable Segment |

### External manager matricules

Referenced in Base but **no Drive folder** in the exercise:

`100020`, `100030`, `100040`, `100050`

→ Production sync must handle employees without a Drive dossier (skip or flag).

### Suggested `Employee.metadata` shape

```json
{
  "prenom": "Youssef",
  "nom": "El Amrani",
  "genre": "H",
  "cin": "AB123456",
  "statut": "CDI",
  "direction": "Clientèle",
  "service": "Facturation",
  "entite": "Contrôle Facturation",
  "poste": "Responsable Contrôle",
  "diplome": "Master Gestion",
  "situation": "Actif",
  "managerMatricule": "100010",
  "managerName": "Nadia Benali"
}
```

Keep frequently filtered fields as top-level columns if query performance matters; stash the rest in `metadata` JSON.

---

## Sheet 2: Arborescence

### Purpose

**Authoritative file inventory** for the exercise — what PDFs should exist per employee and sous-dossier.  
Equivalent to the output of a successful Drive sync.

### Columns

| Column | Description |
|--------|-------------|
| Matricule | Employee ID — **only filled on first row of each employee block** |
| Sous-dossier | One of the 7 folder names — **filled when folder changes** |
| PDF | Filename including `.pdf` — one per row |

### Hierarchical layout (important for parsing)

Excel uses **merged-style grouping** — values are omitted when unchanged:

```
Row | Matricule | Sous-dossier              | PDF
----|-----------|---------------------------|---------------------------
  1 | 100001    | 1- Recrutement            | 100001_Contrat.pdf
  2 |           |                           | 100001_Curriculum vitae.pdf
  3 |           |                           | 100001_Fiche d'entretien.pdf
  4 |           | 2- Etat Civil             | 100001_Acte de Naissance.pdf
  … |           | …                         | …
 12 |           | 7- Divers                 | (empty)
 13 | 100002    | 1- Recrutement            | 100002_Contrat.pdf
```

### Parser algorithm

```typescript
let currentMatricule: string | null = null;
let currentFolder: string | null = null;

for (const row of rows) {
  if (row.matricule) currentMatricule = String(row.matricule);
  if (row.sousDossier) currentFolder = row.sousDossier;
  if (row.pdf) {
    records.push({
      matricule: currentMatricule!,
      folder: currentFolder!,
      fileName: row.pdf,
    });
  }
}
```

### Statistics (exercise)

| Metric | Value |
|--------|-------|
| Data rows | 120 |
| Rows with PDF | 110 |
| Rows without PDF | 10 (one per employee — `7- Divers` placeholder) |
| Unique matricules | 10 |
| Unique sous-dossiers | 7 |

### Use in development

1. **Fixture** for sync unit tests — expected output must match Arborescence
2. **Seed script** — import into PostgreSQL during local dev without Drive API
3. **Validation** — diff sync result vs Arborescence after indexing `doc/debut/Dossiers Digitaux`

---

## Sheet 3: Codification

### Purpose

Official **document naming dictionary** — all allowed `Mle_*` patterns grouped by sous-dossier.

### Layout

Two parallel columns in Excel:

| Column B (left block) | Column D (right block) |
|-----------------------|------------------------|
| Folder header | Folder header |
| `Mle_*` entries | `Mle_*` entries |

**Left block order:** 1- Recrutement → 2- Etat Civil → 3- Arrêtés  
**Right block order:** 4- Mesures Disciplinaires → 5- Maladies… → 6- Départ → 7- Divers

Full catalog: [CODIFICATION.md](./CODIFICATION.md)

### Placeholder `Mle`

`Mle` = **Matricule**. At file creation time, replace with the employee's numeric ID:

```
Mle_CIN  →  100001_CIN.pdf
```

### Incomplete entries

`7- Divers` contains placeholder rows `Mle_` (empty label) — treat as **TBD with RH**.

---

## Cross-sheet consistency

| Check | Result |
|-------|--------|
| Base matricules ⊆ Drive folders | ✅ 10/10 |
| Arborescence PDFs ⊆ Drive files | ✅ 110/110 |
| Drive files ⊆ Arborescence PDFs | ✅ 110/110 |
| Exercise doc types ⊆ Codification | ⚠️ Mostly — `Badge` missing from Codification |
| Codification folder names = Drive subfolders | ✅ 7/7 match |

---

## Import strategies (for implementers)

### Option A — Local dev without Drive

1. Import **Base** → `Employee` table
2. Import **Arborescence** → `DriveFile` table (no real `webViewLink`)
3. Use `doc/debut/Dossiers Digitaux` paths as logical file references

### Option B — Drive sync (production)

1. Scan Drive tree → build same structure as Arborescence
2. Classify each file via **Codification** matcher
3. Merge / upsert **Base** employee fields separately (HRIS job)

### Option C — Hybrid exercise

1. File sync from local folder `doc/debut/Dossiers Digitaux` (filesystem provider)
2. Employee data from Excel **Base** sheet
3. Proves full pipeline before Google credentials exist
