import { useEffect, useState } from "react";

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

  async function openNotification(notification) {
    if (!notification.readAt) {
      const response = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (response.ok) setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
      ));
    }
    const destination = notificationDestination(notification.actionUrl);
    if (destination) onNavigate(destination);
  }

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  return <section className="studentPanel">
    <div className="panelHeader"><h2>Notifications</h2><span className="statusPill">{unreadCount} non lue(s)</span></div>
    {error && <div className="studentError">{error}</div>}
    {!error && notifications.slice(0, 6).map((notification) => <button
      className={`notificationItem dashboardNotificationItem${notification.readAt ? "" : " unread"}`}
      type="button" key={notification.id} onClick={() => openNotification(notification)}
    ><span className="notificationDot" /><p><strong>{notification.title}</strong><br />{notification.message}</p></button>)}
    {!error && !notifications.length && <div className="notificationItem"><p>Aucune notification pour le moment.</p></div>}
  </section>;
}

function notificationDestination(actionUrl = "") {
  if (actionUrl.includes("/contracts/")) return actionUrl.includes("/stage-management/") ? "stageContracts" : "contracts";
  if (actionUrl.includes("/supervisor/stages/requests/")) return "stageRequests";
  if (actionUrl.includes("/demandes-stage/")) return "requests";
  return "";
}
