# Guide Supabase — ZUMUYA GROUP

## Fichier principal

**`00_RESET_ET_SCHEMA_COMPLET.sql`** — script unique qui :

1. Propose une **réinitialisation** (section 0, commentée par défaut)
2. Crée tout le schéma organisé :
   - Portail (pays, propriétaires, organisations, demandes partenaires)
   - Client (profils, adresses, favoris)
   - Agro (profils, produits, demandes, groupes de coopération)
   - Restauration / Hôtel / Livraison (tables JSONB + dispatch livreur)
3. Active les **RLS** et les grants
4. Configure le **cron** de dispatch (si `pg_cron` est disponible)

Les anciens scripts (`sql-portail.sql`, `supabase-setup.sql`, `ZUMUYA_EXTENSION_ESSAI.sql`) restent dans le dépôt pour référence, mais le script maître les remplace.

---

## Procédure recommandée

### A. Projet Supabase neuf

1. Ouvrez **SQL Editor**
2. Collez et exécutez **`00_RESET_ET_SCHEMA_COMPLET.sql`** en entier (section 0 reste commentée)
3. Activez l’extension **pg_cron** (Database → Extensions) si le message l’indique, puis relancez la partie cron si besoin
4. Dans Authentication → Providers, activez **Email**
5. Créez un compte sur `compte.html`
6. Créez votre compte sur `compte.html`, confirmez l’e-mail, puis exécutez dans le SQL Editor le bloc propriétaire (section 6 du script) avec **votre** e-mail — sans le committer dans Git.

### B. Réinitialiser un projet déjà configuré

1. **Sauvegardez** si nécessaire (données perdues sur les tables `rg_*`)
2. Dans `00_RESET_ET_SCHEMA_COMPLET.sql`, **décommentez** toute la section `0. RÉINITIALISATION` (le bloc `DO $$ ... $$;`)
3. Exécutez le fichier complet
4. Recréez le compte propriétaire comme ci-dessus

> Les utilisateurs dans `auth.users` ne sont **pas** supprimés. Seules les tables métier ZUMUYA le sont.

---

## config.js

```js
window.ZUMAYA_CONFIG = {
  SUPABASE_URL: 'https://VOTRE-PROJET.supabase.co',
  SUPABASE_ANON_KEY: 'votre-clé-anon'
};
```

Ne mettez **jamais** la clé `service_role` dans le front.

---

## Tables créées (résumé)

| Domaine | Tables |
|---------|--------|
| Portail | `rg_countries`, `rg_platform_owners`, `rg_profiles`, `rg_organizations`, `rg_establishments`, `rg_service_records`, `rg_payment_transactions`, `rg_partner_applications` |
| Client | `rg_customer_profiles`, `rg_customer_addresses`, `rg_customer_favorites` |
| Agro | `rg_agro_profiles`, `rg_agro_products`, `rg_agro_requests`, `rg_agro_groups`, `rg_agro_group_members`, `rg_agro_group_offers`, `rg_agro_group_messages`, `rg_agro_group_orders`, `rg_agro_group_order_members` |
| Resto / Livraison | `rg_users`, `rg_rests`, `rg_orders`, `rg_chats` (+ vue `rg_room_folios`) |

---

## Sécurité

- Portail, client et agro : RLS basées sur `auth.uid()` et rôle propriétaire.
- Tables `rg_users` / `rg_rests` / `rg_orders` / `rg_chats` : policies ouvertes pour compatibilité avec le front actuel (JSONB). À restreindre progressivement.
- Fonctions sensibles (`rg_dispatch_*`) en `SECURITY DEFINER`.

---

## Après le script

1. Vérifier Authentication → URL de redirection (votre domaine + `compte.html`)
2. Tester inscription Client + Restaurant + Agro
3. Désigner le propriétaire
4. Ouvrir `proprietaire.html` et valider les partenaires si besoin
