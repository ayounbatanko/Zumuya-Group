# ZUMUYA GROUP — fusion des pôles Restauration / Hôtel et mise à jour des espaces

## Ce qui a été intégré

### Pôle Restauration et pôle Hôtel
- Les fichiers du paquet `9mise à jour.zip` correspondent déjà aux modules préfixés `resto-` présents dans ZUMUYA GROUP.
- Les versions ZUMUYA ont été conservées lorsqu'elles contenaient les adaptations au compte unique, à Supabase, au portail, aux équipes et à la livraison.
- Modules intégrés/conservés : espace restaurant, espace hôtel, espace client, espace propriétaire du pôle, chauffeur, cartes publiques, base de données, graphiques, rapports, QR, notifications et messagerie.
- L'APK `GMR_Restaurant.apk` du paquet 9mise est ajouté à la racine, car le module de notification du pôle le référence sous ce nom.
- Les hôtels disposent d'un catalogue public dédié (`hotels-public.html`) et le site principal garde son catalogue public multi-catégories.

### Commandes
- Tous les comptes authentifiés (client, compte universel, professionnel, restaurant, hôtel, livreur et propriétaire plateforme) peuvent commander dans les catalogues publics.
- Le panier public ne bloque plus les comptes professionnels au motif qu'ils ne sont pas des comptes Client.
- Le catalogue agricole permet aussi de valider une commande fournisseur via la fonction serveur `rg_supply_place_order`.
- L'onglet « Mes commandes » ouvre le suivi des commandes et affiche les étapes du traitement jusqu'à la livraison.
- Les liens communs vers Mes commandes, Portefeuille, Historique et Catalogues publics sont injectés dans les espaces connectés.

### Portefeuille
- Nouvelle page `portefeuille.html`, accessible à tous les comptes connectés.
- Nouvelle page `catalogues.html` qui reprend le même catalogue public multi-pôles que la page d'accueil, dans l'espace de compte.
- Le compte universel possède aussi un onglet « Mon portefeuille » distinct dans son menu.
- L'espace propriétaire conserve son onglet Portefeuille et ses fonctions de supervision.

### Historique, statistiques et rapports
- Nouvelle page `historique.html` avec période personnalisable, indicateurs, graphiques, historique détaillé, export CSV et impression/enregistrement PDF.
- Le rapport regroupe les commandes de restauration, commandes Marketplace, achats professionnels, commandes reçues, ventes en caisse, mouvements du portefeuille et journal d'équipe lorsqu'ils sont accessibles au compte.
- L'espace propriétaire conserve ses graphiques et statistiques de supervision et dispose d'un lien vers les rapports détaillés.

### Équipes et journal d'action
- Les fonctions existantes `zteam.js` et la migration SQL 11 sont conservées : création de sous-comptes par le responsable de l'organisation, permissions par module, suspension/réactivation et journal d'audit.
- Les organisations de type restaurant et hôtel utilisent le même mécanisme d'équipe et le même journal d'action.
- Les restrictions sont contrôlées par Supabase (RLS / fonctions serveur), pas seulement par les boutons de l'interface.

## Fichiers principaux modifiés ou ajoutés
- `resto-client.html` : accès aux commandes pour tout compte connecté et filtrage des commandes par compte.
- `resto-portal-bridge.js` : les comptes universels et le propriétaire plateforme peuvent accéder au parcours de commande.
- `zcart.js` : commande autorisée pour tous les comptes connectés.
- `restauration.html` : texte public mis à jour et accès aux raccourcis communs.
- `compte.html`, `dashboard.js` : portefeuille en onglet distinct, raccourcis commandes et rapports.
- `portefeuille.html` : nouvel espace portefeuille commun.
- `mes-commandes.html` : suivi unifié des commandes Restauration, Marketplace et Approvisionnement, avec étapes de traitement.
- `historique.html` : nouveau tableau de bord de rapports et exports.
- `hotels-public.html` : catalogue public des hôtels.
- `catalogues.html` : catalogue public multi-pôles réutilisé dans les comptes.
- `account-shortcuts.js` : navigation commune dans les espaces connectés.
- `GMR_Restaurant.apk` : APK du paquet 9mise.

## Déploiement GitHub
1. Décompresser l'archive à la racine du dépôt GitHub (les fichiers doivent rester au même niveau, sans créer un dossier `zumuya_work`).
2. Envoyer les fichiers modifiés et les nouveaux fichiers.
3. Garder `config.js` avec les paramètres Supabase actuels du projet.
4. Vérifier que les migrations SQL déjà présentes ont été exécutées dans le bon ordre, notamment :
   - `00_RESET_ET_SCHEMA_COMPLET.sql` uniquement pour une installation neuve ou après sauvegarde et décision explicite de réinitialiser ;
   - `07_portefeuilles_commissions.sql` pour les portefeuilles ;
   - `11_equipes_livreurs_approvisionnement.sql` pour les sous-comptes et le journal d'audit ;
   - les migrations 16 et 17 pour l'écosystème et les commandes/livraisons.
5. La création réelle de sous-comptes nécessite aussi le déploiement de l'Edge Function `team-admin` déjà prévue par le projet.

## Important
Cette archive contient les fichiers front-end et SQL, mais ne peut pas exécuter les changements dans le projet Supabase ou GitHub à votre place. Les fonctions de paiement ne sont pas activées par la seule interface : les dépôts, paiements et crédits de portefeuille restent soumis à un prestataire et à un webhook de paiement vérifié. Les exports PDF utilisent la boîte d'impression du navigateur (choisir « Enregistrer au format PDF »).
