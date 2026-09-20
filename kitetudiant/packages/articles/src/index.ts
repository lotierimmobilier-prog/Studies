/**
 * Les articles du blog.
 *
 * Ils vivent dans « packages » et non dans le front : le serveur les lit pour
 * l'API et le script de pré-rendu les lit pour fabriquer les pages statiques
 * que voient les moteurs de recherche. Le script de déploiement recopie ce
 * dossier (cf. server/__tests__/deploiement.test.ts).
 *
 * ── Deux règles de fond ──────────────────────────────────────────────────
 *
 * 1. AUCUN MONTANT dans le corps d'un article. La règle 1 de CLAUDE.md
 *    interdit qu'un euro affiché vienne d'ailleurs que d'une ligne de calcul
 *    sourcée et datée. Un article vieillit ; un barème change. Les articles
 *    renvoient donc au calculateur du site, qui affiche les montants avec
 *    leur source et leur millésime. Un test interdit les euros ici.
 *
 * 2. LE CORPS EST STRUCTURÉ, pas du HTML. Des blocs typés — paragraphe,
 *    titre, liste, encadré — rendus par des composants React. Aucun
 *    « dangerouslySetInnerHTML », donc aucune injection possible par un
 *    article écrit depuis la console d'administration.
 *
 * ── Sur la provenance, et sur les dates ──────────────────────────────────
 *
 * La procédure décrite est celle de Parcoursup. Le texte est original : rien
 * n'est recopié de parcoursup.gouv.fr, dont le contenu reste la référence en
 * cas de doute. Chaque article le dit.
 *
 * Les articles parlent en MOIS — « les vœux se ferment en mars » — et jamais
 * en jours. Ce n'est pas un raccourci de rédaction : le calendrier de la
 * session à venir n'est pas publié au moment où ils sont écrits, et l'ordre
 * des phases est la seule chose qui ne change pas d'une année sur l'autre. Les
 * jours vivent dans web/src/calendrier.ts, avec leur millésime et leur
 * avertissement ; un test interdit qu'une date précise entre ici.
 */

export type Bloc =
  | { readonly type: 'paragraphe'; readonly texte: string }
  | { readonly type: 'titre'; readonly texte: string }
  | { readonly type: 'liste'; readonly points: readonly string[] }
  /** Une mise en garde ou un point à retenir, détaché du fil du texte. */
  | { readonly type: 'encadre'; readonly texte: string }

export interface Article {
  /** Identifiant dans l'URL. Minuscules, tirets, rien d'autre. */
  readonly slug: string
  readonly titre: string
  /** Résumé d'une ou deux phrases. Sert aussi de description pour les moteurs. */
  readonly chapeau: string
  readonly corps: readonly Bloc[]
  /** Date ISO de publication. */
  readonly publieLe: string
  /** Date ISO de dernière révision, ou null si jamais révisé. */
  readonly revuLe: string | null
  readonly motsCles: readonly string[]
  /** Temps de lecture en minutes, calculé, jamais saisi. */
  readonly minutes?: number
}

/** Mention affichée au pied de chaque article. */
export const MENTION_SOURCE =
  'Article rédigé par KitEtudiant.fr à partir de la procédure Parcoursup. Il décrit ' +
  'l’enchaînement des phases, qui ne change pas d’une année sur l’autre, et non les ' +
  'dates de la session à venir : celles-ci sont fixées chaque année par l’État et ' +
  'publiées sur parcoursup.gouv.fr. Ce n’est pas un texte officiel : en cas de doute, ' +
  'parcoursup.gouv.fr fait foi.'

/** Nombre de mots d'un article, corps compris. */
export function mots(article: Article): number {
  const textes = article.corps.flatMap((b) =>
    b.type === 'liste' ? [...b.points] : [b.texte],
  )
  return [article.chapeau, ...textes].join(' ').split(/\s+/).filter(Boolean).length
}

/** Temps de lecture, arrondi à la minute, jamais en dessous d'une. */
export function minutesDeLecture(article: Article): number {
  return Math.max(1, Math.round(mots(article) / 200))
}

const p = (texte: string): Bloc => ({ type: 'paragraphe', texte })
const t = (texte: string): Bloc => ({ type: 'titre', texte })
const l = (...points: string[]): Bloc => ({ type: 'liste', points })
const e = (texte: string): Bloc => ({ type: 'encadre', texte })

