/**
 * ============================================================================
 * COPIEZ TOUT CE FICHIER dans un projet Apps Script (idéalement NOUVEAU projet).
 * Puis : Déployer → Nouveau déploiement → Application Web
 *   - Exécuter en tant que : Moi
 *   - Qui a accès : Tous les utilisateurs de veolia.com
 * Copiez l'URL /exec dans .env → APPS_SCRIPT_EXPORT_URL
 * Redémarrez le portail (npm run dev).
 *
 * Propriété Script obligatoire (Paramètres du projet → Propriétés du script) :
 *   SYNC_SECRET  =  la même valeur que DRIVE_SYNC_WEBHOOK_SECRET du .env
 * ============================================================================
 */

var MAX_ZIP_ITEMS = 150;

function doGet(e) {
  e = e || {};
  if (e.parameter && e.parameter.envelope) {
    return runBrowserZip_(String(e.parameter.envelope));
  }
  return HtmlService.createHtmlOutput(relayPage_()).setTitle("Export ZIP Portail RH");
}

function doPost(e) {
  e = e || {};
  var raw = "";
  if (e.parameter && e.parameter.envelope) {
    raw = String(e.parameter.envelope);
  } else if (e.postData && e.postData.contents) {
    var c = String(e.postData.contents);
    if (c.charAt(0) === "{") {
      raw = c;
    } else {
      var i = c.toLowerCase().indexOf("envelope=");
      if (i >= 0) {
        var rest = c.substring(i + 9);
        var amp = rest.indexOf("&");
        raw = amp >= 0 ? rest.substring(0, amp) : rest;
        raw = raw.replace(/\+/g, " ");
        try {
          raw = decodeURIComponent(raw);
        } catch (err) {}
      } else {
        raw = c;
      }
    }
  }
  if (!raw) {
    return htmlMsg_("Envelope manquant.");
  }

  // Bouton Synchroniser du portail — ce fichier ZIP-only ne contient pas runSync.
  // Utilisez le projet sync.gs (Drive + Base) comme Web App, ou fusionnez les scripts.
  var syncHint = trySyncTriggerHint_(raw);
  if (syncHint) return syncHint;

  // JSON brut (serveur) → zipBase64 ; sinon page HTML téléchargement
  if (e.postData && e.postData.type && e.postData.type.indexOf("json") >= 0) {
    return runServerZip_(raw);
  }
  if (raw.charAt(0) === "{" && !(e.parameter && e.parameter.envelope)) {
    // text/plain JSON depuis fetch navigateur ou serveur
    try {
      return runServerZip_(raw);
    } catch (err2) {
      return runBrowserZip_(raw);
    }
  }
  return runBrowserZip_(raw);
}

