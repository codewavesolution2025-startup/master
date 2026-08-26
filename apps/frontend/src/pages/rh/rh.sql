-- ============================================================
-- MODULE RH — Supply Chain Industrielle
-- ============================================================

-- ── Énumérations ─────────────────────────────────────────────
CREATE TYPE statut_employe AS ENUM ('ACTIF','INACTIF','SUSPENDU','DEMISSIONNAIRE');
CREATE TYPE type_contrat AS ENUM ('CDI','CDD','INTERIM','STAGE','APPRENTISSAGE');
CREATE TYPE statut_conge AS ENUM ('EN_ATTENTE','APPROUVE','REFUSE','ANNULE');
CREATE TYPE type_absence AS ENUM ('CONGE_PAYE','RTT','MALADIE','MATERNITE','FORMATION','AUTRE');
CREATE TYPE niveau_competence AS ENUM ('DEBUTANT','INTERMEDIAIRE','AVANCE','EXPERT');
CREATE TYPE statut_formation AS ENUM ('PLANIFIEE','EN_COURS','TERMINEE','ANNULEE');

-- ── Employés ─────────────────────────────────────────────────
CREATE TABLE employes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule         VARCHAR(20) UNIQUE NOT NULL,
  nom               VARCHAR(100) NOT NULL,
  prenom            VARCHAR(100) NOT NULL,
  email             VARCHAR(150) UNIQUE,
  telephone         VARCHAR(20),
  date_naissance    DATE,
  date_embauche     DATE NOT NULL,
  date_sortie       DATE,
  poste             VARCHAR(100) NOT NULL,
  service           VARCHAR(100),
  site_id           UUID REFERENCES sites(id),
  statut            statut_employe NOT NULL DEFAULT 'ACTIF',
  type_contrat      type_contrat NOT NULL DEFAULT 'CDI',
  taux_horaire      NUMERIC(10,4) NOT NULL DEFAULT 0,
  nb_heures_semaine NUMERIC(5,2) NOT NULL DEFAULT 35,
  cout_charges_pct  NUMERIC(5,2) NOT NULL DEFAULT 45,
  nb_conges_annuels INTEGER NOT NULL DEFAULT 25,
  nb_rtt_annuels    INTEGER NOT NULL DEFAULT 10,
  photo_url         VARCHAR(255),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Présences ─────────────────────────────────────────────────
CREATE TABLE presences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id      UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  date_presence   DATE NOT NULL,
  heure_entree    TIME,
  heure_sortie    TIME,
  heures_travaillees NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN heure_entree IS NOT NULL AND heure_sortie IS NOT NULL
    THEN EXTRACT(EPOCH FROM (heure_sortie - heure_entree)) / 3600
    ELSE NULL END
  ) STORED,
  heures_sup      NUMERIC(5,2) DEFAULT 0,
  type_journee    VARCHAR(20) DEFAULT 'NORMAL',
  commentaire     TEXT,
  valide          BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employe_id, date_presence)
);

-- ── Congés & Absences ─────────────────────────────────────────
CREATE TABLE conges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id      UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  type_absence    type_absence NOT NULL DEFAULT 'CONGE_PAYE',
  date_debut      DATE NOT NULL,
  date_fin        DATE NOT NULL,
  nb_jours        NUMERIC(5,2) GENERATED ALWAYS AS (
    date_fin - date_debut + 1
  ) STORED,
  statut          statut_conge NOT NULL DEFAULT 'EN_ATTENTE',
  motif           TEXT,
  approuve_par    UUID REFERENCES employes(id),
  date_approbation TIMESTAMPTZ,
  commentaire_rh  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Compétences ───────────────────────────────────────────────
CREATE TABLE competences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  libelle     VARCHAR(200) NOT NULL,
  categorie   VARCHAR(100),
  description TEXT
);

CREATE TABLE employe_competences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id      UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  competence_id   UUID NOT NULL REFERENCES competences(id),
  niveau          niveau_competence NOT NULL DEFAULT 'DEBUTANT',
  date_acquisition DATE,
  date_expiration  DATE,
  certifie        BOOLEAN DEFAULT false,
  certificat_url  VARCHAR(255),
  UNIQUE(employe_id, competence_id)
);

