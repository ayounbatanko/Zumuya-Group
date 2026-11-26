# Fonctionnalités ZUMUYA GROUP (version livrée)

## Restaurant & Hôtel
- Espace métier natif (`zrestaurant-restaurant.html` / `hospitality.html`)
- Caisse, commandes, menu / chambres, stocks, livreurs, rapports
- **Gestion de groupe** : création employés & livreurs, permissions par rubrique, suspension / réactivation
- **Journal d’actions** : filtre par dates + téléchargement CSV
- Historique et enregistrements métier exportables

## Marketplace / Boutique / Agro / Commerçant / Livraison
- Tableaux de bord et espaces dédiés (`boutique.html`, `agro.html`, `livraison-entreprise.html`, etc.)
- Statistiques, graphiques d’activité et historiques filtrables
- Téléchargement des données d’activité sur une période choisie (selon le pôle)

## Compte propriétaire
- Vue d’ensemble consolidée (organisations, établissements, transactions, abonnements)
- Graphiques et indicateurs de supervision
- **Gestion du groupe** : comptes secondaires avec droits limités (dashboard, partenaires, orgs, abonnements, transactions, rapports, team)
- Export JSON complet de l’infrastructure (`rg_platform_export_all`) sur période
- Pilotage portefeuille / commissions

## Transversal
- Authentification Supabase Auth
- Journal d’activité transversal (`rg_activity_events`)
- Messagerie entre acteurs
- Portefeuilles et commissions
- Catalogues publics
- RLS + Edge Functions pour les actions sensibles

## Ancien projet RestoGest
- Entièrement retiré. Plus de dépendance localStorage « rm_db » pour le métier.
- Branding unifié ZUMUYA GROUP / ZUMUYA Restauration.

