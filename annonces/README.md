# Espace annonces – dépôt, validation, suivi des clics

Module PHP (sans bibliothèque externe) qui s'installe à côté du site statique, dans le dossier `annonces/`.
Base de données : SQLite (un simple fichier), aucune base MySQL à créer.

## Ce que fait le module

| Pour qui | Adresse | Fonctions |
|---|---|---|
| Entreprises et associations | `devenir-partenaire.html` puis `annonces/inscription.php` | Page qui explique le but (vitrine gratuite : événements, tarifs promotionnels, actualité, événements passés), puis inscription : type, **siège social à Capendu** ou **association voisine dont l'activité se déroule à Capendu**, nom, adresse du siège, téléphone et logo publics, contact privé. **Aucun numéro SIRET/RNA.** L'éditeur valide chaque inscription. Les particuliers ne peuvent pas s'inscrire. |
| Partenaires validés | `annonces/partenaire/` | Connexion **sans mot de passe** (lien par e-mail, 30 min, usage unique), dépôt d'annonces, suivi (avancement, numéro de parution, **clics**), retrait d'une annonce, suppression de l'inscription. |
| Partenaires validés | `annonces/deposer.php` | Dépôt d'annonce : rubrique, titre, Quoi / Où / Quand, conditions, **lien d'inscription facultatif**, **photo facultative**, **assistant IA** par copier-coller (vos idées en vrac, demande à coller dans Claude ou ChatGPT, la réponse remplit le formulaire, avec un conseil de calendrier) et aide à la rédaction (compteur et conseils). Fermé aux non-inscrits. |
| Vous (éditeur) | `annonces/admin/` | **Partenaires** (valider ou refuser les inscriptions), annonces (relire, corriger, valider, refuser), messages du formulaire de contact, **statistiques de clics**, **Rédiger avec l'IA**, préparation du numéro (bloc HTML), mot de passe. |
| Tout le monde | `annonces/partenaires.php` | **Liste publique des partenaires validés** : logo (ou initiales), nom, adresse, téléphone, mention « peut vous aider à vous inscrire ». Le partenaire modifie sa fiche dans `partenaire/fiche.php`. |
| Tout le monde | `annonces/contact.php` | Formulaire de contact (questions, droits RGPD, aide). Aucun échange par e-mail. |
| Lecteurs | bouton « En savoir plus » | Passe par `annonces/r.php?id=…` : compteur anonyme, puis redirection vers le lien de l'annonceur ou la page de l'annonce. |

### Rédiger avec l'IA (sans clé ni compte technique)
`admin/ia.php` génère une demande à **copier-coller** dans un assistant (par exemple Claude sur claude.ai) : consignes de style pour un public de 25 à 85 ans, et les textes publics des annonces validées du numéro. Vous collez la réponse, relisez chaque proposition (avant / après) et appliquez celles que vous retenez. Un édito est aussi proposé. La demande ne contient jamais de nom, d'e-mail, de téléphone ni de photo.

### Photos
JPEG, PNG ou WebP, 5 Mo maximum. Elles sont ré-encodées (métadonnées supprimées), redimensionnées à 1 200 px, stockées **hors du dossier public** et servies seulement une fois l'annonce validée. Elles sont supprimées avec l'annonce.

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

    cp annonces/config.sample.php annonces/config.php   # y ajouter define('DEV_LOG_MAIL', true);
    php -S 127.0.0.1:8099 -t .                                                    # puis http://127.0.0.1:8099/annonces/

Avec `DEV_LOG_MAIL`, les e-mails sont écrits dans `data/mail.log` au lieu d'être envoyés.

## Limites de cette première version

- Les photos nécessitent l'extension PHP GD (présente chez Hostinger) : sinon le formulaire propose d'envoyer sans photo.
- Un seul compte administrateur.
- Les clics sont des compteurs journaliers (pas de courbe détaillée par heure).
