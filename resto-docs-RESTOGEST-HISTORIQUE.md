# Service de Restauration — mise à jour GitHub Pages

Cette archive est conçue pour remplacer les fichiers publiés dans le dépôt GitHub Pages existant. Aucun serveur Node.js n'est requis.

## Publication
1. Décompressez l'archive.
2. Dans GitHub, ouvrez le dépôt `Application-du-restaurant-`.
3. Remplacez les fichiers du dépôt par **tout le contenu** de ce dossier (pas le dossier parent).
4. Faites `Commit changes` sur la branche utilisée par GitHub Pages.
5. Attendez 1 à 3 minutes, puis ouvrez l'adresse du site ZUMUYA GROUP (l'ancien site RestoGest est désormais une simple redirection)
6. Sur Android/Chrome, rechargez le site. Si l'ancienne version reste affichée, effacez les données du site ou rechargez après quelques instants.

## Compte propriétaire
Le compte dont le nom de profil est exactement `Ayouba Tanko` (sans distinction majuscules/minuscules) est dirigé vers le tableau de bord propriétaire à la connexion, même s'il a le rôle partenaire `restaurant`. Le bouton public de première création propriétaire est retiré. Les nouvelles inscriptions ne peuvent pas utiliser ce nom réservé.

**Limite de sécurité à connaître :** cette règle est une protection côté interface uniquement. GitHub Pages est un hébergement statique ; le code et les données `localStorage` sont accessibles depuis le navigateur. Une personne techniquement déterminée peut contourner une vérification JavaScript. Pour une protection réelle des données et du tableau de bord, il faudra connecter Supabase (Auth + règles RLS) ou un backend. Ne stockez pas de données sensibles dans cette version.

## Récupération du mot de passe
Les nouveaux comptes enregistrent une empreinte SHA-256 de leur réponse à la question « Quelle est votre nom ? ». La réponse peut être configurée/modifiée dans chaque espace, rubrique « Récupération du compte ». Les comptes créés avant cette mise à jour doivent se connecter une fois et enregistrer leur réponse secrète avant de pouvoir utiliser « Mot de passe oublié ? ». Le mot de passe et les autres données restent stockés localement comme dans la version précédente.

Choisissez une réponse secrète difficile à deviner : votre nom public n'est pas une bonne réponse.

## Installation et mises à jour
- Le bouton d'installation apparaît lorsque le navigateur autorise l'installation PWA. Sinon, les visiteurs peuvent utiliser le menu Chrome > « Installer l'application » ou « Ajouter à l'écran d'accueil ».
- Le propriétaire peut générer un fichier `resto-version.json` dans son tableau de bord, rubrique « Notifications & mises à jour ». Il faut ensuite téléverser ce fichier à la racine du dépôt GitHub et valider le commit.
- Les utilisateurs qui ouvrent l'application et sont en ligne vérifient la version toutes les 5 minutes et voient une bannière de mise à jour. Le bouton recharge l'application et son cache.
- Les notifications push même lorsque l'application est fermée ne sont pas possibles avec GitHub Pages seul. Il faut un service push externe (par exemple Firebase Cloud Messaging) et une configuration supplémentaire.

## Données
Comme dans le projet initial, les données sont conservées dans `localStorage` sur chaque appareil. Elles ne sont pas synchronisées entre différents téléphones. Une base distante sécurisée sera nécessaire pour une utilisation multi-appareils en production.

## Base de données partagée (Supabase)
Depuis la version 1.1.0, les comptes, restaurants et commandes sont stockés dans Supabase (tables `rg_users`, `rg_rests`, `rg_orders`) via `resto-db.js`, et partagés entre tous les téléphones. Le script SQL de création des tables est à exécuter une seule fois dans Supabase (SQL Editor).

