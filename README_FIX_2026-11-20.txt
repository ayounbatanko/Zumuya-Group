ZUMUYA GROUP — CORRECTIFS COMPTE / RESTAURANT / HOTEL

1) Dézipper ce paquet et remplacer sur GitHub les fichiers du dossier 14 par ceux du dossier site (garder le reste des fichiers).
2) Dans Supabase > SQL Editor, exécuter 00_FIX_CREATION_COMPTES_ET_SUPPRESSION.sql.
3) Le trigger provisionne automatiquement une organisation (restaurant/hôtel et catégories pro) à la création d'un compte. Les métadonnées organization_id permettent à compte.js de rediriger vers l'espace correspondant.
4) Le compte page cache le formulaire « Devenir partenaire » si l'organisation est déjà provisionnée.
5) La fonction de suppression du compte remplace rg_delete_my_account.

AVERTISSEMENT: la suppression est irréversible. Sauvegardez avant SQL. Le trigger et la suppression doivent être testés dans Supabase avant mise en production. Le provisioning crée une organisation minimale à partir du nom de profil; la fiche détaillée (adresse, coordonnées, etc.) peut être complétée ensuite.
