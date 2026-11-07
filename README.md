# Capendu en bref – page de la newsletter

Page unique, statique (HTML/CSS/JS), sans dépendance ni cookie. Les polices sont hébergées dans `fonts/`
(aucune requête vers Google), ce qui évite tout transfert d'adresse IP à un tiers.

## Aperçu local

    python3 -m http.server 8080   # puis http://localhost:8080

## À compléter avant la mise en ligne

Tous les textes à remplir sont surlignés en jaune (classe `.todo`) dans `index.html` : rechercher `todo`.

- Adresse postale ou boîte postale de l'éditeur (Jérôme BOUBA), exigée aussi par Brevo dans le pied des e-mails
- Adresse e-mail de contact (mailto de la section commerçants, politique de confidentialité, mentions légales)
- Hébergeur du site et prestataire d'envoi (Brevo ou autre)
- Date de mise à jour de la politique de confidentialité
- Retirer ensuite la classe `todo` (le surlignage jaune disparaît)

## Brancher l'inscription (Brevo)

1. Créer un compte Brevo, une liste « Capendu en bref » et un formulaire d'inscription avec **double opt-in**
   (e-mail de confirmation). Signer l'accord de sous-traitance (DPA) proposé par Brevo.
2. Dans Brevo, créer les attributs `PRENOM` et `PROFIL`, et activer l'enregistrement du consentement.
3. Remplacer `REMPLACER-PAR-LIEN-FORMULAIRE-BREVO` dans l'attribut `action` du formulaire (`index.html`)
   par l'URL de soumission du formulaire Brevo, et adapter les noms de champs si Brevo en impose d'autres.
4. Vérifier que la politique de confidentialité (section 6, localisation et sous-traitants) correspond bien
   à ce que Brevo indique dans son DPA.
5. Ajouter dans chaque numéro : lien de désinscription en un clic, nom et adresse de l'éditeur.

## Registre des traitements (hors site)

Compléter le modèle gratuit de la CNIL : finalité, base légale, données, durée, destinataires, sécurité.
