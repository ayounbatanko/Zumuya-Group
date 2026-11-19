# ZUMUYA GROUP — plateforme web

Tous les fichiers sont à la racine du dépôt (GitHub Pages : branche `main`, dossier `/`). Le site s'ouvre sur `index.html`.

## Un compte = une catégorie = son propre tableau de bord
La catégorie choisie à l'inscription (`compte.html`) détermine l'espace réservé. Une catégorie qui ouvre la page d'une autre est renvoyée vers la sienne (`zguard.js`).

| Catégorie | Espace | Fonctionnalités (issues de RestoGest) |
|---|---|---|
| Client | `client-espace.html`, `resto-client.html` | restaurants proches (GPS), panier, commande, suivi pas à pas, carte quand la commande est en route, annulation, reçu PDF, messagerie, profil / adresses / favoris |
| Restaurant | `resto-restaurant.html` | tableau de bord, caisse hors connexion + ticket, historique des ventes, commandes en ligne (accepter, refuser, préparer), menu (photos), livreurs, rapport, paramètres (logo, GPS, devise, tarif au km, paiements), carte de visite + QR, abonnement Pro, écran cuisine |
| Hôtel | `resto-restaurant.html` | tout ce qui précède + service en chambre et notes de chambre (`hotel.html`) |
| Livreur | `resto-driver.html` | courses proposées, étapes de livraison, position GPS en direct |
| Producteur / commerçant agricole | `agro.html` | espace agricole |
| Propriétaire de la plateforme | `proprietaire.html`, `resto-owner.html` | supervision, partenaires, pays, organisations, abonnements |

## Panier des catalogues (accueil `index.html` et `restauration.html`)
1. Les catalogues sont visibles par tous.
2. L'ajout au panier est réservé aux comptes **Client** connectés. Un visiteur est invité à se connecter puis revient au catalogue ; un compte professionnel reçoit un message explicatif.
3. **Un panier = un seul restaurant.** Ajouter un plat d'un autre restaurant propose de vider le panier.
4. « Passer la commande » ouvre `resto-client.html` avec le panier repris : adresse, mode de paiement, frais de livraison (distance × tarif/km), validation.
5. « Suivre mes commandes » : statuts en temps réel (envoyée → acceptée → préparée → prise en charge → en route → arrivée → livrée), carte pendant la livraison, notification à chaque changement.

Code : `zcart.js` + `zcart.css` (panier partagé), `catalogue.js` (catalogue de l'accueil), `zsession.js` (session et données publiques).

## Mise en route Supabase (un seul projet, réglé dans `config.js`)
Dans SQL Editor, exécuter dans l'ordre : `sql-portail.sql`, `supabase-setup.sql` (activer `pg_cron` si demandé), puis `ZUMUYA_EXTENSION_ESSAI.sql` (profils / adresses / favoris des clients). Créez votre compte sur `compte.html`, puis décommentez la dernière requête de `sql-portail.sql` (avec votre e-mail) pour devenir propriétaire. `04_auth_phone_email_profile.sql` et `05_suppression_compte.sql` sont des références d'authentification / suppression de compte. Ne jamais mettre de clé `service_role` dans le dépôt.

## Coordination restauration · hôtel · livraison
Une seule commande (`rg_orders`), trois modes de remise : sur place / à emporter (pôle 01), chambre (pôle 02), livraison (pôle 03, attribution automatique au livreur libre le plus proche, côté serveur). Statuts : `en attente < acceptée < préparée < en route < terminée` (+ `annulée`, `refusée`), sans retour en arrière.

## Limites connues
- Sécurité : les politiques RLS des tables `rg_*` du service restent ouvertes (clé anon) ; `rg_users` contient des mots de passe en clair lisibles. À migrer vers Supabase Auth puis à restreindre en priorité.
- Les comptes du portail (Supabase Auth) et les données du service (`rg_users`, `rg_rests`, `rg_orders`) sont reliés par `resto-portal-bridge.js`.
- `agro.js` appelle encore des tables `rg_agro_*` alors que la base actuelle a des tables `z_agro_*` : à adapter avant de considérer l'espace agricole comme opérationnel.
- Les catalogues ne couvrent que les restaurants (pas encore de produits agricoles ni de boutiques).
