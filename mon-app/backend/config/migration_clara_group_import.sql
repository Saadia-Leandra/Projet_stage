USE defaultdb;

ALTER TABLE utilisateurs
  ADD COLUMN telephone_secondaire VARCHAR(40) NULL AFTER telephone;

ALTER TABLE etudiants
  ADD COLUMN session VARCHAR(30) NULL AFTER groupe,
  ADD COLUMN numero_cours VARCHAR(30) NULL AFTER session,
  ADD COLUMN titre_cours VARCHAR(160) NULL AFTER numero_cours,
  ADD COLUMN discipline VARCHAR(160) NULL AFTER titre_cours,
  ADD COLUMN horaire VARCHAR(500) NULL AFTER discipline,
  ADD COLUMN ponderation VARCHAR(30) NULL AFTER horaire,
  ADD COLUMN date_debut_groupe DATE NULL AFTER ponderation,
  ADD COLUMN date_fin_groupe DATE NULL AFTER date_debut_groupe;
