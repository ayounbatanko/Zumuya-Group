> **Version GitHub corrigée (20/11/2026)** : le type de compte est désormais demandé uniquement à l’inscription, la revalidation du mot de passe accepte l’identifiant e-mail ou téléphone déjà associé au compte, et le Service Worker précharge les ressources du dépôt avec un cache versionné. Voir `README_FIX_2026-11-20.txt` avant publication.

# ZUMUYA GROUP — Plateforme web organisée

Écosystème numérique multiservices né au Niger, pensé pour l’Afrique de l’Ouest.  
**Un compte = une catégorie = un tableau de bord dédié.**

---

## Démarrage rapide

1. Tous les fichiers sont à la racine (compatible GitHub Pages : branche `main`, dossier `/`).
2. Ouvrir `index.html`.
3. Configurer Supabase dans `config.js` (URL + clé **anon** uniquement).
4. Dans le SQL Editor Supabase, exécuter **dans l’ordre** :
   - `sql-portail.sql`
   - `supabase-setup.sql` (activer `pg_cron` si demandé)
   - `ZUMUYA_EXTENSION_ESSAI.sql`
   - `07_portefeuilles_commissions.sql`
   - `08_messagerie_acteurs.sql`
5. Créer un compte sur `compte.html`, puis (optionnel) devenir propriétaire en décommentant la dernière requête de `sql-portail.sql` avec votre e-mail.

> Ne jamais committer de clé `service_role`.

---

## Catégories de compte et espaces

| Catégorie | Code | Espace | Fichiers principaux |
|-----------|------|--------|---------------------|
| Client | `customer` | Espace client + commandes | `client-espace.html`, `resto-client.html` |
| Restaurant | `restaurant` | Tableau de bord restaurant | `resto-restaurant.html` |
| Hôtel | `hotel` | Restaurant + service chambre | `resto-restaurant.html`, `hotel.html` |
| Livreur | `delivery` | Courses et GPS | `resto-driver.html` |
| Producteur agricole | `agro_producer` | Catalogue & demandes | `agro.html` |
| Commerçant agricole | `agro_trader` | Achat / revente | `agro.html` |
| Propriétaire plateforme | (rôle serveur) | Supervision globale | `proprietaire.html`, `resto-owner.html` |

La redirection est gérée par `zguard.js` : une catégorie qui ouvre la page d’une autre est renvoyée vers la sienne.

Voir **FEATURES.md** pour le détail complet des fonctionnalités par rôle.

---

## Architecture fonctionnelle

```
index.html                  → Accueil public + catalogues
compte.html                 → Authentification + choix de catégorie
client-espace.html          → Hub client (profil, adresses, favoris)
resto-client.html           → Commande & suivi client
resto-restaurant.html       → Dashboard restaurant / hôtel
resto-driver.html           → Espace livreur
agro.html                   → Espace producteur / commerçant agro
proprietaire.html           → Back-office propriétaire
parametres.html             → Paramètres communs
```

### Portefeuilles et messagerie

- `wallet.js` affiche le portefeuille dans les espaces client, agro, restaurant/hôtel et livreur.
- `07_portefeuilles_commissions.sql` crée les soldes, le grand livre, les moyens de retrait et le taux de commission propriétaire (5 % par défaut, réglable de 0 à 30 %).
- Le partage des fonds après vente doit être appelé exclusivement depuis un webhook/Edge Function après vérification du paiement (`rg_wallet_settle_sale`). Le dépôt Mobile Money/carte et le paiement effectif des retraits nécessitent les identifiants et webhooks d'un prestataire ; l'interface ne crédite donc pas artificiellement un compte.
- `messagerie.html` / `messagerie.js` offrent des conversations privées entre acteurs. `08_messagerie_acteurs.sql` installe les tables et les politiques RLS.

## Modules partagés

- `zsession.js` — session et données publiques
- `zguard.js` — contrôle d’accès par catégorie
- `zcart.js` + `zcart.css` — panier (un seul restaurant à la fois)
- `catalogue.js` — catalogue public
- `resto-portal-bridge.js` — lien entre Auth Supabase et tables métier
- `config.js` — configuration Supabase unique

---

## Coordination Restauration · Hôtel · Livraison

Une seule table de commandes (`rg_orders`), trois modes de remise :

| Mode | Pôle | Description |
|------|------|-------------|
| Sur place / à emporter | 01 | Remise au comptoir |
| Chambre | 02 | Service en chambre (hôtels) |
| Livraison | 03 | Attribution automatique au livreur libre le plus proche (serveur) |

**Statuts** (sans retour en arrière) :  
`en attente` → `acceptée` → `préparée` → `en route` → `terminée`  
(+ `annulée`, `refusée`)

---

## Panier & catalogue (accueil)

1. Les catalogues sont visibles par tous.
2. L’ajout au panier est réservé aux comptes **Client** connectés.
3. Un panier = un seul restaurant. Ajouter un plat d’un autre restaurant propose de vider le panier.
4. « Passer la commande » ouvre `resto-client.html` avec le panier repris.
5. Suivi des commandes en temps réel + carte pendant la livraison.

---

## Sécurité (points d’attention)

- Les politiques RLS des tables `rg_*` restent encore trop ouvertes (clé anon) dans certaines versions.
- `rg_users` peut contenir des mots de passe en clair dans d’anciennes versions → **migrer entièrement vers Supabase Auth**.
- Les comptes du portail (Supabase Auth) et les données métier (`rg_users`, `rg_rests`, `rg_orders`) sont reliés par `resto-portal-bridge.js`.
- `agro.js` utilise les tables `rg_agro_*` : s’assurer que le schéma SQL correspond.

**Priorité absolue :** restreindre les RLS et n’utiliser que Supabase Auth pour l’authentification.

---

## Fichiers SQL fournis

| Fichier | Rôle |
|---------|------|
| `sql-portail.sql` | Schéma portail + fonction propriétaire |
| `supabase-setup.sql` | Setup service restauration |
| `ZUMUYA_EXTENSION_ESSAI.sql` | Profils / adresses / favoris clients + agro |
| `04_auth_phone_email_profile.sql` | Référence auth |
| `05_suppression_compte.sql` | Référence suppression de compte |

---

## Roadmap d’organisation (recommandée)

1. **Sécurité** — RLS strictes + Auth pure
2. **Stabilisation** — Client / Restaurant / Hôtel / Livreur
3. **Agro** — Alignement tables + parcours producteur/commerçant complets
4. **Catalogue unifié** — Restaurants + produits agricoles + futurs commerces
5. **Paiements mobiles** — Orange Money, Moov, Wave…
6. **Analytics propriétaire** — Tableaux de bord consolidés

---

## Licence & usage

Code fourni pour déploiement et évolution de la plateforme ZUMUYA GROUP.  
Adapter `config.js` à votre projet Supabase avant mise en production.

© ZUMUYA GROUP — L’Afrique de l’Ouest en réseau.
