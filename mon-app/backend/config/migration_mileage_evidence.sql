ALTER TABLE deplacements_kilometrage
  ADD COLUMN trace_gps JSON NULL AFTER url_carte,
  ADD COLUMN depart_reel_le DATETIME NULL AFTER trace_gps,
  ADD COLUMN arrivee_reelle_le DATETIME NULL AFTER depart_reel_le,
  ADD COLUMN preuve_stationnement_nom VARCHAR(255) NULL AFTER arrivee_reelle_le,
  ADD COLUMN preuve_stationnement_type VARCHAR(100) NULL AFTER preuve_stationnement_nom,
  ADD COLUMN preuve_stationnement_fichier VARCHAR(255) NULL AFTER preuve_stationnement_type;
