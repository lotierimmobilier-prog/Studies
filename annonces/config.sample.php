<?php
// Copier ce fichier en config.php (jamais publié sur GitHub) puis remplir les valeurs.
define('SITE_NAME',   'Capendu en bref');
define('SITE_URL',    'https://capenduenbref.fr');            // sans barre finale
define('ADMIN_EMAIL', 'jeromebouba@outlook.fr');                // reçoit les alertes « nouvelle annonce »
define('MAIL_FROM',   'noreply@capenduenbref.fr');            // adresse de votre domaine (meilleure délivrabilité)
define('APP_SECRET',  'REMPLACER-PAR-UNE-CHAINE-ALEATOIRE-DE-40-CARACTERES-OU-PLUS');
define('SETUP_CODE',  'REMPLACER-PAR-UN-CODE-A-USAGE-UNIQUE');   // sert uniquement à créer le mot de passe admin
// Dossier de la base de données. Idéalement HORS du dossier public_html (ex. /home/utilisateur/annonces-data).
// define('DATA_DIR', '/home/utilisateur/annonces-data');
// define('MAIL_DISABLED', true);                                // test local : n'envoie aucun e-mail
// define('DEV_LOG_MAIL', true);                                 // test local : écrit les e-mails dans data/mail.log
