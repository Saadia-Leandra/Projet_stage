export function errorHandler(error, _req, res, _next) {
  console.error(error);

  const status = error.status || 500;
  const isProd = process.env.NODE_ENV === "production";
  const message = error.message || "Erreur serveur.";

  const payload = {
    error: isProd && status === 500 ? "Erreur serveur." : message,
    ...(error.details ? { details: error.details } : {})
  };

  if (!isProd) {
    payload.stack = error.stack;
  }

  res.status(status).json(payload);
}
