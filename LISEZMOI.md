# ZUMUYA GROUP — version plate (aucun sous-dossier)

Tous les fichiers sont à la **racine** du dépôt. Aucun dossier à créer : on peut tout envoyer depuis le téléphone.

## Conventions de noms

| Ancien emplacement | Nouveau nom |
|---|---|
| `proprietaire/index.html`, `owner.css`, `owner.js` | `proprietaire.html`, `proprietaire.css`, `proprietaire.js` |
| `restauration/xxx` | `resto-xxx` (ex. `resto-index.html`, `resto-client.html`) |
| `restauration/ext/kds.js` | `resto-ext-kds.js` |
| `restauration/sql/…`, `docs/…` | `resto-sql-…`, `resto-docs-…` |
| `restauration/supabase/functions/push-notify/index.ts` | `resto-fn-push-notify.ts` |
| `GMR_Restaurant.apk` | inchangé (racine) |

Tous les liens internes (pages, scripts, icônes, manifestes, modules) ont été réécrits en conséquence.

## Corrections apportées

1. **Service worker unique** : avant, le portail et le Service de Restauration avaient chacun un `sw.js`. À plat ils auraient été au même niveau et se seraient écrasés. Un seul `sw.js` gère maintenant les deux (cache hors ligne + notifications push).
2. **`sql-portail.sql` ajouté** : le portail utilisait des tables et fonctions qui n'étaient décrites nulle part (`rg_partner_applications`, `rg_countries`, `rg_organizations`, `rg_is_platform_owner`, etc.). Ce script les crée avec leurs règles de sécurité.
3. Chargeur des extensions (`resto-ext-loader.js`) adapté aux nouveaux noms de fichiers.
4. Tableau « Organisations » du propriétaire : colonne vide corrigée (colspan).
5. Documentation mise à jour pour la structure plate.

## Mise en ligne (GitHub Pages)

1. Créez un dépôt, puis **Add file > Upload files** et choisissez tous les fichiers (GitHub accepte jusqu'à 100 fichiers par envoi ; il y en a 66).
2. **Settings > Pages** : branche `main`, dossier `/ (root)`.
3. Le site s'ouvre sur `index.html` (portail).

## Configuration à faire une fois (UN SEUL projet Supabase)

1. Dans Supabase > SQL Editor du projet de `config.js`, exécutez dans l'ordre : `sql-portail.sql`, puis `supabase-setup.sql` (tables du service, realtime, attribution des livreurs côté serveur, protection des commandes). Si un avertissement signale `pg_cron`, activez-le dans Database > Extensions et relancez.
2. Créez votre compte sur `compte.html`, puis décommentez la dernière requête de `sql-portail.sql` (avec votre e-mail) pour devenir propriétaire.
3. Pour changer de projet Supabase, modifiez seulement `config.js`.
4. `resto-sql-v2_securite_rls.sql` : seulement après lecture de `resto-docs-RESTOGEST-EXTENSIONS-V2.md`.

Voir `COORDINATION-POLES.md` pour le fonctionnement commun des pôles 01, 02 et 03.

## Points à connaître

- Le portail et le Service de Restauration utilisent maintenant **un seul projet Supabase** (`config.js`). Les données de l'ancien projet de restauration ne sont pas reprises automatiquement.
- Les images de partage (`og:image`) pointent encore vers l'ancien dépôt `ayounbatanko.github.io/Restaurant-gestion-multiples/`. À remplacer par l'adresse du nouveau site quand elle sera connue (l'image est `resto-apercu-facebook.jpg`).
