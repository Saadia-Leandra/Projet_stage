import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertAllowedMessageRecipient,
  buildConversationReadQuery,
  buildUnreadCountQuery,
  calculateContactIds
} from "../services/messageService.js";

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

test("la lecture DIRECTION est limitée au correspondant autorisé sélectionné", () => {
  const query = buildConversationReadQuery(
    { id: 9, role: "DIRECTION" },
    3
  );

  assert.match(query.sql, /contact\.role IN \('CONSEILLERE', 'COMPTABILITE'\)/);
  assert.match(query.sql, /contact\.statut = 'ACTIF'/);
  assert.match(query.sql, /WHERE \(\(expediteur_id = \? AND destinataire_id = \?\)/);
  assert.deepEqual(query.params, [9, 3, 3, 9, 3]);
});

test("la lecture des autres rôles conserve la requête et les paramètres existants", () => {
  const query = buildConversationReadQuery(
    { id: 5, role: "ETUDIANT" },
    1
  );

  assert.doesNotMatch(query.sql, /contact\.role/);
  assert.deepEqual(query.params, [5, 1, 1, 5]);
});

test("DIRECTION peut envoyer uniquement à la conseillère ou à la comptabilité autorisées", () => {
  const user = { id: 9, role: "DIRECTION" };
  const contacts = new Set([1, 3]);

  assert.doesNotThrow(() => assertAllowedMessageRecipient(user, 1, contacts));
  assert.doesNotThrow(() => assertAllowedMessageRecipient(user, 3, contacts));
});

test("DIRECTION reçoit une erreur métier claire pour tout autre destinataire", () => {
  assert.throws(
    () => assertAllowedMessageRecipient(
      { id: 9, role: "DIRECTION" },
      5,
      new Set([1, 3])
    ),
    (error) => {
      assert.equal(error.status, 403);
      assert.match(error.message, /uniquement a la conseillere ou a la comptabilite/i);
      return true;
    }
  );
});

test("l'erreur d'envoi existante des autres rôles reste inchangée", () => {
  assert.throws(
    () => assertAllowedMessageRecipient(
      { id: 5, role: "ETUDIANT" },
      8,
      new Set([1, 6])
    ),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, "Cette personne n'est pas dans vos contacts.");
      return true;
    }
  );
});

test("le compteur DIRECTION inclut uniquement les messages non lus des contacts autorisés actifs", () => {
  const query = buildUnreadCountQuery({ id: 9, role: "DIRECTION" });

  assert.match(query.sql, /sender\.id = m\.expediteur_id/);
  assert.match(query.sql, /sender\.role IN \('CONSEILLERE', 'COMPTABILITE'\)/);
  assert.match(query.sql, /sender\.statut = 'ACTIF'/);
  assert.match(query.sql, /m\.lu_le IS NULL/);
  assert.deepEqual(query.params, [9]);
});

test("le compteur des autres rôles conserve son comportement existant", () => {
  for (const role of ["ETUDIANT", "SUPERVISEUR", "CONSEILLERE", "COMPTABILITE"]) {
    const query = buildUnreadCountQuery({ id: 5, role });

    assert.equal(
      query.sql,
      "SELECT COUNT(*) AS n FROM messages WHERE destinataire_id = ? AND lu_le IS NULL"
    );
    assert.deepEqual(query.params, [5]);
  }
});
