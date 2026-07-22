import { useEffect, useState } from "react";

export default function FrozenRouteSnapshot({ snapshot, tripId }) {
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    let objectUrl = "";
    if (!snapshot?.proofImageStoredName || !tripId) return undefined;
    fetch(`/api/mileage/trips/${tripId}/route-proof`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    }).then(async (response) => {
      if (!response.ok) throw new Error();
      objectUrl = URL.createObjectURL(await response.blob());
      setImageUrl(objectUrl);
    }).catch(() => setImageError("Impossible de charger la preuve Google Maps enregistrée."));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [snapshot?.proofImageStoredName, tripId]);

  if (!snapshot) return <p>Aucune preuve Google Maps n’est disponible pour cet ancien trajet.</p>;
  return <section className="routeSnapshot">
    <div className="panelHeader"><h3>Itinéraire Google Maps enregistré</h3></div>
    <div className="routeSnapshotSummary">
      <div><strong>{formatDuration(snapshot.durationMinutes)}</strong><span>Durée estimée</span></div>
      <div><strong>{formatNumber(snapshot.distanceKm)} km</strong><span>Distance totale</span></div>
      <div><strong>{snapshot.tripType === "ALLER_RETOUR" ? "Aller-retour" : "Aller simple"}</strong><span>Type de trajet</span></div>
    </div>
    {imageUrl && <img className="frozenRouteImage" src={imageUrl} alt={`Carte Google Maps du trajet calculé le ${formatDateTime(snapshot.calculatedAt)}`} />}
    {imageError && <p className="studentError">{imageError}</p>}
    {!snapshot.proofImageStoredName && <p>La carte Google Maps n’existait pas lors de l’enregistrement de cet ancien trajet.</p>}
    <ol className="routeStops">
      <li><span className="routeStopMarker routeStopStart">D</span><div><strong>Départ</strong><span>{snapshot.origin?.address}</span></div></li>
      {(snapshot.destinations || []).map((destination, index) => <li key={`${destination.address}-${index}`}><span className="routeStopMarker">{index + 1}</span><div><strong>Arrêt {index + 1}{destination.label ? ` — ${destination.label}` : ""}</strong><span>{destination.address}</span></div></li>)}
      {snapshot.tripType === "ALLER_RETOUR" && <li><span className="routeStopMarker routeStopReturn">R</span><div><strong>Retour</strong><span>{snapshot.origin?.address}</span></div></li>}
    </ol>
    <p className="routeSnapshotNotice">Calculé le {formatDateTime(snapshot.calculatedAt)}. La carte, les adresses, la distance et la durée ont été enregistrées ensemble et ne sont jamais recalculées.</p>
  </section>;
}

function formatDateTime(value) { return value ? new Date(value).toLocaleString("fr-CA") : "-"; }
function formatNumber(value) { return Number(value || 0).toLocaleString("fr-CA", { maximumFractionDigits: 2 }); }
function formatDuration(value) {
  const minutes = Number(value || 0);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}
