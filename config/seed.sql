USE stagetec;

INSERT INTO utilisateurs (courriel, mot_de_passe_hash, prenom, nom, role, statut) VALUES
('marie@teccart.com', 'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ', 'Marie', 'Tremblay', 'ETUDIANT', 'ACTIF'),
('samir@teccart.com', 'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ', 'Samir', 'Haddad', 'ETUDIANT', 'ACTIF'),
('tom@teccart.com', 'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ', 'Tom', 'Jerry', 'SUPERVISEUR', 'ACTIF'),
('jessica@teccart.com', 'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ', 'Jessica', 'Adams', 'SUPERVISEUR', 'ACTIF'),
('claire@teccart.com', 'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ', 'Claire', 'Bailey', 'CONSEILLERE', 'ACTIF'),
('compta@teccart.com', 'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ', 'Samuel', 'Cruz', 'COMPTABILITE', 'ACTIF'),
('direction@teccart.com', 'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ', 'Alexis', 'Martin', 'DIRECTION', 'ACTIF');

INSERT INTO superviseurs (utilisateur_id, numero_employe, departement, taux_horaire, taux_kilometrique)
SELECT id, 'EMP-1001', 'Informatique', 45.000, 0.610
FROM utilisateurs WHERE courriel = 'tom@teccart.com';

INSERT INTO superviseurs (utilisateur_id, numero_employe, departement, taux_horaire, taux_kilometrique)
SELECT id, 'EMP-1002', 'Informatique', 45.000, 0.610
FROM utilisateurs WHERE courriel = 'jessica@teccart.com';

INSERT INTO etudiants (
  utilisateur_id, superviseur_id, code_etudiant, programme, cohorte, adresse, ville, code_postal,
  code_permanent, groupe, expiration_caq, expiration_permis_etudes, expiration_assurance
)
SELECT etu.id, sup.utilisateur_id, '2600001', 'Developpement web', '2026', '100 rue Exemple', 'Montreal', 'H2X 1A1',
       'TREM01010101', 'WEB-2026-A', '2027-01-31', '2027-02-28', '2027-03-31'
FROM utilisateurs etu
JOIN superviseurs sup ON sup.numero_employe = 'EMP-1001'
WHERE etu.courriel = 'marie@teccart.com';

INSERT INTO etudiants (
  utilisateur_id, superviseur_id, code_etudiant, programme, cohorte, adresse, ville, code_postal,
  code_permanent, groupe, expiration_caq, expiration_permis_etudes, expiration_assurance
)
SELECT etu.id, sup.utilisateur_id, '2600002', 'Reseaux et securite', '2026', '200 rue Demo', 'Longueuil', 'J4K 1B1',
       'HADD02020202', 'RES-2026-B', '2027-01-31', '2027-02-28', '2027-03-31'
FROM utilisateurs etu
JOIN superviseurs sup ON sup.numero_employe = 'EMP-1002'
WHERE etu.courriel = 'samir@teccart.com';

INSERT INTO conseillere (utilisateur_id, departement)
SELECT id, 'Stages et placement'
FROM utilisateurs WHERE courriel = 'claire@teccart.com';

INSERT INTO comptabilite (utilisateur_id, numero_employe, service)
SELECT id, 'COMPTA-01', 'Comptabilite'
FROM utilisateurs WHERE courriel = 'compta@teccart.com';

INSERT INTO direction (utilisateur_id, titre)
SELECT id, 'Direction des etudes'
FROM utilisateurs WHERE courriel = 'direction@teccart.com';

INSERT INTO campus (code, nom, adresse, ville, code_postal, latitude, longitude) VALUES
('MTL', 'Campus Montreal', '3030 rue Hochelaga Montreal QC', 'Montreal', 'H1W 1G2', 45.5446000, -73.5467000),
('BROSSARD', 'Campus Brossard', '4805 boulevard Lapiniere Brossard QC', 'Brossard', 'J4Z 0G2', 45.4651000, -73.4674000);

