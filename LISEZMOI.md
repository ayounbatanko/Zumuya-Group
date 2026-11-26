# ZUMUYA GROUP — structure du dépôt

Tous les fichiers publiés par GitHub Pages sont à la racine du dépôt.

## Espaces par type de compte

| Type de compte | Espace actif |
|---|---|
| Client | `client-espace.html` et `zrestaurant-client.html` |
| Restaurant | `zrestaurant-restaurant.html?portal=restaurant` |
| Hôtel | `zrestaurant-restaurant.html?portal=hotel#hotel` |
| Livreur | `zrestaurant-driver.html` |
| Producteur / commerçant agricole | `agro.html` |
| Boutique Marketplace | `marketplace.html` et `boutique.html` |
| Société de livraison | `livraison-entreprise.html` |
| Propriétaire plateforme | `proprietaire.html` |
| Compte universel | `compte.html` |

## Fichiers communs

- `config.js` : configuration publique Supabase du projet ZUMUYA GROUP.
- `compte.html` et `compte.js` : authentification, inscription et orientation des comptes.
- `zguard.js` : garde-fou d'interface selon le type de compte.
- `zrestaurant-db.js` et `zrestaurant-portal-bridge.js` : données et liaison des espaces Restaurant / Hôtel au compte commun.
- `wallet.js` : portefeuille partagé.
- `catalogue.js` : catalogues publics multi-pôles.
- `zrestaurant-ext-loader.js` : chargement des extensions Restaurant / Hôtel.

## Installation Supabase

1. Configurer uniquement l'URL et la clé publique anon dans `config.js`.
2. Appliquer les migrations SQL nécessaires dans l'ordre prévu par le dépôt, uniquement si elles ne sont pas déjà installées.
3. Ne pas exécuter de script RESET ou SCHEMA COMPLET sur une base de production.
4. Garder les politiques RLS actives et ne jamais publier la clé `service_role`.

## Compatibilité des anciennes adresses

Les anciens liens de pages Restaurant / Hôtel redirigent vers les espaces ZUMUYA actuels. Les pages actives ne dépendent pas d'une application externe ni d'une deuxième authentification.
