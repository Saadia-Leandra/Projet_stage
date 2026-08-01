import assert from "node:assert/strict";
import test from "node:test";

import { previewStudentCsv } from "../services/claraStudentCsvImportService.js";

test("normalise un export Clara vers le format étudiant StageTec", async () => {
  const csv = [
    "numero_dossier,nom,prenom,code_permanent,numero_programme,numero_grille,spe,telephone_principal,telephone_secondaire,email",
    "2600010,Bernard,Luc,BERL01010101,420.B0,420-B0-2026,Developpement web,514-555-1010,,bernard@teccart.com"
  ].join("\r\n");

  const preview = await previewStudentCsv({
    fileName: "export-clara.csv",
    buffer: Buffer.from(csv, "utf8")
  });

  assert.equal(preview.valide, true);
  assert.equal(preview.nombreLignes, 1);
  assert.equal(preview.lignes[0].code_etudiant, "2600010");
  assert.equal(preview.lignes[0].courriel, "bernard@teccart.com");
  assert.equal(preview.lignes[0].programme, "Developpement web");
  assert.equal(preview.lignes[0].groupe, "420-B0-2026");
  assert.equal(preview.lignes[0].telephone, "514-555-1010");
  assert.equal(
    preview.lignes[0].mot_de_passe_temporaire,
    "secret123"
  );
});

test("signale une ligne Clara sans courriel", async () => {
  const csv = [
    "numero_dossier,nom,prenom,code_permanent,numero_programme,numero_grille,spe,telephone_principal,telephone_secondaire,email",
    "2600011,Gagnon,Emma,GAGE02020202,420.B0,420-B0-2026,Reseaux et securite,514-555-1111,,"
  ].join("\r\n");

  const preview = await previewStudentCsv({
    fileName: "export-clara-invalide.csv",
    buffer: Buffer.from(csv, "utf8")
  });

  assert.equal(preview.valide, false);
  assert.equal(preview.nombreErreurs, 1);
  assert.match(preview.erreurs[0].erreurs.join(" "), /courriel/);
});

test("conserve les informations du groupe Clara et le code du titulaire", async () => {
  const csv = [
    "numero_dossier,nom,prenom,code_permanent,numero_programme,numero_grille,spe,telephone_principal,telephone_secondaire,email,session,no_cours,titre_du_cours,discipline,horaire,titulaires,ponderation,date_de_debut,date_de_fin",
    '202130272,Kaba,Oumar Taliby,KABO16279203,420.B0,420.B0-IS-A24,6,438.928.0395,514.555.0101,kaba@teccart.com,Hiver 2026,420-STR-TT,Stage en reseau,420 - Technique de informatique,Mar 16:00 a 17:00,"Alcindor, R. (AICR);",00-14-03,2026-01-07,2026-04-24'
  ].join("\r\n");

  const preview = await previewStudentCsv({
    fileName: "liste-groupe-clara.csv",
    buffer: Buffer.from(csv, "utf8")
  });

  assert.equal(preview.valide, true);
  assert.equal(preview.lignes[0].telephone, "438.928.0395");
  assert.equal(preview.lignes[0].telephone_secondaire, "514.555.0101");
  assert.equal(preview.lignes[0].numero_cours, "420-STR-TT");
  assert.equal(preview.lignes[0].session, "Hiver 2026");
  assert.equal(preview.lignes[0].numero_employe_superviseur, "Alcindor, R. (AICR);");
  assert.equal(preview.lignes[0].date_fin_groupe, "2026-04-24");
});
