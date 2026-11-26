# Guide Supabase — ZUMUYA GROUP

Le dépôt utilise le projet Supabase indiqué dans `config.js`. Le SQL consolidé et les migrations sont fournis dans ce dépôt. Ne jamais publier une clé `service_role`.

## Installation / mise à niveau

Lire impérativement `INSTALLATION_ZUMUYA_GROUP.md`. Sur une base existante, faire une sauvegarde et ne jamais exécuter un script RESET sans avoir vérifié son impact.

Le nouvel ensemble de fonctionnalités est installé par :
1. `z_hospitality_native.sql` — espaces restaurant / hôtel, équipes, journal d’audit natif.
2. `19_pilotage_rapports_exports_equipe_proprietaire.sql` — journal transversal de tous les pôles, accès secondaires du propriétaire et export complet.
3. Déploiement des Edge Functions `z-hospitality-team` et `platform-team-admin`.

La migration 19 doit être exécutée après le socle portail et les migrations métier qui créent `rg_organizations`, `rg_platform_owners`, `rg_service_records` et les tables des pôles.

## Configuration navigateur

`config.js` ne contient que :
- URL du projet Supabase ;
- clé publique anon / publishable.

Ne jamais y mettre `service_role`, clé privée, mot de passe de base de données ou secret de fonction.

## Fonctions Edge

Sources :
- `supabase/functions/z-hospitality-team/index.ts`
- `supabase/functions/platform-team-admin/index.ts`

Déploiement :
```bash
supabase link --project-ref azfunhfjmybekzakhtbu
supabase functions deploy z-hospitality-team
supabase functions deploy platform-team-admin
```

Les fonctions contrôlent le JWT et le rôle propriétaire côté serveur. Les secrets Supabase sont fournis à l’environnement d’exécution ; ne pas les committer.

## Vérifications

- `rg_platform_access()` doit renvoyer `is_owner=true` pour le propriétaire principal.
- `rg_platform_team_members` ne contient que les comptes secondaires créés par le propriétaire.
- Les membres n’accèdent qu’aux sections autorisées.
- `rg_activity_events` enregistre les actions des tables métier rattachées à une organisation ou un utilisateur.
- `rg_platform_export_all(date,date)` est réservé au propriétaire principal.
