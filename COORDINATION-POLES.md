# Coordination des pôles 01 Restauration · 02 Hôtel · 03 Livraison

**Principe : une seule commande (`rg_orders`), trois façons de la remettre.** Le pôle 01 prépare ; les pôles 02 et 03 sont des modes de remise.

| Mode (`deliveryMode` / `serviceType`) | Parcours | Pôle |
|---|---|---|
| Sur place / À emporter | en attente → acceptée → préparée → terminée | 01 |
| Chambre (`room`) | … → préparée → **remise en chambre** (écran cuisine ou Notes de chambre) → terminée ; montant cumulé sur la note de la chambre, puis « réglée » | 02 |
| Livraison | … → préparée → offre au livreur libre le plus proche (90 s, puis suivant) → en route (suivi carte) → terminée | 03 |

Statuts : `en attente < acceptée < préparée < en route < terminée` (+ `annulée`, `refusée`). Le statut ne peut plus reculer.

## Qui fait quoi
- **Restaurant / cuisine** : accepte, prépare. Ne choisit plus le livreur (sauf attribution manuelle existante).
- **Serveur / réception (pôle 02)** : remet en chambre, règle la note (`rg_room_folios`).
- **Livreur (pôle 03)** : accepte ou refuse l'offre, publie sa position.
- **Serveur Supabase** : attribue les courses (`rg_dispatch_tick`, déclencheur à chaque commande acceptée + pg_cron toutes les 15 s) — même appli fermée.

## Corrections apportées
1. **Écrasements** : `rg_orders_guard` fusionne les écritures (une copie périmée n'efface plus `driverId`, `driverPos`, `settled`) et empêche le recul des statuts. L'acceptation d'une course est atomique (`rg_driver_accept`) : un seul livreur la prend.
2. **Attribution côté serveur** au lieu du navigateur du restaurant. Si `supabase-setup.sql` n'est pas installé, l'ancien mécanisme sert de repli. Correction aussi d'un blocage : quand tous les livreurs avaient refusé, la course n'était plus jamais reproposée.
3. **Hôtel** : l'étape « remise en chambre » existe (aucun livreur n'est sollicité pour une commande en chambre) ; vue SQL `rg_room_folios`.
4. **Un seul projet Supabase** : `config.js` sert au portail et au Service de Restauration (`zrestaurant-db.js`, extensions, realtime).
5. **Realtime activé** (`realtime:1`), le polling reste en secours.

## Limites restantes (à traiter ensuite)
- Les politiques d'accès restent ouvertes (clé anon), comme avant : `zrestaurant-sql-v2_securite_rls.sql` ne doit être lancé qu'après migration des comptes vers Supabase Auth.
- Les comptes et données de l'ancien projet `azfun…` ne sont pas migrés automatiquement.
- Les restaurants ne sont pas encore reliés aux organisations du portail (`rg_organizations`).
- Pas de rôle « réception » dédié : les notes de chambre sont gérées depuis le compte de l'hôtel.
