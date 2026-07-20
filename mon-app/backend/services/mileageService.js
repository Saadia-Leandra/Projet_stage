const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

export class MileageService {
  async calculate(data) {
    const originAddress = normalizeAddress(data.origin);
    const destinations = normalizeDestinations(data.destinations);
    const tripType = data.tripType === "ALLER_SIMPLE" ? "ALLER_SIMPLE" : "ALLER_RETOUR";
    const route = await calculateGoogleRoute(originAddress, destinations, tripType);

    return {
      originAddress,
      destinations,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      durationLabel: route.durationLabel,
      provider: route.provider,
      tripType,
      mapUrl: route.mapUrl,
      calculatedAt: new Date().toISOString()
    };
  }
}

async function calculateGoogleRoute(originAddress, destinations, tripType) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw createError("Cle Google Maps manquante.", 500);
  }

  if (!originAddress) {
    throw createError("Adresse de depart requise.", 400);
  }

  if (!destinations.length) {
    throw createError("Au moins une destination est requise.", 400);
  }

  const [originCoordinates, ...destinationCoordinates] = await Promise.all([
    geocode(originAddress),
    ...destinations.map((destination) => geocode(destination.address))
  ]);
  const routeCoordinates = tripType === "ALLER_RETOUR"
    ? [...destinationCoordinates, originCoordinates]
    : destinationCoordinates;
  const finalCoordinates = routeCoordinates[routeCoordinates.length - 1];
  const response = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration"
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: {
            latitude: originCoordinates.lat,
            longitude: originCoordinates.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: finalCoordinates.lat,
            longitude: finalCoordinates.lng
          }
        }
      },
      intermediates: routeCoordinates.slice(0, -1).map(toWaypoint)
    })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createError(formatGoogleRoutesError(payload, response.status), 400);
  }

  const route = payload.routes?.[0];

  if (!route) {
    throw createError("Aucune route trouvee entre ces adresses.", 400);
  }

  const durationMinutes = durationToMinutes(route.duration);

  return {
    distanceKm: round(route.distanceMeters / 1000, 2),
    durationMinutes,
    durationLabel: formatDuration(durationMinutes),
    mapUrl: buildMapUrl(originCoordinates, routeCoordinates),
    provider: "GOOGLE_ROUTES"
  };
}

async function geocode(address) {
  const url = new URL(GEOCODING_URL);

  url.searchParams.set("address", address);
  url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY);

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.status !== "OK") {
    throw createError(formatGoogleGeocodingError(payload, response.status), 400);
  }

  return payload.results[0].geometry.location;
}

function normalizeAddress(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  return String(value?.address || "").trim();
}

function normalizeDestinations(destinations) {
  if (!Array.isArray(destinations)) {
    return [];
  }

  return destinations
    .map((destination, index) => {
      if (typeof destination === "string") {
        return {
          label: `Destination ${index + 1}`,
          address: destination.trim(),
          companyId: null
        };
      }

      return {
        label: String(destination?.label || destination?.name || `Destination ${index + 1}`).trim(),
        address: String(destination?.address || "").trim(),
        companyId: destination?.companyId || null
      };
    })
    .filter((destination) => destination.address);
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}

function toWaypoint(coordinates) {
  return {
    location: {
      latLng: {
        latitude: coordinates.lat,
        longitude: coordinates.lng
      }
    }
  };
}

function formatCoordinates(coordinates) {
  return `${coordinates.lat},${coordinates.lng}`;
}

function buildMapUrl(originCoordinates, routeCoordinates) {
  const url = new URL("https://www.google.com/maps/dir/");
  const destinationCoordinates = routeCoordinates[routeCoordinates.length - 1];

  url.searchParams.set("api", "1");
  url.searchParams.set("origin", formatCoordinates(originCoordinates));
  url.searchParams.set("destination", formatCoordinates(destinationCoordinates));
  url.searchParams.set("travelmode", "driving");

  const waypoints = routeCoordinates.slice(0, -1);
  if (waypoints.length) {
    url.searchParams.set("waypoints", waypoints.map(formatCoordinates).join("|"));
  }

  return url.toString();
}

function durationToMinutes(duration) {
  const seconds = typeof duration === "object"
    ? Number(duration.seconds ?? 0)
    : typeof duration === "string"
      ? Number.parseInt(duration.replace("s", ""), 10)
      : Number(duration) || 0;

  return Math.round(seconds / 60);
}

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  return `${minutes} min`;
}

function formatGoogleGeocodingError(payload, statusCode) {
  if (payload.status === "REQUEST_DENIED") {
    return "Google Maps refuse le geocodage. Verifiez que Geocoding API est activee et autorisee pour cette cle.";
  }

  if (payload.status === "ZERO_RESULTS") {
    return "Google Maps ne trouve pas une des adresses.";
  }

  if (payload.status === "OVER_QUERY_LIMIT") {
    return "La limite de requetes Google Maps est atteinte pour cette cle API.";
  }

  return `Geocodage Google Maps impossible: ${payload.status || statusCode}.`;
}

function formatGoogleRoutesError(payload, statusCode) {
  const message = payload.error?.message;

  if (statusCode === 403) {
    return "Google Routes refuse la requete. Verifiez que Routes API est activee et autorisee pour cette cle.";
  }

  return message || `Calcul Google Routes impossible: ${statusCode}.`;
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
