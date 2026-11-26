# ZUMUYA GROUP

Plateforme multi-pôles unifiée : restaurant, hôtel, Marketplace, producteurs agricoles,
commerçants agricoles, sociétés de livraison, livreurs rattachés aux établissements et clients.

## Espaces et pilotage
- Les espaces métiers restent distincts et partagent les flux de commandes, achats,
  approvisionnement, livraison, paiements, notifications et suivi.
- Les comptes professionnels disposent de rapports et statistiques avec période sélectionnable
  et exports CSV / JSON depuis `analytics.html`.
- Les restaurants et hôtels disposent de la gestion d'équipe, des permissions et du journal
  d'actions via les modules ZUMUYA natifs.
- Le compte propriétaire supervise l'infrastructure, gère les membres de son groupe avec
  permissions limitées et exporte les données métier autorisées en JSON.
- Les livreurs d'établissement sont créés par l'organisation qui les rattache ; aucune
  inscription publique de livreur n'est prévue.

## Installation
Lire impérativement `INSTALLATION_ZUMUYA_GROUP.md` avant toute migration.
Ordre SQL, déploiement des Edge Functions, configuration Auth et publication GitHub
sont détaillés dans ce guide.

## Sécurité
- `config.js` ne contient que l'URL Supabase et la clé publique publishable/anon.
- Ne jamais committer `service_role`, clés privées, mots de passe ou secrets.
- Les contrôles d'accès doivent être appliqués par Supabase RLS et Edge Functions,
  pas seulement par l'interface.
- Faire une sauvegarde avant toute migration sur une base contenant des données.

## Identité du produit
Le produit officiel est **ZUMUYA GROUP**. Les anciens écrans de restauration conservés
pour compatibilité technique sont intégrés au parcours ZUMUYA et ne constituent pas
une application ou un service séparé.