export const ARTICLES: readonly Article[] = [
  {
    slug: 'comprendre-parcoursup-en-dix-minutes',
    titre: 'Comprendre Parcoursup en dix minutes',
    chapeau:
      'Une seule procédure, un seul dossier, un seul calendrier — et trois moments qui ' +
      'comptent. De quoi savoir où vous mettez les pieds avant d’ouvrir la plateforme.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['parcoursup', 'orientation', 'post-bac', 'vœux'],
    corps: [
      p(
        'Parcoursup n’est pas un concours. C’est un guichet : vous déposez un dossier, ' +
          'les formations le regardent, elles répondent. Tout le reste — les rumeurs sur ' +
          'l’algorithme, les stratégies de classement, les vœux qu’il faudrait « garder en ' +
          'réserve » — découle d’une mauvaise compréhension de ce point de départ.',
      ),
      t('Trois moments, toujours les mêmes'),
      p(
        'L’année se découpe en trois temps qui ne changent pas d’une session à l’autre. ' +
          'D’abord une période où l’on regarde : la carte des formations s’ouvre en ' +
          'décembre, et pendant deux mois personne ne vous demande rien. Ensuite une ' +
          'période où l’on formule : les inscriptions ouvrent en janvier, les vœux se ' +
          'ferment en mars, le dossier se confirme début avril. Enfin une période où l’on ' +
          'répond : les propositions arrivent début juin et la phase principale se termine ' +
          'en juillet.',
      ),
      p(
        'Retenez surtout que la deuxième période a deux échéances, pas une. Formuler un ' +
          'vœu et le confirmer sont deux gestes différents, séparés de trois semaines.',
      ),
      t('Ce que vous décidez, ce que vous ne décidez pas'),
      p(
        'Vous décidez quelles formations vous demandez, et vous décidez quelle proposition ' +
          'vous acceptez. Entre les deux, vous ne décidez rien : ce sont les formations qui ' +
          'examinent les dossiers et fixent leur ordre. Aucun classement de votre part ' +
          'n’influence leur décision, et c’est précisément pour cela que les vœux ne se ' +
          'classent pas au moment où on les formule.',
      ),
      e(
        'Un vœu que vous n’osez pas formuler est un vœu refusé d’avance, par vous. ' +
          'Formuler ne coûte rien et n’engage à rien tant que vous n’avez pas accepté une ' +
          'proposition.',
      ),
      t('Le piège le plus courant'),
      p(
        'Ce n’est pas de mal choisir. C’est de laisser passer une date. Chaque année, des ' +
          'dossiers complets ne sont jamais examinés parce que les vœux n’ont pas été ' +
          'confirmés avant la clôture. Le travail est fait, la candidature n’existe pas.',
      ),
      p(
        'La parade tient en une phrase : notez la date de confirmation, pas seulement ' +
          'celle de formulation, et prévoyez une semaine de marge.',
      ),
    ],
  },
  {
    slug: 'dix-voeux-ce-que-cela-veut-vraiment-dire',
    titre: 'Dix vœux : ce que cela veut vraiment dire',
    chapeau:
      'Dix vœux, des sous-vœux, dix de plus en apprentissage. Le compte est moins simple ' +
      'qu’il n’y paraît, et beaucoup de candidats s’arrêtent bien avant la limite.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['vœux', 'sous-vœux', 'apprentissage', 'parcoursup'],
    corps: [
      p(
        'La règle de base est connue : dix vœux, sans avoir à les classer. Ce que l’on ' +
          'sait moins, c’est que ces dix vœux ne recouvrent pas dix formations.',
      ),
      t('Un vœu peut en contenir plusieurs'),
      p(
        'Certaines filières se demandent par groupe. Vous formulez un vœu pour la filière, ' +
          'puis vous choisissez les établissements qui vous intéressent : ce sont les ' +
          'sous-vœux. Le vœu compte pour un, les sous-vœux ont leur propre plafond. ' +
          'Concrètement, un candidat organisé couvre bien plus de dix portes d’entrée.',
      ),
      t('L’apprentissage a son propre compteur'),
      p(
        'Les vœux en apprentissage ne se déduisent pas des dix autres : ils s’ajoutent, à ' +
          'hauteur de dix. Ils suivent aussi un calendrier plus souple — on peut continuer ' +
          'à en formuler après la clôture de la phase principale, parce qu’une place en ' +
          'apprentissage dépend d’un employeur autant que d’une école.',
      ),
      e(
        'Si une filière qui vous intéresse existe en apprentissage, formuler le vœu ne ' +
          'vous enlève rien. C’est le seul endroit de la procédure où la place est ' +
          'littéralement gratuite.',
      ),
      t('Pourquoi si peu de candidats vont au bout'),
      p(
        'Par autocensure, le plus souvent. On raye les formations « trop demandées », on ' +
          'évite celles qui obligeraient à déménager, on garde trois vœux qui se ' +
          'ressemblent. Le résultat, c’est une liste courte et homogène : si elle ne passe ' +
          'pas, rien ne passe.',
      ),
      p(
        'Une liste solide couvre trois cas de figure. Des formations où votre dossier est ' +
          'dans la moyenne de ceux qui sont admis. Des formations plus ouvertes, qui vous ' +
          'conviendraient vraiment — pas des vœux de secours choisis au hasard. Et une ou ' +
          'deux formations ambitieuses, parce que les taux d’accès publiés sont des ' +
          'moyennes, pas des verdicts.',
      ),
    ],
  },
  {
    slug: 'confirmer-ses-voeux-l-etape-oubliee',
    titre: 'Confirmer ses vœux : l’étape que tout le monde oublie',
    chapeau:
      'Formuler un vœu ne suffit pas. Tant qu’il n’est pas confirmé, il n’est transmis à ' +
      'personne — et la date de confirmation tombe trois semaines après celle de formulation.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['confirmation', 'dossier', 'vœux', 'calendrier'],
    corps: [
      p(
        'C’est la mécanique la plus coûteuse de la procédure, et la plus discrète. Un vœu ' +
          'formulé apparaît dans votre dossier. Il donne l’impression d’exister. Il ' +
          'n’existe pas encore.',
      ),
      t('Deux dates, pas une'),
      p(
        'La première clôt la formulation : passé ce jour, plus aucun vœu ne peut être ' +
          'ajouté en phase principale. La seconde, environ trois semaines plus tard, clôt ' +
          'la confirmation : c’est elle qui transmet votre dossier aux formations. Un vœu ' +
          'formulé à temps mais non confirmé disparaît sans un mot.',
      ),
      t('Ce que « confirmer » demande'),
      p(
        'Confirmer suppose que le dossier soit complet pour ce vœu précis. Selon la ' +
          'formation, cela veut dire des bulletins renseignés, un projet de formation ' +
          'motivé rédigé, parfois des pièces jointes propres à la filière. Rien ' +
          'd’insurmontable, mais rien qui se règle en dix minutes non plus, surtout ' +
          'multiplié par dix vœux.',
      ),
      e(
        'Chaque vœu se confirme séparément. Confirmer le premier ne confirme pas les ' +
          'autres, et rien ne vous le rappellera à votre place.',
      ),
      t('Comment ne pas se faire avoir'),
      l(
        'Notez la date de confirmation dans votre téléphone, avec un rappel une semaine avant.',
        'Confirmez au fil de l’eau, dès qu’un vœu est prêt, plutôt que tout le dernier jour.',
        'Le soir de la clôture, rouvrez le dossier et comptez : le nombre de vœux confirmés ' +
          'doit être exactement celui que vous croyez avoir.',
      ),
      p(
        'Cette dernière vérification prend deux minutes. Elle est la seule qui distingue ' +
          'un dossier déposé d’un dossier imaginaire.',
      ),
    ],
  },
  {
    slug: 'lire-une-fiche-de-formation',
    titre: 'Lire une fiche de formation sans se raconter d’histoires',
    chapeau:
      'Attendus, taux d’accès, nombre de places, origine des admis : une fiche de formation ' +
      'dit beaucoup de choses. Encore faut-il savoir lesquelles sont des faits.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['taux d’accès', 'attendus', 'fiche formation', 'statistiques'],
    corps: [
      p(
        'Chaque formation publie une fiche. On la survole en général pour une seule ' +
          'chose : le taux d’accès. C’est dommage, parce que c’est la donnée la plus facile ' +
          'à mal lire.',
      ),
      t('Le taux d’accès n’est pas votre probabilité'),
      p(
        'Il rapporte le nombre de candidats qui ont reçu une proposition au nombre de ' +
          'candidats qui ont postulé, l’année précédente. C’est une moyenne sur une ' +
          'population entière, pas une estimation sur votre dossier. Une formation à 30 % ' +
          'n’est pas une formation où vous avez 30 % de chances : vous n’êtes pas un ' +
          'candidat moyen, et ce chiffre ne sait rien de vous.',
      ),
      p(
        'Il reste utile pour une chose : situer la tension. Entre une filière à 12 % et une ' +
          'filière à 80 %, l’écart d’exigence est réel, même si votre position exacte reste ' +
          'inconnue.',
      ),
      t('Les attendus disent ce qu’on vous demandera de faire'),
      p(
        'Ils sont souvent lus comme une liste de conditions d’entrée. Ce sont plutôt une ' +
          'description du travail à venir. « Savoir mobiliser des compétences ' +
          'mathématiques » ne veut pas dire « avoir 16 en maths » : cela veut dire que vous ' +
          'en ferez, beaucoup, et que l’année sera rude si le sujet vous rebute.',
      ),
      e(
        'Lisez les attendus en vous demandant non pas « est-ce que je corresponds ? » mais ' +
          '« est-ce que j’ai envie de passer trois ans à faire ça ? ». La deuxième question ' +
          'prédit mieux la réussite que la première.',
      ),
      t('Les chiffres qu’on oublie de regarder'),
      l(
        'Le nombre de places : une filière très demandée avec beaucoup de places reste plus ' +
          'accessible qu’une petite filière calme.',
        'L’origine géographique des admis : certaines formations recrutent très ' +
          'majoritairement dans leur académie.',
        'La part d’admis boursiers, qui renseigne sur l’ouverture sociale réelle de la formation.',
        'Le type de bac des admis : une filière qui ne prend presque aucun bac ' +
          'technologique le dit par ses statistiques, pas par ses attendus.',
      ),
      p(
        'Toutes ces données portent une année. Vérifiez laquelle : une statistique de l’an ' +
          'dernier décrit l’an dernier.',
      ),
    ],
  },
  {
    slug: 'oui-oui-si-en-attente-refuse',
    titre: '« Oui », « oui si », « en attente », « refusé » : que faire de chaque réponse',
    chapeau:
      'Les propositions arrivent au fil de l’eau, chacune avec son délai. Savoir ce que ' +
      'signifie chaque réponse évite de perdre une place par simple hésitation.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['admission', 'oui si', 'liste d’attente', 'réponses'],
    corps: [
      p(
        'À partir du début de la phase d’admission, votre dossier se met à bouger tout ' +
          'seul. Les réponses ne tombent pas toutes le même jour, et chacune ouvre un délai ' +
          'de réponse au terme duquel le silence vaut renoncement.',
      ),
      t('« Oui »'),
      p(
        'La formation vous accepte. Vous pouvez accepter à votre tour, ou refuser. Accepter ' +
          'une proposition ne vous interdit pas de rester en attente ailleurs : il faut ' +
          'simplement le dire explicitement au moment où vous répondez.',
      ),
      t('« Oui si »'),
      p(
        'La formation vous accepte, à condition que vous suiviez un parcours renforcé : ' +
          'année aménagée, modules de remise à niveau, tutorat. Ce n’est pas une réponse au ' +
          'rabais. C’est un « oui » assorti d’un filet, et les élèves qui l’acceptent ' +
          'réussissent souvent mieux que ceux qui entrent sans aide dans une filière trop ' +
          'exigeante pour eux.',
      ),
      e(
        'Refuser un « oui si » par fierté est une erreur classique. Regardez ce que le ' +
          'dispositif propose concrètement avant de décider.',
      ),
      t('« En attente »'),
      p(
        'Vous êtes sur la liste, à un rang donné. Ce rang bouge, parce que les candidats ' +
          'placés devant vous acceptent ailleurs. Une attente n’a rien d’anormal et se ' +
          'débloque souvent, parfois tard. Gardez-la tant qu’elle vous intéresse vraiment, ' +
          'et renoncez à celles qui ne vous intéressent plus : vous libérez une place et ' +
          'vous faites avancer la file pour quelqu’un d’autre.',
      ),
      p(
        'Une période est prévue, début juin, pour classer vos vœux en attente par ordre de ' +
          'préférence. C’est le seul moment de la procédure où votre ordre compte — et il ne ' +
          'sert qu’à vous, pour automatiser vos réponses.',
      ),
      t('« Refusé »'),
      p(
        'La formation ne retient pas votre dossier. Ce n’est pas un jugement sur vous : ' +
          'c’est le résultat d’un examen comparatif entre des centaines de dossiers, pour ' +
          'un nombre de places fixé d’avance. La phase complémentaire existe précisément ' +
          'pour cette situation.',
      ),
    ],
  },
  {
    slug: 'phase-complementaire-pas-un-lot-de-consolation',
    titre: 'La phase complémentaire n’est pas un lot de consolation',
    chapeau:
      'Elle ouvre avant même la fin de la phase principale, et donne accès à des formations ' +
      'qui ont encore des places. Beaucoup de candidats y trouvent mieux que ce qu’ils ' +
      'attendaient.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['phase complémentaire', 'places vacantes', 'réorientation'],
    corps: [
      p(
        'On l’imagine comme une salle d’attente pour les candidats sans proposition. Elle ' +
          'ouvre pourtant en juin, alors que la phase principale bat encore son plein, et ' +
          'elle reste ouverte jusqu’en septembre.',
      ),
      t('Ce qu’on y trouve'),
      p(
        'Des formations qui n’ont pas rempli. Pas seulement des filières délaissées : des ' +
          'établissements très corrects, situés dans des villes moins courues, ou des ' +
          'spécialités mal connues des lycéens. La géographie explique une grande partie ' +
          'des places vacantes en France.',
      ),
      e(
        'Une formation qui a des places en août n’est pas nécessairement une mauvaise ' +
          'formation. Souvent, elle est simplement ailleurs.',
      ),
      t('Comment s’y prendre'),
      l(
        'Jusqu’à dix nouveaux vœux, indépendants de ceux de la phase principale.',
        'Ils se formulent un par un, au fil des places qui se libèrent : revenez régulièrement.',
        'Les vœux en attente de la phase principale continuent de vivre en parallèle. ' +
          'Participer à la complémentaire ne vous fait renoncer à rien.',
      ),
      t('Le bon réflexe si rien ne vient'),
      p(
        'Élargissez d’abord la géographie, ensuite la filière. Dans cet ordre. Accepter de ' +
          'partir à deux heures de chez soi ouvre beaucoup plus de portes que de se rabattre ' +
          'sur une filière qui ne vous intéresse pas — et une filière qui ne vous intéresse ' +
          'pas se quitte au bout d’un an.',
      ),
      p(
        'C’est aussi le moment de regarder ce que coûterait réellement chaque ville, avant ' +
          'de dire oui. Une place obtenue dans une ville intenable ne se tient pas jusqu’au ' +
          'diplôme.',
      ),
    ],
  },
  {
    slug: 'choisir-sa-ville-autant-que-son-ecole',
    titre: 'Choisir sa ville autant que son école',
    chapeau:
      'Le loyer décide plus souvent que le classement de l’établissement. C’est le facteur ' +
      'le moins regardé au moment des vœux, et le premier à se rappeler à vous en novembre.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['logement étudiant', 'budget', 'reste à vivre', 'ville'],
    corps: [
      p(
        'Deux formations identiques, deux villes différentes : l’écart de loyer pour un ' +
          'studio comparable se compte en centaines d’euros par mois. Sur trois ans de ' +
          'licence, cela ne se rattrape pas avec un job étudiant.',
      ),
      t('Ce qu’il faut regarder, dans l’ordre'),
      l(
        'Le loyer d’un logement réaliste dans la commune de la formation, pas dans la ' +
          'métropole voisine.',
        'Ce à quoi vous avez droit : aide au logement, bourse, tarifs universitaires. ' +
          'Cela change complètement l’équation et beaucoup de familles ne le simulent jamais.',
        'Le transport quotidien, qui est souvent le poste caché d’une ville « moins chère ».',
        'Ce qu’il reste une fois tout payé. C’est le seul chiffre qui dit si l’année est tenable.',
      ),
      e(
        'Ne comparez pas des loyers, comparez des restes à vivre. Une ville chère où vous ' +
          'êtes boursier et logé en résidence universitaire peut revenir moins cher qu’une ' +
          'ville bon marché où vous louez dans le privé.',
      ),
      t('L’erreur classique'),
      p(
        'Choisir la grande ville par défaut, parce que « c’est là qu’il se passe des ' +
          'choses ». Les villes moyennes universitaires offrent souvent des formations ' +
          'équivalentes, des promotions plus petites, des enseignants plus disponibles, et ' +
          'un budget qui laisse respirer. Le prestige d’une adresse ne figure sur aucun ' +
          'diplôme.',
      ),
      t('Quand s’en occuper'),
      p(
        'Avant de formuler les vœux, pas après les réponses. En juin, le calcul est déjà ' +
          'fait : vous choisissez entre ce que vous avez demandé. Le vrai choix de ville se ' +
          'joue en février, au moment où vous décidez quelles portes vous ouvrez.',
      ),
    ],
  },
  {
    slug: 'ce-qui-compte-vraiment-dans-vos-bulletins',
    titre: 'Ce qui compte vraiment dans vos bulletins',
    chapeau:
      'Les formations ne lisent pas une moyenne générale. Elles lisent une trajectoire, des ' +
      'matières précises, et des appréciations. Savoir lesquelles change la façon de ' +
      'travailler son année.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['bulletins', 'dossier scolaire', 'première', 'terminale'],
    corps: [
      p(
        'Un dossier n’est pas une moyenne. C’est une série de signaux, et tous n’ont pas le ' +
          'même poids selon la formation qui les lit.',
      ),
      t('Les matières de la filière visée passent devant'),
      p(
        'Une école d’ingénieurs regarde les mathématiques et la physique avant la moyenne ' +
          'générale. Une licence de droit regarde le français, l’histoire et la capacité à ' +
          'rédiger. Un 12 dans la matière centrale pèse plus qu’un 15 obtenu ailleurs, et ' +
          'l’inverse est vrai aussi.',
      ),
      t('La progression se voit, et elle se valorise'),
      p(
        'Trois trimestres à 11, 13 puis 15 racontent une autre histoire que 15, 13 puis 11, ' +
          'à moyenne égale. Les jurys lisent des trajectoires. Une remontée en terminale est ' +
          'l’un des rares éléments qu’un candidat peut encore construire au moment où il ' +
          'formule ses vœux.',
      ),
      e(
        'Si votre première a été moyenne, la terminale n’est pas perdue — elle est ' +
          'justement ce qui peut changer la lecture de votre dossier.',
      ),
      t('Les appréciations pèsent plus qu’on ne croit'),
      p(
        '« Élève sérieux qui participe », « travail irrégulier », « des capacités mais peu ' +
          'd’efforts » : ces phrases sont lues. Elles disent ce qu’une note ne dit pas — ' +
          'l’assiduité, l’attitude en classe, la fiabilité. Ce sont aussi les seuls éléments ' +
          'du dossier sur lesquels vos professeurs ont la main, et que vous pouvez ' +
          'influencer par votre comportement, pas par vos résultats.',
      ),
      t('Ce que cela change concrètement'),
      l(
        'Travaillez d’abord les matières de la filière que vous visez, même si la moyenne ' +
          'générale en souffre un peu.',
        'Une note faible s’explique mieux qu’elle ne se cache : le projet de formation ' +
          'motivé sert aussi à ça.',
        'L’assiduité en terminale est un investissement à rendement immédiat.',
      ),
    ],
  },
  {
    slug: 'ecrire-son-projet-de-formation-motive',
    titre: 'Écrire son projet de formation motivé sans mentir',
    chapeau:
      'Quelques lignes à rédiger pour chaque vœu, lues vite, et qui départagent des dossiers ' +
      'proches. Voici ce qu’on y cherche, et ce qui les dessert.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['lettre de motivation', 'projet motivé', 'candidature'],
    corps: [
      p(
        'C’est un texte court, propre à chaque vœu, lu par quelqu’un qui en lira des ' +
          'centaines. Autant dire que les formules toutes faites ne passent pas inaperçues : ' +
          'elles passent inaperçues au mauvais sens du terme.',
      ),
      t('Ce que le lecteur cherche'),
      l(
        'Que vous sachiez ce qu’on fait dans cette formation — pas ce que le métier ' +
          'représente, ce que les études contiennent.',
        'Un lien concret entre ce que vous avez déjà fait et ce qui vous attend.',
        'Une raison de vouloir CETTE formation-là, et pas la même ailleurs.',
      ),
      t('Ce qui dessert'),
      p(
        'La passion déclarée sans preuve : « j’ai toujours été passionné par » n’a jamais ' +
          'convaincu personne. Le copier-coller d’un vœu à l’autre, qui se repère au premier ' +
          'coup d’œil quand le nom de la formation ne correspond pas. Et l’exagération, qui ' +
          'crée une attente impossible à tenir en entretien ou en première année.',
      ),
      e(
        'Mieux vaut un intérêt modeste et précis qu’une vocation inventée. Un candidat qui ' +
          'écrit « j’ai découvert cette filière cette année et voici ce qui m’a accroché » ' +
          'est plus crédible qu’un candidat qui se prétend déterminé depuis l’enfance.',
      ),
      t('Une structure qui marche'),
      l(
        'Une phrase sur ce qui vous a amené là — un cours, un stage, une lecture, une rencontre.',
        'Deux ou trois phrases sur ce que vous savez du contenu de la formation, et sur ce ' +
          'qui vous y attire.',
        'Une phrase sur ce que vous y apportez : une matière où vous êtes solide, une ' +
          'expérience, une méthode de travail.',
        'Une phrase sur la suite, sans promettre un métier précis si vous n’en savez rien.',
      ),
      p(
        'Relisez à voix haute. Si une phrase pourrait figurer dans la lettre de n’importe ' +
          'qui, supprimez-la : elle occupe la place d’une phrase qui vous ressemble.',
      ),
    ],
  },
  {
    slug: 's-organiser-sur-l-annee-de-terminale',
    titre: 'S’organiser sur l’année de terminale sans y laisser sa santé',
    chapeau:
      'Le bac, les vœux, le dossier, et le reste de la vie. Une méthode simple pour que ' +
      'l’orientation ne dévore pas l’année scolaire — ni l’inverse.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['organisation', 'terminale', 'méthode de travail', 'révisions'],
    corps: [
      p(
        'L’année de terminale demande deux choses en même temps : réussir des épreuves et ' +
          'construire une candidature. Elles ne se disputent pas le même temps si on les ' +
          'range aux bons endroits du calendrier.',
      ),
      t('Ce qui se fait quand'),
      l(
        'Automne : explorer. Lire des fiches, parler aux professeurs, aller aux journées ' +
          'portes ouvertes. Aucun formulaire à remplir, aucune pression.',
        'Janvier–février : formuler. Les vœux se posent, la réflexion est déjà faite.',
        'Mars : rédiger et confirmer. C’est le seul moment vraiment chargé, et il tombe ' +
          'avant les épreuves.',
        'Avril–juin : réviser. Le dossier est clos, l’orientation ne vous prend plus rien.',
      ),
      p(
        'La faute de rythme classique consiste à tout faire en mars : découvrir les ' +
          'formations, choisir, rédiger dix textes et confirmer. C’est faisable, et c’est ' +
          'exactement ainsi qu’on formule des vœux qu’on regrette.',
      ),
      t('Une méthode de travail qui tient sur la durée'),
      l(
        'Des séances courtes et régulières battent les week-ends de rattrapage : la mémoire ' +
          'fonctionne à la répétition, pas à l’intensité.',
        'Se tester vaut mieux que relire. Fermer le cours et tenter de le restituer révèle ' +
          'ce qu’on ne sait pas ; relire donne seulement l’impression de savoir.',
        'Une matière difficile se travaille au moment de la journée où vous êtes le plus ' +
          'disponible, pas en dernier quand il ne reste que la fatigue.',
      ),
      e(
        'Le sommeil n’est pas du temps perdu sur les révisions : c’est le moment où ce que ' +
          'vous avez travaillé se fixe. Une nuit blanche avant une épreuve coûte plus ' +
          'qu’elle ne rapporte.',
      ),
      t('Garder une porte de sortie mentale'),
      p(
        'Aucun vœu ne décide de votre vie. Les réorientations en première année sont ' +
          'nombreuses, prévues, et sans drame. Le savoir en février rend le mois de mars ' +
          'beaucoup plus respirable.',
      ),
    ],
  },
  {
    slug: 'bourse-logement-les-demarches-a-ne-pas-rater',
    titre: 'Bourse et logement : les démarches à ne pas rater',
    chapeau:
      'Elles se font au printemps, en parallèle des vœux, et sur un site différent. Les ' +
      'oublier coûte une année entière d’aides.',
    publieLe: '2026-09-20',
    revuLe: null,
    motsCles: ['bourse', 'CROUS', 'logement', 'DSE', 'CVEC'],
    corps: [
      p(
        'Beaucoup de familles découvrent en août qu’il fallait faire une demande au ' +
          'printemps. Les aides ne sont pas rétroactives, et le calendrier du CROUS ne suit ' +
          'pas celui de Parcoursup.',
      ),
      t('Le dossier social étudiant'),
      p(
        'C’est la demande unique de bourse et de logement en résidence universitaire. Elle ' +
          'se fait indépendamment de vos vœux, avant même de savoir où vous serez admis, et ' +
          'elle se modifie ensuite. L’attendre pour la faire, c’est la faire trop tard.',
      ),
      e(
        'Faites la demande même si vous doutez d’y avoir droit. Le calcul dépend des ' +
          'revenus, du nombre d’enfants à charge et de la distance au lieu d’études : ' +
          'beaucoup de familles s’excluent elles-mêmes à tort.',
      ),
      t('Les autres démarches du printemps'),
      l(
        'La contribution de vie étudiante et de campus, à régler avant l’inscription ' +
          'administrative, avec une exonération pour les boursiers.',
        'L’aide au logement, qui se demande une fois le bail signé, et qui change ' +
          'complètement le budget réel.',
        'Le logement privé, à chercher tôt dans les villes tendues : les annonces de juin ' +
          'sont déjà les moins bonnes.',
      ),
      t('Ce que personne ne vous dit'),
      p(
        'Les aides ne se cumulent pas toutes, et certaines dépendent du logement que vous ' +
          'choisissez. C’est exactement le genre de calcul qu’il vaut mieux faire avant de ' +
          'signer, ville par ville, plutôt que de découvrir en octobre que le budget ne ' +
          'tombe pas juste.',
      ),
      p(
        'Les montants changent chaque année et dépendent de votre situation : ne vous fiez ' +
          'pas à un chiffre lu sur un forum. Simulez le vôtre, avec des barèmes datés.',
      ),
    ],
  },
]