INSERT INTO entreprises (
  code, nom, adresse, ville, code_postal, telephone, poste_telephonique, courriel, site_web,
  contact_rh_nom, contact_rh_courriel, contact_rh_telephone, contact_signature_nom, contact_signature_courriel,
  horaire_travail, heures_semaine,
  langue_travail, type_organisation, secteur_activite, latitude, longitude
) VALUES
('ACME', 'Acme Canada', '150 Sainte-Catherine Ouest Montreal QC', 'Montreal', 'H2X 3Y2', '514-555-1000', '201', 'rh@acme.example', 'https://acme.example', 'Nadia RH', 'nadia.rh@acme.example', '514-555-1001', 'Julie Martin', 'julie.martin@acme.example', 'Lun-Ven 9h-17h', 35.00, 'Francais', 'PRIVE', 'Technologies', 45.5078000, -73.5634000),
('LONG', 'Entreprise Longueuil', '1111 rue Saint-Charles Ouest Longueuil QC', 'Longueuil', 'J4K 5G4', '450-555-2000', NULL, 'info@long.example', 'https://long.example', 'Karim RH', 'karim.rh@long.example', '450-555-2001', 'Marc Gagnon', 'marc.gagnon@long.example', 'Lun-Ven 8h30-16h30', 32.00, 'Francais', 'PRIVE', 'Services TI', 45.5322000, -73.5186000),
('LAVAL', 'Entreprise Laval', '1600 boulevard Le Corbusier Laval QC', 'Laval', 'H7S 1Y9', '450-555-3000', NULL, 'info@laval.example', 'https://laval.example', 'Sophie RH', 'sophie.rh@laval.example', '450-555-3001', 'Sophie RH', 'sophie.rh@laval.example', 'Lun-Ven 9h-17h', 35.00, 'Francais', 'PUBLIC', 'Administration', 45.6066000, -73.7124000);

INSERT INTO dossiers_stage (etudiant_id, superviseur_id, statut)
SELECT e.utilisateur_id, e.superviseur_id, 'CONTRAT_EN_COURS'
FROM etudiants e
WHERE e.code_etudiant = '2600001';

INSERT INTO dossiers_stage (etudiant_id, superviseur_id, statut)
SELECT e.utilisateur_id, e.superviseur_id, 'DEMANDE_SOUMISE'
FROM etudiants e
WHERE e.code_etudiant = '2600002';

INSERT INTO demandes_stage (
  dossier_stage_id, entreprise_id, resume_taches,
  date_debut, date_fin, date_debut_disponibilite, date_fin_disponibilite,
  statut, decide_par_utilisateur_id, decide_le
)
SELECT ds.id, ent.id, 'Developpement de modules web internes.',
       '2026-07-10', '2026-08-20', '2026-07-10', '2026-08-20',
       'APPROUVEE', sup.utilisateur_id, '2026-07-08 09:00:00'
FROM dossiers_stage ds
JOIN etudiants e ON e.utilisateur_id = ds.etudiant_id AND e.code_etudiant = '2600001'
JOIN entreprises ent ON ent.code = 'ACME'
JOIN superviseurs sup ON sup.numero_employe = 'EMP-1001';

INSERT INTO demandes_stage (
  dossier_stage_id, entreprise_id, resume_taches,
  date_debut, date_fin, date_debut_disponibilite, date_fin_disponibilite, statut
)
SELECT ds.id, ent.id, 'Support reseau et documentation technique.',
       '2026-07-15', '2026-08-30', '2026-07-15', '2026-08-30', 'SOUMISE'
FROM dossiers_stage ds
JOIN etudiants e ON e.utilisateur_id = ds.etudiant_id AND e.code_etudiant = '2600002'
JOIN entreprises ent ON ent.code = 'LONG';

INSERT INTO contrats (
  dossier_stage_id, demande_stage_id, annee_scolaire, session, code_programme,
  fonction_stage, description_stage, est_remunere, salaire_horaire,
  heures_semaine, nombre_semaines, total_heures, type_horaire, statut,
  fournisseur_signature, enveloppe_externe_id, document_externe_id, genere_le
)
SELECT ds.id, dem.id, '2026', 'ETE', '420',
       'Stagiaire developpeur web', 'Developpement de modules web internes.',
       TRUE, 18.00, 35.00, 6.00, 210.00, 'TEMPS_PLEIN',
       'SIGNATURE_SUPERVISEUR', 'OPENSIGN', 'env_demo_001', 'doc_demo_001', '2026-07-11 09:00:00'
FROM demandes_stage dem
JOIN dossiers_stage ds ON ds.id = dem.dossier_stage_id
JOIN etudiants e ON e.utilisateur_id = ds.etudiant_id AND e.code_etudiant = '2600001';

INSERT INTO signatures_contrat (
  contrat_id, ordre_signature, role_signataire, utilisateur_signataire_id,
  nom_signataire, courriel_signataire, statut, fournisseur_signature, signature_externe_id
)
SELECT c.id, 1, 'ETUDIANT', u.id, CONCAT(u.prenom, ' ', u.nom), u.courriel, 'SIGNE', 'OPENSIGN', 'sig_demo_001'
FROM contrats c
JOIN dossiers_stage ds ON ds.id = c.dossier_stage_id
JOIN utilisateurs u ON u.id = ds.etudiant_id;

