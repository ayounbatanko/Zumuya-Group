# ZUMUYA GRM — Extension Gestion Restaurant & Hôtel

Cette extension ajoute (sans remplacer le système existant) une interface de gestion : stocks/inventaire et mouvements, fiches recettes, fournisseurs, dépenses, tables, réservations, employés, rapports, chambres et charges chambre pour les établissements hôtel.

## Contenu
- `grm-zumuya.html` / `grm-zumuya.js`: interface web de l'extension
- `grm-zumuya-migration.sql`: migration Supabase additive, tables et politiques RLS
- `zrestaurant-restaurant.html`: intégration d'un lien d'accès flottant à GRM

## Mise en place
1. Faites une sauvegarde du projet et de Supabase.
2. Dans Supabase SQL Editor, exécutez `grm-zumuya-migration.sql` (ne lancez pas le script RESET pour cette extension).
3. Vérifiez `config.js`: `SUPABASE_URL` et `SUPABASE_ANON_KEY` doivent être renseignés avec la clé publique ANON, jamais une service-role key.
4. Déployez les fichiers ensemble sur le même hébergement que les autres fichiers du projet.
5. Ouvrez `grm-zumuya.html`, créez/connectez un compte et créez votre établissement. Si la confirmation email est activée, confirmez d'abord votre adresse.
6. Pour un restaurant hôtel, sélectionnez le type Hôtel lors de la création afin d'activer les chambres et folios.

## Sécurité / limitations à vérifier
- Toutes les tables GRM activent RLS et sont scoped à l'organisation via la table `grm_members`.
- L'accès est réservé aux comptes authentifiés membres d'un établissement; fonctions helper utilisent `SECURITY DEFINER` et un `search_path` explicite.
- La politique manager est en place pour la gestion des membres. Vérifiez et testez les politiques dans votre environnement Supabase avant la mise en production.
- Cette première extension enregistre les stocks, dépenses, réservations et charges de chambre. Elle ne remplace pas encore automatiquement la caisse, ne déduit pas les ingrédients à partir des recettes, ne fait pas de rapprochement comptable et n'intègre pas les charges de chambre au PMS de l'hôtel. Ces intégrations nécessitent une adaptation au schéma de caisse et aux identifiants client/chambre existants.
- Ne jamais exposer la clé Supabase `service_role` dans les fichiers client.
- Effectuez des tests avec deux comptes et deux établissements pour vérifier l'isolation des données avant ouverture aux utilisateurs.