/* --------------------------------------------------- écriture d'un article */

/**
 * Convertit un texte saisi à la main en blocs typés.
 *
 * La syntaxe tient en trois signes, pour qu'un rédacteur non technicien puisse
 * écrire sans apprendre le Markdown :
 *
 *   ## Un titre de section
 *   - un point de liste
 *   > un encadré, pour une mise en garde
 *   tout le reste est un paragraphe
 *
 * Aucun HTML n'est accepté ni produit : le résultat est une structure de
 * données, rendue par des composants. Un article écrit depuis la console ne
 * peut donc pas exécuter de script, quoi qu'on tape dedans.
 */
export function enBlocs(texte: string): Bloc[] {
  const blocs: Bloc[] = []
  let paragraphe: string[] = []
  let liste: string[] = []

  const viderParagraphe = (): void => {
    if (paragraphe.length > 0) {
      blocs.push({ type: 'paragraphe', texte: paragraphe.join(' ') })
      paragraphe = []
    }
  }
  const viderListe = (): void => {
    if (liste.length > 0) {
      blocs.push({ type: 'liste', points: liste })
      liste = []
    }
  }

  for (const brute of texte.split('\n')) {
    const ligne = brute.trim()
    if (ligne === '') {
      viderParagraphe()
      viderListe()
    } else if (ligne.startsWith('## ')) {
      viderParagraphe()
      viderListe()
      blocs.push({ type: 'titre', texte: ligne.slice(3).trim() })
    } else if (ligne.startsWith('- ')) {
      viderParagraphe()
      liste.push(ligne.slice(2).trim())
    } else if (ligne.startsWith('> ')) {
      viderParagraphe()
      viderListe()
      blocs.push({ type: 'encadre', texte: ligne.slice(2).trim() })
    } else {
      viderListe()
      paragraphe.push(ligne)
    }
  }
  viderParagraphe()
  viderListe()
  return blocs
}

