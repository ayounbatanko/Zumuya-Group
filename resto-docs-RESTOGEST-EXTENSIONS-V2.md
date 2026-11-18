# Service de Restauration v2.0.0 — Extensions

Le projet d'origine est conservé tel quel. Les nouvelles fonctions sont dans les fichiers `resto-ext-*.js` et se chargent via **une seule ligne** (`resto-ext-loader.js`, déjà ajoutée aux pages client, restaurant, livreur et propriétaire).

## Installation rapide
1. La clé anonyme est déjà renseignée dans `resto-ext-loader.js` (identique à `resto-db.js`) ; vérifiez-la si vous changez de projet Supabase.
2. Téléversez tous les fichiers à la racine du dépôt GitHub (structure plate, sans dossier), puis publiez `resto-version.json`.
3. Supabase > SQL Editor : exécutez `resto-sql-v1_realtime_index.sql` (sans risque).

## Modules (activables dans `resto-ext-loader.js` > `ON`)
| Module | Fichier | Fonction | Où |
|---|---|---|---|
| Avis & notes | `resto-ext-reviews.js` | Le client note ses commandes livrées (bouton ⭐) | Client |
| Codes promo & fidélité | `resto-ext-promo.js` | Création des codes (🎟️), points de fidélité | Restaurant |
| Attribution livreur | `resto-ext-dispatch.js` | Course proposée au livreur libre le plus proche, délai 90 s, accepter/refuser | Restaurant + Livreur |
| Suivi en direct | `resto-ext-tracking.js` | Carte Leaflet, itinéraire et ETA via OSRM | Client |
| Écran cuisine | `resto-ext-kds.js` | Colonnes Nouvelles / En préparation / Prêtes | Restaurant |
| Stock | `resto-ext-stock.js` | Décrémentation automatique à la livraison (`stock` sur le plat) | Restaurant |
| Notes de chambre | `resto-ext-room-billing.js` | Cumul par chambre, marquer « réglée », export CSV | Hôtel |
| Statistiques | `resto-ext-stats.js` | Heures de pointe, top plats, CA par jour, export CSV | Propriétaire / Restaurant |
| Mode sombre + hors-ligne | `resto-ext-theme.js` | Bascule 🌙, bandeau hors-ligne | Toutes |
| Realtime | `resto-ext-realtime.js` | Mise à jour instantanée (mettre `realtime:1`) | Toutes |
| Push | `resto-ext-push.js` + `resto-fn-push-notify.ts (à coller dans Supabase > Edge Functions > push-notify)` | Notifications application fermée | Toutes |
| Auth | `resto-ext-auth-bridge.js` + `resto-sql-v2_securite_rls.sql` | Vrai hachage des mots de passe + RLS | Toutes |

## Activer le Realtime
Exécuter `resto-sql-v1_realtime_index.sql`, puis `realtime:1` dans `resto-ext-loader.js`.

## Activer les notifications push
1. Générer des clés : `npx web-push generate-vapid-keys`.
2. Clé publique dans `RGX_VAPID` (`resto-ext-loader.js`) ; `push:1`.
3. `supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:vous@exemple.com`
4. `supabase functions deploy push-notify`

## Sécurité (important)
`resto-sql-v2_securite_rls.sql` remplace les politiques ouvertes par de vraies règles, mais **casse l'application actuelle si on l'exécute avant la migration des comptes vers Supabase Auth**. Ordre : (1) migrer les comptes (voir commentaire en bas du script), (2) brancher `resto-ext-auth-bridge.js` dans la page de connexion, (3) exécuter le script. Testez d'abord sur un projet Supabase de copie.

## Limites connues (à lire)
- Ces extensions n'ont **pas pu être testées sur un vrai appareil ni avec votre base Supabase** : elles s'appuient sur la structure des données déduite de votre code (`orders`, `rests`, `users`). Les noms de champs du restaurant (`ownerId`, `menu`/`dishes`, `lat`/`lng`) et du livreur (`restId`) peuvent demander un ajustement.
- **Codes promo** : l'API (`RGX.applyPromo`, `RGX.consumePromo`, `RGX.loyalty`) est prête, mais le champ « code promo » dans le panier du client doit être branché dans `resto-client.html` (appeler `applyPromo` avant `D.save` et retrancher `discount` du total).
- **Stock** : `RGX.isSoldOut(plat)` est fourni ; masquer le bouton « Ajouter » des plats épuisés demande une petite modification dans `resto-client.html`.
- Le **mode sombre** utilise une inversion de couleurs CSS (rapide, mais approximatif).
- L'APK `GMR_Restaurant.apk` n'est pas régénéré : il charge le site, donc il bénéficie des mises à jour web.
