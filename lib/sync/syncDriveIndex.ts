/**
 * Core sync job — indexes the storage backend into PostgreSQL.
 *
 * 1. Import employee metadata from the Base sheet (upsert by matricule).
 * 2. Walk the storage tree: {matricule}/{sous-dossier}/*.pdf → upsert DriveFile.
 * 3. Remove stale DriveFile rows that no longer exist in the backend.
 * 4. Archive employees whose matricule folder is no longer on Drive.
 * 5. Write a SyncLog row with counts.
 *
 * `reconcileDriveIndex` is the provider-agnostic reconciliation step (steps 1–4
 * above, minus listing the tree). `syncDriveIndex` drives it from the local
 * exercise provider; the Google Apps Script webhook (app/api/sync/apps-script)
 * drives it from a pushed payload instead — see lib/storage/storageProvider.ts.
 */

import { createHash } from "node:crypto";
import { replaceEmployeeInformation } from "@/lib/completeness/sheet-catalog";
import { prisma } from "@/lib/db";
import { parseExcelBase } from "@/lib/import/parseExcelBase";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import { syncFailureAlertHtml } from "@/lib/mail/templates";
import { folderToCategory, parseFilename } from "@/lib/storage/codification";
import { getStorageProvider } from "@/lib/storage/storageProvider";

/** Skip re-alerting for the same source if we already sent one recently — a hard
 * first-chunk failure can retry (and re-fail) several times within seconds. */
const ALERT_THROTTLE_MS = 60 * 60 * 1000;

export type SyncResult = {
  syncLogId: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  employeesIndexed: number;
  filesAdded: number;
  filesUpdated: number;
  filesRemoved: number;
  unknownFolders: string[];
  errorMessage?: string;
};

export type RawEmployeeInput = {
  matricule: string;
  displayName: string;
  genre: string | null;
  cin: string | null;
  age: number | null;
  anciennete: number | null;
  direction: string | null;
  service: string | null;
  poste: string | null;
  statut: string | null;
  situation: string | null;
  entite: string | null;
  sousEntite: string | null;
  zone: string | null;
  agence: string | null;
  college: string | null;
  admTech: string | null;
  position: string | null;
  encadrant: boolean | null;
  niveau: string | null;
  grade: string | null;
  categorieRh: string | null;
  managerMatricule: string | null;
  dateEntree: Date | null;
  dateDepart: Date | null;
  metadata: Record<string, string>;
  searchText: string;
};

export type RawFileInput = {
  matricule: string;
  folderName: string;
  /** Backend-native file id (Drive file ID, or relative path for the local provider) */
  backendFileId: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  modifiedAt: Date | null;
};

export type ReconcileInput = {
  employees?: RawEmployeeInput[];
  files: RawFileInput[];
  employeeInformation?: {
    matricule: string;
    prenom: string | null;
    nom: string | null;
    genre: string | null;
    statut: string | null;
    college: string | null;
    situation: string | null;
    nbEnfants: number;
  }[];
  /** Matricule folders present on Drive for this run. Absent on older webhook payloads. */
  driveMatricules?: string[];
};

/**
 * Employees whose matricule folder was not seen in this sync go to the annuaire
 * archive. A folder that comes back clears archivedAt. Older webhook payloads
 * omit driveMatricules: we then infer presence from files touched in this run,
 * and skip the step entirely when that set is empty so a failed empty push
 * cannot archive the whole workforce.
 */
async function archiveMissingDriveFolders(startedAt: Date, input: ReconcileInput) {
  const seen = new Set<string>();

  if (input.driveMatricules) {
    for (const matricule of input.driveMatricules) {
      const trimmed = matricule.trim();
      if (trimmed) seen.add(trimmed);
    }
  } else {
    const touched = await prisma.driveFile.findMany({
      where: { updatedAt: { gte: startedAt } },
      select: { employee: { select: { matricule: true } } },
    });
    for (const row of touched) seen.add(row.employee.matricule);
    if (seen.size === 0) return;
  }

  const now = new Date();
  const present = [...seen];

  if (present.length === 0) {
    await prisma.employee.updateMany({
      where: { archivedAt: null },
      data: { archivedAt: now },
    });
    return;
  }

  await prisma.employee.updateMany({
    where: { matricule: { in: present }, NOT: { archivedAt: null } },
    data: { archivedAt: null },
  });
  await prisma.employee.updateMany({
    where: { matricule: { notIn: present }, archivedAt: null },
    data: { archivedAt: now },
  });
}

function stableFileId(source: string, backendFileId: string): string {
  return createHash("sha256").update(`${source}:${backendFileId}`).digest("hex").slice(0, 32);
}

export async function startSyncRun(source: string) {
  return prisma.syncLog.create({ data: { status: "RUNNING", source } });
}

