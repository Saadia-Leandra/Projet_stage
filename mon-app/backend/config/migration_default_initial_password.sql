-- Le hash ci-dessous correspond au mot de passe initial "secret123".
ALTER TABLE utilisateurs
  MODIFY mot_de_passe_updated BOOLEAN NOT NULL DEFAULT FALSE;

-- Repare uniquement les comptes qui n'ont aucun hash exploitable.
UPDATE utilisateurs
SET
  mot_de_passe_hash = 'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ',
  mot_de_passe_updated = FALSE
WHERE mot_de_passe_hash IS NULL
   OR mot_de_passe_hash = ''
   OR mot_de_passe_hash NOT LIKE 'scrypt:%';
