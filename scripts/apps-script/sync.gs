/**
 * Reference Google Apps Script — pushes the HR Drive folder tree + Base sheet
 * to the portal's webhook (POST /api/sync/apps-script). Not part of the
 * Next.js build: copy this into a script bound to the company's Drive/Sheet
 * (script.google.com), configure the Script Properties below, then install a
 * time-driven trigger on runSync(). See docs/apps-script-sync-setup.md.
 *
 * Uses only the built-in DriveApp/SpreadsheetApp services (no "Advanced Drive
 * Service", no external OAuth) — this runs under the company's own Workspace
 * authorization, never as an external Drive API client.
 *
 * Required Script Properties (File > Project properties > Script properties):
 *   PORTAL_WEBHOOK_URL  e.g. https://portal.example.com/api/sync/apps-script
 *   SYNC_SECRET         shared secret, must match DRIVE_SYNC_WEBHOOK_SECRET
 *   ROOT_FOLDER_ID      Drive folder id containing one subfolder per matricule
 *   BASE_SHEET_ID       Spreadsheet id (tabs: "Base" + "Complétude des dossiers")
 */

const FILES_PER_CHUNK = 500;

// Retry only transient failures (network error / 5xx) — never retry 4xx
// (bad signature, invalid payload), retrying those just spams the same error.
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [2000, 5000, 15000];

function runSync() {
  // Guards against a trigger firing while the previous run is still in
  // progress (e.g. the Drive tree grew large enough that a run takes longer
  // than the trigger interval). tryLock(0) never blocks — if another
  // execution already holds the lock, this run just skips itself; the lock
  // is released automatically when the holding execution ends, so a crashed
  // run can never leave a stale lock behind (unlike a hand-rolled Script
  // Property flag would).
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log("Skipped: a previous runSync() execution is still in progress.");
    return;
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const webhookUrl = props.getProperty("PORTAL_WEBHOOK_URL");
    const secret = props.getProperty("SYNC_SECRET");
    const rootFolderId = props.getProperty("ROOT_FOLDER_ID");
    const baseSheetId = props.getProperty("BASE_SHEET_ID");

    if (!webhookUrl || !secret || !rootFolderId || !baseSheetId) {
      throw new Error("Missing Script Property: PORTAL_WEBHOOK_URL, SYNC_SECRET, ROOT_FOLDER_ID, BASE_SHEET_ID");
    }

    const employees = readBaseSheet_(baseSheetId);
    const employeeInformation = readCompletenessSheet_(baseSheetId);
    const walked = walkDriveTree_(rootFolderId);
    const files = walked.files;
    // Utilisateur portail ayant cliqué Synchroniser (stocké par schedulePortalSync_).
    const triggeredByUserId = props.getProperty("PENDING_SYNC_USER_ID");
    if (triggeredByUserId) {
      props.deleteProperty("PENDING_SYNC_USER_ID");
    }

    let syncLogId = null;
    const chunks = chunk_(files, FILES_PER_CHUNK);
    if (chunks.length === 0) chunks.push([]); // still push employees even with zero files

    for (let i = 0; i < chunks.length; i++) {
      const isFirst = i === 0;
      const isFinal = i === chunks.length - 1;

      const payload = {
        isFinal: isFinal,
        files: chunks[i],
      };
      if (syncLogId) payload.syncLogId = syncLogId;
      if (isFirst) {
        payload.employees = employees;
        payload.employeeInformation = employeeInformation;
        if (triggeredByUserId) payload.triggeredByUserId = triggeredByUserId;
      }
      if (isFinal) payload.driveMatricules = walked.matricules;

      const response = postToPortalWithRetry_(webhookUrl, secret, payload, i + 1, chunks.length);
      const rawText = response.getContentText();
      let body;
      try {
        body = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(
          "Le portail n'a pas renvoyé du JSON (HTTP " +
            response.getResponseCode() +
            "). Vérifiez PORTAL_WEBHOOK_URL (ngrok/tunnel actif, pas localhost). Réponse: " +
            rawText.substring(0, 200),
        );
      }

      if (response.getResponseCode() >= 300) {
        throw new Error("Portal rejected sync chunk " + (i + 1) + "/" + chunks.length + ": " + rawText);
      }

      syncLogId = body.result.syncLogId;
      Logger.log("Chunk " + (i + 1) + "/" + chunks.length + " OK — syncLogId=" + syncLogId);
    }

    Logger.log("Sync complete. syncLogId=" + syncLogId);
  } finally {
    lock.releaseLock();
  }
}

