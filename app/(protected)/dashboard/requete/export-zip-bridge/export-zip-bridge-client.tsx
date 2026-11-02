"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";

type ZipPayload = {
  url: string;
  envelope: string;
  fileCount?: number;
};

/**
 * Form POST depuis localhost → Apps Script (doPost).
 * Évite d’ouvrir /exec seul (« export ZIP OK ») et les 403 d’URL GET trop longues.
 */
export default function ExportZipBridgePage() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [payload, setPayload] = useState<ZipPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("key");
    if (!key) {
      setError("Aucun export. Relancez « Excel + fichiers » depuis le Portail RH.");
      return;
    }
    const raw = localStorage.getItem(key);
    if (!raw) {
      setError("Export expiré. Relancez « Excel + fichiers ».");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as ZipPayload;
      if (!parsed.url || !parsed.envelope) {
        setError("Configuration Apps Script manquante (.env APPS_SCRIPT_EXPORT_URL).");
        return;
      }
      setPayload(parsed);
    } catch {
      setError("Données d'export invalides.");
    }
  }, [searchParams]);

  function clearKey() {
    const key = searchParams.get("key");
    if (key) localStorage.removeItem(key);
  }

  if (error) {
    return (
      <main style={mainStyle}>
        <h1 style={titleStyle}>Export ZIP</h1>
        <p style={{ color: "#b91c1c" }}>{error}</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main style={mainStyle}>
        <h1 style={titleStyle}>Export ZIP</h1>
        <p>Préparation…</p>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <h1 style={titleStyle}>Export ZIP</h1>
      <p style={{ marginBottom: "1rem" }}>
        {payload.fileCount
          ? `${payload.fileCount} fichier(s) → enregistrement sur votre PC`
          : "Enregistrement du ZIP sur votre PC"}
      </p>

      <p style={{ color: "#444", fontSize: "0.9rem", marginBottom: "1rem" }}>
        1. Cliquez le bouton rouge
        <br />
        2. Vous devez voir <strong>ZIP prêt</strong> (pas 403, pas « export ZIP OK »)
        <br />
        3. Le fichier arrive dans <strong>Téléchargements</strong>
      </p>

      <form
        ref={formRef}
        method="POST"
        action={payload.url}
        acceptCharset="UTF-8"
        onSubmit={clearKey}
      >
        <input type="hidden" name="envelope" value={payload.envelope} />
        <button type="submit" style={buttonStyle}>
          Enregistrer le ZIP sur mon PC
        </button>
      </form>

      <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "1.25rem" }}>
        Si <strong>403</strong> : dans Apps Script → Gérer les déploiements → accès = « Tous les
        utilisateurs Veolia », Exécuter = Moi. Ouvrez une fois l’URL /exec seule (compte Veolia
        uniquement, fenêtre privée), puis réessayez.
      </p>
      <p style={{ color: "#aaa", fontSize: "0.75rem", wordBreak: "break-all" }}>{payload.url}</p>
    </main>
  );
}

const mainStyle: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  padding: "2rem",
  maxWidth: "40rem",
};

const titleStyle: CSSProperties = {
  fontSize: "1.25rem",
  marginBottom: "0.75rem",
};

const buttonStyle: CSSProperties = {
  background: "#b42318",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "0.65rem 1.1rem",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
};
