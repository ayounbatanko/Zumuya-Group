# ZUMUYA GROUP — projet web

Ce dépôt contient les fichiers du projet ZUMUYA GROUP : portail principal, comptes, espace agricole, espace client, modules de restauration, livraison, styles, icônes, manifeste et scripts associés.

## Mise en ligne sur GitHub

1. Ouvrir le dépôt GitHub du projet.
2. Télécharger cette archive ZIP et la décompresser sur l'appareil, ou utiliser l'option d'importation de fichiers de GitHub.
3. Envoyer le contenu de ce dossier à la racine du dépôt (les fichiers `index.html`, `config.js`, `agro.html`, etc. doivent être visibles à la racine).
4. Vérifier que `config.js` contient l'URL Supabase et la clé publique `anon` du bon projet.
5. Ne jamais ajouter une clé `service_role`, un mot de passe, un jeton privé ou un secret dans GitHub.

## Configuration Supabase

Le fichier `config.js` utilise une URL Supabase et une clé publique `anon`. Une clé `anon` est destinée à être utilisée côté navigateur, mais la sécurité dépend obligatoirement des politiques RLS et des permissions configurées dans Supabase.

### Attention — scripts SQL agricoles historiques

Les scripts SQL historiques inclus dans cette archive (`SUPABASE-INSTALLATION-COMPLETE.sql`, `ZUMUYA_EXTENSION_ESSAI.sql` et `zumuya-agro.sql`) contiennent des références aux anciennes tables `rg_agro_*`.

La base Supabase actuelle du projet possède des tables agricoles `z_agro_*` (notamment `z_agro_profiles` et `z_agro_products`). **Ne pas exécuter ces anciens scripts agricoles tels quels sur la base actuelle.** Ils sont conservés dans l'archive pour référence et compatibilité historique, pas comme une migration validée pour la base actuelle.

Le module agricole du code source contient également encore des appels à certaines tables `rg_agro_*`. Il devra être adapté aux noms et colonnes réels des tables `z_agro_*` avant de considérer le module agricole comme opérationnel sur la base actuelle.

## Authentification de test

Le fichier `04_auth_phone_email_profile.sql` est fourni comme référence de configuration. La désactivation de la validation SMS dépend aussi des réglages du fournisseur Phone dans Supabase Auth ; la présence d'un champ téléphone dans une table ne désactive pas à elle seule la vérification.

## Important

Cette archive regroupe le code existant du projet. Elle ne constitue pas une certification de fonctionnement en production. Après importation dans GitHub, tester la connexion, la création de compte, les espaces utilisateur, les commandes et les permissions RLS dans un environnement de test.
