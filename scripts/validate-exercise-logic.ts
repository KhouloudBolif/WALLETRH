/**
 * Exercise logic + data integrity tests (no test framework required).
 * Run: npm run test:exercise
 */
import fs from "node:fs";
import path from "node:path";
import {
  allCategories,
  categoryLabels,
  driveFolderToCategory,
} from "../lib/document-category";
import { applyAccessToDocument } from "../lib/mock/access";
import { mockDocuments } from "../lib/mock/documents";
import { mockEmployees } from "../lib/mock/employees";
import { searchMockDocuments } from "../lib/mock/search";
import {
  canViewCategoryFromMap,
  getDefaultAccessMap,
} from "../lib/permissions/defaults";
import { parseFilename } from "../lib/storage/codification";

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, ok: condition, detail });
  const icon = condition ? "✓" : "✗";
  console.log(`${icon} ${name}${detail && !condition ? ` — ${detail}` : ""}`);
}

const ROOT = path.resolve(__dirname, "..");
const DEBUT = path.join(ROOT, "doc", "debut");
const DRIVE = path.join(DEBUT, "Dossiers Digitaux");

const EXPECTED_MATRICULES = [
  "100001",
  "100002",
  "100003",
  "100004",
  "100005",
  "100006",
  "100007",
  "100008",
  "100009",
  "100010",
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/'/g, "_");
}

