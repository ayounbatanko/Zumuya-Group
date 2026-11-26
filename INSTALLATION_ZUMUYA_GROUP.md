# Installation & configuration Supabase — ZUMUYA GROUP

## 1. Projet

Le dépôt pointe déjà vers :
- URL : `https://azfunhfjmybekzakhtbu.supabase.co`
- Clé publique : voir `config.js` (anon / publishable uniquement)

Pour un **nouveau** projet Supabase :
1. Créer le projet.
2. Mettre à jour `config.js` avec la nouvelle URL et la clé anon.
3. Exécuter le SQL ci-dessous.
4. Déployer les Edge Functions.

## 2. Ordre d’exécution SQL (SQL Editor)

Exécuter **dans cet ordre** (scripts idempotents) :

1. `00_setup_complet_SUPABASE.sql` ou `supabase-setup.sql` (socle)
2. `04_auth_phone_email_profile.sql`
3. `05_suppression_compte.sql`
4. `06_FIX_SERVEUR_2026-11-20.sql`
5. `07_portefeuilles_commissions.sql`
6. `08_messagerie_acteurs.sql`
7. `09_catalogues_publics.sql`
8. `10_logistique_organisations.sql`
9. `11_equipes_livreurs_approvisionnement.sql`
10. `12_marketplace_media.sql` + `12_BOUTIQUE_IMMEDIATE_PHOTO_PROFIL.sql` + `13_boutique_vendeur.sql`
11. `14_*` et `15_*` (activation / correctifs)
12. `16_ecosysteme_poles_interconnectes.sql` + `16_reseau_livraison_partenaire.sql`
13. `17_livraison_zones_offres_messagerie.sql`
14. `18_FIX_CONFIGURATION_CATALOGUES_2026-11-22.sql`
15. `z_hospitality_native.sql`  ← restaurant / hôtel natif, équipes, audit
16. `19_pilotage_rapports_exports_equipe_proprietaire.sql`  ← journal transversal, équipe propriétaire, export
17. `20_harmonisation_droits_rapports_journal.sql`

Scripts optionnels / correctifs : les fichiers `CORRECTIF_*`, `ZUMUYA_EXTENSION_ESSAI.sql`, etc.

## 3. Edge Functions

```bash
# Depuis un clone local avec CLI Supabase
supabase login
supabase link --project-ref azfunhfjmybekzakhtbu
supabase functions deploy z-hospitality-team
supabase functions deploy platform-team-admin
```

Les secrets (`service_role`) sont gérés par Supabase ; ne les committez jamais.

## 4. Vérifications post-install

- Connexion `compte.html` → création organisation restaurant/hôtel.
- Espace `zrestaurant-restaurant.html` ou `hospitality.html` :
  - onglet / section **Gestion de groupe** (membres + permissions)
  - onglet / section **Journal des actions** (filtre dates + CSV)
- `proprietaire.html` :
  - Vue d’ensemble avec stats
  - Gestion du groupe (comptes secondaires)
  - Exports de l’infrastructure (JSON période)
- RLS : un membre ne voit que son org ; le propriétaire plateforme voit le consolidé.

## 5. Front

Héberger tous les fichiers statiques (HTML/JS/CSS/images).  
GitHub Pages : Settings → Pages → branch `main` / root.

