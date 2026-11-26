# ZUMUYA GROUP — intégration des pôles et des espaces

## Architecture unifiée

Les pôles Restaurant et Hôtel sont des modules natifs du portail ZUMUYA GROUP. Les comptes, organisations, commandes et accès sont reliés au projet Supabase commun.

## Espaces par rôle

- Client : `client-espace.html` et `zrestaurant-client.html`
- Restaurant : `zrestaurant-restaurant.html?portal=restaurant`
- Hôtel : `zrestaurant-restaurant.html?portal=hotel#hotel`
- Livreur : `zrestaurant-driver.html`
- Producteur et commerçant agricole : `agro.html`
- Boutique Marketplace : `marketplace.html` et `boutique.html`
- Société de livraison : `livraison-entreprise.html`
- Propriétaire plateforme : `proprietaire.html`
- Compte universel : `compte.html`

## Fonctionnalités conservées

### Restaurant et Hôtel
Caisse, reçus, catalogue et menu, commandes en ligne, suivi des statuts, service en chambre, notes de chambre, export CSV, gestion d'équipe, permissions, livreurs, attribution des courses, suivi GPS, rapports, journal d'actions, notifications, assistance et réglages.

### Marketplace et Agro
Boutiques, produits avec photos, commandes, statistiques, catalogues agricoles, demandes d'approvisionnement, collectifs, achats groupés et messagerie.

### Livraison et coordination
Demandes de livraison, zones de desserte, tarifs, disponibilité des sociétés, attribution des courses, suivi en direct et échanges entre partenaires.

### Fonctions communes
- Un portefeuille accessible depuis les espaces connectés.
- Mes commandes et leur suivi.
- Historique, rapports et exports.
- Messagerie et notifications.
- Comptes d'équipe avec permissions et journal d'actions.

## Données et sécurité

Les pages utilisent `config.js` pour la configuration Supabase commune. Les tables `rg_*` et les fonctions serveur existantes sont conservées. Les autorisations de données restent appliquées par RLS et les fonctions serveur.

Les anciens chemins de pages Restaurant / Hôtel sont des redirections de compatibilité vers les espaces ZUMUYA actuels. Les pages actives ne redirigent pas vers une application externe.
