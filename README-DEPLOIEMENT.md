# Déploiement ZUMUYA GROUP

1. Publier le contenu de ce dossier sur GitHub Pages ou un hébergement HTTPS.
2. Configurer `config.js` avec l'URL Supabase et la clé publique `anon` uniquement.
3. Supabase > SQL Editor : coller et exécuter `SUPABASE-INSTALLATION-COMPLETE.sql`.
4. Authentication > Providers > Phone : activer Phone et configurer le fournisseur SMS. Configurer les URL de redirection autorisées.
5. Tester avec un compte de test avant production.

Clients : numéro international E.164 + mot de passe (8 caractères minimum). Aucun e-mail client n'est demandé.
Les comptes professionnels créés via le formulaire sont enregistrés comme vérifiés et leur espace est activé.
Les produits Agro comportent un prix/unité, description et photo. Le bucket `zumuya-agro-products` est créé par le SQL.

IMPORTANT : les comptes Restaurant et Hôtel utilisent le portail d’authentification Supabase commun de ZUMUYA GROUP. Le pont `zrestaurant-portal-bridge.js` rattache la session du portail à l’organisation métier correspondante. Conserve les politiques RLS actives et ne publie jamais la clé `service_role`.
