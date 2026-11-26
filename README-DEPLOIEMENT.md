# Déploiement ZUMUYA GROUP

Suivez `INSTALLATION_ZUMUYA_GROUP.md` pour l’ordre exact des migrations et le déploiement des Edge Functions.

1. Publier le contenu de ce dossier à la racine du dépôt GitHub Pages.
2. Vérifier `config.js` : URL Supabase et clé publique uniquement.
3. Appliquer le socle SQL et les migrations métier selon le guide.
4. Appliquer `z_hospitality_native.sql`, puis `19_pilotage_rapports_exports_equipe_proprietaire.sql`.
5. Déployer `z-hospitality-team` et `platform-team-admin` avec Supabase CLI.
6. Configurer Authentication → URL Configuration avec le domaine GitHub Pages.
7. Tester chaque catégorie de compte et les permissions avant ouverture au public.

La clé `service_role` ne doit jamais apparaître dans GitHub ni dans un fichier JavaScript du navigateur.
