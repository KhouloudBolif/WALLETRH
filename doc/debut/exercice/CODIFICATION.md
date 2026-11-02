# Document codification catalog

> Source: **Codification** sheet in `Etat personnel exercice.xlsx`.  
> Template prefix: `Mle_` → replace `Mle` with employee matricule in actual filenames.

---

## How to read this catalog

| Codification entry | Production filename example |
|--------------------|---------------------------|
| `Mle_CIN` | `100001_CIN.pdf` |
| `Mle_Extrait Acte de Naissance_Enfant_Salah` | `100042_Extrait Acte de Naissance_Enfant_Salah.pdf` |
| `Mle_Décision d'avertissement_14-02-1998` | `100042_Décision d_avertissement_14-02-1998.pdf` |

**Sous-dossier** = which Drive subfolder the file should live in (permission category).

---

## 1- Recrutement (15 types)

| Codification key | Notes |
|------------------|-------|
| `Mle_Demande d'Emploi` | |
| `Mle_Curriculum vitae` | ✅ In exercise |
| `Mle_Contrat de travail` | Exercise short form: `Contrat` |
| `Mle_Fiches d'entretien` | Exercise: `Fiche d'entretien` (singular) |
| `Mle_Fiches d'Embauche` | |
| `Mle_Fiche de Renseignement` | |
| `Mle_Aptitude Médicale` | |
| `Mle_Engagement et Déclaration sur l'Honneur` | |
| `Mle_Lettre d'engagement` | |
| `Mle_Décision de recrutement` | |
| `Mle_Attestation de déclaration des salaires CNSS` | |
| `Mle_Démission` | |
| `Mle_Note de création BP` | |
| `Mle_Proposition de passage` | |
| `Mle_Formulaire droit à l'image` | |

---

## 2- Etat Civil (24 types)

| Codification key | Family / suffix | Notes |
|------------------|-----------------|-------|
| `Mle_CIN` | | ✅ In exercise |
| `Mle_CIN_Conjoint` | Conjoint | |
| `Mle_CNSS` | | |
| `Mle_Photo` | | ✅ In exercise |
| `Mle_Acte de Mariage` | | |
| `Mle_Acte de Mariage_1` | Version `_1` | |
| `Mle_jugement de divorce` | | Listed twice in sheet |
| `Mle_Fiche Anthropométrique` | | |
| `Mle_Attestation de RIB` | | |
| `Mle_Casier judicier` | | |
| `Mle_Extrait Acte de Naissance` | | Exercise short form: `Acte de Naissance` |
| `Mle_Extrait Acte de Naissance_Conjoint` | Conjoint | |
| `Mle_Extrait Acte de Naissance_Enfant_Salah` | Enfant | Children counting |
| `Mle_Extrait Acte de Naissance_Enfant_Zakaria` | Enfant | Children counting |
| `Mle_Certificat de Vie` | | |
| `Mle_Certificat Vie Collective` | | |
| `Mle_Certificat de Vie_Conjoint1` | Conjoint | |
| `Mle_Certificat de Vie_Enfant_Mohammed` | Enfant | |
| `Mle_Certificat de Vie_Enfant_Imane` | Enfant | |
| `Mle_Certificat de Vie_Enfant_Salah` | Enfant | |
| `Mle_Certificat de Vie_Enfant_Zakaria` | Enfant | |
| `Mle_Certificat de Vie_Collectif_1992` | Dated collective | |

### Not in Codification but in exercise

| Exercise file | Folder | Action |
|---------------|--------|--------|
| `Badge.pdf` | 2- Etat Civil | Ask RH; add alias `Mle_Badge` or map to Divers |

---

## 3- Arrêtés (6 types)

| Codification key | Notes |
|------------------|-------|
| `Mle_Tableau d'avancement_1988` | Year suffix |
| `Mle_Tableau d'avancement_1990` | Year suffix |
| `Mle_Décision de nomination` | |
| `Mle_Note de Mutation` | ✅ In exercise |
| `Mle_Diplôme_1985` | Year suffix |
| `Mle_Diplôme_1988` | Year suffix |

