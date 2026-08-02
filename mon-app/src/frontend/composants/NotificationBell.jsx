import { useEffect, useRef, useState } from "react";

export default function NotificationBell({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef(null);

  async function loadNotifications() {
    const token = localStorage.getItem("token");

    if (!token) return;

    try {
      const response = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Impossible de charger les notifications.");
      }

      setNotifications(data.notifications || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadNotifications();
    const refreshTimer = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  async function openNotification(notification) {
    if (!notification.readAt) {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, readAt: new Date().toISOString() }
              : item
          )
        );
      }
    }

    const destination = notificationDestination(notification.actionUrl);
    if (destination) onNavigate(destination);
    setOpen(false);
  }

  return (
    <div className="notificationBell" ref={containerRef}>
      <button
        className="notificationBellButton"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unreadCount
            ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
            : "Notifications"
        }
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notificationBellBadge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section className="notificationPopover" aria-label="Notifications récentes">
          <header>
            <div>
              <strong>Notifications</strong>
              <span>{unreadCount ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est à jour"}</span>
            </div>
          </header>

          <div className="notificationPopoverList">
            {error && <p className="notificationPopoverMessage">{error}</p>}
            {!error && notifications.length === 0 && (
              <p className="notificationPopoverMessage">Aucune notification pour le moment.</p>
            )}
            {notifications.slice(0, 6).map((notification) => (
              <button
                className={`notificationPopoverItem${notification.readAt ? "" : " unread"}`}
                type="button"
                key={notification.id}
                onClick={() => openNotification(notification)}
              >
                <span className="notificationPopoverDot" />
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.message}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function notificationDestination(actionUrl = "") {
  if (actionUrl.includes("/contracts/")) return actionUrl.includes("/stage-management/")
    ? "stageContracts"
    : "contracts";
  if (actionUrl.includes("/supervisor/stages/requests/")) return "stageRequests";
  if (actionUrl.includes("/demandes-stage/")) return "requests";
  if (actionUrl.includes("/messages")) return "messages";
  if (actionUrl.includes("/documents")) return "documents";
  return "";
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
