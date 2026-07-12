USE stagetec;

ALTER TABLE entreprises
  ADD COLUMN neq VARCHAR(30) NULL
    AFTER nom,

  ADD COLUMN contact_rh_poste VARCHAR(20) NULL
    AFTER contact_rh_telephone,

  ADD COLUMN superviseur_nom VARCHAR(160) NULL
    AFTER contact_signature_courriel,

  ADD COLUMN superviseur_titre VARCHAR(160) NULL
    AFTER superviseur_nom,

  ADD COLUMN superviseur_courriel VARCHAR(255) NULL
    AFTER superviseur_titre,

  ADD COLUMN superviseur_telephone VARCHAR(40) NULL
    AFTER superviseur_courriel;

ALTER TABLE demandes_stage
  ADD COLUMN horaire_stage VARCHAR(160) NULL
    AFTER date_fin_disponibilite,

  ADD COLUMN heures_semaine DECIMAL(5,2) NULL
    AFTER horaire_stage,

  ADD COLUMN langue_travail VARCHAR(80) NULL
    AFTER heures_semaine,

  ADD COLUMN type_horaire ENUM(
    'TEMPS_PARTIEL',
    'TEMPS_PLEIN'
  ) NULL
    AFTER langue_travail,

  ADD COLUMN nombre_semaines DECIMAL(5,2) NULL
    AFTER type_horaire,

  ADD COLUMN est_remunere BOOLEAN NOT NULL DEFAULT FALSE
    AFTER nombre_semaines,

  ADD COLUMN salaire_horaire DECIMAL(8,2) NULL
    AFTER est_remunere,

  ADD COLUMN autre_compensation VARCHAR(180) NULL
    AFTER salaire_horaire;

DESCRIBE entreprises;
DESCRIBE demandes_stage;
