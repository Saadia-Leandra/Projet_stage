export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  if (status >= 500) {
    console.error(error);
  }

  const isProd = process.env.NODE_ENV === "production";
  const message =
    isProd && status === 500
      ? "Erreur serveur."
      : error.message || "Erreur serveur.";
  const body = { error: message };

  if (error.details) {
    body.details = error.details;
  }

  if (
    typeof error.code === "string" &&
    status !== 500
  ) {
    body.code = error.code;
  }

  if (!isProd) {
    body.stack = error.stack;
  }

  res.status(status).json(body);
}
