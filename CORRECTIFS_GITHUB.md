# Correctifs GitHub — ZUMAYA GROUP

## Modifications apportées

- **Connexion** : le choix du type de compte n'apparaît plus pendant la connexion. Il reste disponible pendant la création du compte. Le rôle continue d'être lu depuis les métadonnées du compte Auth.
- **Paramètres** : la vérification du mot de passe avant modification ou suppression utilise l'e-mail, ou le téléphone si le compte ne possède pas d'e-mail.
- **Profil** : l'identifiant affiché peut être l'e-mail ou le téléphone.
- **Suppression du compte (SQL)** : la fonction cible les données locales reliées au compte (client, livreur et établissement), préserve les messages de chat stockés dans `rg_orders`, protège le compte propriétaire, limite l'exécution au rôle `authenticated` et durcit le `search_path`.
- **PWA** : le Service Worker utilise un nouveau cache et précharge les pages, scripts, styles et images présents dans le dépôt. Les pages de secours sont distinguées pour le portail et le module Restauration.
- **Publication** : versions des scripts, styles et application incrémentées pour éviter de garder les anciens fichiers en cache.

## Vérifications effectuées

- Tous les fichiers JavaScript passent `node --check`.
- Les références locales `src` et `href` des pages HTML ont été vérifiées : aucune référence locale manquante détectée.
- Le contenu SQL a été relu statiquement, mais n'a pas été exécuté sur le projet Supabase : l'accès à ce projet n'était pas disponible pendant la préparation. Il faut donc exécuter `05_suppression_compte.sql` dans SQL Editor et tester avec un compte de test avant la mise en production.

## Configuration Supabase à noter

Le `config.js` fourni contient encore l'URL et la clé publique correspondantes au projet `dusznqvwhrklcqhmbylu`. Le Project ID `azfunhfjmybekzakhtbu` communiqué ensuite est différent. Pour ne pas casser le site, cette archive ne remplace pas une seule moitié de la configuration. Il faudra associer l'URL **et** la clé publique provenant du même projet avant de basculer définitivement. N'ajoutez jamais une clé `service_role` au dépôt GitHub.

## Déploiement GitHub Pages

1. Décompresser l'archive.
2. Ouvrir le dépôt GitHub Pages de ZUMAYA.
3. Envoyer le contenu de l'archive directement à la racine du dépôt, en remplaçant les fichiers existants.
4. Attendre la publication, puis ouvrir le site et actualiser.
5. Si Android affiche encore l'ancienne version, fermer l'application installée, ouvrir le site dans Chrome et recharger.

> Ne pas exécuter `00_RESET_ET_SCHEMA_COMPLET.sql` pour cette mise à jour. Ce script est un script de schéma initial et sa section de réinitialisation peut supprimer les tables métier.
