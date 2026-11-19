# ZUMUYA GROUP — version plate (aucun sous-dossier)

Tous les fichiers sont à la **racine** du dépôt. Aucun dossier à créer : on peut tout envoyer depuis le téléphone.

## Conventions de noms

| Ancien emplacement | Nouveau nom |
|---|---|
| `proprietaire/index.html`, `owner.css`, `owner.js` | `proprietaire.html`, `proprietaire.css`, `proprietaire.js` |
| `restauration/xxx` | `resto-xxx` (ex. `resto-index.html`, `resto-client.html`) |
| `restauration/ext/kds.js` | `resto-ext-kds.js` |
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
4. La sécurité RLS stricte (ancien `resto-sql-v2_securite_rls.sql`) a été retirée : elle cassait l'application tant que les comptes n'étaient pas migrés vers Supabase Auth. À refaire proprement à ce moment-là.

Voir `COORDINATION-POLES.md` pour le fonctionnement commun des pôles 01, 02 et 03.

## Points à connaître

- Le portail et le Service de Restauration utilisent maintenant **un seul projet Supabase** (`config.js`). Les données de l'ancien projet de restauration ne sont pas reprises automatiquement.
- Les images de partage (`og:image`) pointent maintenant vers `resto-apercu-facebook.jpg` de ce dépôt (plus de lien vers l'ancien dépôt RestoGest).

## Retouches de novembre 2026

1. **Bug grave corrigé** (`resto-index.html`) : l'ancienne page ouvrait automatiquement le compte restaurant dès qu'une session existait. Désormais, une session ouverte affiche seulement « Continuer vers mon espace » / « Changer de compte ». Le portail n'ouvre plus `resto-index.html` : « En savoir plus » mène aux pages de service ci-dessous.
2. **`restauration.html`** (pôle 01) : réservé à l'utilisateur connecté ; restaurants classés par distance (GPS), catalogue complet, prix de chaque repas, frais de livraison = distance × tarif/km du restaurant. Les comptes hôtels n'y figurent pas.
3. **`hotel.html`** (pôle 02) : service à part, ouvert uniquement avec un compte hôtel (commandes, chambres, accès à la gestion de l'hôtel). Création : `compte.html?mode=signup` (catégorie hôtel).
4. **`livraison.html`** (pôle 03) : service à part, coordonné avec 01 et 02 (statistiques réseau, tableau des livraisons du restaurant/hôtel, accès livreur).
5. **Bouton « Connecté »** sur l'accueil (`app.js` + `zsession.js`) dès qu'un utilisateur est connecté (portail ou service).
6. **Visuel technologique** du hero (réseau animé des pôles).
7. **Tableau de bord propriétaire** refait (`proprietaire.*`) : menu latéral, indicateurs, graphique des commandes, supervision des restaurants/hôtels/livraisons, partenaires, pays, organisations, transactions, activité.

Nouveaux fichiers : `zsession.js`, `zservice.css`, `restauration.html`, `hotel.html`, `livraison.html`.

## Limites à connaître
- Les comptes du portail (e-mail, Supabase Auth) et ceux du Service (téléphone, base `rg_users`) sont encore deux systèmes séparés : un utilisateur du portail doit aussi avoir un compte Service pour commander.
- La réservation aux hôtels est appliquée côté navigateur ; une vraie protection demande des règles RLS après migration des comptes.
- `rg_users` contient des mots de passe en clair lisibles avec la clé publique : à migrer vers Supabase Auth en priorité.

## RestoGest : fonctionnalités uniquement sur zumuya
Toutes les fonctionnalités RestoGest (restaurant, client, livreur, propriétaire, carte de visite, extensions) vivent uniquement dans ce dépôt (`resto-*`). L'ancien dépôt RestoGest doit être remplacé par le kit `kit-RestoGest-ancien-depot.zip` (redirection + auto-suppression de l'ancien service worker). Voir `LISEZMOI-RESTOGEST.md` dans le kit.

## Connexion : uniquement `compte.html`
L'ancien écran « Service de Restauration » (téléphone / mot de passe, créer un compte, support connexion) est supprimé. Voir `LISEZMOI-AUTH.md`, section « Portail unique ».

## Version 2.4.0 — Restauration · Hôtel · Livraison coordonnés
Voir `resto-CHANGEMENTS-2.4.0.md` (corrections, fichiers retirés, tests).
