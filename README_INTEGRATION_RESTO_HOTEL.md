# Intégration Pôles Restaurant & Hôtel dans Zumuya Group

**Projet de base :** Zumuya Group (correctif boutique automatique)  
**Source des fonctionnalités :** mise à jour pôle (Restogest) — uniquement Restaurant + Hôtel

## Ce qui a été ajouté / mis à jour

### Pôle Restaurant
- Pages d’entrée : `restauration.html`, `resto-index.html`, `resto-card.html`
- Moteur : `resto-db.js`, extensions (`resto-ext-*.js`), chat, charts, notifs, QR, rapports
- Dashboard restaurant : `resto-restaurant.html` **conservé depuis Zumuya** (portefeuille + UI récents)
- Client / livreur / owner : versions Zumuya conservées

### Pôle Hôtel
- `hotel.html` — espace réservé aux comptes hôtel
- Service en chambre + **notes de chambre** (`resto-ext-room-billing.js`)
- Onglet Hôtel dans `resto-restaurant.html` (déjà présent dans Zumuya)
- `resto-portal-bridge.js` mis à jour pour bien lier un compte au pôle restaurant/hôtel

### SQL à exécuter sur Supabase (dans l’ordre)
1. `14_activation_immediate.sql`
2. `15_activation_auto_poles_et_durcissement.sql`
3. `16_ecosysteme_poles_interconnectes.sql` — active les pôles restaurant & hôtel dans le catalogue
4. `17_livraison_zones_offres_messagerie.sql` — zones / offres liées aux commandes

## Ce qui n’a PAS été écrasé
- Correctifs boutique automatique Zumuya
- `compte.html` / `compte.js` / `compte.css` Zumuya
- `resto-restaurant.html`, `resto-driver.html`, `resto-client.html`, `resto-owner.html` (versions Zumuya plus récentes)
- Marketplace, agro, etc.

## Test rapide
1. Déployer les fichiers
2. Lancer les 4 scripts SQL
3. Compte type **restaurant** → `resto-restaurant.html`
4. Compte type **hotel** → `hotel.html` puis espace hôtel (service chambre + notes de chambre)
