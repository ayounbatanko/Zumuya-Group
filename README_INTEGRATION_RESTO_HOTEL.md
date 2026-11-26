# Pôles Restaurant et Hôtel — ZUMUYA GROUP

## Architecture actuelle

Les pôles Restaurant et Hôtel sont intégrés au portail unique **ZUMUYA GROUP**. Ils utilisent le même compte Supabase, la même authentification du portail, les mêmes organisations et les mêmes commandes que les autres activités.

## Accès

- Connexion et création de compte : `compte.html`
- Gestion restaurant : `zrestaurant-restaurant.html?portal=restaurant`
- Gestion hôtel : `zrestaurant-restaurant.html?portal=hotel#hotel`
- Espace client et commandes : `zrestaurant-client.html`
- Espace livreur : `zrestaurant-driver.html`
- Supervision de la plateforme : `proprietaire.html`

## Fonctionnalités conservées

### Restaurant
- Tableau de bord, indicateurs et rapports
- Caisse, impression des reçus et historique des ventes
- Carte / menu, descriptions et photos
- Commandes en ligne, statuts et suivi
- Attribution automatique des courses et gestion des livreurs
- Gestion d'équipe, permissions et journal des actions
- Approvisionnement agricole
- Abonnement Pro, assistance et paramètres
- Écran cuisine et actualisation en temps réel

### Hôtel
- Gestion des paramètres de l'établissement et des chambres
- Commandes de service en chambre
- Préparation et remise en chambre
- Notes de chambre, règlement et export CSV
- Livraison extérieure coordonnée avec le pôle Livraison
- Historique, rapports, équipe et réglages

## Données et sécurité

- `config.js` est la configuration publique Supabase partagée du portail.
- `zrestaurant-db.js` et `zrestaurant-portal-bridge.js` gèrent les données et le rattachement des comptes aux organisations.
- Les droits des employés et livreurs restent contrôlés côté serveur par les règles RLS et les fonctions SQL.
- Les tables `rg_*` font partie du schéma actuellement utilisé : ne pas les supprimer ni les renommer.

## Déploiement

Les pages sont servies depuis le dépôt ZUMUYA GROUP. Les extensions actives restent chargées par `zrestaurant-ext-loader.js`. Conserver les noms des fichiers appelés par les pages HTML.
