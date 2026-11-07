import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../bulletin', () => ({
  analyserBulletin: vi.fn(),
}))

const { analyserBulletin } = await import('../bulletin')
const { extraireBulletin, avisAcceptable, AUTEUR_AVIS } = await import('../bulletinScolaire')

const ANALYSE_COMPLETE = {
  notes: { mathematiques: 15.5, francais: 11, svt: null, physique_chimie: 22 },
  appreciationGlobale:
    'Élève sérieux mais discret. Des difficultés passagères au premier trimestre.',
  signaux: { serieux: 8, participation: 4, progression: 7 },
  pointsForts: ['travail régulier', 'bon niveau en mathématiques'],
  pointsAmeliorer: ['participation à l’oral'],
}

afterEach(() => vi.resetAllMocks())

describe('extraction d’un bulletin pour KITETUDIANT', () => {
  it('ne laisse sortir que ce qui est prévu, et rien d’autre', async () => {
    // Le contour exact de ce qui sort. Ce test tombait quand la synthèse a été
    // ajoutée : c'est sa raison d'être — aucun champ n'apparaît sans décision.
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(Object.keys(extrait).sort()).toEqual([
      'avis',
      'matieresLues',
      'notes',
      'signaux',
      'source',
    ])
  })

  it('rend la synthèse des appréciations, signée d’une machine', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.avis?.texte).toContain('sérieux mais discret')
    expect(extrait.avis?.pointsForts).toEqual(['travail régulier', 'bon niveau en mathématiques'])
    expect(extrait.avis?.aTravailler).toEqual(['participation à l’oral'])
    // L'auteur dit CE QU'IL EST. Le site parle à des mineurs : laisser croire
    // qu'un adulte a lu leur bulletin donnerait à ces phrases un poids
    // qu'elles n'ont pas.
    expect(extrait.avis?.auteur).toBe(AUTEUR_AVIS)
    expect(AUTEUR_AVIS).toMatch(/machine/i)
    expect(AUTEUR_AVIS).toMatch(/pas un professeur/i)
  })

  it('n’invente pas d’avis quand il n’y a rien à dire', async () => {
    // Une absence s'affiche comme une absence. Fabriquer « Continue comme
    // ça ! » serait une valeur de repli, ce que CLAUDE.md interdit.
    vi.mocked(analyserBulletin).mockResolvedValue({
      ...ANALYSE_COMPLETE,
      appreciationGlobale: '   ',
    })
    expect((await extraireBulletin('base64', 'application/pdf')).avis).toBeNull()
  })

  it('refuse un avis qui contiendrait un montant en euros', async () => {
    // Règle 1 : aucun euro affiché ne peut venir d'un modèle de langage. Un
    // avis qui chiffrerait un budget contournerait la chaîne de calcul sourcée.
    vi.mocked(analyserBulletin).mockResolvedValue({
      ...ANALYSE_COMPLETE,
      appreciationGlobale: 'Bon dossier ; prévois environ 700 € par mois sur place.',
    })
    expect((await extraireBulletin('base64', 'application/pdf')).avis).toBeNull()
  })

  it('refuse une formule anxiogène, et n’en garde aucune dans les listes', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue({
      ...ANALYSE_COMPLETE,
      appreciationGlobale: 'Tu n’as aucune chance dans cette filière.',
    })
    expect((await extraireBulletin('base64', 'application/pdf')).avis).toBeNull()

    vi.mocked(analyserBulletin).mockResolvedValue({
      ...ANALYSE_COMPLETE,
      pointsAmeliorer: ['participation à l’oral', 'c’est fichu pour les maths'],
    })
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.avis?.aTravailler).toEqual(['participation à l’oral'])
  })

  it('juge chaque phrase sur ce qu’elle contient', () => {
    expect(avisAcceptable('Élève sérieux, en progrès au deuxième trimestre.')).toBe(true)
    expect(avisAcceptable('')).toBe(false)
    expect(avisAcceptable('Il te restera 420 € par mois.')).toBe(false)
    expect(avisAcceptable('Aucune chance en prépa.')).toBe(false)
    expect(avisAcceptable('Niveau catastrophique.')).toBe(false)
    // « 20 » sans euro reste une note, pas un montant : on ne la censure pas.
    expect(avisAcceptable('Une moyenne de 14 sur 20 en mathématiques.')).toBe(true)
  })

  it('ne recopie jamais le texte brut au-delà de la synthèse', async () => {
    // La règle 3 porte sur les textes BRUTS d'appréciations. La synthèse est
    // permise ; ce qui ne l'est pas, c'est que le bulletin soit conservé.
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(JSON.stringify(extrait)).not.toContain('base64')
  })

  it('garde les moyennes lues et écarte les matières absentes', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.notes.mathematiques).toBe(15.5)
    expect(extrait.notes.francais).toBe(11)
    expect(extrait.notes).not.toHaveProperty('svt')
    expect(extrait.matieresLues).toBe(3)
  })

  it('borne les notes à 20 plutôt que de propager une valeur aberrante', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.notes.physique_chimie).toBe(20)
  })

  it('borne les signaux à 10 et remplace l’absurde par zéro', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue({
      ...ANALYSE_COMPLETE,
      signaux: { serieux: 99, participation: Number.NaN, progression: -3 },
    })
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.signaux).toEqual({ serieux: 10, participation: 0, progression: 0 })
  })

  it('dit d’où viennent ces chiffres et que le texte n’est pas conservé', async () => {
    vi.mocked(analyserBulletin).mockResolvedValue(ANALYSE_COMPLETE)
    const extrait = await extraireBulletin('base64', 'application/pdf')
    expect(extrait.source).toContain('non conservé')
  })
})