INSERT INTO signatures_contrat (
  contrat_id, ordre_signature, role_signataire, nom_signataire, courriel_signataire,
  statut, fournisseur_signature, signature_externe_id
)
SELECT c.id, 2, 'ENTREPRISE', ent.contact_signature_nom, ent.contact_signature_courriel, 'SIGNE', 'OPENSIGN', 'sig_demo_002'
FROM contrats c
JOIN demandes_stage dem ON dem.id = c.demande_stage_id
JOIN entreprises ent ON ent.id = dem.entreprise_id;

INSERT INTO signatures_contrat (
  contrat_id, ordre_signature, role_signataire, utilisateur_signataire_id,
  nom_signataire, courriel_signataire, statut, fournisseur_signature, signature_externe_id
)
SELECT c.id, 3, 'SUPERVISEUR', u.id, CONCAT(u.prenom, ' ', u.nom), u.courriel, 'ENVOYE', 'OPENSIGN', 'sig_demo_003'
FROM contrats c
JOIN dossiers_stage ds ON ds.id = c.dossier_stage_id
JOIN utilisateurs u ON u.id = ds.superviseur_id;

INSERT INTO signatures_contrat (
  contrat_id, ordre_signature, role_signataire, utilisateur_signataire_id,
  nom_signataire, courriel_signataire, statut, fournisseur_signature
)
SELECT c.id, 4, 'CONSEILLERE', u.id, CONCAT(u.prenom, ' ', u.nom), u.courriel, 'EN_ATTENTE', 'OPENSIGN'
FROM contrats c
JOIN utilisateurs u ON u.courriel = 'claire@teccart.com';

INSERT INTO signatures_contrat (
  contrat_id, ordre_signature, role_signataire, utilisateur_signataire_id,
  nom_signataire, courriel_signataire, statut, fournisseur_signature
)
SELECT c.id, 5, 'DIRECTION', u.id, CONCAT(u.prenom, ' ', u.nom), u.courriel, 'EN_ATTENTE', 'OPENSIGN'
FROM contrats c
JOIN utilisateurs u ON u.courriel = 'direction@example.edu';

INSERT INTO charges_paie_supervision (
  superviseur_id, dossier_stage_id, code_etudiant, nom_etudiant,
  heures_supervision, taux_horaire, statut
)
SELECT sup.utilisateur_id, ds.id, e.code_etudiant, CONCAT(u.prenom, ' ', u.nom),
       4.00, 46.875, 'CALCULE'
FROM dossiers_stage ds
JOIN etudiants e ON e.utilisateur_id = ds.etudiant_id AND e.code_etudiant = '2600001'
JOIN utilisateurs u ON u.id = e.utilisateur_id
JOIN superviseurs sup ON sup.numero_employe = 'EMP-1001';

INSERT INTO etudiants_charge_paie (charge_paie_supervision_id, etudiant_id, commentaire)
SELECT cps.id, e.utilisateur_id, 'Suivi regulier effectue.'
FROM charges_paie_supervision cps
JOIN etudiants e ON e.code_etudiant = cps.code_etudiant;

INSERT INTO deplacements_kilometrage (
  superviseur_id, campus_id, programme, groupe, date_deplacement, type_trajet,
  fournisseur_calcul, distance_km, duree_minutes, taux_kilometrique,
  montant_stationnement, url_carte, statut
)
SELECT sup.utilisateur_id, ca.id, 'Developpement web', 'WEB-2026-A', '2026-07-12',
       'ALLER_RETOUR', 'GOOGLE_MAPS', 18.80, 36, 0.610, 0.00,
       'https://maps.example/trajet-1', 'CALCULE'
FROM superviseurs sup
JOIN campus ca ON ca.code = 'MTL'
WHERE sup.numero_employe = 'EMP-1001';

INSERT INTO destinations_deplacement (
  deplacement_kilometrage_id, entreprise_id, ordre_destination, libelle_destination, adresse_destination
)
SELECT dk.id, ent.id, 1, ent.nom, ent.adresse
FROM deplacements_kilometrage dk
JOIN entreprises ent ON ent.code = 'ACME';

INSERT INTO notifications (titre, message, type_notification) VALUES
('Kilometrage superviseur', 'Agent Prof a saisi 18.80 km parcourus.', 'KILOMETRAGE_CALCULE'),
('Signature requise', 'Le contrat de Marie Tremblay attend la signature du superviseur.', 'SIGNATURE_CONTRAT');

INSERT INTO destinataires_notification (notification_id, utilisateur_destinataire_id)
SELECT n.id, u.id
FROM notifications n
JOIN utilisateurs u ON u.courriel = 'compta@example.edu'
WHERE n.type_notification = 'KILOMETRAGE_CALCULE';

INSERT INTO destinataires_notification (notification_id, utilisateur_destinataire_id)
SELECT n.id, u.id
FROM notifications n
JOIN utilisateurs u ON u.courriel = 'agent.prof@example.edu'
WHERE n.type_notification = 'SIGNATURE_CONTRAT';
