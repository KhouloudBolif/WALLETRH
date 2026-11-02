import { mockDocuments } from "@/lib/mock/documents";
import { mockEmployees } from "@/lib/mock/employees";
import type { MockSyncLogEntry, MockSyncStatus } from "@/lib/mock/types";

export const mockSyncStatus: MockSyncStatus = {
  lastSyncAt: "2026-06-10T08:00:00Z",
  status: "success",
  filesAdded: 110,
  filesUpdated: 0,
  filesRemoved: 0,
  employeesIndexed: mockEmployees.length,
  totalFiles: mockDocuments.length,
  driveConnected: false,
  source: "exercise",
};

export const mockSyncHistory: MockSyncLogEntry[] = [
  {
    id: "sync-001",
    startedAt: "2026-06-10T08:00:00Z",
    finishedAt: "2026-06-10T08:00:12Z",
    status: "success",
    filesAdded: 110,
    filesUpdated: 0,
    filesRemoved: 0,
  },
  {
    id: "sync-002",
    startedAt: "2026-06-09T08:00:00Z",
    finishedAt: "2026-06-09T08:00:11Z",
    status: "success",
    filesAdded: 0,
    filesUpdated: 110,
    filesRemoved: 0,
  },
];