/**
 * POST one chunk, HMAC-signed, retrying transient failures (network error or
 * 5xx from the portal — e.g. a brief redeploy) with backoff. Client errors
 * (4xx — bad signature, invalid payload) fail immediately since a retry
 * can't fix those.
 */
function postToPortalWithRetry_(url, secret, payload, chunkNum, totalChunks) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = postToPortal_(url, secret, payload);
      const status = response.getResponseCode();

      if (status < 500) return response; // success, or a non-retryable 4xx

      lastError = "HTTP " + status + ": " + response.getContentText();
    } catch (error) {
      // Network-level failure (portal unreachable, DNS, timeout, ...).
      lastError = error && error.message ? error.message : String(error);
    }

    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      Logger.log(
        "Chunk " + chunkNum + "/" + totalChunks + " attempt " + attempt + " failed (" + lastError +
          "), retrying in " + delay + "ms…",
      );
      Utilities.sleep(delay);
    }
  }

  throw new Error(
    "Chunk " + chunkNum + "/" + totalChunks + " failed after " + MAX_ATTEMPTS + " attempts: " + lastError,
  );
}

/** POST one chunk, HMAC-signed. */
function postToPortal_(url, secret, payload) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());
  // Force UTF-8 explicitly: the default charset for computeHmacSha256Signature
  // isn't guaranteed to match the UTF-8 bytes UrlFetchApp actually sends over
  // the wire, so accented characters (Prénom, Date d'Entrée, ...) in the Base
  // sheet data can silently produce a signature that doesn't match what the
  // portal recomputes from the received (UTF-8) body — causing a 401 that
  // only shows up once real, non-ASCII data is in the payload.
  const signature = Utilities.computeHmacSha256Signature(
    timestamp + "." + rawBody,
    secret,
    Utilities.Charset.UTF_8,
  )
    .map(function (b) {
      return (b < 0 ? b + 256 : b).toString(16).padStart(2, "0");
    })
    .join("");

  return UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: rawBody,
    headers: {
      "X-Signature": signature,
      "X-Timestamp": timestamp,
    },
    muteHttpExceptions: true,
  });
}

/** Walk {matricule}/{sous-dossier}/*.pdf under the root folder. */
function walkDriveTree_(rootFolderId) {
  const files = [];
  const matricules = [];
  const root = DriveApp.getFolderById(rootFolderId);
  const matriculeFolders = root.getFolders();

  while (matriculeFolders.hasNext()) {
    const employeeFolder = matriculeFolders.next();
    const matricule = employeeFolder.getName().trim();
    if (matricule) matricules.push(matricule);
    const subFolders = employeeFolder.getFolders();

    while (subFolders.hasNext()) {
      const subFolder = subFolders.next();
      const folderName = subFolder.getName();
      const folderFiles = subFolder.getFiles();

      while (folderFiles.hasNext()) {
        const file = folderFiles.next();
        files.push({
          matricule: matricule,
          folderName: folderName,
          backendFileId: file.getId(),
          name: file.getName(),
          mimeType: file.getMimeType(),
          webViewLink: file.getUrl(),
          modifiedAt: file.getLastUpdated().toISOString(),
        });
      }
    }
  }

  return { files: files, matricules: matricules };
}

/**
 * Read the "Base" sheet — same layout as parseExcelBase (row 2 = headers,
 * data from row 3). Column labels must match lib/import/parseExcelBase.ts.
 */
