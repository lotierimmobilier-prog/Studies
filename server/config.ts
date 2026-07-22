import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'
import { dirname, join } from 'node:path'
import type {
  Configuration,
  ContenuVoyageur,
  Sejour,
  SectionTexte,
  SourceVideo,
  Textes,
  Tutoriel,
} from './types'

/** Textes par défaut du site (utilisés tant que l'hôte ne les modifie pas). */
export const TEXTES_DEFAUT: Textes = {
  connexionTitre: 'Bienvenue',
  connexionSousTitre: 'Votre espace voyageur pour un séjour en toute sérénité',
  checklistTitre: 'Pour bien commencer',
  checklist: [
    '🔑 Récupérer les clés dans la boîte à clés',
    '📶 Se connecter au Wi-Fi',
    '❄️ Découvrir la climatisation et les équipements',
    '🏖️ Repérer les bonnes adresses autour',
  ],
  acces: {
    titre: 'Accès à la maison',
    intro: 'Toutes les informations pratiques pour entrer et vous installer.',
  },
  tutoriels: {
    titre: 'Tutoriels de la maison',
    intro:
      'De courtes vidéos pour prendre en main chaque équipement en toute simplicité.',
  },
  tourisme: {
    titre: 'Tourisme & bonnes adresses',
    intro: 'Nos coups de cœur pour profiter pleinement de la région.',
  },
  galerie: {
    titre: 'La maison en photos',
    intro:
      "Découvrez votre lieu de vacances avant même d'y poser vos valises.",
  },
  contact: {
    titre: 'Contact & urgences',
    intro: 'Nous restons joignables pendant tout votre séjour.',
  },
}

/**
 * Chargement et **écriture** de la configuration (maison, séjours, tutoriels,
 * tourisme). Tout est édité depuis l'administration.
 *
 * Deux emplacements, par ordre de priorité en lecture :
 *   1. `.data/config.json`        → configuration réelle (écrite par l'admin)
 *   2. `server/data/config.json`  → l'exemple fourni (versionné)
 *
 * Les écritures vont toujours dans `.data/config.json` (jamais versionné, donc
 * jamais écrasé par une mise à jour du code).
 */

const CHEMIN_PERSO = join(process.cwd(), '.data', 'config.json')
const CHEMIN_EXEMPLE = join(process.cwd(), 'server', 'data', 'config.json')

/** Mot de passe de l'administration (à définir en production). */
const MOT_DE_PASSE_ADMIN = process.env.ADMIN_PASSWORD ?? 'admin'

let config: Configuration | null = null

export async function chargerConfiguration(): Promise<Configuration> {
  const chemin = existsSync(CHEMIN_PERSO) ? CHEMIN_PERSO : CHEMIN_EXEMPLE
  // On normalise au chargement : garantit la présence de tous les champs
  // (textes, documents…) même pour une config antérieure à leur ajout.
  config = validerConfiguration(JSON.parse(await readFile(chemin, 'utf8')))
  return config
}

function courante(): Configuration {
  if (!config) throw new Error('Configuration non chargée')
  return config
}

/** Compare deux chaînes à temps constant (anti-timing). */
function egaliteSure(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Vérifie le mot de passe administrateur. */
export function verifierAdmin(motDePasse: string): boolean {
  return egaliteSure(motDePasse, MOT_DE_PASSE_ADMIN)
}

/** Normalise un code (insensible à la casse et aux espaces) pour comparaison. */
function normaliserCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, '')
}

/** Retrouve un séjour par son code de connexion, ou `null`. */
export function sejourParCode(code: string): Sejour | null {
  const c = normaliserCode(code)
  if (!c) return null
  return (
    courante().sejours.find((s) => normaliserCode(s.code) === c) ?? null
  )
}

