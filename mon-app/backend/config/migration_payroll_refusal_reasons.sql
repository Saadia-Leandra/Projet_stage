ALTER TABLE charges_paie_supervision
  ADD COLUMN motif_refus TEXT NULL AFTER statut;

ALTER TABLE deplacements_kilometrage
  ADD COLUMN motif_refus TEXT NULL AFTER statut;
