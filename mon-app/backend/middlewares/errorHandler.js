export function errorHandler(error, _req, res, _next) {
  console.error(error);

  const status = error.status || 500;
  const message = status === 500 ? "Erreur serveur." : error.message;

  res.status(status).json({ error: message });
}