function readBaseSheet_(spreadsheetId) {
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("Base");
  if (!sheet) throw new Error('Sheet "Base" not found');

  const values = sheet.getDataRange().getValues();
  const headers = values[1].map(function (h) {
    return String(h).replace(/\s+/g, " ").trim();
  });

  const colIndex = function (label) {
    return headers.findIndex(function (h) {
      return h.toLowerCase() === label.toLowerCase();
    });
  };
  const cell = function (row, label) {
    const idx = colIndex(label);
    if (idx < 0) return null;
    const v = row[idx];
    if (v === null || v === undefined || v === "") return null;
    return v instanceof Date ? v : String(v).trim();
  };
  const cellInt = function (row, label) {
    const v = cell(row, label);
    const n = v === null ? NaN : parseInt(v, 10);
    return isNaN(n) ? null : n;
  };
  const cellBool = function (row, label) {
    const v = cell(row, label);
    if (!v) return null;
    const s = String(v).trim().toLowerCase();
    if (s === "oui") return true;
    if (s === "non") return false;
    return null;
  };
  const cellDate = function (row, label) {
    const v = cell(row, label);
    return v instanceof Date ? v.toISOString() : null;
  };

  const employees = [];
  for (let r = 2; r < values.length; r++) {
    const row = values[r];
    const matricule = cell(row, "Matricule");
    if (!matricule) continue;

    const metadata = {};
    headers.forEach(function (h, i) {
      if (!h || h.toLowerCase() === "dossier") return;
      const v = row[i];
      if (v === null || v === undefined || v === "") return;
      metadata[h] = v instanceof Date ? v.toISOString() : String(v).trim();
    });

    const displayName = ((cell(row, "Prénom") || "") + " " + (cell(row, "Nom") || "")).trim() || String(matricule);

    employees.push({
      matricule: String(matricule),
      displayName: displayName,
      genre: cell(row, "Genre"),
      cin: cell(row, "CIN"),
      age: cellInt(row, "Age"),
      anciennete: cellInt(row, "Anc"),
      direction: cell(row, "Direction"),
      service: cell(row, "Service"),
      poste: cell(row, "Poste"),
      statut: cell(row, "Statut"),
      situation: cell(row, "Situation"),
      entite: cell(row, "Entité"),
      sousEntite: cell(row, "Sous-Entité"),
      zone: cell(row, "Zone"),
      agence: cell(row, "Agence"),
      college: cell(row, "Collège"),
      admTech: cell(row, "Adm./Tech."),
      position: cell(row, "Position"),
      encadrant: cellBool(row, "Encadrant"),
      niveau: cell(row, "Niveau"),
      grade: cell(row, "Grade"),
      categorieRh: cell(row, "Catégorie"),
      managerMatricule: cell(row, "Matricule Responsable Hirérachique"),
      dateEntree: cellDate(row, "Date d'Entrée"),
      dateDepart: cellDate(row, "Date Départ"),
      metadata: metadata,
      searchText: [matricule, displayName].concat(Object.values(metadata)).join(" ").toLowerCase(),
    });
  }

  return employees;
}

/**
 * Read tab "Complétude des dossiers" — employee attributes for obligation checks.
 * Same layout as Base: row 1 empty, row 2 headers, data from row 3.
 * Expected headers (A–H): Matricule | Prénom | Nom | Genre | Statut | Collège | Situation | Nb enfants
 */
