# Service de Restauration — ZUMUYA GROUP (version plate)

Application de gestion pour restaurants, hôtels (service en chambre) et livraisons, intégrée à la plateforme ZUMUYA GROUP.

Tous les fichiers sont à la racine du dépôt ; ceux du Service de Restauration commencent par `resto-`.

## Fichiers

- `resto-index.html`, `resto-restaurant.html`, `resto-client.html`, `resto-driver.html`, `resto-card.html` : parcours principaux (accueil/connexion, restaurant, client, livreur, carte de visite).
- `resto-owner.html` et `resto-owner-pro.js` : espace propriétaire historique du service.
- `resto-ext-*.js` : modules conservés (attribution des courses, suivi en direct, écran cuisine, notes de chambre, temps réel), chargés par `resto-ext-loader.js`.
- Base de données : `supabase-setup.sql` (tables du service, realtime, attribution des livreurs, notes de chambre).
- `resto-CHANGEMENTS-2.4.0.md` : corrections et nettoyage de la version 2.4.0.
- `sw.js` (racine) : service worker unique du portail et du Service de Restauration.

## Pôles intégrés

- **Pôle 01 — Restauration** : menus, commandes, caisse, historique des ventes, rapport, livreurs, carte de visite.
- **Pôle 02 — ZUMUYA Hôtel** : service en chambre et facturation sur note de chambre (`resto-ext-room-billing.js`).
- **Pôle 03 — ZUMUYA Livraison** : suivi en direct (`resto-ext-tracking.js`) et attribution des courses (`resto-ext-dispatch.js`).

## Installation

Les clés Supabase du service sont dans `resto-db.js` et `resto-ext-loader.js`. Les scripts SQL sont à exécuter dans Supabase > SQL Editor.

## Préservation

Ne pas supprimer `resto-owner.html`, `resto-owner-pro.js`, `resto-db.js`, `resto-chat.js`, `resto-charts.js`, `resto-notif.js`, `resto-ext-loader.js`, `resto-restaurant.html`, `resto-client.html`, `resto-driver.html`.
