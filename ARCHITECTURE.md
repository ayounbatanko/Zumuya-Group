# Architecture de la plateforme ZUMUYA GROUP

## Principes

1. **Un compte = une catégorie = un espace**
2. Authentification centralisée via Supabase Auth
3. Métadonnées utilisateur : `account_type`, `organization_id`, `name`…
4. Protection d’interface via `zguard.js` (la vraie sécurité = RLS Supabase)
5. Un seul projet Supabase pour portail + services métier

## Flux d’inscription / connexion

```
compte.html
   │
   ├─ Client ──────────────────► client-espace.html / resto-client.html
   ├─ Restaurant / Hôtel ──────► (compléter fiche partenaire) → resto-restaurant.html
   ├─ Livreur ─────────────────► compte créé UNIQUEMENT par un restaurant (Mon équipe) → resto-driver.html
   ├─ Employé ─────────────────► compte créé par un restaurant, droits personnalisés → resto-restaurant.html
   ├─ Producteur / Commerçant ─► agro.html
   └─ Propriétaire (rôle serveur) ► proprietaire.html
```

Les comptes professionnels doivent compléter leur fiche d’organisation (GPS obligatoire pour plusieurs catégories) avant d’accéder pleinement à leur espace.

## Tables principales (référence)

### Portail / Auth
- `auth.users` (Supabase)
- Tables de profils clients (adresses, favoris) — voir `ZUMUYA_EXTENSION_ESSAI.sql`

### Restauration (rg_*)
- `rg_users`, `rg_rests`, `rg_orders`, `rg_menu_*`, etc.
- Bridge : `resto-portal-bridge.js`

### Agro (rg_agro_* ou z_agro_*)
- `rg_agro_profiles`
- `rg_agro_products`
- `rg_agro_requests`
- Alignement à vérifier avec les scripts SQL

## Contrôle d’accès (zguard.js)

Chaque page privée déclare les rôles autorisés :

```html
<script src="zguard.js" data-roles="customer"></script>
<script src="zguard.js" data-roles="restaurant,hotel"></script>
<script src="zguard.js" data-roles="delivery"></script>
<script src="zguard.js" data-roles="agro_producer,agro_trader"></script>
<script src="zguard.js" data-roles="owner"></script>
```

## Recommandations techniques

1. Passer toutes les tables métier sous RLS strictes basées sur `auth.uid()`.
2. Supprimer toute logique de mot de passe en clair.
3. Utiliser les Edge Functions Supabase pour les actions sensibles (attribution livreur, paiements).
4. Centraliser les notifications (Realtime + push).
5. Prévoir un catalogue unifié (vue ou table) pour restaurants + agro + futurs pôles.

## Structure des fichiers clés

| Fichier | Responsabilité |
|---------|----------------|
| `config.js` | URL + clé anon |
| `compte.js` | Auth + onboarding partenaire |
| `zguard.js` | Redirection par rôle |
| `zcart.js` | Panier client |
| `catalogue.js` | Affichage public |
| `resto-*.js` | Modules restauration |
| `agro.js` | Espace agro |
| `proprietaire.js` | Back-office |


## Équipes, livreurs et approvisionnement (v16)

- `rg_team_members` : employés (`staff`) et livreurs (`driver`) rattachés à une organisation ; permissions par module ; statut actif / suspendu / désactivé.
- Création uniquement via l'Edge Function `team-admin` ; un trigger sur `auth.users` interdit l'auto-inscription `delivery` / `staff`.
- `rg_audit_log` : journal des actions sensibles (lecture : compte principal).
- `rg_supply_orders` / `rg_supply_order_items` : achats entre professionnels, séparés de `rg_orders`; fonctions `rg_supply_*`.
- Modules d'interface : `zteam.js`, `zsupply.js`.