/** Assemble le contenu envoyé à un voyageur connecté. */
export function contenuVoyageur(sejour: Sejour): ContenuVoyageur {
  const c = courante()
  return {
    sejour,
    maison: c.maison,
    tutoriels: c.tutoriels,
    tourisme: c.tourisme,
    galerie: c.galerie,
    documents: c.documents,
    textes: c.textes,
  }
}

/** La configuration complète (pour l'administration). */
export function configurationComplete(): Configuration {
  return courante()
}

/**
 * Enregistre une nouvelle configuration (depuis l'administration). Écrit dans
 * `.data/config.json` et met à jour la copie en mémoire.
 */
export async function enregistrerConfiguration(
  nouvelle: Configuration,
): Promise<void> {
  const propre = validerConfiguration(nouvelle)
  await mkdir(dirname(CHEMIN_PERSO), { recursive: true })
  await writeFile(CHEMIN_PERSO, JSON.stringify(propre, null, 2), 'utf8')
  config = propre
}

// --------------------------------------------------------------- validation

function chaine(v: unknown, defaut = ''): string {
  return typeof v === 'string' ? v : defaut
}

function tableauChaines(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/**
 * Nettoie/valide la configuration reçue de l'administration : on garantit la
 * forme attendue (types corrects, tableaux présents) sans faire confiance
 * aveuglément au corps de la requête.
 */
export function validerConfiguration(brut: unknown): Configuration {
  const c = (brut ?? {}) as Record<string, unknown>
  const maisonBrut = (c.maison ?? {}) as Record<string, unknown>
  const wifiBrut = (maisonBrut.wifi ?? {}) as Record<string, unknown>
  const hoteBrut = (maisonBrut.hote ?? {}) as Record<string, unknown>

  const maison = {
    nom: chaine(maisonBrut.nom, 'Ma maison'),
    sousTitre: chaine(maisonBrut.sousTitre),
    photo: chaine(maisonBrut.photo),
    adresse: chaine(maisonBrut.adresse),
    lienCarte: chaine(maisonBrut.lienCarte),
    wifi: {
      reseau: chaine(wifiBrut.reseau),
      motDePasse: chaine(wifiBrut.motDePasse),
    },
    codeAcces: chaine(maisonBrut.codeAcces),
    instructionsArrivee: tableauChaines(maisonBrut.instructionsArrivee),
    instructionsDepart: tableauChaines(maisonBrut.instructionsDepart),
    parking: chaine(maisonBrut.parking),
    reglement: tableauChaines(maisonBrut.reglement),
    hote: {
      nom: chaine(hoteBrut.nom),
      telephone: chaine(hoteBrut.telephone),
      email: chaine(hoteBrut.email),
      whatsapp: chaine(hoteBrut.whatsapp),
    },
    numerosUtiles: (Array.isArray(maisonBrut.numerosUtiles)
      ? maisonBrut.numerosUtiles
      : []
    ).map((n) => {
      const o = (n ?? {}) as Record<string, unknown>
      return { libelle: chaine(o.libelle), numero: chaine(o.numero) }
    }),
  }

  const sejours = (Array.isArray(c.sejours) ? c.sejours : []).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>
    return {
      code: chaine(o.code),
      nom: chaine(o.nom),
      arrivee: chaine(o.arrivee),
      depart: chaine(o.depart),
      voyageurs:
        typeof o.voyageurs === 'number' ? o.voyageurs : undefined,
      messageHote: chaine(o.messageHote),
      sourceUid: chaine(o.sourceUid) || undefined,
      plateforme: chaine(o.plateforme) || undefined,
    }
  })

  const tutoriels: Tutoriel[] = (
    Array.isArray(c.tutoriels) ? c.tutoriels : []
  ).map((t, i) => {
    const o = (t ?? {}) as Record<string, unknown>
      const v = (o.video ?? {}) as Record<string, unknown>
      const video: SourceVideo =
        v.type === 'fichier'
          ? { type: 'fichier', src: chaine(v.src) }
          : v.type === 'vimeo'
            ? { type: 'vimeo', id: chaine(v.id) }
            : { type: 'youtube', id: chaine(v.id) }
      return {
        id: chaine(o.id) || `tuto-${i}`,
        titre: chaine(o.titre),
        categorie: chaine(o.categorie, 'Autres'),
        icone: chaine(o.icone, '🎬'),
        description: chaine(o.description),
        video,
        etapes: tableauChaines(o.etapes),
      }
  })

  const tourisme = (Array.isArray(c.tourisme) ? c.tourisme : []).map((l, i) => {
    const o = (l ?? {}) as Record<string, unknown>
    return {
      id: chaine(o.id) || `lieu-${i}`,
      nom: chaine(o.nom),
      categorie: chaine(o.categorie, 'Autres'),
      icone: chaine(o.icone, '📍'),
      description: chaine(o.description),
      distance: chaine(o.distance),
      telephone: chaine(o.telephone),
      siteWeb: chaine(o.siteWeb),
      lienCarte: chaine(o.lienCarte),
      conseilHote: chaine(o.conseilHote),
    }
  })

  const galerie = (Array.isArray(c.galerie) ? c.galerie : []).map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>
    return {
      id: chaine(o.id) || `photo-${i}`,
      url: chaine(o.url),
      legende: chaine(o.legende),
    }
  })

  const calendriers = (Array.isArray(c.calendriers) ? c.calendriers : []).map(
    (cal, i) => {
      const o = (cal ?? {}) as Record<string, unknown>
      return {
        id: chaine(o.id) || `cal-${i}`,
        url: chaine(o.url),
        nom: chaine(o.nom),
      }
    },
  )

  const documents = (Array.isArray(c.documents) ? c.documents : []).map(
    (d, i) => {
      const o = (d ?? {}) as Record<string, unknown>
      return {
        id: chaine(o.id) || `doc-${i}`,
        titre: chaine(o.titre, 'Document'),
        url: chaine(o.url),
      }
    },
  )

  const textes = validerTextes(c.textes)

  return {
    maison,
    sejours,
    tutoriels,
    tourisme,
    galerie,
    documents,
    textes,
    calendriers,
  }
}

