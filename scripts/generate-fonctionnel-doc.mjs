/**
 * Génère doc/Documentation_Fonctionnelle_Portail_RH.docx
 *
 * Usage : node scripts/generate-fonctionnel-doc.mjs
 * Images optionnelles : doc/screenshots/<nom>.png|jpg|jpeg|webp
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCREENSHOTS_DIR = path.join(ROOT, "doc", "screenshots");
const OUT_PATH = path.join(
  ROOT,
  "doc",
  "Documentation_Fonctionnelle_Portail_RH.docx",
);

const BRAND = "0066B3";
const MUTED = "64748B";
const PLACEHOLDER_BG = "F1F5F9";

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0 },
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        size: opts.size ?? 22,
        font: "Calibri",
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
      }),
    ],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 320, after: 160 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        bold: true,
        color: BRAND,
        size: level === HeadingLevel.HEADING_1 ? 32 : 26,
      }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: `• ${text}`, size: 22, font: "Calibri" }),
    ],
  });
}

function labelValue(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label} : `, bold: true, size: 22, font: "Calibri" }),
      new TextRun({ text: value, size: 22, font: "Calibri" }),
    ],
  });
}

function findImage(baseName) {
  const exts = [".png", ".jpg", ".jpeg", ".webp", ".PNG", ".JPG", ".JPEG"];
  for (const ext of exts) {
    const full = path.join(SCREENSHOTS_DIR, baseName + ext);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function imageOrPlaceholder(baseName, caption) {
  const file = findImage(baseName);
  const blocks = [];

  if (file) {
    const buf = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase().replace(".", "");
    const type = ext === "jpg" || ext === "jpeg" ? "jpg" : ext === "webp" ? "webp" : "png";
    blocks.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 80 },
        children: [
          new ImageRun({
            type,
            data: buf,
            transformation: { width: 520, height: 300 },
            altText: { title: caption, description: caption, name: baseName },
          }),
        ],
      }),
    );
    blocks.push(
      p(`Figure — ${caption}`, {
        italics: true,
        color: MUTED,
        size: 18,
        align: AlignmentType.CENTER,
        after: 240,
      }),
    );
  } else {
    blocks.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.DASHED, size: 8, color: "94A3B8" },
                  bottom: { style: BorderStyle.DASHED, size: 8, color: "94A3B8" },
                  left: { style: BorderStyle.DASHED, size: 8, color: "94A3B8" },
                  right: { style: BorderStyle.DASHED, size: 8, color: "94A3B8" },
                },
                shading: { fill: PLACEHOLDER_BG },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 80 },
                    children: [
                      new TextRun({
                        text: `[Insérer capture : ${caption}]`,
                        bold: true,
                        size: 22,
                        font: "Calibri",
                        color: MUTED,
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                    children: [
                      new TextRun({
                        text: `Fichier attendu : doc/screenshots/${baseName}.png`,
                        size: 18,
                        font: "Calibri",
                        italics: true,
                        color: MUTED,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
    blocks.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  return blocks;
}

function screenSection({ title, objective, access, actions, image, caption }) {
  return [
    heading(title, HeadingLevel.HEADING_2),
    labelValue("Objectif", objective),
    labelValue("Accès", access),
    p("Actions principales", { bold: true, after: 80 }),
    ...actions.map(bullet),
    ...imageOrPlaceholder(image, caption ?? title),
  ];
}

function simpleTable(headers, rows) {
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          shading: { fill: BRAND },
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: h,
                  bold: true,
                  color: "FFFFFF",
                  size: 20,
                  font: "Calibri",
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const body = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              width: {
                size: Math.floor(100 / headers.length),
                type: WidthType.PERCENTAGE,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: cell, size: 20, font: "Calibri" }),
                  ],
                }),
              ],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...body],
  });
}

const today = new Date().toLocaleDateString("fr-FR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const children = [
  // Cover
  new Paragraph({ spacing: { before: 1200 }, children: [] }),
  p("Amendis / Veolia — Direction des Ressources Humaines", {
    align: AlignmentType.CENTER,
    color: MUTED,
    size: 22,
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [
      new TextRun({
        text: "Portail RH Documents",
        bold: true,
        size: 56,
        font: "Calibri",
        color: BRAND,
      }),
    ],
  }),
  p("Documentation fonctionnelle", {
    align: AlignmentType.CENTER,
    bold: true,
    size: 32,
  }),
  p(
    "Guide des écrans et fonctionnalités — à compléter avec vos captures d’écran",
    { align: AlignmentType.CENTER, color: MUTED, size: 20 },
  ),
  p(today, { align: AlignmentType.CENTER, color: MUTED, after: 400 }),
  p("Usage interne", { align: AlignmentType.CENTER, italics: true, color: MUTED }),

  // Page break via empty space + intro
  new Paragraph({ children: [], pageBreakBefore: true }),

  heading("1. Introduction"),
  p(
    "Le Portail RH Documents permet aux équipes RH de rechercher et consulter les documents des salariés stockés sur Google Drive, avec un contrôle d’accès par type de document et par rôle.",
  ),
  p(
    "Les fichiers restent sur Drive. Le portail indexe les métadonnées (salariés, dossiers, fichiers) dans une base interne pour offrir une recherche rapide, des exports et un suivi de complétude des dossiers.",
  ),
  bullet("Recherche documentaire avancée avec filtres identité, organisation, dates et type de document"),
  bullet("Annuaire salariés et fiche dossier individuelle"),
  bullet("Suivi de la complétude des dossiers (documents attendus manquants)"),
  bullet("Rapports démographiques et de complétude"),
  bullet("Administration : utilisateurs, permissions, suivi de synchronisation"),

  heading("2. Rôles utilisateurs"),
  p("Trois rôles sont prévus :"),
  simpleTable(
    ["Rôle", "Profil", "Droits principaux"],
    [
      [
        "Administrateur (ADMIN)",
        "IT / référent portail",
        "Accès complet + administration (utilisateurs, permissions, sync)",
      ],
      [
        "Responsable RH (RH_MANAGER)",
        "Encadrement RH",
        "Consultation et recherche selon la matrice de permissions",
      ],
      [
        "Agent RH (RH_AGENT)",
        "Utilisateur métier",
        "Consultation et recherche selon la matrice de permissions",
      ],
    ],
  ),
  new Paragraph({ spacing: { after: 160 }, children: [] }),
  p(
    "Après connexion, un administrateur arrive sur l’espace Administration ; un responsable ou agent RH arrive sur l’accueil métier (hub).",
    { italics: true, color: MUTED },
  ),
  p(
    "Les documents non autorisés peuvent apparaître dans les listes mais sans lien d’ouverture (accès refusé).",
  ),

  heading("3. Navigation"),
  p("Barre principale (tous les utilisateurs connectés) :"),
  bullet("Accueil — tableau de bord / hub"),
  bullet("Recherche — recherche documentaire"),
  bullet("Annuaire — liste des salariés"),
  bullet("Complétude — dossiers incomplets"),
  bullet("Rapports — indicateurs démographie et complétude"),
  p("Menu Administration (ADMIN uniquement) : Vue d’ensemble, Synchronisation, Permissions, Utilisateurs."),
  p("En-tête : logo Portail RH, nom et rôle, Paramètres (Mon compte), Déconnexion."),

  heading("4. Authentification et accès public"),

  ...screenSection({
    title: "4.1 Page d’accueil publique",
    objective:
      "Présenter le portail et orienter vers la connexion.",
    access: "Public (si déjà connecté, redirection vers l’espace selon le rôle).",
    actions: [
      "Bouton « Accéder au portail » / « Connexion »",
      "Présentation des bénéfices (recherche ciblée, accès maîtrisé, traçabilité)",
    ],
    image: "01-landing",
    caption: "Page d’accueil publique",
  }),

  ...screenSection({
    title: "4.2 Connexion",
    objective: "S’authentifier pour accéder au portail.",
    access: "Public.",
    actions: [
      "Saisir l’e-mail et le mot de passe",
      "Cliquer sur « Se connecter »",
      "Lien « Mot de passe oublié ? »",
    ],
    image: "02-login",
    caption: "Écran de connexion",
  }),

  ...screenSection({
    title: "4.3 Mot de passe oublié",
    objective: "Recevoir un lien de réinitialisation par e-mail.",
    access: "Public.",
    actions: [
      "Saisir l’adresse e-mail du compte",
      "Envoyer la demande et suivre le message de confirmation",
    ],
    image: "03-forgot-password",
    caption: "Mot de passe oublié",
  }),

  ...screenSection({
    title: "4.4 Nouveau mot de passe",
    objective: "Choisir un nouveau mot de passe via le lien reçu par e-mail.",
    access: "Public (lien avec jeton temporaire).",
    actions: [
      "Saisir le nouveau mot de passe et sa confirmation",
      "Valider pour revenir à la connexion",
    ],
    image: "04-reset-password",
    caption: "Réinitialisation du mot de passe",
  }),

  heading("5. Espace de travail"),

  ...screenSection({
    title: "5.1 Accueil (hub)",
    objective:
      "Point d’entrée après connexion : indicateurs clés et raccourcis vers les modules.",
    access: "ADMIN, RH_MANAGER, RH_AGENT.",
    actions: [
      "Consulter les KPI (salariés, documents indexés, taux de complétude, dossiers incomplets)",
      "Accéder rapidement à la Recherche, l’Annuaire, la Complétude et les Rapports",
      "Pour un ADMIN : raccourcis vers l’administration",
      "Ouvrir un dossier incomplet depuis le panneau « À surveiller »",
    ],
    image: "05-dashboard-hub",
    caption: "Accueil — hub",
  }),

  ...screenSection({
    title: "5.2 Recherche documentaire",
    objective:
      "Retrouver des documents selon des critères d’identité, d’organisation, de dates et de type de document.",
    access:
      "ADMIN, RH_MANAGER, RH_AGENT (résultats filtrés selon les permissions).",
    actions: [
      "Recherche libre et filtres : Identité & état civil, Poste & organisation, Ancienneté & dates, Document",
      "Visualiser les filtres actifs et réinitialiser",
      "Trier le tableau de résultats (salarié, document, catégorie, date, accès)",
      "Exporter en Excel ou télécharger un ZIP des documents autorisés",
      "Ouvrir un document sur Drive ou constater un accès refusé",
    ],
    image: "06-recherche",
    caption: "Recherche documentaire",
  }),

  ...screenSection({
    title: "5.2 bis Recherche — résultats filtrés",
    objective: "Illustrer une recherche avec critères actifs et liste de résultats.",
    access: "Idem recherche.",
    actions: [
      "Capturer idéalement avec plusieurs filtres actifs et des lignes de résultats",
    ],
    image: "06b-recherche-resultats",
    caption: "Recherche — résultats",
  }),

  ...screenSection({
    title: "5.3 Annuaire salariés",
    objective: "Parcourir la liste des salariés indexés et ouvrir un dossier.",
    access: "ADMIN, RH_MANAGER, RH_AGENT (périmètre selon droits).",
    actions: [
      "Rechercher par nom, matricule, CIN, diplôme, zone, etc.",
      "Consulter les colonnes (nom, matricule, CIN, service, docs, enfants)",
      "Cliquer sur une ligne pour ouvrir le dossier salarié",
    ],
    image: "07-annuaire",
    caption: "Annuaire salariés",
  }),

  ...screenSection({
    title: "5.4 Dossier salarié",
    objective:
      "Consulter l’état personnel et les documents d’un salarié, regroupés par catégorie.",
    access:
      "Utilisateur authentifié ; ouverture Drive selon permissions.",
    actions: [
      "Lire la carte d’identité (statut, genre, âge, ancienneté, etc.)",
      "Parcourir l’état personnel (identité, poste, hiérarchie, carrière)",
      "Ouvrir les documents par catégorie ou constater un accès refusé",
      "Revenir à l’annuaire",
    ],
    image: "08-dossier-salarie",
    caption: "Dossier salarié",
  }),

  ...screenSection({
    title: "5.5 Complétude des dossiers",
    objective:
      "Identifier les dossiers incomplets (documents attendus manquants).",
    access: "ADMIN, RH_MANAGER, RH_AGENT.",
    actions: [
      "Filtrer (recherche, uniquement incomplets)",
      "Lire le tableau (présents / attendus par catégorie, manquants)",
      "Ouvrir le détail d’un dossier",
    ],
    image: "09-completude",
    caption: "Complétude des dossiers",
  }),

  ...screenSection({
    title: "5.5 bis Complétude — détail",
    objective: "Voir la liste des documents requis et marquer une vérification.",
    access: "Idem complétude.",
    actions: [
      "Consulter les documents manquants / présents",
      "Marquer comme vérifié ou annuler (si disponible)",
    ],
    image: "09b-completude-detail",
    caption: "Complétude — fenêtre détail",
  }),

  ...screenSection({
    title: "5.6 Rapports",
    objective:
      "Visualiser la démographie de l’effectif et les indicateurs de complétude.",
    access: "ADMIN, RH_MANAGER, RH_AGENT (données selon droits).",
    actions: [
      "Consulter les KPI et graphiques (genre, âge, ancienneté, directions…)",
      "Analyser les tableaux de documents manquants et top dossiers incomplets",
      "Naviguer vers une fiche salarié depuis les liens du rapport",
    ],
    image: "10-rapports",
    caption: "Rapports",
  }),

  ...screenSection({
    title: "5.7 Paramètres (Mon compte)",
    objective: "Mettre à jour le profil et changer son mot de passe.",
    access: "ADMIN, RH_MANAGER, RH_AGENT.",
    actions: [
      "Modifier le nom et l’e-mail du profil",
      "Changer le mot de passe (actuel, nouveau, confirmation)",
    ],
    image: "11-parametres",
    caption: "Paramètres — Mon compte",
  }),

  heading("6. Administration"),
  p(
    "Ces écrans sont réservés au rôle Administrateur. La synchronisation des données Drive est déclenchée côté Google Apps Script ; le portail affiche l’historique en lecture seule.",
  ),

  ...screenSection({
    title: "6.1 Vue d’ensemble",
    objective: "Tableau de bord administrateur et accès aux modules d’admin.",
    access: "ADMIN uniquement.",
    actions: [
      "Consulter les KPI (salariés, documents, comptes portail)",
      "Accéder à Sync, Permissions, Utilisateurs",
      "Voir le résumé de la dernière synchronisation",
    ],
    image: "12-admin-overview",
    caption: "Administration — vue d’ensemble",
  }),

  ...screenSection({
    title: "6.2 Synchronisation",
    objective:
      "Suivre l’état de l’index (salariés / fichiers) et l’historique des syncs poussées par Apps Script.",
    access: "ADMIN (lecture). Le lancement se fait hors portail (Google).",
    actions: [
      "Lire les stats d’index et le statut de la dernière sync",
      "Parcourir l’historique (date, statut, durée, erreurs)",
    ],
    image: "13-admin-sync",
    caption: "Administration — synchronisation",
  }),

  ...screenSection({
    title: "6.3 Permissions",
    objective:
      "Définir les droits d’accès aux catégories / types de documents par rôle et par utilisateur.",
    access: "ADMIN uniquement.",
    actions: [
      "Ajuster la matrice Rôles (accès de référence)",
      "Gérer les exceptions utilisateur (autoriser / refuser, overrides)",
      "Limiter éventuellement le périmètre (directions / services)",
    ],
    image: "14-admin-permissions",
    caption: "Administration — permissions",
  }),

  ...screenSection({
    title: "6.4 Utilisateurs",
    objective: "Gérer les comptes portail et tester l’envoi d’e-mails.",
    access: "ADMIN uniquement.",
    actions: [
      "Créer un utilisateur (Nouveau)",
      "Réinitialiser un mot de passe",
      "Activer / désactiver un compte",
      "Tester la configuration SMTP",
    ],
    image: "15-admin-users",
    caption: "Administration — utilisateurs",
  }),

  ...screenSection({
    title: "6.4 bis Création d’utilisateur",
    objective: "Illustrer le formulaire de création de compte.",
    access: "ADMIN.",
    actions: ["Remplir nom, e-mail, rôle et valider"],
    image: "15b-admin-users-creer",
    caption: "Administration — création utilisateur",
  }),

  heading("7. Annexe — glossaire"),
  simpleTable(
    ["Terme", "Définition"],
    [
      [
        "Matricule",
        "Identifiant unique du salarié ; sert aussi de nom de dossier Drive.",
      ],
      [
        "Index",
        "Copie en base des métadonnées Drive (pas des fichiers PDF).",
      ],
      [
        "Complétude",
        "État d’un dossier au regard des documents attendus (présents / manquants).",
      ],
      [
        "Permission",
        "Droit d’ouvrir un type / une catégorie de document (par rôle ou exception utilisateur).",
      ],
      [
        "Sync / Apps Script",
        "Script Google qui envoie périodiquement l’inventaire Drive + feuille Base vers le portail.",
      ],
      [
        "Export ZIP / Excel",
        "Téléchargement des résultats de recherche (métadonnées Excel ou fichiers ZIP autorisés).",
      ],
    ],
  ),
  new Paragraph({ spacing: { before: 400 }, children: [] }),
  p(
    "Comment ajouter vos captures : collez-les dans ce document à la place des cadres en pointillés, ou déposez les fichiers nommés dans doc/screenshots/ puis relancez : node scripts/generate-fonctionnel-doc.mjs",
    { italics: true, color: MUTED, size: 18 },
  ),
];

const doc = new Document({
  creator: "Portail RH Documents",
  title: "Documentation fonctionnelle — Portail RH Documents",
  description:
    "Documentation des écrans et fonctionnalités du Portail RH Documents",
  styles: {
    default: {
      document: {
        styles: [
          {
            id: "Normal",
            run: { font: "Calibri", size: 22 },
          },
        ],
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, buffer);

const missing = [
  "01-landing",
  "02-login",
  "03-forgot-password",
  "04-reset-password",
  "05-dashboard-hub",
  "06-recherche",
  "06b-recherche-resultats",
  "07-annuaire",
  "08-dossier-salarie",
  "09-completude",
  "09b-completude-detail",
  "10-rapports",
  "11-parametres",
  "12-admin-overview",
  "13-admin-sync",
  "14-admin-permissions",
  "15-admin-users",
  "15b-admin-users-creer",
].filter((name) => !findImage(name));

console.log(`OK → ${OUT_PATH}`);
if (missing.length) {
  console.log(
    `Placeholders (${missing.length}) : ${missing.map((m) => m + ".png").join(", ")}`,
  );
} else {
  console.log("Toutes les captures ont été intégrées.");
}
