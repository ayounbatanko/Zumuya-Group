ZUMAYA GROUP — VERSION GITHUB CORRIGÉE

Cette archive contient les fichiers statiques du site à déposer à la racine du dépôt GitHub Pages.

CORRECTIFS APPLIQUÉS
- Le choix du type de compte est masqué à la connexion et demandé uniquement à la création du compte. Après connexion, le rôle est déterminé depuis le profil Supabase.
- La modification et la suppression du compte peuvent revérifier le mot de passe avec l’e-mail ou le téléphone déjà présent dans la session.
- Le Service Worker a été actualisé : cache versionné, préchargement des pages et scripts présents dans l’archive, et page de secours adaptée au module Restauration.
- Les versions des scripts et styles du portail ont été incrémentées pour limiter le chargement d’anciens fichiers en cache.

CONFIGURATION SUPABASE
Le fichier config.js fourni conserve une URL et une clé publique anon qui correspondent entre elles au projet dusznqvwhrklcqhmbylu. Le Project ID azfunhfjmybekzakhtbu communiqué dans la conversation est différent. Ne remplacez pas seulement l’URL : il faut aussi utiliser la clé publishable/anon du même projet. Aucune clé service_role ne doit être placée dans GitHub.

IMPORTANT — SQL
Les scripts SQL sont inclus comme sources de configuration, mais ne sont pas exécutés automatiquement par GitHub Pages. N’exécutez pas 00_RESET_ET_SCHEMA_COMPLET.sql en production sans sauvegarde : sa section de réinitialisation peut supprimer les tables métier. Le correctif de suppression de compte doit être installé et testé séparément dans Supabase.

DÉPLOIEMENT
1. Téléchargez et décompressez l’archive.
2. Ouvrez le dépôt GitHub Pages de ZUMAYA.
3. Remplacez les fichiers existants par le contenu du dossier, directement à la racine du dépôt.
4. Attendez la publication GitHub Pages, puis rechargez le site. Sur Android, si l’ancienne version persiste, fermez l’application installée et rechargez le site dans Chrome.

Les fichiers métier et les fonctionnalités existantes sont conservés ; les modifications sont ciblées sur les points listés ci-dessus.
