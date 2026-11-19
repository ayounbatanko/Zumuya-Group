# Authentification ZUMUYA GROUP : e-mail pour tout le monde

La page unique `compte.html` propose un sélecteur de catégorie (client, restaurant, hôtel, livreur, producteur, commerçant, commerce, entreprise). **Toutes les catégories se connectent et s'inscrivent avec adresse e-mail + mot de passe** (mot de passe saisi deux fois à l'inscription). Les libellés ne répètent plus « (e-mail) ».

Seule exception : un ancien compte client créé avec un numéro de téléphone peut encore se connecter grâce au lien « Mon compte client a été créé avec un numéro de téléphone » (connexion uniquement).

## Restaurants partenaires : plus de seconde connexion

Après connexion e-mail, un restaurant ayant sa fiche partenaire arrive directement sur son espace (`resto-restaurant.html`, tableau de bord RestoGest). Le fichier `resto-portal-bridge.js` (chargé par `resto-restaurant.html` et `resto-index.html`) reconnaît la session du portail, retrouve ou crée le compte local et la fiche restaurant, puis ouvre la session. L'écran « Gestion Multiples de Restaurant » ne redemande plus d'identifiants dans ce parcours. « Changer de compte » et « Déconnexion » dans le Service restent possibles.

## Configuration Supabase Auth

Dans Authentication > Providers :
1. Activez **Email** pour tous les comptes. (**Phone** n'est utile que pour les anciens comptes clients.)
2. Choisissez les règles de confirmation adaptées à votre exploitation. La confirmation par SMS nécessite un fournisseur SMS configuré ; la confirmation e-mail nécessite le service e-mail Supabase ou un SMTP personnalisé.

## SQL

Après le schéma principal, exécutez `04_auth_phone_email_profile.sql` dans SQL Editor. Il rend le déclencheur de profil compatible avec les comptes dont l'identifiant est un téléphone (email nul) comme avec les comptes e-mail.

## Connexion

Le champ identifiant est toujours l'adresse e-mail. Choisissez la même catégorie qu'à l'inscription. Les professionnels complètent ensuite leur fiche d'organisation depuis « Devenir partenaire » si elle n'a pas encore été créée.

## Portail unique (mise à jour)
`resto-index.html` n'affiche plus aucun formulaire de connexion ni de création de compte (ni « Support — problème de connexion »). Il sert seulement d'aiguillage :
- session portail valide → arrivée dans l'espace de la catégorie : client (`resto-client.html`), restaurant/hôtel (`resto-restaurant.html`), livreur (`resto-driver.html`), propriétaire de la plateforme (`resto-owner.html`), producteur/commerçant (`agro.html`) ;
- pas de session → `compte.html`.
`resto-portal-bridge.js` (chargé par toutes les pages `resto-*`) crée/relie automatiquement le profil local (client, livreur, restaurant, hôtel) au compte e-mail du portail. La déconnexion d'une page `resto-*` ferme aussi la session portail et renvoie sur `compte.html`.
Les anciens comptes locaux (téléphone / nom d'utilisateur) ne peuvent plus se connecter : les utilisateurs recréent un compte sur `compte.html`.
