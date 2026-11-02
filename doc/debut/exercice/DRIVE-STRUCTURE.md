# Drive folder structure & file naming

> Source: `Dossiers Digitaux/` (downloaded Drive export) + cross-check with Excel **Arborescence** sheet.

---

## Tree layout

```
Dossiers Digitaux/                    ← Drive root (one shared folder for all employees)
├── 100001/
│   ├── 1- Recrutement/
│   ├── 2- Etat Civil/
│   ├── 3- Arrêtés/
│   ├── 4- Mesures Disciplinaires/
│   ├── 5- Maladies et Accidents de Travail/
│   ├── 6- Départ/
│   └── 7- Divers/
├── 100002/
│   └── … (same 7 subfolders)
…
└── 100010/
    └── …
```

### Rules

| Rule | Detail |
|------|--------|
| Root child = employee | Folder name **is** the matricule (string, typically 6 digits) |
| Fixed subfolders | Always the same 7 names, prefixed with `N- ` |
| Subfolder may be empty | `7- Divers` is empty for all 10 employees in the exercise |
| File types | PDF only in this sample |
| No nesting below sous-dossier | PDFs sit directly inside sous-dossiers (no deeper folders in exercise) |

---

## Exercise inventory

### Employees

`100001`, `100002`, `100003`, `100004`, `100005`, `100006`, `100007`, `100008`, `100009`, `100010`

### Files per employee (11 PDFs each)

| Sous-dossier | Filename pattern (after matricule prefix) |
|--------------|-------------------------------------------|
| **1- Recrutement** | `Contrat.pdf`, `Curriculum vitae.pdf`, `Fiche d_entretien.pdf` |
| **2- Etat Civil** | `Acte de Naissance.pdf`, `Badge.pdf`, `CIN.pdf`, `Photo.pdf` |
| **3- Arrêtés** | `Note de Mutation.pdf` |
| **4- Mesures Disciplinaires** | `Décision d_avertissement_jj-MM-YYYY.pdf` |
| **5- Maladies et Accidents de Travail** | `Maladie.pdf` |
| **6- Départ** | `Demande de Démission.pdf` |
| **7- Divers** | — |

**Total:** 10 × 11 = **110 PDFs**

---

## Filename convention

### General pattern

```
{matricule}_{document_label}.pdf
```

**Examples:**

```
100001_Contrat.pdf
100003_Curriculum vitae.pdf
100007_Décision d_avertissement_jj-MM-YYYY.pdf
100010_Demande de Démission.pdf
```

### Codification equivalent

In the **Codification** sheet, the matricule is written as `Mle`:

```
Mle_Contrat de travail   →   100001_Contrat de travail.pdf   (production)
Mle_CIN                  →   100001_CIN.pdf
```

---

## Normalization rules (for sync / matching)

When comparing Excel names to on-disk names or matching against Codification:

| Rule | Excel / Codification | On disk (observed) |
|------|----------------------|-------------------|
| Apostrophes | `d'entretien`, `d'avertissement` | `d_entretien`, `d_avertissement` |
| Spaces | Kept | Kept (`Curriculum vitae`) |
| Accents | `Décision`, `Démission`, `Arrêtés` | Preserved (UTF-8) |
| Date placeholder | `jj-MM-YYYY` | Literal in exercise (undated template) |
| Date suffix | `_14-02-1998` | `_DD-MM-YYYY` format in codification examples |

### Suggested normalizer (implementation sketch)

```typescript
function normalizeFileToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/'/g, "_")
    .toLowerCase()
    .trim();
}
```

Use for **matching**, not for renaming files on Drive.

---

## Suffix patterns (production)

Beyond the exercise's simple labels, production codification adds:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `_Conjoint` | Spouse document | `Mle_CIN_Conjoint` |
| `_Conjoint1` | Spouse (numbered) | `Mle_Certificat de Vie_Conjoint1` |
| `_Enfant_{Prénom}` | Child document | `Mle_Extrait Acte de Naissance_Enfant_Salah` |
| `_{YYYY}` | Year / version | `Mle_Diplôme_1985`, `Mle_Tableau d'avancement_1988` |
| `_{DD-MM-YYYY}` | Dated event | `Mle_Décision d'avertissement_14-02-1998` |
| `_1`, `_2` | Duplicate / second copy | `Mle_Acte de Mariage_1` |

### Children count algorithm

```
childrenCount = count of unique names in
  filename segments matching /_Enfant_([^_]+)/ after normalization
  for files in sous-dossier "2- Etat Civil" belonging to employee
```

---

## Sync mapping (Phase 2)

For each file discovered during Drive sync:

| Drive path | DB field |
|------------|----------|
| `{root}/{matricule}/` | `Employee.matricule`, `Employee.driveFolderId` |
| `{root}/{matricule}/{sous-dossier}/` | `DriveFile.category` (= sous-dossier enum) |
| `{filename}` | `DriveFile.name` |
| Drive file ID | `DriveFile.driveFileId` |
| `webViewLink` | `DriveFile.webViewLink` (server only until authorized) |

Parsed from filename into `DriveFile.parsedMetadata`:

```json
{
  "documentType": "CIN",
  "codificationKey": "Mle_CIN",
  "dateSuffix": null,
  "familyMember": null,
  "familyRelation": null
}
```

---

## Validation checklist (exercise)

Use this to verify a local sync implementation against `doc/debut`:

- [ ] Discovers exactly **10** employee folders
- [ ] Each employee has **7** sous-dossiers
- [ ] Indexes exactly **110** PDFs
- [ ] Every PDF's folder matches **Arborescence** sheet
- [ ] Matricule in filename matches parent folder name
- [ ] Empty `7- Divers` folders do not produce `DriveFile` rows (or produce zero files — folder existence is optional metadata)

---

## ASCII map (one employee)

```
100001/  ── Youssef El Amrani (from Base sheet)
│
├─ 1- Recrutement/
│    ├─ 100001_Contrat.pdf
│    ├─ 100001_Curriculum vitae.pdf
│    └─ 100001_Fiche d_entretien.pdf
│
├─ 2- Etat Civil/
│    ├─ 100001_Acte de Naissance.pdf
│    ├─ 100001_Badge.pdf
│    ├─ 100001_CIN.pdf
│    └─ 100001_Photo.pdf
│
├─ 3- Arrêtés/
│    └─ 100001_Note de Mutation.pdf
│
├─ 4- Mesures Disciplinaires/
│    └─ 100001_Décision d_avertissement_jj-MM-YYYY.pdf
│
├─ 5- Maladies et Accidents de Travail/
│    └─ 100001_Maladie.pdf
│
├─ 6- Départ/
│    └─ 100001_Demande de Démission.pdf
│
└─ 7- Divers/
     (empty)
```