function trySyncTriggerHint_(raw) {
  try {
    var envelope = JSON.parse(raw);
    if (!envelope || !envelope.payload) return null;
    var body = JSON.parse(envelope.payload);
    if (!body || body.action !== "runSync") return null;
    return ContentService.createTextOutput(
      JSON.stringify({
        error:
          "Ce projet Apps Script est ZIP-only. Pour Synchroniser depuis le portail, déployez scripts/apps-script/sync.gs en Web App (même URL dans APPS_SCRIPT_EXPORT_URL) — il contient runSync + l’export ZIP.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return null;
  }
}

/** Appelé par la page relais. Renvoie le ZIP en base64 — pas de téléchargement Drive. */
function processZipFromPortal(envelopeRaw) {
  try {
    return zipPayload_(envelopeRaw);
  } catch (err) {
    return { error: String(err) };
  }
}

/** ZIP en base64, fichier Drive temporaire mis à la corbeille (pas de ZIP ouvert). */
function zipPayload_(raw) {
  var built = buildZip_(raw);
  if (built.error) return built;
  var fileId = String(built.downloadUrl).split("id=")[1];
  var bytes = DriveApp.getFileById(fileId).getBlob().getBytes();
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (err) {}
  return { count: built.count, zipBase64: Utilities.base64Encode(bytes) };
}

function relayPage_() {
  return (
    "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Export ZIP</title></head>" +
      "<body style='font-family:system-ui;padding:2rem;max-width:36rem'>" +
      "<h1>Export ZIP</h1>" +
      "<p id='s'>En attente du Portail RH…</p>" +
      "<script>" +
      "var s=document.getElementById('s');" +
      "function ready(){if(window.opener)window.opener.postMessage({type:'portail-rh-zip-ready'},'*');}" +
      "window.addEventListener('message',function(ev){" +
      "  var d=ev.data; if(!d)return;" +
      "  if(d.type==='portail-rh-zip-ping'){ready();return;}" +
      "  if(d.type!=='portail-rh-zip-envelope'||!d.envelope)return;" +
      "  s.textContent='Création du ZIP…';" +
      "  google.script.run.withSuccessHandler(function(r){" +
      "    if(!r||r.error){s.textContent='Erreur: '+(r&&r.error||'?');return;}" +
      "    if(r.zipBase64){" +
      "      var msg={type:'portail-rh-zip-b64',zipBase64:r.zipBase64,count:r.count||0};" +
      "      try{if(window.opener)window.opener.postMessage(msg,'*');}catch(e){}" +
      "      s.textContent='ZIP envoyé au Portail. Le fichier protégé se télécharge là-bas.';" +
      "      return;" +
      "    }" +
      "    s.textContent='Réponse sans contenu ZIP.';" +
      "  }).withFailureHandler(function(e){s.textContent='Erreur: '+e;})" +
      "  .processZipFromPortal(d.envelope);" +
      "});" +
      "ready();" +
      "if(!window.opener)s.textContent='Ouvrez via Excel + fichiers dans le Portail RH.';" +
      "</script></body></html>"
  );
}

function buildZip_(raw) {
  if (!raw) return { error: "Envelope manquant." };
  var envelope = typeof raw === "string" ? JSON.parse(raw) : raw;
  var secret = PropertiesService.getScriptProperties().getProperty("SYNC_SECRET");
  if (!secret || !verify_(envelope, secret)) {
    return { error: "Signature invalide (SYNC_SECRET)." };
  }
  var items = JSON.parse(envelope.payload).items || [];
  if (!items.length) return { error: "Aucun fichier." };
  if (items.length > MAX_ZIP_ITEMS) return { error: "Trop de fichiers (max " + MAX_ZIP_ITEMS + ")." };

  var blobs = [];
  for (var i = 0; i < items.length; i++) {
    try {
      var b = DriveApp.getFileById(items[i].fileId).getBlob();
      b.setName(items[i].path);
      blobs.push(b);
    } catch (err) {
      Logger.log(err);
    }
  }
  if (!blobs.length) return { error: "Impossible de lire les fichiers Drive." };

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var zip = Utilities.zip(blobs, "export.zip");
  zip.setName("export-documents-" + stamp + ".zip");
  var file = DriveApp.createFile(zip);
  return {
    count: blobs.length,
    downloadUrl: "https://drive.google.com/uc?export=download&confirm=t&id=" + file.getId(),
    viewUrl: "https://drive.google.com/file/d/" + file.getId() + "/view",
  };
}

function runBrowserZip_(raw) {
  var r = zipPayload_(raw);
  if (r.error) return htmlMsg_(r.error);
  // N'ouvre PAS le ZIP Drive : le Portail chiffre puis télécharge uniquement le fichier protégé.
  var html = HtmlService.createHtmlOutput(
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>" +
      "<body style='font-family:system-ui;padding:1.5rem'>" +
      "<p>ZIP envoyé au Portail RH. Le fichier protégé se télécharge dans l’onglet du Portail.</p>" +
      "<script>" +
      "var msg={type:'portail-rh-zip-b64',zipBase64:" +
      JSON.stringify(r.zipBase64) +
      ",count:" +
      JSON.stringify(r.count) +
      "};" +
      "try{if(window.opener){window.opener.postMessage(msg,'*');}}catch(e){}" +
      "try{if(window.parent&&window.parent!==window){window.parent.postMessage(msg,'*');}}catch(e){}" +
      "</script></body></html>",
  );
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function runServerZip_(raw) {
  var r = zipPayload_(raw);
  if (r.error) {
    return ContentService.createTextOutput(JSON.stringify({ error: r.error })).setMimeType(
      ContentService.MimeType.JSON,
    );
  }
  return ContentService.createTextOutput(JSON.stringify({ zipBase64: r.zipBase64 })).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function verify_(envelope, secret) {
  if (!envelope || !envelope.timestamp || !envelope.signature || !envelope.payload) return false;
  var skew = Math.abs(Date.now() - Number(envelope.timestamp));
  if (isNaN(skew) || skew > 5 * 60 * 1000) return false;
  var expected = Utilities.computeHmacSha256Signature(
    envelope.timestamp + "." + envelope.payload,
    secret,
    Utilities.Charset.UTF_8,
  )
    .map(function (b) {
      return (b < 0 ? b + 256 : b).toString(16).padStart(2, "0");
    })
    .join("");
  if (expected.length !== envelope.signature.length) return false;
  var diff = 0;
  for (var i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
  }
  return diff === 0;
}

function htmlMsg_(t) {
  return HtmlService.createHtmlOutput(
    "<!DOCTYPE html><html><body style='font-family:system-ui;padding:2rem'><h1>Export impossible</h1><p>" +
      String(t).replace(/</g, "&lt;") +
      "</p></body></html>",
  );
}
