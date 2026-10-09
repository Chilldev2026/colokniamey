-- ColokNiamey — données initiales du référentiel (M1)
-- Généré le 9 octobre 2026 à partir de docs/donnees/referentiel-niamey.csv. Idempotent : rejouable sans doublon.
-- Règle : aucune coordonnée inventée. Une valeur NULL signifie « à placer sur la carte dans A5 » (RG25 bis).
-- Sources indiquées ligne par ligne. Les listes de quartiers viennent de Wikipédia (d'après INS, RGPH 2012) et sont incomplètes.

-- Ville
-- Centre : GeoNames (13°30′49″N, 2°6′35″E). rayon_km = 20 : [À VALIDER] valeur provisoire choisie par nous pour la zone de la ville (RG22), pas une donnée officielle.
insert into public.villes (nom, centre, rayon_km) values ('Niamey', 'SRID=4326;POINT(2.10972 13.51361)'::geography, 20)
  on conflict (nom) do nothing;

-- Quartiers (centre NULL : facultatif, à placer dans A5)
-- Niamey I — source : https://fr.wikipedia.org/wiki/Niamey_I
insert into public.quartiers (nom, ville_id, commune) values ('Bobiel', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Château 1', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Cité chinoise', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Corniche Yantala', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Francophonie', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Garde Présidentielle', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Gendarmerie', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Goudel', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Grande Gendarmerie', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Hôpital National', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Koira Kano', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Koubia du Nord', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Koubia Sud', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Losso Goungou', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Plateau 2', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Résidence Ministérielle', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Riyad', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Satu Sa', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('SONUCI', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('SOS Village d''Enfants', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Tchangarey', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Yantala Haut', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Yantala Bas', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Peau de Yantala', (select id from public.villes where nom = 'Niamey'), 'Niamey I') on conflict (nom, ville_id) do nothing;
-- Niamey II — source : https://fr.wikipedia.org/wiki/Niamey_II
insert into public.quartiers (nom, ville_id, commune) values ('Banifandou I', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Banizoumbou II', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Boukoki I', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Boukoki II', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Boukoki III', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Cité Député', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Dan Zama Koira', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Dar Es Salam', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Deyzeibon', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Djeddah Koira Mè', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Gandatché', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Issa Béri', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Koira Tagui', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Kombo', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Lazaret', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Maourey', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Nord Faisceau', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Nord Lazaret', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Tourakou', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Zongo', (select id from public.villes where nom = 'Niamey'), 'Niamey II') on conflict (nom, ville_id) do nothing;
-- Niamey III — source : https://fr.wikipedia.org/wiki/Niamey_III
insert into public.quartiers (nom, ville_id, commune) values ('Abidjan', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Bandabari', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Banifandou II', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Banizoumbou', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Boukoki IV', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Cité Caisse', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Cité Fayçal', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Collège Mariama', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Couronne Nord', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Kalley Centre', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Kalley Est', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Kalley Sud', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Lacouroussou', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Madina', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Nouveau Marché', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Poudrière', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Terminus', (select id from public.villes where nom = 'Niamey'), 'Niamey III') on conflict (nom, ville_id) do nothing;
-- Niamey IV — source : https://fr.wikipedia.org/wiki/Niamey_IV
insert into public.quartiers (nom, ville_id, commune) values ('Aéroport I', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Aéroport II', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Camp Bagagi', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Génie Militaire', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Cité Asecna', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Escadrille', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Gamkalley Golley', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Gamkalley Sébanguey', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Kaf Kouara', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Koubo Mè', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Logement Militaire', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Niamey 2000', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Niamey IV', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Pays Bas-Tondi Gammé', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Prytanée Militaire', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Route Filingué', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Route Tchanga', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Saga Fandou', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Saga Fondobon', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Saga Gassia Kouara', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Saga Goungou', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Saga Sahara', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Saga Sambou Koira', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Sary Koubou', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Talladjé', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Talladjé Est', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Touré Koara', (select id from public.villes where nom = 'Niamey'), 'Niamey IV') on conflict (nom, ville_id) do nothing;
-- Niamey V — source : https://fr.wikipedia.org/wiki/Niamey_V
insert into public.quartiers (nom, ville_id, commune) values ('AGRHYMET', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Banga Bana', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Gawèye', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Hôpital Gawèye', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Hôpital Lamordé', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('INJS/C', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Karadjé', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Kirkissoye', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Lamordé', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Nogaré', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Nordiré', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Pont Kennedy', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Saguia', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;
insert into public.quartiers (nom, ville_id, commune) values ('Séno', (select id from public.villes where nom = 'Niamey'), 'Niamey V') on conflict (nom, ville_id) do nothing;

-- Universités et écoles
-- UAM — source : https://latitude.to/articles-by-country/ne/niger/141484/abdou-moumouni-university (origine non précisée) — À VÉRIFIER : point unique pour un grand campus ; choisir l'entrée principale
insert into public.universites (nom, sigle, ville_id, adresse, position) values ('Université Abdou Moumouni', 'UAM', (select id from public.villes where nom = 'Niamey'), 'Harobanda (rive droite)', 'SRID=4326;POINT(2.092500 13.500831)'::geography)
  on conflict (nom, ville_id) do nothing;
-- UPEN — source : https://simoon-cv.com/blog/ecoles-privees-reconnues-niger-2026 — Vérifier le quartier ; coordonnées à relever ; introuvable en ligne (site officiel inaccessible ou sans carte)
insert into public.universites (nom, sigle, ville_id, adresse, position) values ('Université Privée l''Élite de Niamey', 'UPEN', (select id from public.villes where nom = 'Niamey'), 'Lazaret Nord', null)
  on conflict (nom, ville_id) do nothing;
-- UPEI — source : https://simoon-cv.com/blog/ecoles-privees-reconnues-niger-2026 — Quartier et coordonnées à relever ; introuvable en ligne (site officiel inaccessible ou sans carte)
insert into public.universites (nom, sigle, ville_id, adresse, position) values ('Université Privée Entente Internationale', 'UPEI', (select id from public.villes where nom = 'Niamey'), 'Niamey I', null)
  on conflict (nom, ville_id) do nothing;
-- IAT — source : https://www.iatniger.org/contact (carte OpenStreetMap du site officiel) — Vérifier sur place
insert into public.universites (nom, sigle, ville_id, adresse, position) values ('Institut Africain de Technologie', 'IAT', (select id from public.villes where nom = 'Niamey'), 'Yantala (Rond-point Gadafawa, derrière la station Total), Niamey I', 'SRID=4326;POINT(2.081680 13.532711)'::geography)
  on conflict (nom, ville_id) do nothing;
-- EPI — source : https://epiniger.edu.ne/ (carte Google Maps du site officiel) — Vérifier sur place
insert into public.universites (nom, sigle, ville_id, adresse, position) values ('École Privée d''Ingénierie du Niger', 'EPI', (select id from public.villes where nom = 'Niamey'), 'Échangeur Mali Béro, en face du Ministère de la Justice', 'SRID=4326;POINT(2.105012 13.532121)'::geography)
  on conflict (nom, ville_id) do nothing;
-- ECCAM — source : https://legrandfrere.africa/etablissement/ecole-de-commerce-de-communication-dadministration-et-de-management-eccam/ — Adresse du siège et coordonnées à relever ; introuvable en ligne (site officiel inaccessible ou sans carte)
insert into public.universites (nom, sigle, ville_id, adresse, position) values ('École de Commerce, de Communication, d''Administration et de Management', 'ECCAM', (select id from public.villes where nom = 'Niamey'), 'Siège : à compléter ; annexe : Boukoki 2, rue de Arewa', null)
  on conflict (nom, ville_id) do nothing;

-- [INFORMATION MANQUANTE] Autres établissements fréquentés par les futurs utilisateurs : à ajouter dans A5 ou ici.
