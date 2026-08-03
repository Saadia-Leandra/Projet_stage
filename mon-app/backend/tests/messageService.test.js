import assert from "node:assert/strict";
import { test } from "node:test";

import { calculateContactIds } from "../services/messageService.js";

const users = [
  { id: 1, role: "CONSEILLERE", statut: "ACTIF" },
  { id: 2, role: "CONSEILLERE", statut: "INACTIF" },
  { id: 3, role: "COMPTABILITE", statut: "ACTIF" },
  { id: 4, role: "COMPTABILITE", statut: "INACTIF" },
  { id: 5, role: "ETUDIANT", statut: "ACTIF" },
  { id: 6, role: "SUPERVISEUR", statut: "ACTIF" },
  { id: 7, role: "ENSEIGNANT", statut: "ACTIF" },
  { id: 8, role: "ADMINISTRATEUR", statut: "ACTIF" },
  { id: 9, role: "DIRECTION", statut: "ACTIF" }
];

function directionDatabase() {
  return {
    async query(sql) {
      assert.match(sql, /role IN \('CONSEILLERE', 'COMPTABILITE'\)/);
      assert.match(sql, /statut = 'ACTIF'/);
      return [users.filter(
        ({ role, statut }) =>
          ["CONSEILLERE", "COMPTABILITE"].includes(role) && statut === "ACTIF"
      )];
    }
  };
}

test("DIRECTION reçoit uniquement la conseillère et la comptabilité actives", async () => {
  const contacts = await calculateContactIds(
    { id: 9, role: "DIRECTION" },
    directionDatabase()
  );

  assert.ok(contacts instanceof Set);
  assert.deepEqual([...contacts], [1, 3]);
});

test("DIRECTION exclut la conseillère inactive", async () => {
  const contacts = await calculateContactIds(
    { id: 9, role: "DIRECTION" },
    directionDatabase()
  );

  assert.equal(contacts.has(2), false);
});

test("DIRECTION exclut la comptabilité inactive", async () => {
  const contacts = await calculateContactIds(
    { id: 9, role: "DIRECTION" },
    directionDatabase()
  );

  assert.equal(contacts.has(4), false);
});

test("DIRECTION exclut tous les autres rôles et son propre compte", async () => {
  const contacts = await calculateContactIds(
    { id: 9, role: "DIRECTION" },
    directionDatabase()
  );

  for (const id of [5, 6, 7, 8, 9]) {
    assert.equal(contacts.has(id), false);
  }
});

test("les règles existantes des autres rôles restent inchangées", async () => {
  const database = {
    async query(sql) {
      if (sql.includes("FROM dossiers_stage") && sql.includes("superviseur_id AS id")) {
        return [[{ id: 6 }]];
      }
      if (sql.includes("FROM dossiers_stage") && sql.includes("etudiant_id AS id")) {
        return [[{ id: 5 }]];
      }
      if (sql.includes("role = 'CONSEILLERE'")) return [[{ id: 1 }]];
      if (sql.includes("role IN ('ETUDIANT', 'SUPERVISEUR')")) {
        return [[{ id: 5 }, { id: 6 }]];
      }
      throw new Error(`Requête inattendue : ${sql}`);
    }
  };

  assert.deepEqual(
    [...await calculateContactIds({ id: 5, role: "ETUDIANT" }, database)],
    [6, 1]
  );
  assert.deepEqual(
    [...await calculateContactIds({ id: 6, role: "SUPERVISEUR" }, database)],
    [5, 1]
  );
  assert.deepEqual(
    [...await calculateContactIds({ id: 1, role: "CONSEILLERE" }, database)],
    [5, 6]
  );
  assert.deepEqual(
    [...await calculateContactIds({ id: 7, role: "ENSEIGNANT" }, database)],
    []
  );
  assert.deepEqual(
    [...await calculateContactIds({ id: 8, role: "ADMINISTRATEUR" }, database)],
    []
  );
});

test("le résultat reste itérable et compatible avec le panneau de messagerie", async () => {
  const contacts = await calculateContactIds(
    { id: 9, role: "DIRECTION" },
    directionDatabase()
  );

  const contactIds = [...contacts];
  assert.deepEqual(contactIds, [1, 3]);
  assert.ok(contactIds.every(Number.isFinite));
});