function scanDrivePdfs(): { matricule: string; folder: string; fileName: string }[] {
  const entries: { matricule: string; folder: string; fileName: string }[] = [];
  if (!fs.existsSync(DRIVE)) return entries;

  for (const matricule of fs.readdirSync(DRIVE).sort()) {
    const empPath = path.join(DRIVE, matricule);
    if (!fs.statSync(empPath).isDirectory()) continue;

    for (const folder of fs.readdirSync(empPath).sort()) {
      const folderPath = path.join(empPath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      for (const fileName of fs.readdirSync(folderPath).sort()) {
        if (!fileName.toLowerCase().endsWith(".pdf")) continue;
        entries.push({ matricule, folder, fileName });
      }
    }
  }
  return entries;
}

function testEmployeeData() {
  console.log("\n--- Employees (Base sheet alignment) ---");

  assert("Exactly 10 employees", mockEmployees.length === 10);
  assert(
    "Matricules 100001–100010",
    mockEmployees.every((e) => EXPECTED_MATRICULES.includes(e.matricule)),
  );

  for (const mat of EXPECTED_MATRICULES) {
    const emp = mockEmployees.find((e) => e.matricule === mat);
    assert(`Employee ${mat} exists`, !!emp);
    if (emp) {
      assert(`Employee ${mat} has displayName`, emp.displayName.length > 0);
      assert(`Employee ${mat} has service`, emp.service.length > 0);
      assert(`Employee ${mat} documentCount = 11`, emp.documentCount === 11);
    }
  }
}

function testDocumentData() {
  console.log("\n--- Documents (Drive folder alignment) ---");

  assert("Exactly 110 documents", mockDocuments.length === 110);

  const perEmployee = new Map<string, number>();
  for (const doc of mockDocuments) {
    perEmployee.set(doc.employeeMatricule, (perEmployee.get(doc.employeeMatricule) ?? 0) + 1);
  }

  for (const mat of EXPECTED_MATRICULES) {
    assert(`Employee ${mat} has 11 PDFs`, perEmployee.get(mat) === 11);
  }

  for (const doc of mockDocuments) {
    assert(
      `Doc ${doc.id} has valid category`,
      allCategories.includes(doc.category),
      doc.category,
    );
    assert(
      `Doc ${doc.id} filename starts with matricule`,
      doc.fileName.startsWith(`${doc.employeeMatricule}_`),
      doc.fileName,
    );
    assert(`Doc ${doc.id} folder maps to category`, driveFolderToCategory[doc.folder] === doc.category);
    assert(`Doc ${doc.id} is PDF`, doc.fileName.toLowerCase().endsWith(".pdf"));
  }

  const foldersWithFiles = new Set(mockDocuments.map((d) => d.folder));
  assert(
    "Exercise has files in 6 sous-dossiers (7- Divers empty by design)",
    foldersWithFiles.size === 6,
    `found ${foldersWithFiles.size}: ${[...foldersWithFiles].join(", ")}`,
  );
  assert(
    "DIVERS category defined for empty folders",
    allCategories.includes("DIVERS"),
  );
}

function testDriveFilesystemMatch() {
  console.log("\n--- Drive filesystem vs mock ---");

  const onDisk = scanDrivePdfs();
  assert("Drive folder exists", fs.existsSync(DRIVE));
  assert("Drive has 110 PDFs", onDisk.length === 110);

  const mockSet = new Set(
    mockDocuments.map((d) => `${d.employeeMatricule}|${d.folder}|${normalize(d.fileName)}`),
  );
  const diskSet = new Set(
    onDisk.map((d) => `${d.matricule}|${d.folder}|${normalize(d.fileName)}`),
  );

  const onlyDisk = [...diskSet].filter((x) => !mockSet.has(x));
  const onlyMock = [...mockSet].filter((x) => !diskSet.has(x));

  assert("All disk files in mock", onlyDisk.length === 0, onlyDisk.slice(0, 3).join(", "));
  assert("All mock files on disk", onlyMock.length === 0, onlyMock.slice(0, 3).join(", "));
}

function testCategories() {
  console.log("\n--- Document categories ---");

  assert("7 categories defined", allCategories.length === 7);
  assert(
    "All categories have French labels",
    allCategories.every((c) => categoryLabels[c].length > 0),
  );
  assert(
    "driveFolderToCategory has 7 entries",
    Object.keys(driveFolderToCategory).length === 7,
  );
}

function testDefaultAccess() {
  console.log("\n--- Default access maps (new portal users) ---");

  const adminAccess = getDefaultAccessMap("ADMIN");
  const managerAccess = getDefaultAccessMap("RH_MANAGER");
  const agentAccess = getDefaultAccessMap("RH_AGENT");

  assert(
    "ADMIN default: all folders",
    allCategories.every((c) => adminAccess[c]),
  );
  assert(
    "RH_MANAGER default: all folders",
    allCategories.every((c) => managerAccess[c]),
  );
  assert("RH_AGENT default: Recrutement", agentAccess.RECRUTEMENT === true);
  assert("RH_AGENT default: Etat civil", agentAccess.ETAT_CIVIL === true);
  assert("RH_AGENT default: no Depart", agentAccess.DEPART === false);
  assert("RH_AGENT default: no Arretes", agentAccess.ARRETES === false);
}

function testRoleAccess() {
  console.log("\n--- Access map applied to documents ---");

  const adminAccess = getDefaultAccessMap("ADMIN");
  const agentAccess = getDefaultAccessMap("RH_AGENT");

  assert(
    "ADMIN can view ETAT_CIVIL",
    canViewCategoryFromMap(adminAccess, "ETAT_CIVIL"),
  );
  assert("ADMIN can view DEPART", canViewCategoryFromMap(adminAccess, "DEPART"));
  assert(
    "RH_AGENT can view RECRUTEMENT",
    canViewCategoryFromMap(agentAccess, "RECRUTEMENT"),
  );
  assert(
    "RH_AGENT cannot view DEPART",
    !canViewCategoryFromMap(agentAccess, "DEPART"),
  );

  const sample = mockDocuments.find((d) => d.category === "DEPART");
  if (sample) {
    const adminDoc = applyAccessToDocument(sample, adminAccess);
    const agentDoc = applyAccessToDocument(sample, agentAccess);
    assert("ADMIN authorized on DEPART doc", adminDoc.authorized === true);
    assert("RH_AGENT denied on DEPART doc", agentDoc.authorized === false);
    assert("Denied doc has no webViewLink", agentDoc.webViewLink === undefined);
    assert("Allowed doc has webViewLink", !!adminDoc.webViewLink);
  }
}

function testSearch() {
  console.log("\n--- Search logic ---");

  const adminAccess = getDefaultAccessMap("ADMIN");
  const agentAccess = getDefaultAccessMap("RH_AGENT");

  const byName = searchMockDocuments({ query: "El Amrani" }, adminAccess);
  assert("Search 'El Amrani' finds employee", byName.length > 0);
  assert(
    "Search 'El Amrani' all for matricule 100001",
    byName.every((r) => r.employee.matricule === "100001"),
  );

  const byMatricule = searchMockDocuments({ query: "100003" }, adminAccess);
  assert("Search matricule 100003 returns 11 docs", byMatricule.length === 11);

  const recrutement = searchMockDocuments({ category: "RECRUTEMENT" }, adminAccess);
  assert("Filter RECRUTEMENT: 30 docs (10×3)", recrutement.length === 30);

  const agentSearch = searchMockDocuments({ query: "100001" }, agentAccess);
  const agentAllowed = agentSearch.filter((r) => r.authorized);
  const agentDenied = agentSearch.filter((r) => !r.authorized);
  assert("RH_AGENT search 100001 has allowed docs", agentAllowed.length > 0);
  assert("RH_AGENT search 100001 has denied docs", agentDenied.length > 0);
  assert(
    "RH_AGENT allowed docs are RECRUTEMENT or ETAT_CIVIL only",
    agentAllowed.every(
      (r) => r.category === "RECRUTEMENT" || r.category === "ETAT_CIVIL",
    ),
  );

  const noMatch = searchMockDocuments({ query: "ZZZZNOTFOUND" }, adminAccess);
  assert("Search nonsense returns empty", noMatch.length === 0);
}

function testCodificationParsing() {
  console.log("\n--- Filename codification: _Conjoint token ---");
  // The exercise dataset has no real spouse documents (`_Conjoint` token),
  // so this exercises `parseFilename()` directly against the codification
  // catalog's documented patterns (doc/debut/exercice/CODIFICATION.md).

  const cinConjoint = parseFilename("100001_CIN_Conjoint.pdf");
  assert("CIN_Conjoint parses matricule", cinConjoint.matricule === "100001");
  assert("CIN_Conjoint sets conjoint = true", cinConjoint.conjoint === true);
  assert("CIN_Conjoint documentType strips the token", cinConjoint.documentType === "CIN");

  const numberedConjoint = parseFilename("100002_Certificat de Vie_Conjoint1.pdf");
  assert("Certificat de Vie_Conjoint1 sets conjoint = true", numberedConjoint.conjoint === true);
  assert(
    "Certificat de Vie_Conjoint1 documentType strips the numbered token",
    numberedConjoint.documentType === "Certificat de Vie",
  );

  const birthConjoint = parseFilename("100003_Extrait Acte de Naissance_Conjoint.pdf");
  assert("Extrait Acte de Naissance_Conjoint sets conjoint = true", birthConjoint.conjoint === true);

  const noConjoint = parseFilename("100004_Contrat.pdf");
  assert("Plain document has conjoint = false", noConjoint.conjoint === false);

  const enfant = parseFilename("100005_Extrait Acte de Naissance_Enfant_Salah.pdf");
  assert("_Enfant_ document has conjoint = false", enfant.conjoint === false);
  assert("_Enfant_ document still parses child name", enfant.enfant === "Salah");
}

function testSyncStats() {
  console.log("\n--- Sync status consistency ---");

  const totalFromEmployees = mockEmployees.reduce((s, e) => s + e.documentCount, 0);
  assert(
    "Employee documentCount sums to 110",
    totalFromEmployees === 110,
    String(totalFromEmployees),
  );
}

function main() {
  console.log("Exercise logic & data validation\n");

  testEmployeeData();
  testDocumentData();
  testDriveFilesystemMatch();
  testCategories();
  testDefaultAccess();
  testRoleAccess();
  testSearch();
  testCodificationParsing();
  testSyncStats();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- Summary: ${results.length - failed.length}/${results.length} passed ---`);

  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const f of failed) {
      console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
    }
    process.exit(1);
  }

  console.log("\nAll exercise logic tests passed.");
}

main();
