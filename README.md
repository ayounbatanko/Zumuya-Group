# ZUMUYA GROUP

Plateforme multi-pôles (restaurant, hôtel, marketplace, agro-producteur, commerçant, livraison, propriétaire) avec authentification Supabase, tableaux de bord professionnels, journal d’actions, gestion de groupe et exports téléchargeables.

## Démarrage rapide

1. **Supabase**  
   - Projet déjà référencé dans `config.js` : `https://azfunhfjmybekzakhtbu.supabase.co`  
   - Dans le SQL Editor, exécuter dans l’ordre (ou le script consolidé si fourni) :
     - `00_setup_complet_SUPABASE.sql` / `supabase-setup.sql`
     - les migrations `04_` → `20_`
     - `z_hospitality_native.sql`
     - `19_pilotage_rapports_exports_equipe_proprietaire.sql`
     - `20_harmonisation_droits_rapports_journal.sql`
   - Déployer les Edge Functions :
     ```bash
     supabase link --project-ref azfunhfjmybekzakhtbu
     supabase functions deploy z-hospitality-team
     supabase functions deploy platform-team-admin
     ```

2. **Front**  
   - Héberger le contenu de ce dépôt (GitHub Pages, Netlify, Vercel, ou serveur statique).  
   - `config.js` contient uniquement l’URL et la clé **anon / publishable**. Ne jamais y mettre `service_role`.

3. **Comptes**  
   - Client / restaurant / hôtel / marketplace / agro / commerçant / société de livraison : inscription via `compte.html`.  
   - Employés & livreurs d’un établissement : créés depuis l’espace restaurant/hôtel (Gestion de groupe).  
   - Comptes secondaires du propriétaire ZUMUYA : créés depuis `proprietaire.html` → Gestion du groupe.

## Fonctionnalités principales

### Tous les pôles professionnels
- Tableau de bord structuré avec KPI et graphiques d’historique.
- Historique d’activité filtrable par période et **téléchargeable** (CSV / JSON selon le pôle).
- Messagerie, portefeuille / commissions, catalogues publics selon le rôle.

### Restaurant & Hôtel
- Caisse, commandes, menu / chambres, stocks, livreurs, KDS.
- **Gestion de groupe** : création de membres (employés, livreurs), permissions par rubrique, suspension / réactivation.
- **Journal d’actions** : consultation filtrée + export CSV.
- Rapports de ventes et enregistrements métier exportables.

### Compte propriétaire ZUMUYA GROUP
- Vue consolidée (organisations, établissements, transactions, abonnements).
- Graphiques d’activité et indicateurs de supervision.
- Gestion des comptes secondaires avec droits limités.
- Export JSON complet de l’infrastructure sur une période choisie.
- Pilotage des partenaires, pays, portefeuille et commissions.

### Sécurité
- Supabase Auth + RLS.
- Actions sensibles (création de comptes équipe) via Edge Functions.
- Interface protégée par `zguard.js` (la vraie sécurité reste côté base).

## Structure utile

| Fichier / dossier | Rôle |
|-------------------|------|
| `index.html` | Portail d’entrée |
| `compte.html` | Inscription / connexion multi-rôles |
| `zrestaurant-restaurant.html` | Espace restaurant / hôtel (staff) |
| `hospitality.js` + `z_hospitality_native.sql` | Équipes, journal, records |
| `proprietaire.html` + `proprietaire.js` | Espace propriétaire |
| `19_pilotage_…sql` | Journal transversal + équipe propriétaire + export |
| `supabase/functions/` | Edge Functions équipe |

## Notes

- Ancien projet « RestoGest » / localStorage : entièrement remplacé. Toutes les données métier passent par Supabase.
- Les clés `service_role` restent exclusivement dans le tableau de bord Supabase / secrets des fonctions.
- Pour un nouveau projet Supabase, mettre à jour `config.js` puis rejouer le SQL et redéployer les fonctions.