async function appendUnknownFolders(syncLogId: string, unknownFolders: string[]) {
  if (!unknownFolders.length) return;

  const current = await prisma.syncLog.findUniqueOrThrow({
    where: { id: syncLogId },
    select: { errorMessage: true },
  });
  const existing = current.errorMessage?.startsWith("Dossiers non reconnus : ")
    ? current.errorMessage.replace("Dossiers non reconnus : ", "").split(", ")
    : [];
  const merged = [...new Set([...existing, ...unknownFolders])];

  await prisma.syncLog.update({
    where: { id: syncLogId },
    data: { errorMessage: `Dossiers non reconnus : ${merged.join(", ")}` },
  });
}

/**
 * Marks a SyncLog FAILED and — best-effort, throttled — emails active admins.
 * An alert-send failure must never break the caller's own failure handling,
 * so everything past the status update is wrapped in its own try/catch.
 */
async function markSyncFailed(
  syncLogId: string,
  source: string,
  startedAt: Date,
  message: string,
): Promise<void> {
  await prisma.syncLog.update({
    where: { id: syncLogId },
    data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
  });

  try {
    if (!isSmtpConfigured()) return;

    const recentAlert = await prisma.syncLog.findFirst({
      where: {
        source,
        status: "FAILED",
        alertSentAt: { gte: new Date(Date.now() - ALERT_THROTTLE_MS) },
      },
      orderBy: { alertSentAt: "desc" },
    });
    if (recentAlert) return;

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { email: true, name: true },
    });
    if (admins.length === 0) return;

    const html = syncFailureAlertHtml({ source, errorMessage: message, startedAt });
    await Promise.all(
      admins.map((admin) =>
        sendMail({
          to: admin.email,
          subject: "Échec de synchronisation — Portail RH",
          html,
        }),
      ),
    );

    await prisma.syncLog.update({ where: { id: syncLogId }, data: { alertSentAt: new Date() } });
  } catch (alertError) {
    console.error("[sync] failed to send sync-failure alert", alertError);
  }
}

/**
 * Reconcile one batch of employees/files into the DB against an already-open
 * SyncLog (see startSyncRun). Safe to call multiple times for the same
 * syncLogId (chunked webhook pushes) — pass `isFinal: true` on the last call
 * to remove stale DriveFile rows and close out the SyncLog.
 *
 * `storeLocalPath` should only be true for the local exercise provider, where
 * `backendFileId` is a filesystem-relative path rather than a Drive file ID.
 */