function readCompletenessSheet_(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet =
    ss.getSheetByName("Complétude des dossiers") ||
    ss.getSheetByName("Completude des dossiers");
  if (!sheet) {
    Logger.log('Sheet "Complétude des dossiers" not found — skipping.');
    return [];
  }

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = sheet.getRange(1, 1, lastRow, 8).getValues();
  if (values.length < 3) {
    Logger.log("Complétude sheet needs at least 3 rows (empty, headers, data).");
    return [];
  }

  const cellStr = function (v) {
    if (v === null || v === undefined || v === "") return null;
    return String(v).replace(/\s+/g, " ").trim();
  };
  const norm = function (s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };
  const cellInt = function (v) {
    const s = cellStr(v);
    if (!s) return 0;
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  };

  // Row 2 = headers (index 1)
  const headers = values[1].map(function (h) {
    return norm(cellStr(h));
  });
  Logger.log("Complétude headers (row 2): " + headers.filter(Boolean).join(" | "));

  const colIndex = function (candidates) {
    for (let i = 0; i < candidates.length; i++) {
      const idx = headers.indexOf(candidates[i]);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const colMatricule = colIndex(["matricule"]);
  const colPrenom = colIndex(["prenom", "prénom"]);
  const colNom = colIndex(["nom"]);
  const colGenre = colIndex(["genre", "sexe"]);
  const colStatut = colIndex(["statut"]);
  const colCollege = colIndex(["college", "collège"]);
  const colSituation = colIndex(["situation"]);
  const colNbEnfants = colIndex([
    "nb enfants",
    "nbr enfants",
    "nombre denfants",
    "nombre d enfants",
    "enfants",
    "children",
  ]);

  if (colMatricule < 0) {
    Logger.log('Complétude sheet: column "Matricule" not found on row 2 — abort.');
    return [];
  }

  const rows = [];
  for (let r = 2; r < values.length; r++) {
    const row = values[r];
    const matricule = cellStr(row[colMatricule]);
    if (!matricule || !/^\d{4,}$/.test(matricule)) continue;

    rows.push({
      matricule: matricule,
      prenom: colPrenom >= 0 ? cellStr(row[colPrenom]) : null,
      nom: colNom >= 0 ? cellStr(row[colNom]) : null,
      genre: colGenre >= 0 ? cellStr(row[colGenre]) : null,
      statut: colStatut >= 0 ? cellStr(row[colStatut]) : null,
      college: colCollege >= 0 ? cellStr(row[colCollege]) : null,
      situation: colSituation >= 0 ? cellStr(row[colSituation]) : null,
      nbEnfants: colNbEnfants >= 0 ? cellInt(row[colNbEnfants]) : 0,
    });
  }

  Logger.log("EmployeeInformation rows loaded: " + rows.length);
  return rows;
}

function chunk_(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Manual smoke test — run from the script editor, check Executions log. */
function testRunSyncManually() {
  runSync();
}

// ─────────────────────────────────────────────────────────────────────────
// ZIP export bridge — the portal calls this Web App to bundle a set of Drive
// files (from a search result) into one signed ZIP with folder structure.
// This is the one place the portal calls OUT to Google — everything else in
// this file only reacts to Google calling the portal. Requires its own Web
// App deployment: Deploy > New deployment > Web app > Execute as "Me" >
// Who has access "Anyone". Set the resulting URL as the portal's
// APPS_SCRIPT_EXPORT_URL. See doc/APPS_SCRIPT_SYNC_SETUP.md.
//
// Apps Script's doPost(e) cannot read custom HTTP headers, so — unlike the
// sync push above — the signature travels inside the JSON body itself:
//   { timestamp, signature, payload: '<exact string that was signed>' }
// ─────────────────────────────────────────────────────────────────────────

const MAX_ZIP_ITEMS = 150;

/**
 * doGet sans paramètre : page relais postMessage (évite URL trop longue → 403).
 * doGet ?envelope=… : export direct (petits exports).
 */
function doGet(e) {
  e = e || {};
  var extracted = extractEnvelopeRaw_(e);
  if (extracted.raw) {
    var syncGet = tryHandleSyncTrigger_(extracted.raw, true);
    if (syncGet) return syncGet;
    return runZipExport_(extracted.raw, true);
  }
  return HtmlService.createHtmlOutput(zipRelayHtml_()).setTitle("Export ZIP Portail RH");
}

function doPost(e) {
  var extracted = extractEnvelopeRaw_(e);
  var fromBrowser =
    extracted.fromBrowser ||
    !!(e && e.parameter && e.parameter.envelope) ||
    !!(e && e.postData && /envelope=/i.test(String(e.postData.contents || "")));

  // Bouton « Synchroniser » du portail : envelope signé { action: "runSync" }
  // (via form POST navigateur — la session Google Veolia est requise).
  var syncPost = tryHandleSyncTrigger_(extracted.raw, fromBrowser);
  if (syncPost) return syncPost;

  return runZipExport_(extracted.raw, fromBrowser);
}

/**
 * Déclenche runSync depuis le portail (admin), sans bloquer la Web App 6 min.
 * Planifie une exécution one-shot ~3 s plus tard, puis répond immédiatement.
 * fromBrowser=true → page HTML + postMessage (Web App domaine Veolia).
 */
function tryHandleSyncTrigger_(raw, fromBrowser) {
  if (!raw) return null;
  try {
    var envelope = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!envelope || !envelope.payload) return null;

    var body;
    try {
      body = JSON.parse(envelope.payload);
    } catch (parseErr) {
      return null;
    }
    if (!body || body.action !== "runSync") return null;

    var secret = PropertiesService.getScriptProperties().getProperty("SYNC_SECRET");
    if (!secret || !verifyEnvelope_(envelope, secret)) {
      var sigErr = "Signature invalide. Vérifiez SYNC_SECRET = DRIVE_SYNC_WEBHOOK_SECRET.";
      return fromBrowser ? htmlSyncResult_(false, sigErr) : jsonOutput_({ error: sigErr });
    }

    var result = schedulePortalSync_(body.triggeredByUserId || null);
    if (fromBrowser) {
      return htmlSyncResult_(true, result.message || "Synchronisation planifiée.");
    }
    return jsonOutput_(result);
  } catch (err) {
    var msg = String(err);
    return fromBrowser ? htmlSyncResult_(false, msg) : jsonOutput_({ error: msg });
  }
}

/** Page HTML pour le popup navigateur (postMessage vers le Portail). */
function htmlSyncResult_(ok, message) {
  var html = HtmlService.createHtmlOutput(
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>" +
      "<body style='font-family:system-ui,sans-serif;padding:1.5rem'>" +
      "<p>" +
      String(message).replace(/</g, "&lt;") +
      "</p>" +
      "<script>" +
      "var msg={type:" +
      (ok ? "'portail-rh-sync-ok'" : "'portail-rh-sync-error'") +
      ",message:" +
      JSON.stringify(String(message)) +
      "};" +
      "var seen=[];" +
      "function send(w){if(!w)return;for(var i=0;i<seen.length;i++){if(seen[i]===w)return;}seen.push(w);try{w.postMessage(msg,'*');}catch(e){}}" +
      "var p=window;for(var n=0;n<6&&p;n++){try{send(p.opener);}catch(e){}try{if(!p.parent||p.parent===p)break;p=p.parent;}catch(e2){break;}}" +
      "setTimeout(function(){try{window.close();}catch(e){}},1500);" +
      "</script></body></html>",
  );
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function schedulePortalSync_(triggeredByUserId) {
  var props = PropertiesService.getScriptProperties();
  if (triggeredByUserId) {
    props.setProperty("PENDING_SYNC_USER_ID", String(triggeredByUserId));
  } else {
    props.deleteProperty("PENDING_SYNC_USER_ID");
  }

  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runSyncFromPortal_") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("runSyncFromPortal_")
    .timeBased()
    .after(3000)
    .create();

  return {
    ok: true,
    scheduled: true,
    message: "Synchronisation planifiée — elle démarre dans quelques secondes.",
  };
}

/** Handler one-shot créé par schedulePortalSync_ (appel portail). */
function runSyncFromPortal_() {
  try {
    runSync();
  } finally {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "runSyncFromPortal_") {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
  }
}

/** Appelé depuis la page relais via google.script.run (envelope JSON string). */
function processZipFromPortal(envelopeRaw) {
  try {
    return zipPayloadForPortal_(envelopeRaw);
  } catch (err) {
    return { error: String(err) };
  }
}

/** Base64 pour le Portail. Le ZIP Drive temporaire est mis à la corbeille. */
function zipPayloadForPortal_(raw) {
  var built = buildZipDownload_(raw);
  if (built.error) return built;
  var fileId = String(built.downloadUrl).split("id=")[1];
  var bytes = DriveApp.getFileById(fileId).getBlob().getBytes();
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (err) {}
  return { count: built.count, zipBase64: Utilities.base64Encode(bytes) };
}

function zipRelayHtml_() {
  return (
    "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Export ZIP</title></head>" +
      "<body style='font-family:system-ui,sans-serif;padding:2rem;max-width:36rem'>" +
      "<h1>Export ZIP</h1>" +
      "<p id='s'>Connexion au Portail RH…</p>" +
      "<script>" +
      "var statusEl=document.getElementById('s');" +
      "function setStatus(t){statusEl.textContent=t;}" +
      "function notify(msg){" +
      "  var seen=[];" +
      "  function send(w){if(!w)return;for(var i=0;i<seen.length;i++){if(seen[i]===w)return;}seen.push(w);try{w.postMessage(msg,'*');}catch(e){}}" +
      "  var p=window;for(var n=0;n<6&&p;n++){try{send(p.opener);}catch(e){}try{if(!p.parent||p.parent===p)break;p=p.parent;}catch(e2){break;}}" +
      "}" +
      "function signalReady(){notify({type:'portail-rh-zip-ready'});}" +
      "window.addEventListener('message',function(ev){" +
      "  var d=ev.data;" +
      "  if(d&&d.type==='portail-rh-zip-ping'){signalReady();return;}" +
      "  if(!d||d.type!=='portail-rh-zip-envelope'||!d.envelope)return;" +
      "  setStatus('Création du ZIP…');" +
      "  google.script.run" +
      "    .withSuccessHandler(function(res){" +
      "      if(!res||res.error){setStatus('Erreur: '+(res&&res.error?res.error:'inconnue'));return;}" +
      "      if(!res.zipBase64){setStatus('Réponse sans ZIP.');return;}" +
      "      notify({type:'portail-rh-zip-b64',zipBase64:res.zipBase64,count:res.count||0});" +
      "      setStatus('ZIP envoyé au Portail. Le fichier protégé se télécharge là-bas.');" +
      "    })" +
      "    .withFailureHandler(function(err){setStatus('Erreur Apps Script: '+err);})" +
      "    .processZipFromPortal(d.envelope);" +
      "});" +
      "signalReady();" +
      "setStatus('En attente du Portail RH…');" +
      "</script></body></html>"
  );
}

/**
 * Crée le ZIP Drive et renvoie { downloadUrl, viewUrl, count } ou { error }.
 */
function buildZipDownload_(raw) {
  if (!raw) return { error: "Envelope manquant." };

  var envelope = typeof raw === "string" ? JSON.parse(raw) : raw;
  var secret = PropertiesService.getScriptProperties().getProperty("SYNC_SECRET");
  if (!secret || !verifyEnvelope_(envelope, secret)) {
    return { error: "Signature invalide. Vérifiez SYNC_SECRET = DRIVE_SYNC_WEBHOOK_SECRET." };
  }

  var body = JSON.parse(envelope.payload);
  var items = body.items || [];
  if (items.length === 0) return { error: "Aucun fichier demandé." };
  if (items.length > MAX_ZIP_ITEMS) {
    return { error: "Trop de fichiers demandés (max " + MAX_ZIP_ITEMS + ")." };
  }

  var blobs = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    try {
      var blob = DriveApp.getFileById(item.fileId).getBlob();
      blob.setName(item.path);
      blobs.push(blob);
    } catch (err) {
      Logger.log("Skipping " + item.fileId + ": " + err);
    }
  }
  if (blobs.length === 0) return { error: "Aucun des fichiers n'a pu être lu sur Drive." };

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var zipBlob = Utilities.zip(blobs, "export.zip");
  zipBlob.setName("export-documents-" + stamp + ".zip");
  var file = DriveApp.createFile(zipBlob);
  return {
    count: blobs.length,
    downloadUrl: "https://drive.google.com/uc?export=download&confirm=t&id=" + file.getId(),
    viewUrl: "https://drive.google.com/file/d/" + file.getId() + "/view",
  };
}

/**
 * Récupère le JSON signé depuis e.parameter, query string, ou corps form-urlencoded.
 * Les POST navigateur arrivent souvent comme "envelope=%7B..." dans postData.contents
 * sans peupler e.parameter — d'où le SyntaxError "Unexpected token 'e'".
 */
function extractEnvelopeRaw_(e) {
  e = e || {};

  // Query string ou form fields déjà décodés par Apps Script
  if (e.parameter && e.parameter.envelope) {
    return { raw: String(e.parameter.envelope), fromBrowser: true };
  }
  if (e.parameters && e.parameters.envelope && e.parameters.envelope.length) {
    return { raw: String(e.parameters.envelope[0]), fromBrowser: true };
  }

  var contents = (e.postData && e.postData.contents) || "";
  if (!contents) {
    return { raw: "", fromBrowser: false };
  }

  var trimmed = String(contents).replace(/^\uFEFF/, "").trim();

  // Déjà du JSON (appel serveur Next.js ou text/plain)
  if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
    return { raw: trimmed, fromBrowser: false };
  }

  // Form POST : n'importe où dans le corps "envelope=<json>"
  var idx = trimmed.toLowerCase().indexOf("envelope=");
  if (idx >= 0) {
    var after = trimmed.substring(idx + "envelope=".length);
    var amp = after.indexOf("&");
    var encoded = amp >= 0 ? after.substring(0, amp) : after;
    var decoded = encoded.replace(/\+/g, " ");
    try {
      decoded = decodeURIComponent(decoded);
    } catch (err) {
      // garder decoded tel quel
    }
    return { raw: decoded, fromBrowser: true };
  }

  return { raw: trimmed, fromBrowser: false };
}

function runZipExport_(rawOrEvent, fromBrowser) {
  try {
    var raw = rawOrEvent;
    if (rawOrEvent && typeof rawOrEvent === "object" && !Array.isArray(rawOrEvent)) {
      if (rawOrEvent.postData || rawOrEvent.parameter) {
        var extracted = extractEnvelopeRaw_(rawOrEvent);
        raw = extracted.raw;
        fromBrowser = extracted.fromBrowser || fromBrowser;
      }
    }

    var payload = zipPayloadForPortal_(raw);
    if (payload.error) {
      if (fromBrowser) return htmlMessage_(payload.error);
      return jsonOutput_({ error: payload.error });
    }

    if (fromBrowser) return htmlZipBase64_(payload.zipBase64, payload.count);
    return jsonOutput_({ zipBase64: payload.zipBase64 });
  } catch (err) {
    var msg = String(err);
    if (fromBrowser) return htmlMessage_(msg);
    return jsonOutput_({ error: msg });
  }
}

function htmlZipBase64_(zipBase64, count) {
  var html = HtmlService.createHtmlOutput(
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>" +
      "<body style='font-family:system-ui,sans-serif;padding:1.5rem'>" +
      "<p>ZIP envoyé au Portail RH. Le fichier protégé se télécharge dans l’onglet du Portail.</p>" +
      "<script>" +
      "var msg={type:'portail-rh-zip-b64',zipBase64:" +
      JSON.stringify(zipBase64) +
      ",count:" +
      JSON.stringify(count) +
      "};" +
      "var seen=[];" +
      "function send(w){if(!w)return;for(var i=0;i<seen.length;i++){if(seen[i]===w)return;}seen.push(w);try{w.postMessage(msg,'*');}catch(e){}}" +
      "var p=window;for(var n=0;n<6&&p;n++){try{send(p.opener);}catch(e){}try{if(!p.parent||p.parent===p)break;p=p.parent;}catch(e2){break;}}" +
      "</script></body></html>",
  );
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function htmlMessage_(text) {
  var html = HtmlService.createHtmlOutput(
    "<!DOCTYPE html><html><body style='font-family:system-ui,sans-serif;padding:2rem'>" +
      "<h1>Export impossible</h1><p>" +
      String(text).replace(/</g, "&lt;") +
      "</p><p style='color:#666;font-size:0.9rem'>Copiez le doGet/doPost depuis scripts/apps-script/sync.gs puis redéployez la Web App.</p></body></html>",
  );
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function verifyEnvelope_(envelope, secret) {
  if (!envelope || !envelope.timestamp || !envelope.signature || !envelope.payload) {
    return false;
  }

  const skewMs = Math.abs(Date.now() - Number(envelope.timestamp));
  if (isNaN(skewMs) || skewMs > 5 * 60 * 1000) return false;

  const expected = Utilities.computeHmacSha256Signature(
    envelope.timestamp + "." + envelope.payload,
    secret,
    Utilities.Charset.UTF_8,
  )
    .map(function (b) {
      return (b < 0 ? b + 256 : b).toString(16).padStart(2, "0");
    })
    .join("");

  return timingSafeEqual_(expected, envelope.signature);
}

/** Apps Script has no built-in constant-time compare — this is the same
 * fixed-length XOR-accumulate approach Node's crypto.timingSafeEqual uses. */
function timingSafeEqual_(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
