# Espace annonces – dépôt, validation, suivi des clics

Module PHP (sans bibliothèque externe) qui s'installe à côté du site statique, dans le dossier `annonces/`.
Base de données : SQLite (un simple fichier), aucune base MySQL à créer.

## Ce que fait le module

| Pour qui | Adresse | Fonctions |
|---|---|---|
| Commerçants, associations | `annonces/deposer.php` | Formulaire de dépôt (rubrique, titre, Quoi / Où / Quand, conditions, lien, coordonnées privées, consentement) |
| Commerçants, associations | `annonces/partenaire/` | Espace de suivi : avancement (reçue, validée, publiée, refusée + motif), numéro de parution, **nombre de clics**, retrait d'une annonce. Connexion **sans mot de passe** par lien e-mail (30 min, usage unique) |
| Vous (éditeur) | `annonces/admin/` | Liste des annonces par statut, relecture et modification du texte, validation pour un numéro, refus avec motif, e-mails automatiques à l'annonceur, **statistiques de clics**, génération du bloc HTML du numéro, changement de mot de passe |
| Lecteurs | bouton « En savoir plus » | Passe par `annonces/r.php?id=…` : ajoute 1 au compteur (anonyme) puis redirige vers le lien de l'annonceur ou vers `annonces/a.php?id=…` |

## Installation sur Hostinger (hébergement web avec PHP 8.1 ou plus)

1. Envoyer le dossier `annonces/` dans `public_html/annonces/` (avec le reste du site).
2. Copier `config.sample.php` en `config.php` et remplir : `SITE_URL`, `MAIL_FROM` (adresse de votre domaine), `APP_SECRET`
   (40 caractères aléatoires), `SETUP_CODE` (code à usage unique).
3. **Recommandé** : placer la base **hors** de `public_html` : créer un dossier `annonces-data` à côté de `public_html`
   et décommenter `DATA_DIR` dans `config.php` avec son chemin complet.
   Sinon le dossier `annonces/data/` est protégé par un `.htaccess` (« Require all denied ») : vérifier en ouvrant
   `https://votre-site/annonces/data/annonces.sqlite`, qui doit afficher une erreur 403.
4. Ouvrir `https://votre-site/annonces/admin/` : à la première visite, saisir le `SETUP_CODE` et choisir votre mot de passe
   (12 caractères minimum). Retirer ensuite `SETUP_CODE` de `config.php`.
5. Faire un test complet : déposer une annonce, la valider, cliquer sur le lien généré, ouvrir l'espace partenaire.
6. Vérifier que les e-mails arrivent bien (y compris dans les courriers indésirables). Sinon, faire configurer SPF/DKIM
   du domaine dans Hostinger.

`config.php`, la base et le journal d'e-mails de test sont exclus de GitHub (`.gitignore`) : ne jamais les publier.

## Suivi des clics : ce qui est compté

- Un compteur par annonce et par jour (`clicks`). **Aucune adresse IP, aucun cookie, aucun identifiant** n'est enregistré.
- Les robots, aperçus de liens et préchargements sont écartés (reconnaissance simple, pas parfaite).
- Une même personne qui clique plusieurs fois est comptée plusieurs fois : ce sont des clics, pas des visiteurs uniques.
- L'ouverture des e-mails et les clics hors annonces restent mesurés par Brevo.

## Sécurité mise en place

- Requêtes préparées (pas d'injection SQL), échappement systématique des sorties (pas de XSS), jeton CSRF sur tous les formulaires.
- Mot de passe administrateur chiffré (`password_hash`), 5 essais par 15 minutes, session de 2 h, cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
- Formulaire public : champ piège, délai minimal, signature du formulaire, 5 envois par heure et par connexion
  (l'adresse IP n'est conservée que sous forme d'empreinte chiffrée, 24 h au maximum).
- Redirection de clic : la destination vient uniquement de la base (annonce validée), jamais de l'adresse demandée ; liens limités à `http(s)`.
- En-têtes : `Content-Security-Policy` stricte, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS si HTTPS.
- Espace partenaire : même réponse que l'adresse soit connue ou non (pas de fuite), lien à usage unique qui demande une confirmation (les scanners de messagerie ne le consomment pas).

## Données personnelles et durées de conservation

- Données annonceur : nom, organisation, e-mail, téléphone facultatif, date de consentement.
- Suppression automatique : annonces refusées après 30 jours, en attente après 90 jours, validées ou publiées après 12 mois.
- Suppression à la demande : bouton « Retirer » côté partenaire, « Supprimer définitivement » côté admin.
- À inscrire au **registre des traitements** : « Gestion des annonces de commerçants et d'associations ».
- La politique de confidentialité du site décrit déjà ce traitement (points 10 et 10 bis).

## Test en local

    cd newsletter-capendu && cp annonces/config.sample.php annonces/config.php   # y ajouter define('DEV_LOG_MAIL', true);
    php -S 127.0.0.1:8099 -t .                                                    # puis http://127.0.0.1:8099/annonces/

Avec `DEV_LOG_MAIL`, les e-mails sont écrits dans `data/mail.log` au lieu d'être envoyés.

## Limites de cette première version

- Pas de téléversement de photo (l'annonceur peut indiquer un lien ; à ajouter si nécessaire, avec contrôle strict des fichiers).
- Un seul compte administrateur.
- Les clics sont des compteurs journaliers (pas de courbe détaillée par heure).
