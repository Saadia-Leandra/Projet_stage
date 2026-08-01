ALTER TABLE utilisateurs
  ADD COLUMN mot_de_passe_updated BOOLEAN NOT NULL DEFAULT FALSE
  AFTER mot_de_passe_hash;

-- Les comptes existants conservent leur mot de passe actuel.
-- Les nouveaux comptes importés auront la valeur FALSE jusqu'à la création
-- de leur mot de passe personnel.