---

## 4- Mesures Disciplinaires (2 types)

| Codification key | Notes |
|------------------|-------|
| `Mle_Demande d'explication_12-12-2015` | Dated example |
| `Mle_Décision d'avertissement_14-02-1998` | Exercise: `Décision d_avertissement_jj-MM-YYYY` |

---

## 5- Maladies et Accidents de Travail (2 types)

| Codification key | Notes |
|------------------|-------|
| `Mle_Maladie` | ✅ In exercise |
| `Mle_AT` | Accident du travail |

---

## 6- Départ (4 types)

| Codification key | Notes |
|------------------|-------|
| `Mle_Demande de Démission` | ✅ In exercise |
| `Mle_Lettre d'acceptation de la démission` | |
| `Mle_STC` | Solde de tout compte |
| `Mle_Certificat de Travail` | |

---

## 7- Divers (incomplete)

| Codification key | Status |
|------------------|--------|
| `Mle_Mutation` | Listed under Divers in sheet layout; **also** `Note de Mutation` is under 3- Arrêtés — confirm with RH |
| `Mle_` | Placeholder — incomplete |
| `Mle_` | Placeholder — incomplete |
| `Mle_` | Placeholder — incomplete |

Exercise: folder exists but is **empty** for all employees.

---

## Exercise → Codification alias table

Use during sync when exact label match fails:

| Exercise label (after `{matricule}_`) | Best codification match | Folder |
|---------------------------------------|-------------------------|--------|
| `Contrat` | `Mle_Contrat de travail` | 1- Recrutement |
| `Curriculum vitae` | `Mle_Curriculum vitae` | 1- Recrutement |
| `Fiche d_entretien` | `Mle_Fiches d'entretien` | 1- Recrutement |
| `Acte de Naissance` | `Mle_Extrait Acte de Naissance` | 2- Etat Civil |
| `Badge` | *(TBD)* | 2- Etat Civil |
| `CIN` | `Mle_CIN` | 2- Etat Civil |
| `Photo` | `Mle_Photo` | 2- Etat Civil |
| `Note de Mutation` | `Mle_Note de Mutation` | 3- Arrêtés |
| `Décision d_avertissement_jj-MM-YYYY` | `Mle_Décision d'avertissement_*` | 4- Mesures Disciplinaires |
| `Maladie` | `Mle_Maladie` | 5- Maladies… |
| `Demande de Démission` | `Mle_Demande de Démission` | 6- Départ |

Store aliases in `lib/storage/codification.ts` (or JSON) — not hard-coded in UI.

---

## Classification algorithm (recommended)

```
Input: matricule, sous-dossier, fileName

1. Strip .pdf extension
2. Remove "{matricule}_" prefix → rawLabel
3. normalize(rawLabel) and normalize(codification labels)
4. Try exact match against catalog for that sous-dossier
5. Try alias table (exercise shortcuts)
6. Try pattern match:
   - ends with _DD-MM-YYYY → dated document (store date)
   - contains _Enfant_ → parse child name
   - contains _Conjoint → spouse document
7. If no match → codificationKey = "UNKNOWN", flag for admin review
```

---

## Proposed Prisma enum (replace mock categories)

```prisma
enum DocumentCategory {
  RECRUTEMENT                        // 1- Recrutement
  ETAT_CIVIL                         // 2- Etat Civil
  ARRETES                            // 3- Arrêtés
  MESURES_DISCIPLINAIRES             // 4- Mesures Disciplinaires
  MALADIES_ACCIDENTS_TRAVAIL         // 5- Maladies et Accidents de Travail
  DEPART                             // 6- Départ
  DIVERS                             // 7- Divers
}
```

`AccessRule.category` should use this enum — one rule per user × category × optional employee scope.

`DriveFile` may additionally store `documentType` (string) for fine-grained display within a folder.
