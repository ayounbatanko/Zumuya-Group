# Installation ZUMUYA GROUP — Supabase et GitHub

Ce dépôt est préconfiguré pour le projet Supabase référencé dans `config.js`. La clé publique peut être utilisée côté navigateur ; la clé `service_role` ne doit jamais être ajoutée au dépôt.

## 1. SQL — ordre d’installation

Sur une base déjà en service, faire d’abord une sauvegarde. Ne pas exécuter de script RESET sur une base contenant des données utiles.

1. Exécuter `SUPABASE-INSTALLATION-COMPLETE.sql` si le socle du portail n’est pas encore installé. Sur une base déjà initialisée, ne pas le rejouer sans comparer son contenu et son impact.
2. Exécuter les migrations numérotées dans l’ordre, uniquement si elles ne sont pas déjà appliquées : `04_auth_phone_email_profile.sql`, `05_suppression_compte.sql`, `06_FIX_SERVEUR_2026-11-20.sql`, puis `07` à `18` en ordre numérique.
3. Exécuter `z_hospitality_native.sql` pour les modules natifs Restaurant / Hôtel, équipes, données et journal d’audit.
4. Exécuter `19_pilotage_rapports_exports_equipe_proprietaire.sql`.
5. Exécuter `20_harmonisation_droits_rapports_journal.sql` pour harmoniser
   les permissions `report` / `reports` du journal restaurant-hôtel.

Les migrations numérotées sont conçues pour compléter le socle ZUMUYA ; relire les commentaires d’en-tête de chaque script avant exécution. Ne pas exécuter deux fois un script explicitement indiqué comme migration destructive.

## 2. Edge Functions

Depuis la racine du dépôt, avec Supabase CLI installé et connecté au bon projet :

```bash
supabase link --project-ref azfunhfjmybekzakhtbu
supabase functions deploy z-hospitality-team
supabase functions deploy platform-team-admin
```

Les fonctions utilisent `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` depuis les secrets d’environnement Supabase. Ne copiez jamais la clé service_role dans `config.js`.

`z-hospitality-team` crée les comptes employés / livreurs uniquement après vérification que l’appelant est propriétaire de l’établissement.
`platform-team-admin` crée et administre les comptes secondaires du propriétaire uniquement après vérification de `rg_is_platform_owner()`.

## 3. Authentification et paramètres Supabase

Dans Supabase Dashboard :
- Authentication → Providers : activer les fournisseurs réellement utilisés (Email et/ou Phone).
- Authentication → URL Configuration : ajouter le domaine GitHub Pages et les URL de retour du site.
- Edge Functions : vérifier que les secrets standards Supabase sont disponibles.
- Database → Replication : conserver Realtime activé pour les tables métier qui l’utilisent.
- Storage : vérifier les buckets et policies déjà installés par les migrations Marketplace / Agro.

## 4. Désigner le propriétaire

Le compte propriétaire doit déjà exister dans Supabase Auth. Ajouter son UUID dans `public.rg_platform_owners` via le SQL Editor. Utiliser l’UUID du compte Auth, pas son nom d’affichage. Ne pas committer cette opération ni les données de connexion.

Exemple à adapter dans le SQL Editor :

```sql
insert into public.rg_platform_owners(user_id,email)
select id,email from auth.users where lower(email)=lower('VOTRE_EMAIL')
on conflict(user_id) do nothing;
```

## 5. Déploiement GitHub

1. Décompresser l’archive.
2. Envoyer le contenu du dossier `Zumuya-Group-main` à la racine du dépôt GitHub.
3. Vérifier que GitHub Pages publie la branche et le dossier attendus.
4. Après publication, ouvrir `compte.html`, tester un compte client, un compte restaurant / hôtel, un compte Agro, une boutique Marketplace et une société de livraison.
5. Se connecter à `proprietaire.html` avec le compte propriétaire et créer les comptes secondaires depuis « Gestion du groupe ».

## 6. Tests à effectuer avant la production

- Compte principal restaurant : créer un membre, vérifier ses permissions, suspendre puis réactiver.
- Compte membre : vérifier qu’il ne voit que les rubriques autorisées.
- Journal : créer / modifier un article et vérifier l’événement correspondant.
- Rapports : choisir une période et vérifier les exports CSV / JSON.
- Propriétaire : créer un compte secondaire avec une seule permission et confirmer qu’il ne peut pas ouvrir les autres rubriques.
- Export propriétaire : lancer un export avec et sans période, vérifier le JSON.

## Limites d’exécution

Les fichiers SQL et Edge Functions sont préparés dans ce dépôt, mais leur exécution distante nécessite une session autorisée sur le projet Supabase et un accès de déploiement GitHub. L’archive ne prétend pas avoir exécuté les migrations ni déployé les fonctions sur le serveur.
