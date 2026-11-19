# Version 2.4.0 — Restauration · Hôtel · Livraison

## 1. Fonctions RestoGest : où les trouver dans Zumuya
| RestoGest | Zumuya |
|---|---|
| Tableau de bord (CA, 7 jours, meilleurs plats) | `resto-restaurant.html` › Tableau de bord |
| Caisse hors connexion + ticket imprimé | › Caisse |
| Historique des ventes + réimpression | › Historique des ventes |
| Commandes : accepter, refuser, préparer, livreur | › Commandes en ligne (revu, voir §2) |
| Menu : plats, description, plusieurs photos | › Menu |
| Livreurs | › Gestion des livreurs (revu, voir §2) |
| Réglages : logo, adresse, GPS, devise, paiements | › Paramètres et réglages (+ tarif au km) |
| Carte de visite + QR code | Réglages › `resto-card.html` |
| Essai gratuit / option Pro | › Abonnement Pro (+ formulaire de paiement) |
| Client : restaurants proches, panier, suivi, annulation, reçu PDF | `resto-client.html` et `restauration.html` |
| Livreur : tâches, étapes, position GPS | `resto-driver.html` |
| Propriétaire : abonnements | `resto-owner.html` |
| Langues FR / EN / ES / AR, mode hors ligne, notifications | Toutes les pages `resto-*` |

## 2. Coordination avec l'hôtel et la livraison (corrigée)
- **Commande en chambre** : bouton « 🛎️ Remis en chambre ✓ » dans l'onglet Commandes ; plus de choix de livreur. Avant, elle ne pouvait se terminer que par l'écran cuisine.
- **Commande à livrer** : état de l'attribution visible (offre en cours, livreur, recherche) ; attribution manuelle conservée.
- **Livreurs** : l'ancien formulaire « créer un compte livreur » (mot de passe local) ne permettait plus de se connecter. Remplacé par la liste des livreurs (dédiés / réseau) avec Rattacher / Détacher.
- **Page livreur** : lieu de récupération (restaurant, adresse, téléphone, itinéraire) et devise du restaurant de la commande.
- **Client** : suivi en 4 étapes pour une commande en chambre.
- **Ventes** : une seule vente par commande ; source « chambre » pour le service en chambre.
- **hotel.html / livraison.html** : accès direct à l'onglet utile ; nouveaux compteurs « À remettre en chambre » et « En attente de livreur ».

## 3. Retiré (inutile au fonctionnement)
- Modules non branchés ou désactivés : promotions, avis, stock, statistiques (doublon du tableau de bord), mode sombre par inversion de couleurs, notifications push (+ fonction Edge), ancien pont d'authentification.
- `resto-sql-v2_securite_rls.sql` : cassait l'application si lancé avant la migration des comptes.
- Ancien mot de passe local et « réponse secrète » (la connexion se fait uniquement sur `compte.html`).
- 3 captures d'écran PNG et 2 anciens guides de publication.
- Modules conservés : attribution des courses, suivi en direct, écran cuisine, notes de chambre, temps réel.

## 4. À savoir
- Le cache hors ligne passe en `zumuya-v5` : les appareils se mettent à jour au prochain chargement.
- Non modifiés : agro, espace client, comptes, tableau de bord propriétaire du portail.
- Testé : syntaxe de toutes les pages modifiées et logique des vues (commandes, livreurs, suivi, ventes) sur données fictives. Non testé : sur appareil réel et avec votre base Supabase.
