# Authentification ZUMUYA GROUP : client téléphone, professionnels e-mail

La page unique `compte.html` propose un sélecteur de catégorie. Le mode d'identification dépend de la catégorie choisie :

- **Client** : numéro avec indicatif international + mot de passe. À l'inscription, le mot de passe doit être saisi deux fois. Le numéro doit être confirmé par SMS si la confirmation téléphone est activée dans Supabase.
- **Restaurant, hôtel, livreur, producteur, commerçant, commerce et entreprise** : adresse e-mail + mot de passe. À l'inscription, le mot de passe doit être saisi deux fois. Supabase peut envoyer un e-mail de confirmation selon le réglage « Confirm email ».

## Configuration Supabase Auth

Dans Authentication > Providers :
1. Activez **Phone** et configurez un fournisseur SMS pour les comptes clients.
2. Activez **Email** pour les comptes professionnels.
3. Choisissez les règles de confirmation adaptées à votre exploitation. La confirmation par SMS nécessite un fournisseur SMS configuré ; la confirmation e-mail nécessite le service e-mail Supabase ou un SMTP personnalisé.

## SQL

Après le schéma principal, exécutez `04_auth_phone_email_profile.sql` dans SQL Editor. Il rend le déclencheur de profil compatible avec les comptes dont l'identifiant est un téléphone (email nul) comme avec les comptes e-mail.

## Connexion

L'utilisateur doit choisir sa catégorie sur l'écran de connexion pour afficher le bon identifiant : téléphone pour Client, e-mail pour les autres catégories. Il doit sélectionner la même catégorie qu'à l'inscription. Les professionnels complètent ensuite leur fiche d'organisation depuis « Devenir partenaire » si elle n'a pas encore été créée.
