# ZUMUYA GROUP — Fonctionnalités par catégorie de compte

Document de référence de la plateforme organisée.  
Chaque compte ouvre **uniquement** son propre espace (contrôlé par `zguard.js`).

---

## 1. Client (`customer`)

**Espace principal :** `client-espace.html` + `resto-client.html`

| Fonctionnalité | Description | Statut |
|----------------|-------------|--------|
| Catalogue public | Restaurants + menus visibles sans compte | ✅ |
| Panier unique | Un seul restaurant par panier | ✅ |
| Commande | Adresse, mode de paiement, frais (distance × tarif/km) | ✅ |
| Suivi temps réel | Statuts : envoyée → acceptée → préparée → en route → livrée | ✅ |
| Carte pendant livraison | Position du livreur | ✅ |
| Adresses de livraison | Plusieurs adresses + adresse par défaut | ✅ |
| Favoris | Restaurants favoris | ✅ |
| Profil | Nom, téléphone, langue | ✅ |
| Historique & reçus | Commandes passées + PDF | ✅ |
| Messagerie | Contact restaurant / livreur | ✅ |
| Notifications | Changements de statut | ✅ |
| Catalogue Agro (futur) | Produits agricoles dans le même catalogue | 🔄 À connecter |

**Parcours type :** Accueil → Catalogue → Connexion Client → Ajout panier → Validation → Suivi.

---

## 2. Restaurant (`restaurant`)

**Espace principal :** `resto-restaurant.html`

| Fonctionnalité | Description | Statut |
|----------------|-------------|--------|
| Tableau de bord | Commandes en attente / préparation / livraison | ✅ |
| Menu | Photos, catégories, prix, disponibilité | ✅ |
| Acceptation / refus | Commandes en ligne | ✅ |
| Préparation | Passage au statut « préparée » | ✅ |
| Caisse hors-ligne | Ticket de caisse | ✅ |
| Livreurs | Création, suspension, suppression : seul le restaurant crée ses livreurs | ✅ |
| Mon équipe | Comptes employés avec rubriques autorisées + journal | ✅ |
| Approvisionnement agricole | Commandes aux producteurs / commerçants | ✅ |
| Paramètres | Logo, GPS, devise, tarif/km, paiements, horaires | ✅ |
| Carte de visite + QR | Partageable | ✅ |
| Rapports | Historique des ventes | ✅ |
| Abonnement Pro | Fonctionnalités avancées | ✅ |
| Écran cuisine (KDS) | Affichage cuisine | ✅ |
| Notifications | Nouvelles commandes | ✅ |

---

## 3. Hôtel (`hotel`)

**Espace principal :** `resto-restaurant.html` + `hotel.html`

| Fonctionnalité | Description | Statut |
|----------------|-------------|--------|
| Tout le module Restaurant | Identique | ✅ |
| Service en chambre | Commandes liées à un numéro de chambre | ✅ |
| Notes de chambre | Facturation chambre | ✅ |
| Gestion des chambres | Liste / numéros | 🔄 |

---

## 4. Livreur (`delivery`)

**Espace principal :** `resto-driver.html`

| Fonctionnalité | Description | Statut |
|----------------|-------------|--------|
| Compte | Créé uniquement par un restaurant (pas d'inscription publique) | ✅ |
| Courses proposées | Uniquement celles du restaurant rattaché | ✅ |
| Acceptation / refus | Prise en charge | ✅ |
| Étapes de livraison | Récupéré → en route → arrivé → livré | ✅ |
| GPS en direct | Position transmise | ✅ |
| Historique | Courses et gains | ✅ |
| Statut disponibilité | Disponible / Occupé / Hors service | 🔄 |

---

## 5. Producteur agricole (`agro_producer`)

**Espace principal :** `agro.html`

| Fonctionnalité | Description | Statut |
|----------------|-------------|--------|
| Profil exploitation | Nom, adresse, GPS obligatoire | ✅ |
| Catalogue produits | Nom, photo, catégorie, unité, prix, stock | ✅ |
| Disponibilité | Disponible / Limité / Indisponible | ✅ |
| Demandes reçues | Acceptation / refus | ✅ |
| Coopération | Collectifs d’achat / vente | ✅ (base) |
| Messagerie | Avec commerçants / restaurants | 🔄 |
| Livraison propre | Suivi si le producteur livre | 🔄 |

> **Note technique :** Les tables `rg_agro_*` doivent être alignées avec le schéma SQL fourni. Vérifier `ZUMUYA_EXTENSION_ESSAI.sql` et scripts SQL.

---

## 6. Commerçant agricole (`agro_trader`)

**Espace principal :** `agro.html`

| Fonctionnalité | Description | Statut |
|----------------|-------------|--------|
| Profil commerçant | Identique producteur | ✅ |
| Catalogue d’achat | Voir produits des producteurs proches | ✅ |
| Revente | Publier ses propres produits | ✅ |
| Demandes | Entrantes et sortantes | ✅ |
| Stock intermédiaire | Gestion basique | 🔄 |

---

## 7. Propriétaire de la plateforme (`platform_owner`)

**Espace principal :** `proprietaire.html` + `resto-owner.html`

| Fonctionnalité | Description | Statut |
|----------------|-------------|--------|
| Validation partenaires | Accepter / refuser les demandes | ✅ |
| Pays & déploiement | Activation par pays | ✅ |
| Organisations | Liste et vérification | ✅ |
| Abonnements | Suivi des abonnements resto | ✅ |
| Transactions | Lecture des paiements | ✅ |
| Activité métier | Derniers enregistrements | ✅ |
| Tableau de bord global | Stats consolidées | 🔄 |

**Activation propriétaire :** Après création du compte, exécuter la requête commentée dans `sql-portail.sql` avec votre e-mail.

---

## Modules transverses

| Module | Fichier(s) | Rôle |
|--------|------------|------|
| Session | `zsession.js` | Session + données publiques |
| Garde d’accès | `zguard.js` | Redirection selon catégorie |
| Panier | `zcart.js` + `zcart.css` | Panier partagé (1 restaurant) |
| Catalogue | `catalogue.js` | Affichage public des menus |
| Bridge | `resto-portal-bridge.js` | Lien Auth ↔ données service |
| Config | `config.js` | URL + clé anon Supabase |
| Auth | `compte.html` / `compte.js` | Inscription / connexion |

---

## Légende des statuts

- ✅ Implémenté et fonctionnel (sous réserve de la base Supabase)
- 🔄 Partiellement implémenté ou à finaliser
- ❌ Non encore présent

---

*Document généré pour la version organisée de la plateforme ZUMUYA GROUP.*

## ZUMUYA LIVRAISON — réseau multi-entreprises (mise à jour)
- Espace société : `livraison-entreprise.html` avec missions, indicateurs, partenariats, équipe, flotte, tarification et rapports.
- Espace partenaires : `livraison-partenaires.html` pour recevoir les demandes de collaboration et transmettre des missions aux transporteurs actifs.
- Migration additive `16_reseau_livraison_partenaire.sql` : partenariats, flotte, événements de suivi, incidents, tarifs, annuaire limité aux sociétés vérifiées et fonctions RPC avec contrôle du propriétaire.
- Les missions sont rattachées à une société de livraison uniquement après partenariat actif. Les livreurs doivent appartenir à la société qui reçoit la mission.
- Les indicateurs financiers affichent les frais enregistrés sur les missions ; ils ne déclarent pas un paiement encaissé sans confirmation du prestataire.
