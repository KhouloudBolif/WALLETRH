import type { DocumentCategory } from "@/lib/document-category";

export type { DocumentCategory };

export type MockEmployee = {
  matricule: string;
  displayName: string;
  direction: string;
  service: string;
  poste: string;
  statut: string;
  situation: string;
  childrenCount: number;
  documentCount: number;
};

export type MockDocument = {
  id: string;
  employeeMatricule: string;
  fileName: string;
  /** Drive sous-dossier label (e.g. "2- Etat Civil") */
  folder: string;
  category: DocumentCategory;
  modifiedAt: string;
};

export type MockDocumentWithAccess = MockDocument & {
  authorized: boolean;
  webViewLink?: string;
};

export type MockSyncStatus = {
  lastSyncAt: string;
  status: "success" | "running" | "failed";
  filesAdded: number;
  filesUpdated: number;
  filesRemoved: number;
  employeesIndexed: number;
  totalFiles: number;
  driveConnected: false;
  source: "exercise";
};

export type MockSyncLogEntry = {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "failed";
  filesAdded: number;
  filesUpdated: number;
  filesRemoved: number;
};

export type MockPermissionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "RH_MANAGER" | "RH_AGENT";
};

export type MockAccessRule = {
  userId: string;
  category: DocumentCategory;
  canView: boolean;
};

export type DocumentSearchFilters = {
  query?: string;
  category?: DocumentCategory | "ALL";
  minChildren?: number;
};

export type DocumentSearchResult = MockDocumentWithAccess & {
  employee: MockEmployee;
};
