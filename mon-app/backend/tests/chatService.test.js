import assert from "node:assert/strict";
import { test } from "node:test";
import { ChatService } from "../services/chatService.js";

test("crée une conversation en ajoutant automatiquement le créateur et déduplique les participants", async () => {
  let received;
  const service = createService({
    async createConversation(data) {
      received = data;
      return { id: 10, ...data };
    }
  });

  const result = await service.createConversation({
    userId: 7,
    subject: "  Suivi du stage  ",
    participantIds: [8, 7, 8]
  });

  assert.equal(result.id, 10);
  assert.equal(received.subject, "Suivi du stage");
  assert.deepEqual(received.participantIds, [7, 8]);
});

test("refuse toute consultation d'une conversation avant d'appeler le repository de lecture", async () => {
  let conversationRead = false;
  const service = createService({
    async isParticipant() { return false; },
    async findConversationById() { conversationRead = true; }
  });

  await assertForbidden(() => service.getConversation({ conversationId: 4, userId: 99 }));
  assert.equal(conversationRead, false);
});

test("refuse la lecture des messages sans appartenance et ne lit aucun message", async () => {
  let messagesRead = false;
  const service = createService({
    async isParticipant() { return false; },
    async listMessages() { messagesRead = true; }
  });

  await assertForbidden(() => service.getMessages({ conversationId: 4, userId: 99 }));
  assert.equal(messagesRead, false);
});

test("refuse l'envoi sans appartenance et ne crée aucun message", async () => {
  let messageCreated = false;
  const service = createService({
    async isParticipant() { return false; },
    async createMessage() { messageCreated = true; }
  });

  await assertForbidden(() => service.sendMessage({
    conversationId: 4,
    userId: 99,
    content: "Bonjour"
  }));
  assert.equal(messageCreated, false);
});

test("refuse le marquage lu sans appartenance et ne modifie aucun statut", async () => {
  let marked = false;
  const service = createService({
    async isParticipant() { return false; },
    async markRead() { marked = true; }
  });

  await assertForbidden(() => service.markConversationRead({ conversationId: 4, userId: 99 }));
  assert.equal(marked, false);
});

test("vérifie l'appartenance avant l'ajout de participants", async () => {
  const calls = [];
  const service = createService({
    async isParticipant() { calls.push("authorization"); return true; },
    async addParticipants(_conversationId, ids) { calls.push("addition"); return ids; }
  });

  const result = await service.addParticipants({
    conversationId: 4,
    userId: 7,
    participantIds: [8, 8, 9]
  });

  assert.deepEqual(calls, ["authorization", "addition"]);
  assert.deepEqual(result, [8, 9]);
});

test("envoie un message après autorisation et normalise son contenu", async () => {
  const calls = [];
  const service = createService({
    async isParticipant() { calls.push("authorization"); return true; },
    async createMessage(data) { calls.push("creation"); return data; }
  });

  const message = await service.sendMessage({ conversationId: 4, userId: 7, content: "  Bonjour  " });
  assert.deepEqual(calls, ["authorization", "creation"]);
  assert.equal(message.content, "Bonjour");
});

test("refuse de marquer comme lu un message appartenant à une autre conversation", async () => {
  let marked = false;
  const service = createService({
    async isParticipant() { return true; },
    async messageBelongsToConversation() { return false; },
    async markRead() { marked = true; }
  });

  await assert.rejects(
    service.markConversationRead({ conversationId: 4, userId: 7, messageId: 22 }),
    (error) => error.status === 400 && /n'appartient pas/.test(error.message)
  );
  assert.equal(marked, false);
});

test("calcule les non-lus globaux et protège le calcul ciblé par conversation", async () => {
  const calls = [];
  const service = createService({
    async isParticipant() { calls.push("authorization"); return true; },
    async countUnread(userId, conversationId) {
      calls.push([userId, conversationId]);
      return conversationId ? 2 : 5;
    }
  });

  assert.equal(await service.getUnreadCount({ userId: 7 }), 5);
  assert.equal(await service.getUnreadCount({ userId: 7, conversationId: 4 }), 2);
  assert.deepEqual(calls, [[7, null], "authorization", [7, 4]]);
});

function createService(overrides = {}) {
  return new ChatService({
    chatRepo: {
      async isParticipant() { return true; },
      ...overrides
    }
  });
}

async function assertForbidden(operation) {
  await assert.rejects(operation(), (error) => error.status === 403);
}
