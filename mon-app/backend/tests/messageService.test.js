import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertAllowedMessageRecipient,
  buildConversationReadQuery,
  buildUnreadCountQuery,
  calculateContactIds
} from "../services/messageService.js";

const activeUsers = [
  { id: 1, role: "CONSEILLERE" },
  { id: 3, role: "COMPTABILITE" },
  { id: 5, role: "ETUDIANT" },
  { id: 6, role: "SUPERVISEUR" },
  { id: 9, role: "DIRECTION" }
];

function databaseFor({ supervisor = 6, contractParticipants = [5, 6, 9] } = {}) {
  return {
    async query(sql) {
      if (sql.includes("superviseur_id AS id")) return [[{ id: supervisor }]];
      if (sql.includes("role = 'CONSEILLERE'")) return [[{ id: 1 }]];
      if (sql.includes("FROM contrats c")) {
        return [contractParticipants.map((id) => ({ id }))];
      }
      if (sql.includes("WHERE statut = 'ACTIF'")) return [activeUsers];
      if (sql.includes("role IN ('SUPERVISEUR', 'CONSEILLERE', 'COMPTABILITE', 'DIRECTION')")) {
        return [activeUsers.filter(({ role }) => role !== "ETUDIANT")];
      }
      throw new Error(`Requete inattendue : ${sql}`);
    }
  };
}

test("un etudiant voit son superviseur, la conseillere et les signataires de son contrat", async () => {
  const contacts = await calculateContactIds(
    { id: 5, role: "ETUDIANT" },
    databaseFor()
  );
  assert.deepEqual([...contacts], [6, 1, 9]);
});

test("un superviseur et une conseillere voient tous les utilisateurs actifs", async () => {
  for (const user of [{ id: 6, role: "SUPERVISEUR" }, { id: 1, role: "CONSEILLERE" }]) {
    const contacts = await calculateContactIds(user, databaseFor());
    assert.deepEqual([...contacts], activeUsers.map(({ id }) => id).filter((id) => id !== user.id));
  }
});

test("la comptabilite voit les employes, mais aucun etudiant", async () => {
  const contacts = await calculateContactIds(
    { id: 3, role: "COMPTABILITE" },
    databaseFor()
  );
  assert.deepEqual([...contacts], [1, 6, 9]);
  assert.equal(contacts.has(5), false);
});

test("la direction voit les employes et les participants de ses contrats", async () => {
  const contacts = await calculateContactIds(
    { id: 9, role: "DIRECTION" },
    databaseFor()
  );
  assert.deepEqual([...contacts], [1, 3, 6, 5]);
});

test("un destinataire absent des contacts reste interdit", () => {
  assert.doesNotThrow(() => assertAllowedMessageRecipient(
    { id: 5, role: "ETUDIANT" }, 6, new Set([1, 6])
  ));
  assert.throws(
    () => assertAllowedMessageRecipient({ id: 5, role: "ETUDIANT" }, 3, new Set([1, 6])),
    (error) => error.status === 403 && /pas dans vos contacts/i.test(error.message)
  );
});

test("la lecture d'une conversation utilise les deux participants", () => {
  const query = buildConversationReadQuery({ id: 9, role: "DIRECTION" }, 5);
  assert.doesNotMatch(query.sql, /contact\.role/);
  assert.deepEqual(query.params, [9, 5, 5, 9]);
});

test("le compteur inclut tous les messages recus et non lus", () => {
  for (const role of ["ETUDIANT", "SUPERVISEUR", "CONSEILLERE", "COMPTABILITE", "DIRECTION"]) {
    const query = buildUnreadCountQuery({ id: 5, role });
    assert.equal(query.sql, "SELECT COUNT(*) AS n FROM messages WHERE destinataire_id = ? AND lu_le IS NULL");
    assert.deepEqual(query.params, [5]);
  }
});
