# ZUMUYA GROUP — comptes, catégories et espaces (version 2.5)

## Connexion : e-mail + mot de passe pour toutes les catégories
`compte.html` : le visiteur choisit sa catégorie (client, restaurant, hôtel, livreur, producteur agricole, commerçant agricole), saisit son e-mail et un mot de passe (deux fois à l'inscription). Aucun SMS n'est utilisé ; « Mot de passe oublié » envoie un lien par e-mail. Les catégories Commerce et Entreprise sont masquées tant qu'elles n'ont pas d'espace.

## Chaque catégorie arrive UNIQUEMENT dans son espace
| Catégorie | Espace | Pages autorisées |
|---|---|---|
| Client | `client-espace.html` | `client-espace`, `resto-client` (restaurants, commandes) |
| Restaurant | `resto-restaurant.html` | Tableau de bord, Caisse, Commandes, Menu, Historique, Rapport CA, Livreurs, Support, Paramètres (sans Module hôtel) ; `agro` |
| Hôtel | `resto-restaurant.html` | Idem + **Module hôtel** |
| Livreur | `resto-driver.html` | Courses, position |
| Producteur / commerçant agricole | `agro.html` | Catalogue et demandes |
| Propriétaire | `proprietaire.html`, `resto-owner.html` | Administration de toute la plateforme |
Toutes les catégories : `parametres.html` (profil, e-mail, mot de passe, notifications, export, suppression du compte).

`zguard.js` (chargé en tête de chaque page privée, attribut `data-roles`) renvoie toute catégorie non autorisée vers son propre espace, et les visiteurs sans session vers `compte.html`. C'est un aiguillage d'interface : la protection réelle des données doit venir des règles RLS de Supabase (à renforcer pour les tables Restauration).

## Propriétaire (administrateur) — géré dans Supabase, pas dans GitHub
Aucune adresse e-mail de propriétaire n'est écrite dans le code. Le propriétaire est la ligne de la table `rg_platform_owners` (fonction `rg_is_platform_owner()`), créée par SQL dans Supabase. Le privilège « propriétaire » fondé sur un nom (« Ayouba Tanko ») a été supprimé.

## Supabase
1. SQL Editor : `SQL-TOUT-EN-UN.sql` (ou seulement `05_suppression_compte.sql` si la base est déjà installée).
2. Authentication > Providers : Email activé. Phone peut rester désactivé.
3. Authentication > Sign In / Providers > Email : « Confirm email » activé en production (nécessite un SMTP personnalisé : le service e-mail par défaut est très limité) ou désactivé pendant les essais.
4. Authentication > URL Configuration : mettre l'adresse GitHub Pages du site dans « Site URL » et « Redirect URLs ».
