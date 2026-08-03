import { useCallback, useEffect, useState } from "react";

const DOCUMENT_TYPES = [
  { value: "ATTESTATION", label: "Attestation" },
  { value: "ASSURANCE", label: "Assurance" },
  { value: "CAQ", label: "CAQ" },
  { value: "PERMIS_ETUDES", label: "Permis d'etudes" },
  { value: "AUTRE", label: "Autre" }
];

const ACTION_LABELS = {
  DEPOT: "Document depose",
  NOUVELLE_VERSION: "Nouvelle version",
  TELECHARGEMENT: "Telechargement",
  ARCHIVAGE: "Document supprime"
};

const MODERATOR_ROLES = ["CONSEILLERE"];
const MAX_BYTES = 10 * 1024 * 1024;

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }

  return data;
}

function typeLabel(value) {
  return DOCUMENT_TYPES.find((type) => type.value === value)?.label || value;
}

function formatSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default function DocumentsPanel({
  user,
  onNavigate
}) {
  const [stageFiles, setStageFiles] = useState([]);
  const [selectedStageFileId, setSelectedStageFileId] = useState("");
  const [documents, setDocuments] = useState([]);
  const [openDocument, setOpenDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStageFiles = useCallback(async () => {
    try {
      const data = await apiJson("/api/documents/stage-files");
      const files = data.stageFiles || [];
      setStageFiles(files);
      setSelectedStageFileId((current) => current || (files[0]?.stageFileId ?? ""));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async (stageFileId) => {
    if (!stageFileId) {
      setDocuments([]);
      return;
    }

    try {
      const data = await apiJson(`/api/documents?stageFileId=${stageFileId}`);
      setDocuments(data.documents || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    loadStageFiles();
  }, [loadStageFiles]);

  useEffect(() => {
    loadDocuments(selectedStageFileId);
  }, [selectedStageFileId, loadDocuments]);

  function notify(text) {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 4000);
  }

  async function handleDownload(document) {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Le telechargement a echoue.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.fileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  async function handleDelete(document) {
    if (!window.confirm("Supprimer ce document ? Il restera dans le journal d'audit.")) {
      return;
    }

    try {
      await apiJson(`/api/documents/${document.id}`, { method: "DELETE" });
      if (openDocument?.id === document.id) {
        setOpenDocument(null);
      }
      notify("Document supprime.");
      loadDocuments(selectedStageFileId);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function handleNewVersion(document, file) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("Le fichier depasse la taille maximale de 10 Mo.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/documents/${document.id}/versions`, {
        method: "POST",
        headers: authHeaders(),
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Le depot de la nouvelle version a echoue.");
      }
      notify("Nouvelle version deposee.");
      loadDocuments(selectedStageFileId);
    } catch (versionError) {
      setError(versionError.message);
    }
  }

  if (loading) {
    return <div className="loadingState">Chargement des documents...</div>;
  }

  if (stageFiles.length === 0) {
    return (
      <section className="panel documentPanel">
        <div className="panelHeader">
          <h2>Gestion documentaire</h2>
        </div>
        <p className="emptyState">Aucun dossier de stage accessible pour le moment.</p>
      </section>
    );
  }

  const lockedStageFile =
    user.role === "ETUDIANT"
      ? stageFiles.find(
          (stageFile) =>
            stageFile.blockedByRefusal
        )
      : null;

  if (lockedStageFile) {
    return (
      <section className="panel documentPanel stageLockPanel">
        <div className="panelHeader">
          <div>
            <h2>Documents bloques</h2>
            <p>
              Un refus definitif bloque les depots,
              remplacements, suppressions, checklist et
              commentaires de dossier.
            </p>
          </div>

          <span className="statusPill statusRed">
            Demande refusee
          </span>
        </div>

        <div className="studentError">
          <strong>Motif du refus definitif :</strong>{" "}
          {lockedStageFile.refusalReason ||
            "Aucun motif detaille n'est disponible."}
        </div>

        <div className="stageLockActions">
          <button
            className="primaryButton fitButton"
            type="button"
            onClick={() => onNavigate?.("messages")}
          >
            Ouvrir la messagerie
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel documentPanel">
      <div className="panelHeader">
        <h2>Gestion documentaire</h2>
        {stageFiles.length > 1 && (
          <select
            value={selectedStageFileId}
            onChange={(event) => {
              setSelectedStageFileId(Number(event.target.value));
              setOpenDocument(null);
            }}
          >
            {stageFiles.map((file) => (
              <option key={file.stageFileId} value={file.stageFileId}>
                {file.studentName}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="notice">{message}</div>}

      <ChecklistSection stageFileId={selectedStageFileId} user={user} />

      <UploadForm
        stageFileId={selectedStageFileId}
        onUploaded={() => {
          notify("Document depose.");
          loadDocuments(selectedStageFileId);
        }}
        onError={setError}
      />

      <DocumentList
        documents={documents}
        openId={openDocument?.id}
        onOpen={(doc) => setOpenDocument((prev) => (prev?.id === doc.id ? null : doc))}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onNewVersion={handleNewVersion}
      />

      {openDocument && (
        <DocumentDetail
          document={openDocument}
          onClose={() => setOpenDocument(null)}
          onError={setError}
        />
      )}

      <DossierDiscussion stageFileId={selectedStageFileId} user={user} onError={setError} />
    </section>
  );
}

function DossierDiscussion({ stageFileId, user, onError }) {
  const [comments, setComments] = useState([]);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!stageFileId) return;
    try {
      const data = await apiJson(`/api/documents/stage/${stageFileId}/comments`);
      setComments(data.comments || []);
    } catch (loadError) {
      onError(loadError.message);
    }
  }, [stageFileId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function addComment(content, parentId) {
    try {
      await apiJson(`/api/documents/stage/${stageFileId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId: parentId || null })
      });
      load();
    } catch (e) {
      onError(e.message);
    }
  }

  async function updateComment(commentId, content) {
    try {
      await apiJson(`/api/documents/stage-comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      load();
    } catch (e) {
      onError(e.message);
    }
  }

  async function deleteComment(commentId) {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    try {
      await apiJson(`/api/documents/stage-comments/${commentId}`, { method: "DELETE" });
      load();
    } catch (e) {
      onError(e.message);
    }
  }

  return (
    <section className="dossierDiscussion">
      <button
        type="button"
        className="linkButton dossierDiscussionToggle"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "▼" : "▶"} Commentaires ({comments.length})
      </button>
      <p className="dossierDiscussionIntro">
        Échanges entre l'étudiant et la conseillère sur le dossier.
      </p>

      {open && (
        <div>
          {comments.length === 0 ? (
            <p className="emptyState">Aucun commentaire. Lancez la discussion !</p>
          ) : (
            comments.map((c) => (
              <Comment
                key={c.id}
                comment={c}
                user={user}
                onReply={addComment}
                onUpdate={updateComment}
                onDelete={deleteComment}
              />
            ))
          )}
          <CommentInput label="Commenter" onSubmit={(content) => addComment(content, null)} />
        </div>
      )}
    </section>
  );
}

function UploadForm({ stageFileId, onUploaded, onError }) {
  const [type, setType] = useState("ATTESTATION");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    onError("");

    if (!file) {
      onError("Veuillez selectionner un fichier.");
      return;
    }

    if (file.size > MAX_BYTES) {
      onError("Le fichier depasse la taille maximale de 10 Mo.");
      return;
    }

    const formData = new FormData();
    formData.append("stageFileId", stageFileId);
    formData.append("type", type);
    formData.append("file", file);

    setUploading(true);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: authHeaders(),
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Le depot a echoue.");
      }

      event.target.reset();
      setFile(null);
      onUploaded();
    } catch (uploadError) {
      onError(uploadError.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="documentUploadForm"
    >
      <select value={type} onChange={(event) => setType(event.target.value)}>
        {DOCUMENT_TYPES.map((documentType) => (
          <option key={documentType.value} value={documentType.value}>
            {documentType.label}
          </option>
        ))}
      </select>

      <input
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={(event) => setFile(event.target.files[0] ?? null)}
      />

      <button className="primaryButton fitButton" type="submit" disabled={uploading}>
        {uploading ? "Dépôt..." : "Déposer"}
      </button>
    </form>
  );
}

function ChecklistSection({ stageFileId, user }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!stageFileId) return;
    try {
      const data = await apiJson(`/api/documents/checklist/${stageFileId}`);
      setItems(data.checklist || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [stageFileId]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = user.role === "ETUDIANT";

  async function toggle(type, done) {
    try {
      await apiJson(`/api/documents/checklist/${stageFileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, done })
      });
      load();
    } catch (toggleError) {
      setError(toggleError.message);
    }
  }

  const doneCount = items.filter((i) => i.done).length;
  const isComplete = items.length > 0 && doneCount === items.length;

  return (
    <div className="documentChecklist">
      <div className="documentChecklistHeader">
        <strong>
          Documents à jour{!canEdit && <span> (déclarés par l'étudiant)</span>}
        </strong>
        <span
          className={`checklistCount ${
            isComplete ? "checklistCountDone" : ""
          }`}
        >
          {doneCount}/{items.length}
        </span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="documentChecklistItems">
        {items.map((item) => (
          <label
            key={item.type}
            className={`documentChecklistItem ${
              item.done ? "documentChecklistDone" : ""
            } ${canEdit ? "documentChecklistEditable" : ""}`}
          >
            {canEdit ? (
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) => toggle(item.type, e.target.checked)}
              />
            ) : (
              <span
                className={`documentChecklistMarker ${
                  item.done ? "documentChecklistMarkerDone" : ""
                }`}
              >
                {item.done ? "✓" : "–"}
              </span>
            )}
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function DocumentList({ documents, openId, onOpen, onDownload, onDelete, onNewVersion }) {
  if (documents.length === 0) {
    return <p className="emptyState">Aucun document dans ce dossier.</p>;
  }

  return (
    <div className="documentList">
      {documents.map((document) => {
        const isOpen = openId === document.id;
        const day = new Date(document.createdAt).toLocaleDateString("fr-CA", { dateStyle: "medium" });

        return (
          <div
            key={document.id}
            className="documentListItem"
          >
            <div className="documentListMeta">
              <strong>{document.fileName}</strong>
              <span className="statusPill">{typeLabel(document.type)}</span>
              <span className="documentListSubtext">
                v{document.version} · {formatSize(document.sizeBytes)} · {day}
              </span>
            </div>

            <div className="documentListActions">
              <button className="linkButton documentActionLink" type="button" onClick={() => onOpen(document)}>
                {isOpen ? "Fermer" : "Détails"}
              </button>
              <button className="linkButton documentActionLink" type="button" onClick={() => onDownload(document)}>
                Télécharger
              </button>
              <label className="linkButton documentActionLink documentUploadLabel">
                Nouvelle version
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="documentHiddenInput"
                  onChange={(e) => {
                    onNewVersion(document, e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="linkButton documentActionLink documentDangerLink"
                type="button"
                onClick={() => onDelete(document)}
              >
                Supprimer
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentDetail({ document, onClose, onError }) {
  const [history, setHistory] = useState([]);

  const reloadHistory = useCallback(async () => {
    try {
      const data = await apiJson(`/api/documents/${document.id}/history`);
      setHistory(data.history || []);
    } catch (loadError) {
      onError(loadError.message);
    }
  }, [document.id, onError]);

  useEffect(() => {
    reloadHistory();
  }, [reloadHistory]);

  return (
    <div className="contractDetails">
      <div className="contractStatusHeader">
        <h3>{document.fileName}</h3>
        <button className="linkButton" type="button" onClick={onClose}>
          Fermer
        </button>
      </div>

      <h4 className="documentHistoryTitle">Historique du document ({history.length})</h4>
      <HistoryList history={history} />
    </div>
  );
}

function Comment({ comment, user, onReply, onUpdate, onDelete, isReply = false }) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);

  const isAuthor = comment.authorId === user.id;
  const canDelete = isAuthor || MODERATOR_ROLES.includes(user.role);

  if (comment.deleted) {
    return (
      <div
        className={`commentItem commentDeleted ${
          isReply ? "commentReply" : ""
        }`}
      >
        <p className="commentDeletedText">
          Commentaire supprimé
        </p>
        {comment.replies?.map((reply) => (
          <Comment
            key={reply.id}
            comment={reply}
            user={user}
            onReply={onReply}
            onUpdate={onUpdate}
            onDelete={onDelete}
            isReply
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`commentItem ${
        isReply ? "commentReply" : ""
      }`}
    >
      <div className="commentHeader">
        <strong>{comment.authorName}</strong>
        <span className="statusPill">{comment.authorRole}</span>
        <span className="commentDate">
          {formatDate(comment.createdAt)}{comment.updatedAt && " · modifié"}
        </span>
      </div>

      {editing ? (
        <CommentInput
          label="Enregistrer"
          initialValue={comment.content}
          onSubmit={(content) => {
            onUpdate(comment.id, content);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p className="commentBody">
          {comment.content}
        </p>
      )}

      {!editing && (
        <div className="commentActions">
          <button className="linkButton" type="button" onClick={() => setReplying(!replying)}>
            Repondre
          </button>
          {isAuthor && (
            <button className="linkButton" type="button" onClick={() => setEditing(true)}>
              Modifier
            </button>
          )}
          {canDelete && (
            <button className="linkButton" type="button" onClick={() => onDelete(comment.id)}>
              Supprimer
            </button>
          )}
        </div>
      )}

      {replying && (
        <CommentInput
          label="Repondre"
          onSubmit={(content) => {
            onReply(content, comment.id);
            setReplying(false);
          }}
          onCancel={() => setReplying(false)}
        />
      )}

      {comment.replies?.map((reply) => (
        <Comment
          key={reply.id}
          comment={reply}
          user={user}
          onReply={onReply}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isReply
        />
      ))}
    </div>
  );
}

function CommentInput({ label, initialValue = "", onSubmit, onCancel }) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(event) {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="commentInputForm">
      <textarea
        rows={2}
        maxLength={5000}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Votre commentaire..."
      />
      <div className="contractActions">
        <button className="primaryButton fitButton" type="submit" disabled={!value.trim()}>
          {label}
        </button>
        {onCancel && (
          <button className="linkButton" type="button" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

function HistoryList({ history }) {
  if (history.length === 0) {
    return <p className="emptyState">Aucune action enregistree.</p>;
  }

  return (
    <ul className="documentHistoryList">
      {history.map((entry) => (
        <li
          key={entry.id}
          className="documentHistoryItem"
        >
          <span className="documentHistoryAction">
            {ACTION_LABELS[entry.action] || entry.action}
          </span>
          <span className="documentHistoryMeta">
            {entry.userName} · {entry.userRole} · {formatDate(entry.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
