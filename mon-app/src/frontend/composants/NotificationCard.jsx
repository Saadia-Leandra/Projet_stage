export default function NotificationCard({ notification, compact = false, onClick }) {
  const tone = notificationTone(notification);
  return <button
    className={`notificationCard notificationTone-${tone}${notification.readAt ? " isRead" : " isUnread"}${compact ? " isCompact" : ""}`}
    type="button"
    onClick={onClick}
  >
    <span className="notificationCardIcon" aria-hidden="true"><NotificationGlyph tone={tone} /></span>
    <span className="notificationCardBody">
      <span className="notificationCardTopline">
        <strong>{notification.title}</strong>
        {!notification.readAt && <span className="notificationUnreadLabel">Nouveau</span>}
      </span>
      <span className="notificationCardMessage">{notification.message}</span>
      <span className="notificationCardMeta">
        <time dateTime={notification.createdAt}>{formatNotificationDate(notification.createdAt)}</time>
        {notification.actionUrl && <span>Voir les détails <span aria-hidden="true">→</span></span>}
      </span>
    </span>
  </button>;
}

function notificationTone(notification) {
  const value = `${notification.type || ""} ${notification.title || ""}`.toLowerCase();
  if (/refus|rejet|erreur|incomplet/.test(value)) return "danger";
  if (/approuv|valid|sign[eé]|complet|accept/.test(value)) return "success";
  if (/document|contrat|demande|correction/.test(value)) return "document";
  return "info";
}

function formatNotificationDate(value) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 60_000) return "À l’instant";
  if (elapsed >= 0 && elapsed < 3_600_000) return `Il y a ${Math.floor(elapsed / 60_000)} min`;
  if (elapsed >= 0 && elapsed < 86_400_000) return `Il y a ${Math.floor(elapsed / 3_600_000)} h`;
  return date.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function NotificationGlyph({ tone }) {
  if (tone === "success") return <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" /></svg>;
  if (tone === "danger") return <svg viewBox="0 0 24 24"><path d="M12 7v6m0 4h.01M4 20h16L12 4 4 20Z" /></svg>;
  if (tone === "document") return <svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7V3Zm7 0v5h4M10 12h5m-5 4h5" /></svg>;
  return <svg viewBox="0 0 24 24"><path d="M12 8v5m0 4h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /></svg>;
}
