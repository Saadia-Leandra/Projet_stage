import { useEffect, useRef, useState } from "react";
import { navigationTargetFromActionUrl } from "../utils/navigationContext.js";
import NotificationCard from "./NotificationCard.jsx";

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
    const removeReadNotification = (event) => {
      setNotifications((current) => current.filter((item) => item.id !== event.detail));
    };
    window.addEventListener("notification-read", removeReadNotification);
    return () => window.removeEventListener("notification-read", removeReadNotification);
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
            {!error && unreadCount === 0 && (
              <p className="notificationPopoverMessage">Aucune notification pour le moment.</p>
            )}
            {notifications.filter((notification) => !notification.readAt).slice(0, 6).map((notification) => <NotificationCard compact key={notification.id} notification={notification} onClick={() => openNotification(notification)} />)}
          </div>
        </section>
      )}
    </div>
  );
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
