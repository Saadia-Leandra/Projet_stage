import { useCallback, useEffect, useRef, useState } from "react";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }
  return data;
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" });
}

function PaperclipIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 0 1 5.66 5.66l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function roleLabel(role) {
  const labels = {
    ETUDIANT: "Etudiant",
    SUPERVISEUR: "Superviseur",
    CONSEILLERE: "Conseillere",
    DIRECTION: "Direction",
    COMPTABILITE: "Comptabilite"
  };
  return labels[role] || role;
}

function visibleContactsForUser(contacts, userRole) {
  if (userRole !== "DIRECTION") return contacts;
  return contacts.filter((contact) =>
    ["CONSEILLERE", "COMPTABILITE"].includes(contact.role)
  );
}

export default function MessagesPanel({ user }) {
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const matchingContacts = contacts.filter((contact) =>
    normalizeSearch(contact.name).startsWith(normalizeSearch(recipientQuery))
  );

  const loadContacts = useCallback(async () => {
    try {
      const data = await apiJson("/api/messages/contacts");
      setContacts(visibleContactsForUser(data.contacts || [], user.role));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  const loadConversation = useCallback(async (contactId) => {
    if (!contactId) return;
    try {
      const data = await apiJson(`/api/messages/conversation/${contactId}`);
      setMessages(data.messages || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadContacts();
      if (activeContact) loadConversation(activeContact.id);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeContact, loadContacts, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openContact(contact) {
    setActiveContact(contact);
    setRecipientQuery(contact.name || "");
    setRecipientOpen(false);
    setMessages([]);
    await loadConversation(contact.id);
    loadContacts();
  }

  async function handleSend(event) {
    event.preventDefault();
    const content = draft.trim();
    if ((!content && !attachment) || !activeContact) return;

    setDraft("");
    try {
      if (attachment) {
        const formData = new FormData();
        formData.append("recipientId", activeContact.id);
        formData.append("content", content);
        formData.append("file", attachment);
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: authHeaders(),
          body: formData
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "L'envoi a echoue.");
        }
        setAttachment(null);
      } else {
        await apiJson("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId: activeContact.id, content })
        });
      }
      await loadConversation(activeContact.id);
      loadContacts();
    } catch (sendError) {
      setError(sendError.message);
    }
  }

  async function downloadAttachment(message) {
    try {
      const response = await fetch(`/api/messages/attachment/${message.id}`, {
        headers: authHeaders()
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Le telechargement a echoue.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = message.attachmentName || "fichier";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  if (loading) {
    return <div className="loadingState">Chargement de la messagerie...</div>;
  }

  return (
    <section className="panel messagesPanel">
      <div className="panelHeader messagesPanelHeader">
        <div>
          <span className="messagesEyebrow">Communications</span>
          <h2>Messagerie</h2>
          <p>Échangez simplement avec les personnes liées à votre dossier.</p>
        </div>
        <span className="messagesContactCount">{contacts.length} contact(s)</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="messagesWorkspace">
        <div className="messagesContacts">
          <div className="messageRecipientPicker">
            <label htmlFor="messageRecipient">Destinataire</label>
            <div className="messageRecipientInputWrap">
              <span className="messageRecipientSearch" aria-hidden="true">⌕</span>
              <input
                id="messageRecipient"
                type="text"
                value={recipientQuery}
                placeholder="Saisir un nom..."
                autoComplete="off"
                onFocus={() => setRecipientOpen(true)}
                onChange={(event) => {
                  setRecipientQuery(event.target.value);
                  setRecipientOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setRecipientOpen(false);
                  if (event.key === "Enter" && matchingContacts.length === 1) {
                    event.preventDefault();
                    openContact(matchingContacts[0]);
                  }
                }}
              />
              <button type="button" aria-label="Afficher les destinataires" onClick={() => setRecipientOpen((open) => !open)}>⌄</button>
            </div>
            {recipientOpen && (
              <div className="messageRecipientOptions">
                {matchingContacts.length ? matchingContacts.map((contact) => (
                  <button key={contact.id} type="button" onClick={() => openContact(contact)}>
                    <span className="messageRecipientAvatar">{contact.name?.charAt(0)?.toUpperCase() || "?"}</span>
                    <span><strong>{contact.name}</strong><small>{roleLabel(contact.role)}</small></span>
                  </button>
                )) : <p>Aucun destinataire trouvé.</p>}
              </div>
            )}
          </div>
          <div className="messagesContactsTitle"><strong>Conversations</strong><span>{contacts.filter((contact) => contact.unread > 0).length} non lue(s)</span></div>
          {contacts.length === 0 ? (
            <p className="emptyState">Aucun contact disponible.</p>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => openContact(contact)}
                className={`messageContact ${activeContact?.id === contact.id ? "active" : ""}`}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 6,
                  cursor: "pointer",
                  background: activeContact?.id === contact.id ? "#dae8fc" : "transparent"
                }}
              >
                <span className="messageContactAvatar">{contact.name?.charAt(0)?.toUpperCase() || "?"}</span>
                <span className="messageContactContent">
                <div className="messageContactTopline" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <strong>{contact.name}</strong>
                  {contact.unread > 0 && (
                    <span className="messageUnreadBadge" style={{ background: "#ef4444", color: "#fff", borderRadius: 999, fontSize: "0.72rem", padding: "1px 7px" }}>
                      {contact.unread}
                    </span>
                  )}
                </div>
                <div className="messageContactRole" style={{ fontSize: "0.75rem", color: "#64748b" }}>{roleLabel(contact.role)}</div>
                {contact.lastMessage && (
                  <div className="messageContactPreview" style={{ fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {contact.lastMessage}
                  </div>
                )}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="messagesConversation">
          {!activeContact ? (
            <div className="messagesEmptyState">
              <span className="messagesEmptyIcon">✉</span>
              <strong>Sélectionnez une conversation</strong>
              <p>Choisissez un contact dans la liste pour consulter vos échanges.</p>
            </div>
          ) : (
            <>
              <div className="conversationHeader" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 8, marginBottom: 8 }}>
                <span className="conversationAvatar">{activeContact.name?.charAt(0)?.toUpperCase() || "?"}</span>
                <div>
                <strong>{activeContact.name}</strong>{" "}
                <span className="conversationRole" style={{ fontSize: "0.8rem", color: "#64748b" }}>{roleLabel(activeContact.role)}</span>
                </div>
              </div>

              <div className="conversationMessages" style={{ flex: 1, overflowY: "auto", maxHeight: 340, paddingRight: 6 }}>
                {messages.length === 0 ? (
                  <p className="emptyState">Aucun message. Ecrivez le premier !</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderId === user.id;
                    return (
                      <div key={m.id} className={`messageRow ${mine ? "mine" : "theirs"}`} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
                        <div
                          className="messageBubble"
                          style={{
                            maxWidth: "75%",
                            padding: "8px 12px",
                            borderRadius: 12,
                            background: mine ? "#6c8ebf" : "#eef2f7",
                            color: mine ? "#fff" : "#1e293b"
                          }}
                        >
                          {m.content && <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>}
                          {m.attachmentName && (
                            <button
                              className="messageAttachment"
                              type="button"
                              onClick={() => downloadAttachment(m)}
                              style={{
                                display: "block",
                                marginTop: m.content ? 6 : 0,
                                border: "none",
                                background: mine ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)",
                                color: "inherit",
                                borderRadius: 8,
                                padding: "5px 10px",
                                cursor: "pointer",
                                fontSize: "0.82rem",
                                textDecoration: "underline"
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <PaperclipIcon />
                                {m.attachmentName}
                              </span>
                            </button>
                          )}
                          <div className="messageTime" style={{ fontSize: "0.68rem", opacity: 0.75, marginTop: 3, textAlign: "right" }}>
                            {formatTime(m.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form className="messageComposer" onSubmit={handleSend} style={{ marginTop: 8 }}>
                {attachment && (
                  <div className="messageAttachmentChip"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#eef2f7",
                      borderRadius: 8,
                      padding: "4px 10px",
                      marginBottom: 6,
                      fontSize: "0.82rem"
                    }}
                  >
                    <PaperclipIcon />
                    {attachment.name}
                    <button
                      className="messageAttachmentRemove"
                      type="button"
                      onClick={() => setAttachment(null)}
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#b91c1c" }}
                      aria-label="Retirer le fichier"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="messageComposerRow" style={{ display: "flex", gap: 8 }}>
                  <label
                    className="messageFileButton"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      padding: "0 8px",
                      color: "#475569"
                    }}
                    title="Joindre un fichier (PDF, DOC, DOCX, JPG, PNG)"
                  >
                    <PaperclipIcon size={19} />
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        setAttachment(e.target.files[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <input
                    className="messageInput"
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ecrire un message..."
                    maxLength={5000}
                    style={{ flex: 1 }}
                  />
                  <button className="fitButton" type="submit" disabled={!draft.trim() && !attachment}>
                    Envoyer
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
