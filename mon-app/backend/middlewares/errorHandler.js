export function errorHandler(error, _req, res, _next) {
  console.error(error);

  const status = error.status || 500;
  const message = status === 500 ? "Erreur serveur." : error.message;
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

  res.status(status).json(body);
}