-- ── Formations ────────────────────────────────────────────────
CREATE TABLE formations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) UNIQUE NOT NULL,
  intitule        VARCHAR(200) NOT NULL,
  organisme       VARCHAR(200),
  duree_jours     NUMERIC(5,2),
  cout_unitaire   NUMERIC(10,2) DEFAULT 0,
  statut          statut_formation NOT NULL DEFAULT 'PLANIFIEE',
  date_debut      DATE,
  date_fin        DATE,
  lieu            VARCHAR(200),
  objectifs       TEXT,
  competence_id   UUID REFERENCES competences(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employe_formations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id      UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  formation_id    UUID NOT NULL REFERENCES formations(id),
  statut          VARCHAR(50) DEFAULT 'INSCRIT',
  note_evaluation NUMERIC(3,1),
  commentaire     TEXT,
  cout_reel       NUMERIC(10,2),
  UNIQUE(employe_id, formation_id)
);

-- ── Fiches de paie ────────────────────────────────────────────
CREATE TABLE fiches_paie (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id          UUID NOT NULL REFERENCES employes(id),
  periode_mois        INTEGER NOT NULL CHECK (periode_mois BETWEEN 1 AND 12),
  periode_annee       INTEGER NOT NULL,
  nb_heures_travaillees NUMERIC(7,2) DEFAULT 0,
  nb_heures_sup       NUMERIC(7,2) DEFAULT 0,
  nb_jours_conge      NUMERIC(5,2) DEFAULT 0,
  nb_jours_absence    NUMERIC(5,2) DEFAULT 0,
  salaire_brut        NUMERIC(10,2) DEFAULT 0,
  charges_patronales  NUMERIC(10,2) DEFAULT 0,
  cout_total_mo       NUMERIC(10,2) GENERATED ALWAYS AS (
    salaire_brut + charges_patronales
  ) STORED,
  primes              NUMERIC(10,2) DEFAULT 0,
  retenues            NUMERIC(10,2) DEFAULT 0,
  salaire_net         NUMERIC(10,2) GENERATED ALWAYS AS (
    salaire_brut - retenues
  ) STORED,
  statut              VARCHAR(20) DEFAULT 'BROUILLON',
  validee_par         UUID,
  date_validation     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employe_id, periode_mois, periode_annee)
);

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX idx_employes_statut ON employes(statut);
CREATE INDEX idx_employes_site ON employes(site_id);
CREATE INDEX idx_presences_employe_date ON presences(employe_id, date_presence);
CREATE INDEX idx_conges_employe ON conges(employe_id);
CREATE INDEX idx_conges_statut ON conges(statut);
CREATE INDEX idx_fiches_paie_employe ON fiches_paie(employe_id);
CREATE INDEX idx_fiches_paie_periode ON fiches_paie(periode_annee, periode_mois);

-- ── Données de test ───────────────────────────────────────────
INSERT INTO competences (id, code, libelle, categorie) VALUES
('aa000000-0000-0000-0000-000000000001','TOUR-CNC','Tournage CNC','Usinage'),
('aa000000-0000-0000-0000-000000000002','FRAI-5AX','Fraisage 5 axes','Usinage'),
('aa000000-0000-0000-0000-000000000003','SOUD-TIG','Soudure TIG','Soudage'),
('aa000000-0000-0000-0000-000000000004','CTRL-3D','Contrôle 3D','Qualité'),
('aa000000-0000-0000-0000-000000000005','MONT-MECА','Montage mécanique','Assemblage'),
('aa000000-0000-0000-0000-000000000006','HABIL-ELEC','Habilitation électrique B1','Sécurité'),
('aa000000-0000-0000-0000-000000000007','CACES-3','CACES R489 Cat.3','Logistique'),
('aa000000-0000-0000-0000-000000000008','ISO-9001','Audit ISO 9001','Qualité');