## Mises à jour
Le bouton « 🔄 Mise à jour » (en haut de l'écran) n'apparaît que si `resto-version.json` contient `"notify": true` avec un nouveau numéro de version. Utilisez le formulaire « Notifications & mises à jour » du tableau de bord propriétaire pour générer ce fichier.

## QR code des restaurants
Chaque restaurant a un QR code (carte de visite + Réglages) qui ouvre `resto-index.html?resto=<lien-du-restaurant>` : après connexion client, le menu du restaurant s'ouvre directement.

## Version 1.5.0
- **Messagerie** : fonctionne même si la table `rg_chats` n'existe pas (messages rangés automatiquement ailleurs dans Supabase). Créer `rg_chats` (script `resto-sql-creer_rg_chats.sql`) reste facultatif.
- **Utilisateurs** : « Supprimer » est remplacé par « Désactiver » / « Réactiver le compte ». Un compte désactivé ne peut plus se connecter, mais conserve toutes ses données.
- **Moyens de paiement Pro** : désormais enregistrés dans Supabase (visibles par tous les restaurants). Le restaurant les voit dans le formulaire Pro avec un bouton « 📋 Copier ».

## Version 1.6.0
- **Application Android (APK)** : le fichier `GMR_Restaurant.apk` est à la racine du dépôt. La page d'accueil affiche « Télécharger l'application » aux visiteurs Android qui ne l'ont pas encore (masqué dans l'application installée ou après « Je l'ai déjà installée »).
- **Bouton 🔔 notifications** (toutes les pages, accueil compris) : à activer une fois par utilisateur. Notifie : message de l'administrateur, formulaire de paiement Pro reçu, abonnement Pro activé ; côté propriétaire : message d'un utilisateur, demande Pro, paiement déclaré. Limite : l'application doit être ouverte ou en arrière-plan ; une notification application fermée exige un serveur push (Firebase) non disponible avec GitHub Pages seul.
- **Frais de livraison** : le restaurant fixe son prix du kilomètre (Réglages). Le panier du client calcule distance (restaurant → client, à vol d'oiseau) × prix du km et l'ajoute au total, enregistré dans la commande et affiché au restaurant, au client et sur les reçus.

## Version 1.7.0
- Le bouton flottant 🔔 est supprimé. À la place, des pastilles rouges de compteur : sur « Support » (messages de l'administrateur non lus, pour client, restaurant et livreur) et sur « Mes commandes » (nombre d'étapes validées par le restaurant ou le livreur depuis la dernière visite, côté client). Elles disparaissent à l'ouverture de l'onglet.
- Page de connexion : bouton « 🆘 Support ». Les visiteurs sans accès envoient un message (nom, téléphone, texte) qui arrive dans l'onglet Messages du propriétaire (étiquette « Visiteur »). Ils lisent la réponse en rouvrant le Support avec le même numéro. Le propriétaire peut afficher des boutons WhatsApp / Appeler via Compte > « Contact support ».

## Version 1.8.0
- Support : l'envoi du message est confirmé par un bandeau vert en haut de la fenêtre. Si l'écriture dans `rg_chats` est refusée par Supabase (table absente, règle RLS manquante), le message est automatiquement enregistré ailleurs.
- Champs mot de passe : plus de suggestion / génération de mot de passe du clavier (champs masqués, sans remplissage automatique).
- Propriétaire > Messages > « 📢 Message à tous » : un seul message envoyé à tous, ou seulement aux clients / restaurants / livreurs. Les utilisateurs le lisent dans leur Support (pastille de compteur) ; vous pouvez le retirer.

## Aperçu Facebook / WhatsApp
L'image `resto-apercu-facebook.jpg` (1200×630) est déclarée dans les balises `og:image` de `resto-index.html`. Après publication, rafraîchir le cache sur https://developers.facebook.com/tools/debug/ (bouton « Récupérer de nouvelles informations »).


## Version 1.9.0 — Module Hôtel partenaire
- Nouvel espace « Module hôtel » dans le tableau de bord des partenaires.
- Paramétrage du nom et du type d'établissement, du responsable restauration, du nombre de chambres, des services (restaurant, service en chambre, petit-déjeuner, bar/café, banquets, à emporter), des horaires et des consignes.
- Lorsque le module hôtel est activé, les clients voient le choix du service et peuvent indiquer leur numéro de chambre. Le numéro de chambre est obligatoire pour le service en chambre.
- Les commandes reçues affichent le type de service et le numéro de chambre dans l'espace du partenaire. Les données sont enregistrées dans la fiche du restaurant/hôtel existante de Supabase, sans nouvelle table.
- Pour activer le module : ouvrir l'espace partenaire, choisir « Module hôtel », remplir les informations et enregistrer.

**Limite de cette version :** le module ajoute la configuration hôtelière et l'identification des commandes de service en chambre. Il ne crée pas encore de comptes séparés pour la réception, les étages ou la cuisine, ni de facturation automatique sur la chambre.


## Version 1.9.2 — Commandes en chambre
- Pour tout établissement ayant activé le module hôtel, le numéro de chambre est désormais obligatoire avant l'envoi d'une commande.
- Le service « Service en chambre » est sélectionné par défaut. Dès qu'un numéro de chambre est saisi, le service est automatiquement réglé sur « Service en chambre », même si le client avait choisi un autre service.
- Les commandes hôtelières restent sans frais de livraison ; le montant du panier correspond uniquement aux plats.
- La géolocalisation GPS reste facultative pour les commandes d'hôtel. Le numéro de chambre est repris comme information de destination dans la commande.


## Version 1.9.3 — comptes hôtel et livraisons
- À l'inscription professionnelle, le partenaire choisit entre « Compte pour gérer votre restaurant » et « Compte pour gérer les activités de restauration de votre hôtel ».
- Le compte hôtel active automatiquement l'onglet « Module hôtel » ; cet onglet n'est pas affiché aux comptes restaurant classiques. Les fonctions existantes du restaurant classique sont conservées.
- Depuis le portail d'un hôtel, le client choisit entre le service en chambre (bâtiment + chambre obligatoires, frais de livraison à 0) et la livraison extérieure (GPS et tarif kilométrique du restaurant requis, frais calculés comme pour les restaurants classiques).
- Les commandes en chambre transmettent au restaurant et au livreur le numéro du bâtiment et de la chambre. Les commandes extérieures transmettent l'adresse et la position GPS.
