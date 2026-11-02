"""Generate lib/mock/employees.ts and documents.ts from doc/debut exercise assets."""
from __future__ import annotations

import json
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DEBUT = ROOT / "doc" / "debut"
DRIVE = DEBUT / "Dossiers Digitaux"

FOLDER_MAP = {
    "1- Recrutement": "RECRUTEMENT",
    "2- Etat Civil": "ETAT_CIVIL",
    "3- Arrêtés": "ARRETES",
    "4- Mesures Disciplinaires": "MESURES_DISCIPLINAIRES",
    "5- Maladies et Accidents de Travail": "MALADIES_ACCIDENTS_TRAVAIL",
    "6- Départ": "DEPART",
    "7- Divers": "DIVERS",
}


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> None:
    wb = openpyxl.load_workbook(DEBUT / "Etat personnel exercice.xlsx", data_only=True)
    rows = list(wb["Base"].iter_rows(values_only=True))

    employees: list[dict] = []
    for row in rows[2:]:
        if row[0] is None:
            continue
        mat = str(int(row[0]))
        employees.append(
            {
                "matricule": mat,
                "displayName": f"{row[1]} {row[2]}",
                "direction": row[22],
                "service": row[26],
                "poste": row[31],
                "statut": row[12],
                "situation": row[40],
            }
        )

    documents: list[dict] = []
    doc_num = 1
    for emp_dir in sorted(DRIVE.iterdir()):
        if not emp_dir.is_dir():
            continue
        mat = emp_dir.name
        for sub in sorted(emp_dir.iterdir()):
            if not sub.is_dir():
                continue
            category = FOLDER_MAP.get(sub.name, "DIVERS")
            for file_path in sorted(sub.iterdir()):
                if file_path.suffix.lower() != ".pdf":
                    continue
                documents.append(
                    {
                        "id": f"doc-{doc_num:03d}",
                        "employeeMatricule": mat,
                        "fileName": file_path.name,
                        "folder": sub.name,
                        "category": category,
                        "modifiedAt": "2026-05-01T08:00:00Z",
                    }
                )
                doc_num += 1

    counts: dict[str, int] = {}
    for doc in documents:
        counts[doc["employeeMatricule"]] = counts.get(doc["employeeMatricule"], 0) + 1

    mock_dir = ROOT / "lib" / "mock"
    emp_lines = [
        'import type { MockEmployee } from "@/lib/mock/types";',
        "",
        "/** From Etat personnel exercice.xlsx (sheet Base). Regenerate: python scripts/generate-exercise-mock.py */",
        "export const mockEmployees: MockEmployee[] = [",
    ]
    for employee in employees:
        emp_lines.append("  {")
        for key, value in employee.items():
            emp_lines.append(f"    {key}: {ts_string(str(value))},")
        emp_lines.append("    childrenCount: 0,")
        emp_lines.append(f"    documentCount: {counts.get(employee['matricule'], 0)},")
        emp_lines.append("  },")
    emp_lines.extend(
        [
            "];",
            "",
            "export function getMockEmployee(matricule: string): MockEmployee | undefined {",
            "  return mockEmployees.find((e) => e.matricule === matricule);",
            "}",
            "",
            "export function getMockEmployeeStats() {",
            "  return {",
            "    totalEmployees: mockEmployees.length,",
            "    totalDocuments: mockEmployees.reduce((sum, e) => sum + e.documentCount, 0),",
            "    withThreePlusChildren: mockEmployees.filter((e) => e.childrenCount >= 3).length,",
            "  };",
            "}",
            "",
        ]
    )
    (mock_dir / "employees.ts").write_text("\n".join(emp_lines), encoding="utf-8")

    doc_lines = [
        'import type { MockDocument } from "@/lib/mock/types";',
        "",
        "/** From doc/debut/Dossiers Digitaux (110 PDFs). Regenerate: python scripts/generate-exercise-mock.py */",
        "export const mockDocuments: MockDocument[] = [",
    ]
    for doc in documents:
        doc_lines.append(
            "  { "
            + f"id: {ts_string(doc['id'])}, "
            + f"employeeMatricule: {ts_string(doc['employeeMatricule'])}, "
            + f"fileName: {ts_string(doc['fileName'])}, "
            + f"folder: {ts_string(doc['folder'])}, "
            + f"category: {ts_string(doc['category'])}, "
            + f"modifiedAt: {ts_string(doc['modifiedAt'])}, "
            + " },"
        )
    doc_lines.extend(
        [
            "];",
            "",
            "export function getDocumentsByMatricule(matricule: string): MockDocument[] {",
            "  return mockDocuments.filter((d) => d.employeeMatricule === matricule);",
            "}",
            "",
        ]
    )
    (mock_dir / "documents.ts").write_text("\n".join(doc_lines), encoding="utf-8")

    print(f"Generated {len(employees)} employees, {len(documents)} documents")


if __name__ == "__main__":
    main()