INSERT INTO employes (id, matricule, nom, prenom, email, date_naissance, date_embauche, poste, service, site_id, statut, type_contrat, taux_horaire, nb_heures_semaine, cout_charges_pct) VALUES
('bb000000-0000-0000-0000-000000000001','EMP-001','Martin','Jean','j.martin@usine.fr','1985-03-15','2018-01-15','Opérateur CNC','Production','10000000-0000-0000-0000-000000000001','ACTIF','CDI',18.50,35,45),
('bb000000-0000-0000-0000-000000000002','EMP-002','Dubois','Marie','m.dubois@usine.fr','1990-07-22','2019-06-01','Soudeur TIG','Production','10000000-0000-0000-0000-000000000001','ACTIF','CDI',20.00,35,45),
('bb000000-0000-0000-0000-000000000003','EMP-003','Bernard','Pierre','p.bernard@usine.fr','1988-11-30','2020-03-01','Contrôleur Qualité','Qualité','10000000-0000-0000-0000-000000000001','ACTIF','CDI',22.00,35,45),
('bb000000-0000-0000-0000-000000000004','EMP-004','Leroy','Sophie','s.leroy@usine.fr','1992-05-10','2021-09-01','Technicien Méthodes','Production','10000000-0000-0000-0000-000000000001','ACTIF','CDI',24.00,35,45),
('bb000000-0000-0000-0000-000000000005','EMP-005','Moreau','Thomas','t.moreau@usine.fr','1987-08-18','2017-04-01','Responsable Production','Production','10000000-0000-0000-0000-000000000001','ACTIF','CDI',32.00,39,45),
('bb000000-0000-0000-0000-000000000006','EMP-006','Simon','Claire','c.simon@usine.fr','1993-12-03','2022-01-10','Assistante RH','RH','10000000-0000-0000-0000-000000000001','ACTIF','CDD',16.00,35,42),
('bb000000-0000-0000-0000-000000000007','EMP-007','Laurent','Marc','m.laurent@usine.fr','1986-04-25','2016-11-01','Magasinier','Logistique','10000000-0000-0000-0000-000000000001','ACTIF','CDI',15.50,35,45),
('bb000000-0000-0000-0000-000000000008','EMP-008','Garcia','Ana','a.garcia@usine.fr','1995-09-14','2023-03-01','Apprenti Usinage','Production','10000000-0000-0000-0000-000000000001','ACTIF','APPRENTISSAGE',9.50,35,25);

-- Compétences employés
INSERT INTO employe_competences (employe_id, competence_id, niveau, date_acquisition, certifie) VALUES
('bb000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000001','EXPERT','2018-06-01',true),
('bb000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000002','INTERMEDIAIRE','2020-01-15',false),
('bb000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000007','2023-05-20',true,'AVANCE'),
('bb000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000003','EXPERT','2019-09-01',true),
('bb000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000006','AVANCE','2020-03-10',true),
('bb000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000004','EXPERT','2020-06-01',true),
('bb000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000008','INTERMEDIAIRE','2021-11-20',false),
('bb000000-0000-0000-0000-000000000004','aa000000-0000-0000-0000-000000000005','AVANCE','2021-12-01',false),
('bb000000-0000-0000-0000-000000000007','aa000000-0000-0000-0000-000000000007','EXPERT','2017-01-15',true);

-- Formations
INSERT INTO formations (id, code, intitule, organisme, duree_jours, cout_unitaire, statut, date_debut, date_fin, competence_id) VALUES
('cc000000-0000-0000-0000-000000000001','FOR-001','Programmation FAO SolidCAM','CETIM',3,1200.00,'TERMINEE','2024-03-04','2024-03-06','aa000000-0000-0000-0000-000000000002'),
('cc000000-0000-0000-0000-000000000002','FOR-002','Renouvellement CACES R489','ISTA',1,350.00,'PLANIFIEE','2026-06-15','2026-06-15','aa000000-0000-0000-0000-000000000007'),
('cc000000-0000-0000-0000-000000000003','FOR-003','Audit interne ISO 9001','Bureau Veritas',2,890.00,'TERMINEE','2024-10-07','2024-10-08','aa000000-0000-0000-0000-000000000008'),
('cc000000-0000-0000-0000-000000000004','FOR-004','Soudure aluminium TIG','AFPI',5,2100.00,'PLANIFIEE','2026-07-01','2026-07-05','aa000000-0000-0000-0000-000000000003');