/** Reprend un texte fourni s'il est non vide, sinon la valeur par défaut. */
function texteOuDefaut(v: unknown, defaut: string): string {
  const s = typeof v === 'string' ? v.trim() : ''
  return s || defaut
}

function section(v: unknown, defaut: SectionTexte): SectionTexte {
  const o = (v ?? {}) as Record<string, unknown>
  return {
    titre: texteOuDefaut(o.titre, defaut.titre),
    intro: texteOuDefaut(o.intro, defaut.intro),
  }
}

/** Valide les textes en comblant chaque champ manquant par sa valeur par défaut. */
export function validerTextes(brut: unknown): Textes {
  const t = (brut ?? {}) as Record<string, unknown>
  const checklist = Array.isArray(t.checklist)
    ? t.checklist.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : []
  return {
    connexionTitre: texteOuDefaut(t.connexionTitre, TEXTES_DEFAUT.connexionTitre),
    connexionSousTitre: texteOuDefaut(
      t.connexionSousTitre,
      TEXTES_DEFAUT.connexionSousTitre,
    ),
    checklistTitre: texteOuDefaut(t.checklistTitre, TEXTES_DEFAUT.checklistTitre),
    checklist: checklist.length ? checklist : TEXTES_DEFAUT.checklist,
    acces: section(t.acces, TEXTES_DEFAUT.acces),
    tutoriels: section(t.tutoriels, TEXTES_DEFAUT.tutoriels),
    tourisme: section(t.tourisme, TEXTES_DEFAUT.tourisme),
    galerie: section(t.galerie, TEXTES_DEFAUT.galerie),
    contact: section(t.contact, TEXTES_DEFAUT.contact),
  }
}
