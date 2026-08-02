import assert from "node:assert/strict";
import test from "node:test";
import { createConversationRepo } from "../repositories/conversationRepo.js";
import { createParticipantRepo } from "../repositories/participantRepo.js";
import { createMessageRepo } from "../repositories/messageRepo.js";

function createDbMock(responses) {
  const calls = [];

  return {
    calls,
    async execute(sql, params) {
      calls.push({ sql, params });
      return responses.shift();
    }
  };
}

test("ConversationRepository cree et retrouve les conversations d'un utilisateur", async () => {
  const db = createDbMock([
    [{ insertId: 12 }],
    [[{ id: 12, subject: "Suivi de stage" }]],
    [[]]
  ]);
  const repo = createConversationRepo(db);

  assert.deepEqual(
    await repo.createConversation({ subject: "Suivi de stage", stageRequestId: 4, contractId: null }),
    { id: 12 }
  );
  assert.deepEqual(await repo.findConversationsByUserId(7), [{ id: 12, subject: "Suivi de stage" }]);
  assert.equal(await repo.findConversationById(999), null);

  assert.match(db.calls[0].sql, /INSERT INTO conversations/);
  assert.deepEqual(db.calls[0].params, ["Suivi de stage", 4, null]);
  assert.match(db.calls[1].sql, /JOIN participants_conversation/);
  assert.deepEqual(db.calls[1].params, [7]);
  assert.match(db.calls[2].sql, /WHERE id = \?/);
  assert.deepEqual(db.calls[2].params, [999]);
});

test("ParticipantRepository gere les participants et le dernier message lu", async () => {
  const db = createDbMock([
    [{ affectedRows: 1 }],
    [[{ exists: 1 }]],
    [[{ conversationId: 5, userId: 7 }]],
    [{ affectedRows: 0 }]
  ]);
  const repo = createParticipantRepo(db);

  assert.equal(await repo.addParticipant({ conversationId: 5, userId: 7 }), true);
  assert.equal(await repo.isParticipant(5, 7), true);
  assert.deepEqual(await repo.getParticipants(5), [{ conversationId: 5, userId: 7 }]);
  assert.equal(await repo.updateLastReadMessage({ conversationId: 5, userId: 7, messageId: 19 }), false);

  assert.match(db.calls[0].sql, /INSERT INTO participants_conversation/);
  assert.deepEqual(db.calls[0].params, [5, 7]);
  assert.match(db.calls[1].sql, /SELECT 1/);
  assert.deepEqual(db.calls[1].params, [5, 7]);
  assert.match(db.calls[2].sql, /ORDER BY rejoint_le ASC/);
  assert.deepEqual(db.calls[2].params, [5]);
  assert.match(db.calls[3].sql, /UPDATE participants_conversation/);
  assert.deepEqual(db.calls[3].params, [19, 5, 7]);
});

test("MessageRepository cree, liste et compte les messages non lus", async () => {
  const db = createDbMock([
    [{ insertId: 21 }],
    [[{ id: 21, content: "Bonjour" }]],
    [[]],
    [[{ unreadCount: "3" }]]
  ]);
  const repo = createMessageRepo(db);

  assert.deepEqual(
    await repo.createMessage({ conversationId: 5, senderId: 7, content: "Bonjour" }),
    { id: 21 }
  );
  assert.deepEqual(await repo.findMessagesByConversationId(5), [{ id: 21, content: "Bonjour" }]);
  assert.equal(await repo.findLatestMessage(5), null);
  assert.equal(await repo.countUnreadMessages(5, 7), 3);

  assert.match(db.calls[0].sql, /INSERT INTO messages/);
  assert.deepEqual(db.calls[0].params, [5, 7, "Bonjour"]);
  assert.match(db.calls[1].sql, /ORDER BY envoye_le ASC, id ASC/);
  assert.deepEqual(db.calls[1].params, [5]);
  assert.match(db.calls[2].sql, /ORDER BY envoye_le DESC, id DESC/);
  assert.deepEqual(db.calls[2].params, [5]);
  assert.match(db.calls[3].sql, /m\.expediteur_id != p\.utilisateur_id/);
  assert.deepEqual(db.calls[3].params, [5, 7]);
});
