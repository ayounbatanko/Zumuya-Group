# Pôles Restaurant et Hôtel — ZUMUYA GROUP

## Architecture actuelle

Les pôles Restaurant et Hôtel sont intégrés au portail unique **ZUMUYA GROUP**. Ils utilisent le même compte Supabase, la même authentification du portail, les mêmes organisations et les mêmes commandes que les autres activités.

## Accès

- Connexion et création de compte : `compte.html`
- Gestion restaurant (modules complets issus de l’ancien RestoGest) : `zrestaurant-restogest.html`
- Gestion hôtel : `zrestaurant-restaurant.html?portal=hotel#hotel`
- Espace client et commandes : `zrestaurant-client.html`
- Espace livreur : `zrestaurant-driver.html`
- Supervision de la plateforme : `proprietaire.html`

## Fonctionnalités conservées

### Restaurant — RestoGest intégré
- Tableau de bord, indicateurs et rapports
- Caisse / vente, panier, quantités, modes de paiement, montant reçu et monnaie à rendre
- Impression et partage des tickets 58/80 mm, logo, caissier, taxes et message de fin
- Menu et produits, prix de vente, coûts, marges et catégories
- Gestion du stock, entrées/sorties et seuils d’alerte
- Clients, dettes, remboursements partiels, réservations de tables
- Historique, recherche des ventes, rapports et export CSV
- Utilisateurs internes avec rôles Administrateur, Gérant, Caissier et Serveur, droits par page et remise maximale
- Paramètres du restaurant, logo, devise, taxes, paiements, apparence, préférences et sauvegarde/restauration
- Synchronisation automatique Supabase dans `z_hospitality_records`, isolée par `org_id`
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


## Intégration RestoGest (2026-11-26)
- Le code source `RestoGest(2).html` a été porté dans `zrestaurant-restogest.html`.
- Le module utilise `config.js` et la session Supabase du compte ZUMUYA GROUP ; aucun second compte cloud RestoGest n'est créé.
- Les données sont séparées par organisation dans `z_hospitality_records` avec `record_type='setting'` et `title='restogest_data'`, protégées par les politiques RLS existantes.
- L'ancien tableau de bord générique `hospitality.html` redirige désormais vers les modules métiers réels.
- Le pôle Hôtel conserve son espace natif `zrestaurant-restaurant.html?portal=hotel#hotel` et ses modules de chambres, réservations et service en chambre.
- Validation réalisée : vérification syntaxique du JavaScript du module et contrôle des liens publiés. Les parcours de données avec comptes réels restent à tester dans le navigateur.
