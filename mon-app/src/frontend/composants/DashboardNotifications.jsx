import { useEffect, useState } from "react";
import { navigationTargetFromActionUrl } from "../utils/navigationContext.js";
import NotificationCard from "./NotificationCard.jsx";

export default function DashboardNotifications({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Impossible de charger les notifications.");
        setNotifications(data.notifications || []);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    const removeReadNotification = (event) => {
      setNotifications((current) => current.filter((item) => item.id !== event.detail));
    };
    window.addEventListener("notification-read", removeReadNotification);
    return () => window.removeEventListener("notification-read", removeReadNotification);
  }, []);

  async function openNotification(notification) {
    if (!notification.readAt) {
      const response = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Impossible de marquer la notification comme lue.");
        return;
      }
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      window.dispatchEvent(new CustomEvent("notification-read", { detail: notification.id }));
    }
    const destination = navigationTargetFromActionUrl(
      notification.actionUrl
    );
    if (destination) {
      onNavigate(destination.view, destination.context);
    }
  }

  const unreadNotifications = notifications.filter((notification) => !notification.readAt);
  const unreadCount = unreadNotifications.length;
  return <section className="studentPanel notificationDashboardPanel">
    <div className="panelHeader"><div><h2>Notifications</h2><p className="panelSubtle">Les dernières activités importantes de votre dossier</p></div><span className={`statusPill${unreadCount ? " statusYellow" : " statusGreen"}`}>{unreadCount ? `${unreadCount} non lue(s)` : "Tout est à jour"}</span></div>
    {error && <div className="studentError">{error}</div>}
    <div className="notificationDashboardList">
      {!error && unreadNotifications.slice(0, 6).map((notification) => <NotificationCard key={notification.id} notification={notification} onClick={() => openNotification(notification)} />)}
      {!error && !unreadNotifications.length && <div className="notificationEmptyState"><span aria-hidden="true">✓</span><strong>Aucune notification</strong><p>Vous êtes à jour. Les nouvelles activités apparaîtront ici.</p></div>}
    </div>
  </section>;
}
