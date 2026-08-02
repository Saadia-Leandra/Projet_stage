import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import chatRoutes from "../routes/chatRoute.js";
import { errorHandler } from "../middlewares/errorHandler.js";
import { createToken } from "../services/jwt.js";

test("les routes de chat exigent le JWT existant", async () => {
  await withApp(createChatService(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat/conversations`);
    assert.equal(response.status, 401);
  });
});

test("liste uniquement les conversations de l'utilisateur authentifié", async () => {
  let receivedUserId;
  const service = createChatService({
    async getUserConversations(userId) {
      receivedUserId = userId;
      return [{ id: 3 }];
    }
  });

  await withApp(service, async (baseUrl) => {
    const response = await request(baseUrl, "/api/chat/conversations", { token: tokenFor(7) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).conversations, [{ id: 3 }]);
    assert.equal(receivedUserId, 7);
  });
});

test("ignore tout userId du frontend lors de la création", async () => {
  let received;
  const service = createChatService({
    async createConversation(data) {
      received = data;
      return { id: 12 };
    }
  });

  await withApp(service, async (baseUrl) => {
    const response = await request(baseUrl, "/api/chat/conversations", {
      method: "POST",
      token: tokenFor(7),
      body: { userId: 999, subject: "Stage", participantIds: [8] }
    });
    assert.equal(response.status, 201);
    assert.equal(received.userId, 7);
    assert.deepEqual(received.participantIds, [8]);
  });
});

test("transmet l'identité JWT au service pour lire les messages", async () => {
  let received;
  const service = createChatService({
    async getMessages(data) { received = data; return []; }
  });

  await withApp(service, async (baseUrl) => {
    const response = await request(baseUrl, "/api/chat/conversations/42/messages", {
      token: tokenFor(7)
    });
    assert.equal(response.status, 200);
    assert.deepEqual(received, { conversationId: 42, userId: 7 });
  });
});

test("refuse les messages vides ou dépassant 2000 caractères avant le service", async () => {
  let sendCount = 0;
  const service = createChatService({
    async sendMessage() { sendCount += 1; }
  });

  await withApp(service, async (baseUrl) => {
    const empty = await request(baseUrl, "/api/chat/conversations/4/messages", {
      method: "POST", token: tokenFor(7), body: { content: "   " }
    });
    const tooLong = await request(baseUrl, "/api/chat/conversations/4/messages", {
      method: "POST", token: tokenFor(7), body: { content: "a".repeat(2001) }
    });
    assert.equal(empty.status, 400);
    assert.equal(tooLong.status, 400);
    assert.equal(sendCount, 0);
  });
});

test("crée un message avec le statut 201 et marque la conversation comme lue", async () => {
  const calls = [];
  const service = createChatService({
    async sendMessage(data) { calls.push(data); return { id: 5, content: data.content }; },
    async markConversationRead(data) { calls.push(data); return { conversationId: data.conversationId, unreadCount: 0 }; }
  });

  await withApp(service, async (baseUrl) => {
    const sent = await request(baseUrl, "/api/chat/conversations/4/messages", {
      method: "POST", token: tokenFor(7), body: { content: "Bonjour" }
    });
    const read = await request(baseUrl, "/api/chat/conversations/4/read", {
      method: "PATCH", token: tokenFor(7), body: { messageId: 5, userId: 999 }
    });
    assert.equal(sent.status, 201);
    assert.equal(read.status, 200);
    assert.deepEqual(calls[0], { conversationId: 4, userId: 7, content: "Bonjour" });
    assert.deepEqual(calls[1], { conversationId: 4, userId: 7, messageId: 5 });
  });
});

test("refuse un identifiant de conversation invalide", async () => {
  await withApp(createChatService(), async (baseUrl) => {
    const response = await request(baseUrl, "/api/chat/conversations/abc/messages", {
      token: tokenFor(7)
    });
    assert.equal(response.status, 400);
  });
});

function createChatService(overrides = {}) {
  return {
    async getUserConversations() { return []; },
    async createConversation() { return { id: 1 }; },
    async getMessages() { return []; },
    async sendMessage() { return { id: 1 }; },
    async markConversationRead({ conversationId }) { return { conversationId, unreadCount: 0 }; },
    ...overrides
  };
}

function tokenFor(id) {
  return createToken({ id, role: "ETUDIANT", mustChangePassword: false });
}

async function request(baseUrl, path, { method = "GET", token, body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

async function withApp(chatService, callback) {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatRoutes({ chatService }));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
