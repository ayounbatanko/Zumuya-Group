ZUMUYA GROUP — MISE À JOUR VERSION ESSAI
========================================

A. SUPABASE
-----------
1. Ouvrir le projet Supabase de ZUMUYA GROUP.
2. SQL Editor > New query.
3. Coller d'abord le script consolidé SUPABASE-INSTALLATION-COMPLETE.sql uniquement si la base n'a pas encore été installée.
4. Pour une base déjà installée avec le ZIP précédent, coller uniquement ZUMUYA_EXTENSION_ESSAI.sql et cliquer RUN.
5. Ne pas réexécuter de scripts SQL de réinitialisation sur une base ZUMUYA GROUP déjà utilisée.

Configuration Auth pour le test sans SMS :
- Supabase Dashboard > Authentication > Sign In / Providers > Phone.
- Activer Phone.
- Désactiver la confirmation du téléphone / Confirm phone pour cette version d'essai.
- Ne pas demander de code SMS dans le formulaire client.
- Garder Email activé pour les comptes professionnels.
Le réglage du Dashboard est indispensable : le SQL ne peut pas désactiver une confirmation Auth.

B. FICHIERS À AJOUTER / REMPLACER À LA RACINE GITHUB
----------------------------------------------------
REMPLACER :
- compte.js
- compte.html
- agro.html

AJOUTER :
- client-espace.html
- client-espace.js
- agro-collaboration.js
- ZUMUYA_EXTENSION_ESSAI.sql (copie de sauvegarde du SQL)

Le fichier config.js existant doit être conservé : il contient déjà l'URL et la clé publique Supabase du projet. Ne jamais publier une clé service_role dans GitHub.

C. FONCTIONS AJOUTÉES
--------------------
Client : profil, carnet d'adresses, adresse par défaut, favoris restaurants / produits agricoles et accès au catalogue de commande.
Agro : profils professionnels enrichissables, collectifs, adhésion, responsable automatique, messages, offres collectives, besoins d'achat groupé et participation avec mise à jour atomique de la quantité engagée.
Auth : client téléphone + mot de passe sans étape OTP dans l'interface ; professionnels e-mail + mot de passe avec confirmation du mot de passe côté formulaire.

D. ORDRE DE DÉPLOIEMENT
----------------------
1. Sauvegarder le dépôt GitHub.
2. Exécuter le SQL complémentaire dans Supabase.
3. Remplacer / ajouter les fichiers listés à la racine du dépôt GitHub.
4. Vérifier les paramètres Phone et Email dans Supabase Auth.
5. Attendre le déploiement GitHub Pages puis tester inscription et connexion sur téléphone.

E. LIMITES À CONNAÎTRE
----------------------
- Le suivi des commandes de restauration reste dans le module natif ZUMUYA Restauration ; ce correctif ne remplace pas son moteur de commande.
- Les paiements en ligne, la vérification d'identité des vendeurs, la modération et les preuves de livraison nécessitent une phase supplémentaire avant une mise en production.
- La désactivation de la confirmation SMS est réservée à l'essai : un numéro non confirmé peut être usurpé.