INSERT INTO employe_formations (employe_id, formation_id, statut, note_evaluation, cout_reel) VALUES
('bb000000-0000-0000-0000-000000000001','cc000000-0000-0000-0000-000000000001','TERMINE',4.2,1200.00),
('bb000000-0000-0000-0000-000000000004','cc000000-0000-0000-0000-000000000001','TERMINE',3.8,1200.00),
('bb000000-0000-0000-0000-000000000007','cc000000-0000-0000-0000-000000000002','INSCRIT',NULL,NULL),
('bb000000-0000-0000-0000-000000000003','cc000000-0000-0000-0000-000000000003','TERMINE',4.5,890.00),
('bb000000-0000-0000-0000-000000000002','cc000000-0000-0000-0000-000000000004','INSCRIT',NULL,NULL);

-- Congés
INSERT INTO conges (employe_id, type_absence, date_debut, date_fin, statut, motif) VALUES
('bb000000-0000-0000-0000-000000000001','CONGE_PAYE','2026-07-14','2026-07-25','APPROUVE','Congés été'),
('bb000000-0000-0000-0000-000000000002','RTT','2026-06-06','2026-06-06','APPROUVE','RTT'),
('bb000000-0000-0000-0000-000000000003','CONGE_PAYE','2026-08-03','2026-08-14','EN_ATTENTE','Congés été'),
('bb000000-0000-0000-0000-000000000005','FORMATION','2026-07-01','2026-07-05','APPROUVE','Formation soudure');

-- Présences (derniers 5 jours ouvrés)
INSERT INTO presences (employe_id, date_presence, heure_entree, heure_sortie, heures_sup, valide) VALUES
('bb000000-0000-0000-0000-000000000001','2026-05-27','07:45','16:45',1.0,true),
('bb000000-0000-0000-0000-000000000001','2026-05-28','07:50','16:30',0.0,true),
('bb000000-0000-0000-0000-000000000001','2026-05-29','07:45','17:15',1.5,true),
('bb000000-0000-0000-0000-000000000002','2026-05-27','08:00','16:00',0.0,true),
('bb000000-0000-0000-0000-000000000002','2026-05-28','07:55','16:45',0.75,true),
('bb000000-0000-0000-0000-000000000003','2026-05-27','08:30','17:30',1.0,true),
('bb000000-0000-0000-0000-000000000004','2026-05-27','08:00','16:00',0.0,true),
('bb000000-0000-0000-0000-000000000005','2026-05-27','07:30','18:00',2.5,true);

-- Fiches de paie (mai 2026)
INSERT INTO fiches_paie (employe_id, periode_mois, periode_annee, nb_heures_travaillees, nb_heures_sup, nb_jours_conge, salaire_brut, charges_patronales, primes, retenues, statut) VALUES
('bb000000-0000-0000-0000-000000000001',5,2026,151.67,8.5,0,2883.75,1297.69,200.00,432.56,'VALIDEE'),
('bb000000-0000-0000-0000-000000000002',5,2026,151.67,4.0,0,3083.40,1387.53,0.00,462.51,'VALIDEE'),
('bb000000-0000-0000-0000-000000000003',5,2026,151.67,6.0,0,3388.74,1524.93,0.00,508.31,'VALIDEE'),
('bb000000-0000-0000-0000-000000000004',5,2026,151.67,2.0,2,3640.08,1638.04,150.00,546.01,'VALIDEE'),
('bb000000-0000-0000-0000-000000000005',5,2026,168.00,12.0,0,6048.00,2721.60,500.00,907.20,'VALIDEE'),
('bb000000-0000-0000-0000-000000000007',5,2026,151.67,0.0,0,2358.85,1061.48,0.00,353.83,'VALIDEE'),
('bb000000-0000-0000-0000-000000000008',5,2026,151.67,0.0,0,1443.65,360.91,0.00,216.55,'BROUILLON');

SELECT 'Module RH créé avec succès' as status;
