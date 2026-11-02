import { Suspense } from "react";
import ExportZipBridgePage from "./export-zip-bridge-client";

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: "2rem", fontFamily: "system-ui" }}>Chargement…</p>}>
      <ExportZipBridgePage />
    </Suspense>
  );
}
