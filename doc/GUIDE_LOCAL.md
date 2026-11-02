# Guide local — lancer le portail, ngrok et Apps Script

Guide pratique (Windows) pour démarrer le projet en local, exposer le webhook avec ngrok, lier le script Google, et relancer après une modification.

Pour l’architecture et le détail sécurité du sync, voir [APPS_SCRIPT_SYNC_SETUP.md](./APPS_SCRIPT_SYNC_SETUP.md).

---

## 1. Prérequis

| Outil | Notes |
|---|---|
| **Node.js ≥ 20.9** | Vérifier : `node -v` |
| **npm** | Livré avec Node |
| **PostgreSQL 16+** | Service démarré (souvent le port **5432**, parfois **5433** sur Windows) |
| **Compte ngrok** | [dashboard.ngrok.com](https://dashboard.ngrok.com) → **Your Authtoken** |
| **Compte Google** | Accès au dossier Drive RH et au Sheet « Etat personnel » |

Deux terminaux PowerShell seront ouverts en parallèle :

1. serveur Next.js (`npm run dev`)
2. tunnel ngrok (`npx ngrok http 3000`)

---

## 2. Premier lancement du projet

Dans le dossier du repo (celui qui contient `package.json`) :

```powershell
cd projet-rh-main
npm install
```

### 2.1 Fichier `.env`

```powershell
copy .env.example .env
```

Éditer `.env` — minimum :

```env
DATABASE_URL="postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/APP-RH?schema=public"
AUTH_SECRET="colle-ici-un-secret-aleatoire"
AUTH_URL="http://localhost:3000"
DRIVE_SYNC_WEBHOOK_SECRET="colle-ici-un-autre-secret-aleatoire"
```

Règles :

- Si le mot de passe Postgres contient un `@`, l’encoder : `@` → `%40` (ex. `Admin@123` → `Admin%40123`).
- Entourer `DRIVE_SYNC_WEBHOOK_SECRET` de **guillemets**.
- Générer un secret :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Le **même** secret ira dans Apps Script (`SYNC_SECRET`). Ne pas le committer.

### 2.2 Base de données

PostgreSQL doit tourner. Puis :

```powershell
npm run db:generate
npm run db:setup
```

Si `db:setup` échoue au seed (`Cannot find module '.prisma/client/default'`) :

```powershell
npm run db:generate
npm run db:seed
```

Compte admin seedé : `admin@amendis.ma` / `Admin123!`

### 2.3 Serveur de développement

```powershell
npm run dev
```

Ouvrir **http://localhost:3000** — c’est l’URL à utiliser au quotidien.

Laisser ce terminal ouvert.

---

## 3. Ngrok (URL publique pour Google)

Google Apps Script **ne peut pas** appeler `http://localhost:3000`. Ngrok donne une URL HTTPS publique vers le port 3000.

### 3.1 Authtoken (une seule fois)

Ngrok n’est pas forcément installé en global. Utiliser **`npx`** :

```powershell
npx ngrok config add-authtoken TON_AUTHTOKEN
```

Token : [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)

### 3.2 Lancer le tunnel

**Nouveau** terminal, **pendant** que `npm run dev` tourne :

```powershell
npx ngrok http 3000
```

La ligne **Forwarding** donne l’URL complète, du type :

```
https://xxxxx.ngrok-free.dev
```

Le terminal tronque parfois la fin (`.d` au lieu de `.dev`). L’URL complète :

- interface locale : http://127.0.0.1:4040
- ou copier toute la ligne **Forwarding**.

Webhook Apps Script :

```
https://xxxxx.ngrok-free.dev/api/sync/apps-script
```

**Ne pas fermer** ce terminal. Si tu le relances, l’URL ngrok **change** → mettre à jour `PORTAL_WEBHOOK_URL`.

Le plan gratuit affiche parfois « Visit Site » dans le navigateur : cliquer une fois. Next.js autorise déjà les origines `*.ngrok-free.dev` via `allowedDevOrigins` dans `next.config.ts`.

---

## 4. Lier le script Google Apps Script

Le bouton admin **ne lance pas** la sync. C’est Apps Script qui pousse les données vers `POST /api/sync/apps-script`.

### 4.1 Créer le projet

1. [script.google.com](https://script.google.com) → nouveau projet  
   (ou dans le Sheet : **Extensions → Apps Script**)
2. Coller **une seule fois** le contenu de `scripts/apps-script/sync.gs` dans `Code.gs`
3. **Supprimer** tout autre fichier `.gs` (ex. `Sans titre.gs`) — sinon erreur `Identifier 'FILES_PER_CHUNK' has already been declared`

### 4.2 Propriétés du script

**Paramètres du projet → Propriétés du script :**

| Propriété | Valeur |
|---|---|
| `PORTAL_WEBHOOK_URL` | `https://xxxxx.ngrok-free.dev/api/sync/apps-script` |
| `SYNC_SECRET` | **identique** à `DRIVE_SYNC_WEBHOOK_SECRET` du `.env` |
| `ROOT_FOLDER_ID` | ID du dossier Drive racine (un sous-dossier par matricule) |
| `BASE_SHEET_ID` | ID du **classeur** Google Sheet (onglet nommé exactement `Base`) |

Où trouver les IDs :

```
Drive :  https://drive.google.com/drive/folders/ID_ICI
Sheet :  https://docs.google.com/spreadsheets/d/ID_ICI/edit#gid=...
```

- `BASE_SHEET_ID` = la partie entre `/d/` et `/edit` (longue, lettres + chiffres)
- **Ne pas** coller `#gid=...` (erreur `Illegal spreadsheet id`)
- L’onglet doit s’appeler **`Base`** (sans espace)

### 4.3 Premier run

1. Fonction **`testRunSyncManually`** → **Exécuter**
2. Autoriser Drive / Sheets au premier lancement
3. Logs : `Chunk x/y OK` puis `Sync complete`

Vérifier : **http://localhost:3000/admin/sync** (ou l’URL ngrok `/admin/sync`) → ligne **SUCCESS**.

### 4.4 Sync automatique (optionnel)

**Déclencheurs → Ajouter un déclencheur** : fonction `runSync`, basé sur le temps (ex. toutes les 30 min). En local, ngrok doit rester allumé.

---

## 5. Relancer après une modification

| Tu as modifié… | Que faire |
|---|---|
| Composant, page, CSS, `lib/` (sans `.env`) | Rien : **hot reload**. Sinon **Ctrl+F5** dans le navigateur |
| `.env` | **Arrêter** `npm run dev` (Ctrl+C) puis `npm run dev` |
| `next.config.ts`, `middleware.ts` | Redémarrer `npm run dev` |
| `prisma/schema.prisma` | `npm run db:push` puis `npm run db:generate` puis redémarrer `npm run dev` |
| `scripts/apps-script/sync.gs` | Recoller dans Apps Script, enregistrer, relancer `testRunSyncManually` |
| URL ngrok (tunnel relancé) | Mettre à jour `PORTAL_WEBHOOK_URL` dans Apps Script |
| Cache Next bizarre | `npm run dev:clean` |

### Commandes utiles

```powershell
# Redémarrer l'app
npm run dev

# Cache Next corrompu
npm run dev:clean

# Schéma Prisma + seed admin
npm run db:setup

# Données d'exercice locales (sans Google)
npm run sync:exercise
```

Ngrok n’a **pas** besoin d’être relancé après un changement de code, tant que le processus tourne toujours.

---

## 6. Erreurs fréquentes

| Symptôme | Cause | Correction |
|---|---|---|
| `ngrok n'est pas reconnu` | Pas installé en global | Utiliser `npx ngrok ...` |
| Page ngrok blanche (header seul) | Next.js bloquait le JS hors localhost | `allowedDevOrigins` dans `next.config.ts` + redémarrer `npm run dev` + Ctrl+F5 |
| DNS `pawing-....ngrok-free.d` | URL tronquée | URL complète en `.dev` (voir http://127.0.0.1:4040) |
| `FILES_PER_CHUNK has already been declared` | Script collé dans 2 fichiers `.gs` | Garder uniquement `Code.gs` |
| `Illegal spreadsheet id` | `gid` au lieu de l’ID du classeur | ID entre `/d/` et `/edit` |
| `Synchronisation non configurée` (HTTP 500) | Secret `.env` vide ou serveur pas relancé | Guillemets autour du secret + `npm run dev` |
| `Non autorisé` (401) | `SYNC_SECRET` ≠ `DRIVE_SYNC_WEBHOOK_SECRET` | Même valeur des deux côtés, redémarrer Next |
| Tunnel mort / URL qui change | Ngrok redémarré | Nouvelle `PORTAL_WEBHOOK_URL` |

---

## 7. Rappel des commandes (ordre du matin)

```powershell
# Terminal 1 — à la racine du projet
npm run dev

# Terminal 2
npx ngrok http 3000
```

Puis, si besoin de resync : Apps Script → **`testRunSyncManually`**.

Navigation locale : **http://localhost:3000**  
Webhook : `https://<sous-domaine>.ngrok-free.dev/api/sync/apps-script`
