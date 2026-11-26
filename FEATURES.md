# ZUMUYA GROUP — fonctionnalités et accès

## 1. Espaces professionnels

- **Restaurant** : tableau de bord, commandes, catalogue, menus, cuisine, caisse, ventes, stocks, promotions, avis, livreurs, approvisionnement agricole, équipe, journal, rapports, QR.
- **Hôtel** : fonctions restaurant + chambres, réservations, service en chambre et suivi des opérations d’hébergement.
- **Producteur agricole** : profil professionnel, localisation, catalogue, stocks, demandes, approvisionnement et coopération.
- **Commerçant agricole** : découverte des producteurs, achat, revente, catalogue, demandes et stock.
- **Marketplace** : boutique, catalogue produits, médias, commandes, messagerie et collaboration inter-pôles.
- **Société de livraison** : profil de transport, zones, offres, missions, statuts et coordination des expéditions.
- **Livreur d’établissement** : compte créé par le restaurant / hôtel qui le rattache, missions affectées et suivi.
- **Client** : catalogue, commandes, suivi, profil, adresses et historique.

## 2. Rapports et statistiques

Tous les espaces professionnels disposent d’un accès à `analytics.html` :
- historique des actions enregistrées ;
- filtre par date de début et de fin ;
- statistiques de créations, modifications et suppressions ;
- graphique d’activité ;
- export CSV et JSON.

Le rapport restaurant / hôtel propose également les ventes, commandes, chiffre d’affaires et téléchargement des enregistrements métier de l’établissement.

## 3. Gestion de groupe restaurant / hôtel

Le compte principal peut :
- créer des comptes employés et livreurs ;
- attribuer des permissions par rubrique ;
- consulter les membres rattachés à son établissement ;
- modifier leurs autorisations ;
- suspendre et réactiver un accès ;
- consulter et exporter le journal des actions.

Les restrictions sont appliquées par RLS Supabase, pas uniquement par l’interface.

## 4. Espace propriétaire ZUMUYA GROUP

- Indicateurs consolidés et graphiques de supervision.
- Gestion des organisations, partenaires, pays, abonnements et transactions.
- Gestion du portefeuille et des commissions.
- Comptes secondaires de gestion avec droits individuels.
- Suspension / réactivation des membres du groupe.
- Export JSON des tables métier disponibles, avec filtre temporel.

## 5. Sécurité

- Authentification Supabase Auth.
- Les actions sensibles de création de comptes passent par les Edge Functions.
- Les clés `service_role` restent uniquement dans l’environnement Supabase.
- Les comptes secondaires du propriétaire ne sont pas propriétaires de plateforme.
- Les livreurs ne disposent pas d’un formulaire d’inscription publique.

## 6. Identité et accès aux rapports

- ZUMUYA GROUP est l'identité unique du produit.
- Les fichiers techniques `zrestaurant-*` restent compatibles avec les écrans
  restaurant / hôtel intégrés ; ils ne constituent pas une application séparée.
- Un accès rapide aux rapports est présent dans les espaces professionnels.
- Les permissions de rapport reconnaissent `report` et `reports`.
