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
      p(
        'La procédure concerne les élèves de terminale, mais pas seulement eux. Un étudiant ' +
          'déjà inscrit quelque part et qui veut changer de voie y repasse, au même titre ' +
          'qu’un candidat qui reprend ses études après une interruption. Dans ces deux cas, ' +
          'le dossier se construit avec le service d’orientation de l’établissement ' +
          'd’origine plutôt qu’avec un professeur principal, mais la mécanique est la même.',
      ),
      t('Un seul dossier pour tous vos vœux'),
      p(
        'C’est le point qui surprend le plus. Vous ne remplissez pas dix candidatures : ' +
          'vous remplissez un dossier — état civil, bulletins, résultats, activités — et ' +
          'chaque formation y puise ce qui l’intéresse. Seuls deux éléments sont propres à ' +
          'chaque vœu : le projet de formation motivé, et les pièces complémentaires que ' +
          'certaines filières demandent.',
      ),
      p(
        'Conséquence pratique : le gros du travail se fait une fois. Ce qui prend du temps, ' +
          'c’est la partie qui se répète — et c’est justement celle qu’on repousse.',
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
          'vœu et le confirmer sont deux gestes différents, séparés de trois semaines. Les ' +
          'jours exacts changent chaque année : ils sont fixés par l’État et publiés à ' +
          'l’ouverture de la session. Notez-les à ce moment-là, pas avant.',
      ),
      t('Ce que vous décidez, ce que vous ne décidez pas'),
      p(
        'Vous décidez quelles formations vous demandez, et vous décidez quelle proposition ' +
          'vous acceptez. Entre les deux, vous ne décidez rien : ce sont les formations qui ' +
          'examinent les dossiers et fixent leur ordre. Aucun classement de votre part ' +
          'n’influence leur décision, et c’est précisément pour cela que les vœux ne se ' +
          'classent pas au moment où on les formule.',
      ),
      p(
        'Chaque formation constitue une commission qui examine les dossiers selon des ' +
          'critères qu’elle publie à l’avance sur sa fiche. Ces critères ne sont pas les ' +
          'mêmes partout : deux licences de la même discipline, dans deux universités, ne ' +
          'pondèrent pas identiquement les notes, les appréciations et le projet motivé. ' +
          'Lire ces critères vaut mieux que spéculer sur ce qu’on imagine qu’ils regardent.',
      ),
      e(
        'Un vœu que vous n’osez pas formuler est un vœu refusé d’avance, par vous. ' +
          'Formuler ne coûte rien et n’engage à rien tant que vous n’avez pas accepté une ' +
          'proposition.',
      ),
      t('Ce qui n’est pas sur la plateforme'),
      p(
        'Presque toutes les formations reconnues par l’État y sont, mais pas toutes. ' +
          'Quelques écoles, notamment dans le privé, recrutent par leur propre procédure, ' +
          'avec leur propre calendrier. Si une formation vous intéresse et que vous ne la ' +
          'trouvez pas, cherchez son site : vous y lirez comment elle recrute, et surtout ' +
          'avant quelle date. Une candidature hors plateforme se prépare en parallèle, pas ' +
          'à la place.',
      ),
      t('Le piège le plus courant'),
      p(
        'Ce n’est pas de mal choisir. C’est de laisser passer une date. Chaque année, des ' +
          'dossiers complets ne sont jamais examinés parce que les vœux n’ont pas été ' +
          'confirmés avant la clôture. Le travail est fait, la candidature n’existe pas.',
      ),
      p(
        'La parade tient en une phrase : notez la date de confirmation, pas seulement ' +
          'celle de formulation, et prévoyez une semaine de marge. Rien dans la procédure ' +
          'ne vous relancera à votre place.',
      ),
      t('Et après la proposition ?'),
      p(
        'Accepter une proposition ne vous inscrit pas. Il reste une inscription ' +
          'administrative à faire auprès de l’établissement, dans un délai qu’il fixe, avec ' +
          'ses propres pièces. C’est une formalité, mais une formalité qui a une date elle ' +
          'aussi — et c’est la dernière occasion de perdre une place qu’on a obtenue.',
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
      p(
        'Ce fonctionnement existe surtout là où une même formation est proposée dans ' +
          'beaucoup d’établissements : classes préparatoires, écoles d’ingénieurs et de ' +
          'commerce à concours commun, certains instituts de formation en santé. Le ' +
          'principe est toujours le même : un vœu pour la filière, des sous-vœux pour les ' +
          'lieux. Vérifiez le décompte sur la fiche avant de vous restreindre — beaucoup ' +
          'de candidats s’interdisent des établissements en croyant, à tort, consommer un ' +
          'vœu entier à chaque fois.',
      ),
      t('Pourquoi il n’y a pas de classement'),
      p(
        'Parce qu’un classement de votre part ne servirait à personne. Les formations ' +
          'examinent votre dossier sans savoir à quel rang vous les placez, et elles ne ' +
          'savent pas non plus quels autres vœux vous avez formulés. Demander une filière ' +
          'très sélective ne dessert donc jamais vos autres vœux, et se « rabattre » ' +
          'd’avance sur une formation plus accessible ne vous donne aucun bonus chez elle.',
      ),
      t('L’apprentissage a son propre compteur'),
      p(
        'Les vœux en apprentissage ne se déduisent pas des dix autres : ils s’ajoutent, à ' +
          'hauteur de dix. Ils suivent aussi un calendrier plus souple — on peut continuer ' +
          'à en formuler après la clôture de la phase principale, parce qu’une place en ' +
          'apprentissage dépend d’un employeur autant que d’une école.',
      ),
      p(
        'C’est aussi la différence à comprendre : être accepté par le centre de formation ' +
          'ne suffit pas, il faut un contrat. La recherche d’entreprise se mène en ' +
          'parallèle, dès le printemps, et c’est elle qui conditionne la rentrée. En ' +
          'contrepartie, l’alternance change entièrement l’équation financière d’une année ' +
          'étudiante, et souvent la question du logement avec.',
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
        'L’autre cause est le temps. Chaque vœu demande un projet de formation motivé, ' +
          'parfois des pièces en plus, et un candidat qui s’y prend en mars renonce ' +
          'naturellement aux derniers. Formuler tôt et rédiger au fil de l’eau évite ce ' +
          'rétrécissement par fatigue.',
      ),
      t('À quoi ressemble une liste solide'),
      p(
        'Une liste solide couvre trois cas de figure. Des formations où votre dossier est ' +
          'dans la moyenne de ceux qui sont admis. Des formations plus ouvertes, qui vous ' +
          'conviendraient vraiment — pas des vœux de secours choisis au hasard. Et une ou ' +
          'deux formations ambitieuses, parce que les taux d’accès publiés sont des ' +
          'moyennes, pas des verdicts.',
      ),
      l(
        'Varier les types de formation autant que les établissements : université, BUT, ' +
          'BTS et prépa ne recrutent pas sur les mêmes critères, et une liste qui mélange ' +
          'les voies résiste mieux qu’une liste qui les empile.',
        'Varier la géographie, qui est le levier le plus efficace et le moins utilisé.',
        'Ne garder aucun vœu que vous refuseriez s’il tombait. Un vœu de remplissage ' +
          'occupe une place et ne vous servira pas le jour où il sera la seule réponse.',
      ),
      p(
        'Dernier point, souvent négligé : regardez ce que chaque ville vous coûterait avant ' +
          'de formuler, pas après les réponses. Une liste qui n’est pas finançable est une ' +
          'liste qu’on tronque dans l’urgence, en juin, avec de mauvais critères.',
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
      p(
        'Cet intervalle n’est pas un délai de grâce, c’est un temps de travail. Il existe ' +
          'précisément parce que compléter un dossier prend des heures, et il est calibré ' +
          'pour dix vœux, pas pour un.',
      ),
      t('Ce que « confirmer » demande'),
      p(
        'Confirmer suppose que le dossier soit complet pour ce vœu précis. Selon la ' +
          'formation, cela veut dire des bulletins renseignés, un projet de formation ' +
          'motivé rédigé, parfois des pièces jointes propres à la filière. Rien ' +
          'd’insurmontable, mais rien qui se règle en dix minutes non plus, surtout ' +
          'multiplié par dix vœux.',
      ),
      p(
        'Les pièces propres à une filière sont la source d’imprévu la plus fréquente : un ' +
          'questionnaire à remplir, une attestation à demander, un document que votre ' +
          'établissement doit fournir. Certaines dépendent de quelqu’un d’autre, et c’est ' +
          'ce qui rend le dernier jour dangereux — un secrétariat fermé le week-end suffit ' +
          'à faire tomber un vœu.',
      ),
      e(
        'Chaque vœu se confirme séparément. Confirmer le premier ne confirme pas les ' +
          'autres, et rien ne vous le rappellera à votre place.',
      ),
      t('Ce qui se fige, et ce qui reste modifiable'),
      p(
        'Une fois un vœu confirmé, vous ne pouvez plus en changer le contenu : le projet ' +
          'motivé est transmis tel quel. En revanche, vous pouvez encore renoncer à ce vœu ' +
          'si vous changez d’avis. Confirmer tôt ne vous enferme donc pas — c’est ' +
          'l’inverse : cela vous laisse le temps de réfléchir sans l’épée de la date ' +
          'au-dessus de la tête.',
      ),
      p(
        'Les éléments communs à tous les vœux, eux, continuent de se compléter jusqu’à la ' +
          'clôture. Un bulletin qui arrive tard n’empêche donc pas de confirmer ce qui est ' +
          'prêt.',
      ),
      t('Comment ne pas se faire avoir'),
      l(
        'Notez la date de confirmation dans votre téléphone, avec un rappel une semaine avant.',
        'Confirmez au fil de l’eau, dès qu’un vœu est prêt, plutôt que tout le dernier jour.',
        'Demandez dès février les pièces qui dépendent d’un tiers : elles ne s’obtiennent ' +
          'pas en vingt-quatre heures.',
        'Le soir de la clôture, rouvrez le dossier et comptez : le nombre de vœux confirmés ' +
          'doit être exactement celui que vous croyez avoir.',
      ),
      p(
        'Cette dernière vérification prend deux minutes. Elle est la seule qui distingue ' +
          'un dossier déposé d’un dossier imaginaire.',
      ),
      t('Le cas de l’apprentissage'),
      p(
        'Les vœux en apprentissage suivent une règle à part : ils échappent à la clôture ' +
          'de la phase principale et peuvent être formulés, puis confirmés, bien plus tard. ' +
          'C’est logique — une place en apprentissage dépend d’un employeur autant que d’un ' +
          'centre de formation, et une signature de contrat ne se commande pas. Si vous ' +
          'avez ce type de vœu dans votre liste, ne calez pas tout votre calendrier sur lui ' +
          'et ne calez surtout pas le sien sur celui des autres.',
      ),
      t('Si la date est passée'),
      p(
        'Un vœu non confirmé ne se rattrape pas en phase principale. Ce n’est pas la fin ' +
          'de l’année pour autant : la phase complémentaire rouvre des vœux à partir de ' +
          'juin, sur les formations qui ont encore des places, et elle reste ouverte tout ' +
          'l’été. Une commission académique peut par ailleurs être saisie par un candidat ' +
          'qui se retrouve sans aucune proposition. Le mieux reste évidemment de ne pas en ' +
          'arriver là, mais aucune porte ne se ferme définitivement au mois d’avril.',
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
      p(
        'Une nuance change beaucoup la lecture : le taux d’accès compte les propositions ' +
          'faites sur toute la campagne, y compris celles envoyées en juillet quand la ' +
          'liste d’attente a beaucoup bougé. Une formation affichant un taux confortable ' +
          'peut donc n’avoir appelé les derniers candidats que très tard. Le rang du ' +
          'dernier candidat appelé, quand il est publié, dit mieux jusqu’où la file est ' +
          'descendue.',
      ),
      t('Les attendus disent ce qu’on vous demandera de faire'),
      p(
        'Ils sont souvent lus comme une liste de conditions d’entrée. Ce sont plutôt une ' +
          'description du travail à venir. « Savoir mobiliser des compétences ' +
          'mathématiques » ne veut pas dire « avoir 16 en maths » : cela veut dire que vous ' +
          'en ferez, beaucoup, et que l’année sera rude si le sujet vous rebute.',
      ),
      p(
        'À côté des attendus figurent les critères d’examen des vœux : ce que la commission ' +
          'regarde réellement, et avec quel poids. C’est la partie la plus utile de la ' +
          'fiche et la moins lue. Elle vous dit si ce sont les notes, la régularité, les ' +
          'appréciations ou le projet motivé qui pèsent le plus — donc où porter votre ' +
          'effort, et ce qu’il faut absolument soigner dans votre texte.',
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
        'Les spécialités des admis, qui révèlent souvent une combinaison attendue que les ' +
          'attendus ne nomment pas explicitement.',
      ),
      p(
        'Toutes ces données portent une année. Vérifiez laquelle : une statistique de l’an ' +
          'dernier décrit l’an dernier. Une filière qui ouvre, qui change de capacité ou ' +
          'qui déménage rend ses propres chiffres caducs.',
      ),
      t('Ce que la fiche ne dit pas'),
      p(
        'Elle décrit une formation, pas une vie étudiante. Elle ne dit rien du coût du ' +
          'logement sur place, de la distance entre le campus et le centre, du temps de ' +
          'transport quotidien, ni de ce qu’il vous restera pour vivre une fois le loyer ' +
          'payé. Ces éléments décident pourtant du fait que vous irez au bout ou non.',
      ),
      p(
        'Elle ne dit pas non plus ce que devient une promotion : taux de passage en ' +
          'deuxième année, poursuite d’études, insertion. Quand ces chiffres existent, ils ' +
          'valent souvent le détour par le site de l’établissement. Et quand ils n’existent ' +
          'pas, une question posée aux journées portes ouvertes fait très bien l’affaire.',
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
      p(
        'Ce délai est court, surtout dans les premiers jours de la phase. Il se compte en ' +
          'jours, pas en semaines, et il court même si vous êtes en voyage ou en épreuve. ' +
          'La première chose à organiser, avant même de savoir quoi répondre, c’est de ' +
          'pouvoir consulter votre dossier tous les jours pendant cette période.',
      ),
      t('« Oui »'),
      p(
        'La formation vous accepte. Vous pouvez accepter à votre tour, ou refuser. Accepter ' +
          'une proposition ne vous interdit pas de rester en attente ailleurs : il faut ' +
          'simplement le dire explicitement au moment où vous répondez.',
      ),
      p(
        'C’est le geste le plus important de toute la procédure, et le plus souvent mal ' +
          'fait. Accepter une proposition en conservant ses vœux en attente vous met à ' +
          'l’abri : vous avez une place, et la file continue d’avancer pour vous. Refuser ' +
          'une proposition pour « ne pas bloquer » quelqu’un d’autre, en revanche, ne rend ' +
          'service à personne et vous laisse sans rien.',
      ),
      t('« Oui si »'),
      p(
        'La formation vous accepte, à condition que vous suiviez un parcours renforcé : ' +
          'année aménagée, modules de remise à niveau, tutorat. Ce n’est pas une réponse au ' +
          'rabais. C’est un « oui » assorti d’un filet, et les élèves qui l’acceptent ' +
          'réussissent souvent mieux que ceux qui entrent sans aide dans une filière trop ' +
          'exigeante pour eux.',
      ),
      p(
        'Le dispositif varie beaucoup d’un endroit à l’autre : quelques heures ' +
          'hebdomadaires en plus, un semestre supplémentaire, un accompagnement ' +
          'individualisé. Demandez à la formation ce qu’il recouvre chez elle avant de ' +
          'trancher. Une année allongée n’est pas une année perdue si elle évite un ' +
          'redoublement.',
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
        'Pour situer votre rang, comparez-le au rang du dernier candidat appelé l’an ' +
          'dernier dans la même formation, quand il est publié. Ce n’est pas une promesse — ' +
          'une file ne descend pas au même rythme deux années de suite — mais cela ' +
          'distingue une attente qui a toutes les chances d’aboutir d’une attente très ' +
          'lointaine.',
      ),
      p(
        'Une période est prévue, début juin, pour classer vos vœux en attente par ordre de ' +
          'préférence. C’est le seul moment de la procédure où votre ordre compte — et il ne ' +
          'sert qu’à vous, pour automatiser vos réponses. Ce classement répond à votre ' +
          'place, jour et nuit, y compris pendant les épreuves du bac. Une fois activé, il ' +
          'accepte pour vous dès qu’un vœu mieux classé se débloque : ne l’alimentez donc ' +
          'qu’avec des formations que vous accepteriez vraiment.',
      ),
      t('« Refusé »'),
      p(
        'La formation ne retient pas votre dossier. Ce n’est pas un jugement sur vous : ' +
          'c’est le résultat d’un examen comparatif entre des centaines de dossiers, pour ' +
          'un nombre de places fixé d’avance. La phase complémentaire existe précisément ' +
          'pour cette situation, et elle ouvre avant même la fin de la phase principale.',
      ),
      p(
        'Un candidat qui se retrouve sans aucune proposition peut par ailleurs demander ' +
          'l’intervention de la commission académique chargée d’examiner ces situations. ' +
          'Elle cherche une place compatible avec le dossier et le projet. Le dispositif ' +
          'existe, il est prévu par la procédure, et il se saisit depuis le dossier.',
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
      t('Qui peut y participer'),
      p(
        'Tout le monde, ou presque. Un candidat sans aucune proposition, évidemment. Mais ' +
          'aussi un candidat qui a déjà accepté une place et qui voudrait mieux, ou ' +
          'autrement : rien n’interdit de formuler des vœux complémentaires tout en ' +
          'conservant la proposition qu’on a acceptée. Un candidat qui n’avait pas formulé ' +
          'de vœu du tout en phase principale peut également entrer dans la procédure à ce ' +
          'moment-là.',
      ),
      t('Ce qu’on y trouve'),
      p(
        'Des formations qui n’ont pas rempli. Pas seulement des filières délaissées : des ' +
          'établissements très corrects, situés dans des villes moins courues, ou des ' +
          'spécialités mal connues des lycéens. La géographie explique une grande partie ' +
          'des places vacantes en France.',
      ),
      p(
        'Les places bougent en continu. Une formation complète un matin peut rouvrir le ' +
          'soir parce qu’un candidat s’est désisté après avoir été appelé ailleurs. C’est ' +
          'pourquoi la phase complémentaire récompense la régularité bien plus que la ' +
          'stratégie : revenir tous les deux ou trois jours vaut mieux que réfléchir ' +
          'longuement une seule fois.',
      ),
      e(
        'Une formation qui a des places en août n’est pas nécessairement une mauvaise ' +
          'formation. Souvent, elle est simplement ailleurs.',
      ),
      t('Comment s’y prendre'),
      l(
        'Jusqu’à dix nouveaux vœux, indépendants de ceux de la phase principale.',
        'Ils se formulent un par un, au fil des places qui se libèrent : revenez régulièrement.',
        'Chacun demande son projet de formation motivé, comme en phase principale : ' +
          'préparez un texte de base que vous adapterez, plutôt que d’improviser à chaque fois.',
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
        'Pensez aussi à la commission académique, qui peut être saisie par un candidat ' +
          'resté sans proposition. Elle examine la situation et cherche une place ' +
          'compatible avec le projet. Beaucoup de candidats ignorent qu’elle existe et ' +
          'passent l’été à rafraîchir une page.',
      ),
      t('Se renseigner vite, mais se renseigner'),
      p(
        'La rapidité ne dispense pas de regarder ce qu’on demande. Avant de formuler un ' +
          'vœu complémentaire, ouvrez la fiche de la formation comme vous l’auriez fait en ' +
          'mars : les attendus, le contenu réel de la première année, le nombre de places. ' +
          'Appelez le secrétariat si un point vous échappe — en août, les équipes répondent ' +
          'souvent vite, et une question posée directement vaut mieux qu’une supposition.',
      ),
      p(
        'Une place acceptée sans être comprise se transforme en abandon à l’automne. Or un ' +
          'abandon en cours de première année n’a pas les mêmes conséquences qu’une ' +
          'réorientation préparée : il vaut mieux consacrer une soirée à vérifier qu’une ' +
          'année à réparer.',
      ),
      t('Vérifier avant de dire oui'),
      p(
        'C’est aussi le moment de regarder ce que coûterait réellement chaque ville, avant ' +
          'de dire oui. Une place obtenue dans une ville intenable ne se tient pas jusqu’au ' +
          'diplôme.',
      ),
      p(
        'À cette période, deux choses se jouent en même temps : la place et le logement. ' +
          'Les résidences universitaires se remplissent tôt, et le parc privé de la fin de ' +
          'l’été est le moins bon de l’année. Si vous visez une ville tendue, cherchez un ' +
          'toit dès que la proposition tombe, sans attendre l’inscription administrative.',
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
      p(
        'C’est pourtant le paramètre qu’on regarde en dernier, souvent en juin, quand les ' +
          'réponses tombent et qu’il n’y a plus de choix à faire. À ce moment-là le calcul ' +
          'est déjà joué : vous arbitrez entre ce que vous avez demandé en mars.',
      ),
      t('Le seul chiffre qui compte vraiment'),
      p(
        'Ce n’est pas le loyer. C’est ce qu’il reste une fois le loyer payé, les aides ' +
          'reçues, les charges réglées et le transport déduit. Deux villes peuvent afficher ' +
          'le même loyer et laisser des restes à vivre très différents, selon que vous êtes ' +
          'boursier, logé en résidence universitaire ou dans le privé, et selon la distance ' +
          'entre votre logement et le campus.',
      ),
      p(
        'Cette somme-là décide de choses concrètes : pouvoir manger correctement, rentrer ' +
          'chez soi aux vacances, acheter les livres, payer une mutuelle, sortir de temps ' +
          'en temps. C’est aussi elle qui détermine si vous devrez travailler pendant ' +
          'l’année, et combien d’heures — le facteur le mieux documenté d’échec en ' +
          'première année.',
      ),
      t('Ce qu’il faut regarder, dans l’ordre'),
      l(
        'Le loyer d’un logement réaliste dans la commune de la formation, pas dans la ' +
          'métropole voisine.',
        'Ce à quoi vous avez droit : aide au logement, bourse, tarifs universitaires. ' +
          'Cela change complètement l’équation et beaucoup de familles ne le simulent jamais.',
        'Le transport quotidien, qui est souvent le poste caché d’une ville « moins chère ».',
        'Les frais d’installation, qu’on oublie systématiquement : dépôt de garantie, ' +
          'premier mois, assurance, mobilier de base. Ils tombent tous le même mois.',
        'Ce qu’il reste une fois tout payé. C’est le seul chiffre qui dit si l’année est tenable.',
      ),
      e(
        'Ne comparez pas des loyers, comparez des restes à vivre. Une ville chère où vous ' +
          'êtes boursier et logé en résidence universitaire peut revenir moins cher qu’une ' +
          'ville bon marché où vous louez dans le privé.',
      ),
      t('Le piège de la ville « pas chère »'),
      p(
        'Une commune périphérique affiche un loyer attractif, et le compte semble bon. ' +
          'Puis on ajoute l’abonnement de transport, une heure de trajet matin et soir, ' +
          'l’impossibilité de rentrer entre deux cours, et les repas pris dehors faute de ' +
          'pouvoir passer chez soi. Le gain fond, et la fatigue reste.',
      ),
      p(
        'La bonne question n’est pas « où le mètre carré est-il le moins cher ? » mais ' +
          '« combien de minutes pour aller en cours, et combien ça coûte ? ». Un logement ' +
          'à quinze minutes à pied d’un campus vaut souvent mieux qu’un logement moins cher ' +
          'à quarante minutes de bus.',
      ),
      t('L’erreur classique'),
      p(
        'Choisir la grande ville par défaut, parce que « c’est là qu’il se passe des ' +
          'choses ». Les villes moyennes universitaires offrent souvent des formations ' +
          'équivalentes, des promotions plus petites, des enseignants plus disponibles, et ' +
          'un budget qui laisse respirer. Le prestige d’une adresse ne figure sur aucun ' +
          'diplôme.',
      ),
      p(
        'L’erreur symétrique existe aussi : rester chez ses parents « pour économiser » ' +
          'alors que la formation visée est ailleurs, et se retrouver dans une filière de ' +
          'proximité qu’on quitte au bout d’un an. Le calcul doit intégrer ce que coûte un ' +
          'renoncement, pas seulement ce que coûte un loyer.',
      ),
      t('Quand s’en occuper'),
      p(
        'Avant de formuler les vœux, pas après les réponses. En juin, le calcul est déjà ' +
          'fait : vous choisissez entre ce que vous avez demandé. Le vrai choix de ville se ' +
          'joue en février, au moment où vous décidez quelles portes vous ouvrez.',
      ),
      p(
        'Concrètement : pour chaque ville de votre liste, posez le loyer d’un logement ' +
          'réaliste, ajoutez les aides auxquelles vous auriez droit, retranchez le ' +
          'transport, et regardez ce qui reste. Faites-le avec des barèmes datés, pas avec ' +
          'un chiffre lu sur un forum — les montants changent chaque année et dépendent de ' +
          'votre situation. Une formation qui n’est pas finançable n’est pas un vœu, c’est ' +
          'un regret programmé.',
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
      t('Ce que les formations voient exactement'),
      p(
        'Elles voient vos bulletins de première et de terminale, matière par matière, avec ' +
          'les appréciations. Elles voient vos résultats aux épreuves anticipées de ' +
          'français. Elles voient vos spécialités et les notes obtenues dedans. Et elles ' +
          'voient une fiche renseignée par votre lycée, où figurent un avis par matière et ' +
          'une appréciation du chef d’établissement sur votre capacité à réussir dans la ' +
          'voie demandée.',
      ),
      p(
        'Cette dernière pièce est la moins connue des élèves et l’une des plus regardées ' +
          'par les commissions : elle vient de gens qui vous ont vu travailler toute ' +
          'l’année, ce qu’aucune note ne dit.',
      ),
      t('Les matières de la filière visée passent devant'),
      p(
        'Une école d’ingénieurs regarde les mathématiques et la physique avant la moyenne ' +
          'générale. Une licence de droit regarde le français, l’histoire et la capacité à ' +
          'rédiger. Un 12 dans la matière centrale pèse plus qu’un 15 obtenu ailleurs, et ' +
          'l’inverse est vrai aussi.',
      ),
      p(
        'Le choix des spécialités joue le même rôle, en amont. Il ne ferme presque jamais ' +
          'une porte à lui seul, mais il rend certaines candidatures plus naturelles que ' +
          'd’autres. Les statistiques des admis, publiées sur chaque fiche, montrent les ' +
          'combinaisons réellement représentées : c’est une information plus honnête que ' +
          'les rumeurs de couloir.',
      ),
      t('La progression se voit, et elle se valorise'),
      p(
        'Trois trimestres à 11, 13 puis 15 racontent une autre histoire que 15, 13 puis 11, ' +
          'à moyenne égale. Les jurys lisent des trajectoires. Une remontée en terminale est ' +
          'l’un des rares éléments qu’un candidat peut encore construire au moment où il ' +
          'formule ses vœux.',
      ),
      p(
        'C’est aussi pour cela que les premiers trimestres de terminale comptent beaucoup : ' +
          'ce sont les derniers résultats complets dont disposent les commissions au moment ' +
          'où elles examinent votre dossier. Un sursaut au troisième trimestre arrive trop ' +
          'tard pour être lu.',
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
      p(
        'Une appréciation sévère n’est pas irrattrapable, à une condition : qu’elle soit ' +
          'contredite par les suivantes. Une série « peut mieux faire » qui devient ' +
          '« nets progrès, élève impliqué » raconte exactement ce qu’une commission ' +
          'espère lire.',
      ),
      t('Et si un trimestre a mal tourné'),
      p(
        'Un accident — maladie, deuil, période difficile — se mentionne plutôt qu’il ne se ' +
          'cache. Le projet de formation motivé sert aussi à ça : une phrase sobre, sans ' +
          'pathos, qui explique un décrochage ponctuel et montre ce qui a suivi. Les ' +
          'commissions lisent des dossiers humains, pas des séries statistiques.',
      ),
      t('Ce que cela change concrètement'),
      l(
        'Travaillez d’abord les matières de la filière que vous visez, même si la moyenne ' +
          'générale en souffre un peu.',
        'Soignez les deux premiers trimestres de terminale en priorité : ce sont ceux qui ' +
          'seront lus.',
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
      p(
        'Le format impose sa loi : l’espace est compté, en caractères, et il est court. ' +
          'Cela n’est pas une contrainte hostile, c’est une indication. On ne vous demande ' +
          'pas une dissertation sur votre vocation, on vous demande de montrer en quelques ' +
          'phrases que vous savez où vous postulez.',
      ),
      t('Ce que le lecteur cherche'),
      l(
        'Que vous sachiez ce qu’on fait dans cette formation — pas ce que le métier ' +
          'représente, ce que les études contiennent.',
        'Un lien concret entre ce que vous avez déjà fait et ce qui vous attend.',
        'Une raison de vouloir CETTE formation-là, et pas la même ailleurs.',
        'Que vous ayez lu les attendus et les critères d’examen publiés sur la fiche : ' +
          'y répondre point par point, sans les réciter, est le moyen le plus simple ' +
          'd’écrire un texte utile.',
      ),
      t('Ce qui dessert'),
      p(
        'La passion déclarée sans preuve : « j’ai toujours été passionné par » n’a jamais ' +
          'convaincu personne. Le copier-coller d’un vœu à l’autre, qui se repère au premier ' +
          'coup d’œil quand le nom de la formation ne correspond pas. Et l’exagération, qui ' +
          'crée une attente impossible à tenir en entretien ou en première année.',
      ),
      p(
        'S’y ajoutent deux défauts moins visibles. Le texte qui parle du métier plutôt que ' +
          'des études : vouloir être avocat ne dit rien de votre intérêt pour trois ans de ' +
          'droit civil. Et le texte qui raconte votre parcours scolaire, que le lecteur a ' +
          'déjà sous les yeux dans vos bulletins — il n’a pas besoin qu’on le lui résume, ' +
          'il a besoin qu’on l’éclaire.',
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
      t('Où trouver le concret'),
      p(
        'Dans la maquette de la formation, publiée par l’établissement : les intitulés des ' +
          'unités d’enseignement de première année vous donnent de quoi écrire une phrase ' +
          'qu’aucun autre candidat n’écrira. Dans une journée portes ouvertes, où une ' +
          'question posée à un étudiant vaut dix pages de brochure. Dans un stage, un job, ' +
          'une association, une pratique personnelle — à condition de dire ce que vous y ' +
          'avez fait, pas seulement que vous y étiez.',
      ),
      p(
        'La rubrique consacrée aux activités et centres d’intérêt sert exactement à ça : ' +
          'elle est facultative et sous-utilisée, alors qu’elle permet de montrer un ' +
          'engagement, un encadrement, une pratique régulière. Elle existe pour les ' +
          'candidats dont tout ne tient pas dans un bulletin.',
      ),
      t('Relire, couper, recommencer'),
      p(
        'Relisez à voix haute. Si une phrase pourrait figurer dans la lettre de n’importe ' +
          'qui, supprimez-la : elle occupe la place d’une phrase qui vous ressemble.',
      ),
      p(
        'Faites relire par quelqu’un qui ne connaît pas la filière : s’il ne comprend pas ' +
          'ce que vous allez y étudier, le texte n’est pas assez concret. Et écrivez-les ' +
          'étalés dans le temps, un ou deux par semaine à partir de février — dix textes ' +
          'rédigés la veille de la clôture se ressemblent tous, y compris pour vous.',
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
        'Juin–juillet : répondre. Consulter le dossier chaque jour, même pendant les épreuves.',
      ),
      p(
        'La faute de rythme classique consiste à tout faire en mars : découvrir les ' +
          'formations, choisir, rédiger dix textes et confirmer. C’est faisable, et c’est ' +
          'exactement ainsi qu’on formule des vœux qu’on regrette.',
      ),
      p(
        'L’automne est le moment le plus sous-employé de l’année. Personne ne vous demande ' +
          'rien, donc on ne fait rien — alors que c’est la seule période où l’on peut ' +
          'explorer sans enjeu, changer d’avis trois fois, et découvrir une filière dont on ' +
          'ignorait l’existence. Deux heures par semaine en novembre valent dix heures en ' +
          'mars.',
      ),
      t('Une méthode de travail qui tient sur la durée'),
      l(
        'Des séances courtes et régulières battent les week-ends de rattrapage : la mémoire ' +
          'fonctionne à la répétition, pas à l’intensité.',
        'Se tester vaut mieux que relire. Fermer le cours et tenter de le restituer révèle ' +
          'ce qu’on ne sait pas ; relire donne seulement l’impression de savoir.',
        'Espacer les reprises : revoir une notion le lendemain, puis une semaine après, ' +
          'puis un mois après, la fixe bien plus sûrement que trois relectures d’affilée.',
        'Une matière difficile se travaille au moment de la journée où vous êtes le plus ' +
          'disponible, pas en dernier quand il ne reste que la fatigue.',
        'Le téléphone hors de la pièce, pas retourné sur la table : sa seule présence ' +
          'suffit à coûter de l’attention.',
      ),
      e(
        'Le sommeil n’est pas du temps perdu sur les révisions : c’est le moment où ce que ' +
          'vous avez travaillé se fixe. Une nuit blanche avant une épreuve coûte plus ' +
          'qu’elle ne rapporte.',
      ),
      t('Tenir le mois de juin'),
      p(
        'C’est la période la plus inconfortable de l’année : les épreuves et les réponses ' +
          'tombent en même temps, et chaque proposition ouvre un délai court. Prévoyez un ' +
          'moment fixe dans la journée pour consulter votre dossier — le soir, une fois — ' +
          'plutôt que de le rafraîchir entre deux exercices. Le classement automatique des ' +
          'vœux en attente existe exactement pour ça : il répond à votre place pendant que ' +
          'vous composez.',
      ),
      t('Ce que la famille peut faire, et ne pas faire'),
      p(
        'Utile : rappeler les dates, relire un texte à voix haute, aider à chiffrer ce que ' +
          'coûterait chaque ville. Moins utile : commenter chaque proposition qui tombe, ' +
          'comparer avec les enfants des voisins, ou transformer le dîner en point ' +
          'd’avancement quotidien. La pression extérieure ne fait pas monter un rang de ' +
          'liste d’attente.',
      ),
      t('Garder une porte de sortie mentale'),
      p(
        'Aucun vœu ne décide de votre vie. Les réorientations en première année sont ' +
          'nombreuses, prévues, et sans drame. Le savoir en février rend le mois de mars ' +
          'beaucoup plus respirable.',
      ),
      p(
        'Et si l’année devient lourde, le dire tôt : professeur principal, personnels ' +
          'd’orientation, infirmerie du lycée. Ce sont des interlocuteurs prévus pour ça, ' +
          'et ils ont vu passer beaucoup d’élèves dans la même situation que vous. Les ' +
          'services de santé étudiante proposent par ailleurs des consultations gratuites, ' +
          'y compris avant l’entrée dans le supérieur.',
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
      p(
        'C’est le malentendu central : formuler des vœux ne déclenche aucune demande ' +
          'd’aide. Ce sont deux procédures distinctes, sur deux sites, avec deux ' +
          'calendriers. Personne ne fera le lien à votre place.',
      ),
      t('Le dossier social étudiant'),
      p(
        'C’est la demande unique de bourse et de logement en résidence universitaire. Elle ' +
          'se fait indépendamment de vos vœux, avant même de savoir où vous serez admis, et ' +
          'elle se modifie ensuite. L’attendre pour la faire, c’est la faire trop tard.',
      ),
      p(
        'Elle s’appuie sur l’avis d’imposition du foyer, le nombre d’enfants à charge et la ' +
          'distance entre le domicile et le lieu d’études. Ces trois éléments déterminent un ' +
          'échelon, et l’échelon détermine le montant. Rassemblez les documents en amont : ' +
          'c’est la partie qui bloque les familles au dernier moment.',
      ),
      e(
        'Faites la demande même si vous doutez d’y avoir droit. Le calcul dépend des ' +
          'revenus, du nombre d’enfants à charge et de la distance au lieu d’études : ' +
          'beaucoup de familles s’excluent elles-mêmes à tort.',
      ),
      p(
        'Deux situations méritent une attention particulière, parce qu’elles sortent du ' +
          'barème ordinaire : une rupture familiale, et une baisse de revenus récente. Dans ' +
          'ces deux cas, le dossier peut être réexaminé sur la situation actuelle plutôt que ' +
          'sur l’avis d’imposition de l’année précédente. Il faut le demander, et le ' +
          'signaler au service social du CROUS.',
      ),
      t('Le logement, et son calendrier propre'),
      p(
        'Les résidences universitaires s’attribuent au printemps, bien avant que vous ' +
          'sachiez où vous serez admis. On postule donc sur les villes qu’on a demandées en ' +
          'vœux, quitte à renoncer ensuite. Ne pas postuler « parce qu’on n’est pas encore ' +
          'sûr » revient à se priver de la solution la moins chère.',
      ),
      p(
        'Dans le parc privé, le calendrier est inverse : les meilleures offres partent tôt ' +
          'dans les villes tendues, et ce qui reste en août est ce que personne n’a voulu. ' +
          'Préparez le dossier de location en amont — pièces d’identité, avis d’imposition ' +
          'des garants, justificatifs — parce qu’un logement se perd souvent au profit du ' +
          'candidat qui répond dans l’heure avec un dossier complet.',
      ),
      t('Les autres démarches du printemps'),
      l(
        'La contribution de vie étudiante et de campus, à régler avant l’inscription ' +
          'administrative, avec une exonération pour les boursiers.',
        'L’aide au logement, qui se demande une fois le bail signé, et qui change ' +
          'complètement le budget réel.',
        'Le logement privé, à chercher tôt dans les villes tendues : les annonces de juin ' +
          'sont déjà les moins bonnes.',
        'La garantie locative publique, qui remplace un garant quand la famille ne peut ' +
          'pas se porter caution — beaucoup de bailleurs l’acceptent et peu d’étudiants ' +
          'la connaissent.',
        'Les aides des régions, départements et communes, qui existent presque partout et ' +
          'ne sont presque jamais demandées.',
      ),
      t('Ce que personne ne vous dit'),
      p(
        'Les aides ne se cumulent pas toutes, et certaines dépendent du logement que vous ' +
          'choisissez. C’est exactement le genre de calcul qu’il vaut mieux faire avant de ' +
          'signer, ville par ville, plutôt que de découvrir en octobre que le budget ne ' +
          'tombe pas juste.',
      ),
      p(
        'Le mois de la rentrée est aussi le plus lourd de l’année : dépôt de garantie, ' +
          'premier loyer, assurance, contribution, frais d’inscription et installation ' +
          'tombent ensemble, alors que les premières aides mettent quelques semaines à ' +
          'arriver. Ce décalage se prévoit ; il surprend chaque année des familles qui ' +
          'avaient pourtant bien calculé l’année.',
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
