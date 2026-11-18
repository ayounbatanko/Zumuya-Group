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

## Retouches de novembre 2026

1. **Bug grave corrigé** (`resto-index.html`) : l'ancienne page ouvrait automatiquement le compte restaurant dès qu'une session existait. Désormais, une session ouverte affiche seulement « Continuer vers mon espace » / « Changer de compte ». Le portail n'ouvre plus `resto-index.html` : « En savoir plus » mène aux pages de service ci-dessous.
2. **`restauration.html`** (pôle 01) : réservé à l'utilisateur connecté ; restaurants classés par distance (GPS), catalogue complet, prix de chaque repas, frais de livraison = distance × tarif/km du restaurant. Les comptes hôtels n'y figurent pas.
3. **`hotel.html`** (pôle 02) : service à part, ouvert uniquement avec un compte hôtel (commandes, chambres, accès à la gestion de l'hôtel). Création : `resto-index.html?type=hotel`.
4. **`livraison.html`** (pôle 03) : service à part, coordonné avec 01 et 02 (statistiques réseau, tableau des livraisons du restaurant/hôtel, accès livreur).
5. **Bouton « Connecté »** sur l'accueil (`app.js` + `zsession.js`) dès qu'un utilisateur est connecté (portail ou service).
6. **Visuel technologique** du hero (réseau animé des pôles).
7. **Tableau de bord propriétaire** refait (`proprietaire.*`) : menu latéral, indicateurs, graphique des commandes, supervision des restaurants/hôtels/livraisons, partenaires, pays, organisations, transactions, activité.

Nouveaux fichiers : `zsession.js`, `zservice.css`, `restauration.html`, `hotel.html`, `livraison.html`.

## Limites à connaître
- Le portail utilise Supabase Auth avec téléphone + mot de passe. Le code historique RestoGest conserve encore son stockage `rg_users` : il n’est pas possible de fusionner ces identités existantes sans migration de données et des règles RLS adaptées. Ne pas exposer l’ancien stockage en production.
- La réservation aux hôtels est appliquée côté navigateur ; une vraie protection demande les règles RLS (`resto-sql-v2_securite_rls.sql`) après migration des comptes.
- `rg_users` contient des mots de passe en clair lisibles avec la clé publique : à migrer vers Supabase Auth en priorité.

## Pôle 04 — ZUMUYA Agro (ajout)

- `agro.html`, `agro.css`, `agro.js` : espace professionnel partagé des restaurants partenaires, producteurs et commerçants agricoles.
- `zumuya-agro.sql` : tables, index et politiques RLS pour les profils géolocalisés, les catalogues de produits et les demandes d'approvisionnement.
- À exécuter dans Supabase après `sql-portail.sql`.
- À la création du compte portail, choisissez le type de compte : restaurant partenaire, producteur agricole, commerçant agricole, client, hôtel ou livreur. L’identifiant de connexion est un numéro de téléphone international (indicatif pays + numéro) et un mot de passe, sans e-mail obligatoire. Après connexion, le navigateur ouvre automatiquement l'espace ZUMUYA Agro.
- Le profil professionnel ne peut pas être enregistré sans position GPS. Les produits sont classés par distance chez les restaurants ; ces derniers peuvent envoyer des demandes d'approvisionnement aux fournisseurs.
- Les comptes déjà existants sans `account_type` doivent être recréés avec le bon type ou leur métadonnée `account_type` doit être renseignée dans Supabase Auth.

## Connexion par téléphone (mise à jour)

- Le formulaire de compte utilise un sélecteur d’indicatif international et un numéro de téléphone. L’adresse e-mail n’est pas demandée.
- Création : Supabase Auth `signUp({ phone, password, options: { data } })`. Connexion : `signInWithPassword({ phone, password })`.
- La confirmation SMS doit être activée dans Supabase Authentication et un fournisseur SMS doit être configuré. Le code de récupération du mot de passe passe également par SMS OTP.
- Le mot de passe doit contenir au moins 8 caractères. Le compte conserve son type dans `user_metadata.account_type`, utilisé pour ouvrir le bon espace.
- Les comptes historiques de RestoGest (`rg_users`) ne sont pas convertis automatiquement : une migration contrôlée vers Supabase Auth est indispensable pour obtenir une identité réellement unique sans perdre les historiques.


## Correctifs interface publique et comptes (novembre 2026)
- La page d'accueil affiche maintenant un catalogue public des restaurants, des plats, des descriptions et des prix. Les frais affichés sont estimés par distance × tarif kilométrique défini dans le profil restaurant.
- La localisation du visiteur est facultative pour consulter les catalogues, mais nécessaire pour estimer les frais de livraison.
- L'inscription client reste basée sur téléphone international + mot de passe, sans champ e-mail. Pour une connexion immédiate sans OTP, désactiver la confirmation téléphonique obligatoire dans Supabase Auth > Providers > Phone.
- Les espaces professionnels sont routés selon `account_type` ; les demandes d'adhésion avec statut en attente ne sont plus présentées dans le tableau de bord du compte.
- ZUMUYA Agro permet maintenant d'ajouter une photo à chaque produit. Le script `zumuya-agro.sql` ajoute la colonne `image_url` et le bucket public `agro-products` avec règles d'accès.

## À exécuter dans Supabase
1. Exécuter `sql-portail.sql` si ce n'est pas déjà fait.
2. Exécuter `zumuya-agro.sql` mis à jour pour les photos et droits de lecture des produits.
3. Vérifier `config.js` (URL et clé anon Supabase).
4. Dans Supabase Auth, désactiver l'exigence de confirmation téléphonique si l'inscription doit donner immédiatement une session sans SMS.

Note : l'accès aux données et l'activation réelle dépendent de la configuration Supabase et des politiques RLS du projet. Les données RestoGest historiques dans `rg_rests` restent dans leur schéma actuel ; cette livraison n'effectue pas une migration de comptes locaux RestoGest vers les UUID Supabase.
