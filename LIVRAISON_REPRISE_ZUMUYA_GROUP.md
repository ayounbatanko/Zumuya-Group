# Livraison — reprise ZUMUYA GROUP

## Ce qui est inclus dans cette archive
- Le dépôt web ZUMUYA GROUP fourni, conservé avec ses modules métiers existants.
- Le module transversal `analytics.html` et ses exports CSV / JSON par période.
- Le raccourci « Rapports & statistiques » ajouté aux espaces professionnels.
- Les migrations SQL de l'écosystème, dont `z_hospitality_native.sql` et
  `19_pilotage_rapports_exports_equipe_proprietaire.sql`.
- Les Edge Functions `z-hospitality-team` et `platform-team-admin`.
- La documentation d'installation Supabase et GitHub.

## Identité et compatibilité
ZUMUYA GROUP est le seul nom de produit présenté dans la documentation racine.
Certains fichiers `zrestaurant-*` restent volontairement présents : ils portent les
écrans et fonctions métier de restauration/hôtellerie déjà intégrés. Les supprimer
physiquement casserait des liens de navigation, scripts, données ou migrations.
Ils ne doivent pas être interprétés comme un second produit à déployer.

## Installation Supabase
L'archive ne peut pas exécuter des requêtes sur le projet Supabase distant ni déployer
des Edge Functions sans une session administrateur autorisée. Suivre
`INSTALLATION_ZUMUYA_GROUP.md` dans le Dashboard Supabase / CLI.
La migration 19 doit être exécutée après les migrations 00 à 18 et
`z_hospitality_native.sql`. Ne pas rejouer un script RESET sur une base active.

## Application Android
Le fichier APK transmis est un binaire précompilé. Les sources Android natives ne
sont pas présentes dans le dépôt fourni ; cet APK n'a donc pas été reconstruit ni
rebrandé. Le site publié par GitHub Pages et les fichiers web de cette archive
peuvent être mis à jour indépendamment, si l'APK ouvre bien cette URL.

## Vérifications avant mise en production
1. Vérifier l'URL et la clé publique de `config.js`.
2. Vérifier l'UUID du propriétaire dans `rg_platform_owners`.
3. Déployer les deux Edge Functions et contrôler leurs secrets.
4. Tester avec des comptes distincts : propriétaire, membre propriétaire,
   propriétaire restaurant/hôtel, employé, livreur, producteur, commerçant,
   Marketplace et société de livraison.
5. Vérifier l'isolation RLS entre organisations et les permissions des membres.
6. Effectuer un export CSV / JSON sur une période courte et comparer aux données.
7. Ne publier en production qu'après ces tests sur une base de préproduction.
