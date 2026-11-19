# Authentification ZUMUYA GROUP : numéro de téléphone pour tout le monde

`compte.html` : sélecteur de catégorie (client, restaurant, hôtel, livreur, producteur, commerçant, commerce, entreprise). **Toutes les catégories s'inscrivent et se connectent avec numéro de téléphone (indicatif du pays) + mot de passe.** L'option e-mail a été retirée.

## À régler dans Supabase
Authentication > Providers > **Phone** : activer. Sans fournisseur SMS, désactivez « Confirm phone » (sinon aucun code ne sera envoyé). Avec un fournisseur SMS (Twilio, etc.), la confirmation et « mot de passe oublié » (code SMS) fonctionnent.
Exécutez ensuite dans SQL Editor : `04_auth_phone_email_profile.sql` (déjà compatible téléphone) puis **`05_suppression_compte.sql`** (suppression de compte).

## Espaces selon la catégorie
- Restaurant → `resto-restaurant.html` : Abonnement Pro, Tableau de bord, Caisse, Commandes en ligne, Menu, Historique des ventes, Rapport du chiffre d'affaires, Gestion des livreurs, Support, Paramètres et réglages.
- Hôtel (ou restaurant d'hôtel) → même espace **+ Module hôtel**.
- Client → `client-espace.html` ; Livreur → `resto-driver.html` ; Producteur/commerçant → `agro.html`.

## Paramètres du compte (toutes catégories) : `parametres.html`
Profil (nom), changement de numéro (code SMS), mot de passe, notifications, déconnexion (un appareil / tous), export des données, **suppression du compte** (mot SUPPRIMER + mot de passe, fonction SQL `rg_delete_my_account`). Accessible depuis chaque espace.

## Accueil public
`index.html` affiche, sans connexion, tous les restaurants partenaires actifs et leurs catalogues (`catalogue.js`), avec distance et frais de livraison si la position est activée. « Commander » redirige vers la connexion si besoin.

## Remarque
Les anciens comptes créés avec e-mail ne peuvent plus se connecter : ils recréent un compte avec leur numéro.
