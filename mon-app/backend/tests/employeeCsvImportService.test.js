import assert from "node:assert/strict";
import test from "node:test";

import { previewEmployeeCsv } from "../services/employeeCsvImportService.js";

const file = (csv) => ({ fileName: "employes.csv", buffer: Buffer.from(csv, "utf8") });

test("valide les trois types de comptes employes", async () => {
  const csv = [
    "courriel,prenom,nom,role,numero_employe,departement,service,taux_horaire,taux_kilometrique",
    "sup@teccart.com,Nadia,Roy,SUPERVISEUR,EMP-20,Informatique,,52.500,0.610",
    "conseil@teccart.com,Julie,Cote,CONSEILLERE,,Stages,,,",
    "compta@teccart.com,Marc,Gagne,COMPTABILITE,COMPTA-20,,Finances,,"
  ].join("\r\n");
  const preview = await previewEmployeeCsv(file(csv));
  assert.equal(preview.valide, true);
  assert.equal(preview.nombreLignes, 3);
  assert.equal(preview.lignes[0].taux_horaire, "52.500");
});

test("exige le taux horaire pour un superviseur", async () => {
  const csv = "courriel,prenom,nom,role,numero_employe,taux_horaire\r\nsup@teccart.com,Nadia,Roy,SUPERVISEUR,EMP-20,";
  const preview = await previewEmployeeCsv(file(csv));
  assert.equal(preview.valide, false);
  assert.match(preview.erreurs[0].erreurs.join(" "), /taux_horaire/);
});

test("refuse un role non autorise", async () => {
  const csv = "courriel,prenom,nom,role\r\netu@teccart.com,Ada,Lovelace,ETUDIANT";
  const preview = await previewEmployeeCsv(file(csv));
  assert.equal(preview.valide, false);
  assert.match(preview.erreurs[0].erreurs.join(" "), /SUPERVISEUR/);
});

test("detecte les identifiants en double", async () => {
  const csv = [
    "courriel,prenom,nom,role,numero_employe,taux_horaire",
    "sup@teccart.com,Nadia,Roy,SUPERVISEUR,EMP-20,50",
    "sup@teccart.com,Jean,Roy,SUPERVISEUR,EMP-20,55"
  ].join("\r\n");
  const preview = await previewEmployeeCsv(file(csv));
  assert.equal(preview.nombreErreurs, 1);
  assert.equal(preview.erreurs[0].erreurs.length, 2);
});