/** L'opération inverse, pour rouvrir un article dans le formulaire. */
export function enTexte(blocs: readonly Bloc[]): string {
  return blocs
    .map((b) => {
      switch (b.type) {
        case 'titre':
          return `## ${b.texte}`
        case 'encadre':
          return `> ${b.texte}`
        case 'liste':
          return b.points.map((p) => `- ${p}`).join('\n')
        case 'paragraphe':
          return b.texte
      }
    })
    .join('\n\n')
}

/**
 * Identifiant d'URL tiré d'un titre.
 *
 * Accents retirés, tout en minuscules, un tiret entre les mots. C'est la seule
 * forme que le routeur accepte, et celle qui survit à un copier-coller.
 */
export function slugDe(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

export class ArticleInvalide extends Error {
  constructor(raison: string) {
    super(raison)
    this.name = 'ArticleInvalide'
  }
}

/**
 * Valide et normalise un article venu de la console d'administration.
 *
 * Lève plutôt que de corriger en silence : un article publié avec un chapeau
 * vide ou un slug bancal est un article mal référencé, et personne ne s'en
 * apercevrait avant des mois.
 */
export function articleDepuisSaisie(saisie: {
  titre?: unknown
  chapeau?: unknown
  corps?: unknown
  motsCles?: unknown
  publieLe?: unknown
  slug?: unknown
}): Article {
  const texte = (v: unknown, champ: string, min: number, max: number): string => {
    if (typeof v !== 'string') throw new ArticleInvalide(`${champ} est manquant.`)
    const net = v.trim()
    if (net.length < min)
      throw new ArticleInvalide(`${champ} est trop court : ${min} caractères au moins, ${net.length} saisis.`)
    if (net.length > max)
      throw new ArticleInvalide(`${champ} est trop long : ${max} caractères au plus, ${net.length} saisis.`)
    return net
  }

  const titre = texte(saisie.titre, 'Le titre', 10, 120)
  // Le chapeau sert de description aux moteurs : trop court il n'apprend rien,
  // trop long il est tronqué dans les résultats de recherche.
  const chapeau = texte(saisie.chapeau, 'Le chapeau', 70, 220)
  const corps = enBlocs(texte(saisie.corps, 'Le corps', 200, 40000))
  if (corps.length < 2) throw new ArticleInvalide('Le corps doit compter au moins deux blocs.')

  const slug =
    typeof saisie.slug === 'string' && saisie.slug.trim() !== ''
      ? slugDe(saisie.slug)
      : slugDe(titre)
  if (slug === '') throw new ArticleInvalide('Le titre ne donne aucun identifiant d’URL utilisable.')

  const publieLe =
    typeof saisie.publieLe === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saisie.publieLe)
      ? saisie.publieLe
      : new Date().toISOString().slice(0, 10)

  const motsCles = Array.isArray(saisie.motsCles)
    ? saisie.motsCles
        .filter((m): m is string => typeof m === 'string')
        .map((m) => m.trim().toLowerCase())
        .filter((m) => m !== '')
        .slice(0, 8)
    : []

  return { slug, titre, chapeau, corps, publieLe, revuLe: null, motsCles }
}
