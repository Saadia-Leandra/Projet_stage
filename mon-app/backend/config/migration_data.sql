USE stagetec;


UPDATE entreprises
SET
  neq = '1176543210',
  contact_rh_poste = '201',
  superviseur_nom = 'Julie Martin',
  superviseur_titre = 'Superviseure de stage',
  superviseur_courriel = 'julie.martin@acme.example',
  superviseur_telephone = '514-555-1000'
WHERE code = 'ACME';

UPDATE entreprises
SET
  neq = '1176543211',
  contact_rh_poste = NULL,
  superviseur_nom = 'Marc Gagnon',
  superviseur_titre = 'Superviseur de stage',
  superviseur_courriel = 'marc.gagnon@long.example',
  superviseur_telephone = '450-555-2000'
WHERE code = 'LONG';

UPDATE entreprises
SET
  neq = '1176543212',
  contact_rh_poste = NULL,
  superviseur_nom = 'Sophie RH',
  superviseur_titre = 'Superviseure de stage',
  superviseur_courriel = 'sophie.rh@laval.example',
  superviseur_telephone = '450-555-3000'
WHERE code = 'LAVAL';

UPDATE demandes_stage dem
JOIN dossiers_stage ds ON ds.id = dem.dossier_stage_id
JOIN etudiants e ON e.utilisateur_id = ds.etudiant_id
JOIN entreprises ent ON ent.id = dem.entreprise_id
LEFT JOIN contrats c ON c.demande_stage_id = dem.id
SET
  dem.horaire_stage = ent.horaire_travail,
  dem.heures_semaine = ent.heures_semaine,
  dem.langue_travail = ent.langue_travail,
  dem.type_horaire = CASE
    WHEN ent.heures_semaine >= 35 THEN 'TEMPS_PLEIN'
    WHEN ent.heures_semaine IS NOT NULL THEN 'TEMPS_PARTIEL'
    ELSE NULL
  END,
  dem.nombre_semaines = CASE
    WHEN dem.date_debut IS NOT NULL AND dem.date_fin IS NOT NULL
      THEN ROUND((DATEDIFF(dem.date_fin, dem.date_debut) + 1) / 7, 2)
    ELSE NULL
  END,
  dem.est_remunere = COALESCE(c.est_remunere, FALSE),
  dem.salaire_horaire = c.salaire_horaire,
  dem.autre_compensation = c.autre_compensation
WHERE e.code_etudiant IN ('2600001', '2600002');

SELECT code, neq, contact_rh_poste, superviseur_nom, superviseur_titre,
       superviseur_courriel, superviseur_telephone
FROM entreprises
WHERE code IN ('ACME', 'LONG', 'LAVAL');

SELECT dem.id, e.code_etudiant, ent.code AS entreprise_code,
       dem.horaire_stage, dem.heures_semaine, dem.langue_travail,
       dem.type_horaire, dem.nombre_semaines, dem.est_remunere,
       dem.salaire_horaire, dem.autre_compensation
FROM demandes_stage dem
JOIN dossiers_stage ds ON ds.id = dem.dossier_stage_id
JOIN etudiants e ON e.utilisateur_id = ds.etudiant_id
JOIN entreprises ent ON ent.id = dem.entreprise_id
WHERE e.code_etudiant IN ('2600001', '2600002');
