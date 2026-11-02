import { canViewCategoryFromMap } from "@/lib/permissions/defaults";
import type { CategoryAccessMap } from "@/lib/permissions/types";
import { getDocumentsByMatricule } from "@/lib/mock/documents";
import type { MockDocument, MockDocumentWithAccess } from "@/lib/mock/types";

export function applyAccessToDocument(
  doc: MockDocument,
  access: CategoryAccessMap,
): MockDocumentWithAccess {
  const authorized = canViewCategoryFromMap(access, doc.category);
  return {
    ...doc,
    authorized,
    webViewLink: authorized
      ? `https://drive.google.com/file/d/exercise-${doc.id}/view`
      : undefined,
  };
}

export function getDocumentsForMatricule(
  matricule: string,
  access: CategoryAccessMap,
): MockDocumentWithAccess[] {
  return getDocumentsByMatricule(matricule).map((doc) =>
    applyAccessToDocument(doc, access),
  );
}