export async function reconcileDriveIndex(
  syncLogId: string,
  source: string,
  input: ReconcileInput,
  opts: { isFinal: boolean; storeLocalPath?: boolean },
): Promise<SyncResult> {
  const log = await prisma.syncLog.findUniqueOrThrow({ where: { id: syncLogId } });

  let employeesIndexed = 0;
  let filesAdded = 0;
  let filesUpdated = 0;
  let filesRemoved = 0;
  const unknownFolders: string[] = [];

  try {
    // 1. Employee metadata
    const employeeByMatricule = new Map<string, string>();
    for (const row of input.employees ?? []) {
      const fields = {
        displayName: row.displayName,
        genre: row.genre,
        cin: row.cin,
        age: row.age,
        anciennete: row.anciennete,
        direction: row.direction,
        service: row.service,
        poste: row.poste,
        statut: row.statut,
        situation: row.situation,
        entite: row.entite,
        sousEntite: row.sousEntite,
        zone: row.zone,
        agence: row.agence,
        college: row.college,
        admTech: row.admTech,
        position: row.position,
        encadrant: row.encadrant,
        niveau: row.niveau,
        grade: row.grade,
        categorieRh: row.categorieRh,
        managerMatricule: row.managerMatricule,
        dateEntree: row.dateEntree,
        dateDepart: row.dateDepart,
        metadata: row.metadata,
        searchText: row.searchText,
      };
      const employee = await prisma.employee.upsert({
        where: { matricule: row.matricule },
        create: { matricule: row.matricule, ...fields },
        update: fields,
      });
      employeeByMatricule.set(row.matricule, employee.id);
    }
    employeesIndexed = input.employees?.length ?? 0;

    // 1b. Employee situation / enfants from Sheet "Complétude des dossiers"
    if (input.employeeInformation) {
      await replaceEmployeeInformation(input.employeeInformation);
    }

    // 2. Files, grouped by matricule
    const filesByMatricule = new Map<string, RawFileInput[]>();
    for (const file of input.files) {
      const list = filesByMatricule.get(file.matricule) ?? [];
      list.push(file);
      filesByMatricule.set(file.matricule, list);
    }

    for (const [matricule, files] of filesByMatricule) {
      let employeeId = employeeByMatricule.get(matricule);

      // Drive folder without a Base row (e.g. external manager) — index anyway
      if (!employeeId) {
        const employee = await prisma.employee.upsert({
          where: { matricule },
          create: { matricule, displayName: matricule, searchText: matricule },
          update: {},
        });
        employeeId = employee.id;
        employeeByMatricule.set(matricule, employeeId);
      }

      for (const file of files) {
        const category = folderToCategory(file.folderName);
        if (!category) {
          unknownFolders.push(`${matricule}/${file.folderName}`);
          continue;
        }

        const parsed = parseFilename(file.name);
        const driveFileId = stableFileId(source, file.backendFileId);

        const data = {
          name: file.name,
          mimeType: file.mimeType,
          category,
          folderName: file.folderName,
          documentType: parsed.documentType,
          webViewLink: file.webViewLink,
          localPath: opts.storeLocalPath ? file.backendFileId : null,
          employeeId,
          parsedMetadata: {
            enfant: parsed.enfant,
            conjoint: parsed.conjoint,
            dateToken: parsed.dateToken,
          },
          driveModifiedAt: file.modifiedAt,
        };

        const existing = await prisma.driveFile.findUnique({
          where: { driveFileId },
          select: { id: true },
        });

        if (existing) {
          await prisma.driveFile.update({ where: { driveFileId }, data });
          filesUpdated += 1;
        } else {
          await prisma.driveFile.create({ data: { driveFileId, ...data } });
          filesAdded += 1;
        }
      }

      // Re-derive from all currently known files for this employee (not just
      // this chunk) so counts stay correct across multiple chunked calls.
      const allFiles = await prisma.driveFile.findMany({
        where: { employeeId },
        select: { parsedMetadata: true },
      });
      const enfants = new Set<string>();
      let hasSpouse = false;
      for (const f of allFiles) {
        const meta = f.parsedMetadata as { enfant?: string | null; conjoint?: boolean } | null;
        if (meta?.enfant) enfants.add(meta.enfant.toLowerCase());
        if (meta?.conjoint) hasSpouse = true;
      }

      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          lastSyncedAt: new Date(),
          childrenCount: enfants.size,
          hasSpouseDocument: hasSpouse,
        },
      });
    }

    await appendUnknownFolders(syncLogId, unknownFolders);
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        employeesIndexed: { increment: employeesIndexed },
        filesAdded: { increment: filesAdded },
        filesUpdated: { increment: filesUpdated },
      },
    });

    if (opts.isFinal) {
      // 3. Remove stale rows: anything not touched since this run started.
      const removed = await prisma.driveFile.deleteMany({
        where: { updatedAt: { lt: log.startedAt } },
      });
      filesRemoved = removed.count;

      await archiveMissingDriveFolders(log.startedAt, input);

      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: { status: "SUCCESS", finishedAt: new Date(), filesRemoved },
      });
    }

    const final = await prisma.syncLog.findUniqueOrThrow({ where: { id: syncLogId } });
    return {
      syncLogId,
      status: final.status,
      employeesIndexed: final.employeesIndexed,
      filesAdded: final.filesAdded,
      filesUpdated: final.filesUpdated,
      filesRemoved: final.filesRemoved,
      unknownFolders,
      errorMessage: final.errorMessage ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await markSyncFailed(syncLogId, source, log.startedAt, message);
    return {
      syncLogId,
      status: "FAILED",
      employeesIndexed,
      filesAdded,
      filesUpdated,
      filesRemoved,
      unknownFolders,
      errorMessage: message,
    };
  }
}

export async function syncDriveIndex(): Promise<SyncResult> {
  const provider = getStorageProvider();
  const log = await startSyncRun(provider.source);

  try {
    const baseRows = await parseExcelBase();
    const employees: RawEmployeeInput[] = baseRows;

    const files: RawFileInput[] = [];
    const matriculeFolders = await provider.listFolders("");
    const driveMatricules = matriculeFolders
      .map((folder) => folder.name.trim())
      .filter(Boolean);

    for (const employeeFolder of matriculeFolders) {
      const matricule = employeeFolder.name.trim();
      const subFolders = await provider.listFolders(employeeFolder.id);

      for (const subFolder of subFolders) {
        const folderFiles = await provider.listFiles(subFolder.id);
        for (const file of folderFiles) {
          files.push({
            matricule,
            folderName: subFolder.name,
            backendFileId: file.id,
            name: file.name,
            mimeType: file.mimeType,
            webViewLink: file.webViewLink ?? null,
            modifiedAt: file.modifiedAt ?? null,
          });
        }
      }
    }

    return await reconcileDriveIndex(
      log.id,
      provider.source,
      { employees, files, driveMatricules },
      { isFinal: true, storeLocalPath: Boolean(provider.getLocalPath) },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await markSyncFailed(log.id, provider.source, log.startedAt, message);
    return {
      syncLogId: log.id,
      status: "FAILED",
      employeesIndexed: 0,
      filesAdded: 0,
      filesUpdated: 0,
      filesRemoved: 0,
      unknownFolders: [],
      errorMessage: message,
    };
  }
}

export async function getSyncOverview() {
  const [lastLog, history, employeeCount, fileCount] = await Promise.all([
    prisma.syncLog.findFirst({
      where: { status: { not: "RUNNING" } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.employee.count(),
    prisma.driveFile.count(),
  ]);

  return { lastLog, history, employeeCount, fileCount };
}
