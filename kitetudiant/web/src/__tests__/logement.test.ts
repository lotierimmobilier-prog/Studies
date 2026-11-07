import { describe, expect, it } from 'vitest'

import { liensLogement } from '../logement.ts'

describe('liens de recherche de logement', () => {
  it('met la résidence universitaire en premier', () => {
    // Le site conseille le CROUS dans ses articles. Mettre le privé devant
    // contredirait son propre conseil, et un produit qui se contredit ne
    // mérite pas qu'on le croie.
    expect(liensLogement('Toulouse')[0]!.cle).toBe('crous')
  })

  it('encode la ville, accents et espaces compris', () => {
    const prive = liensLogement('Saint-Étienne')[1]!
    expect(prive.url).toContain('locations=Saint-%C3%89tienne')
    expect(prive.url).not.toContain(' ')
  })

  it('vise les locations d’appartements d’une à deux pièces', () => {
    const prive = liensLogement('Limoges')[1]!
    // category=10 : la rubrique « Locations ». Sans elle, la recherche
    // ramènerait des ventes, ce qui n'a rien à voir.
    expect(prive.url).toContain('category=10')
    expect(prive.url).toContain('real_estate_type=2')
    expect(prive.url).toContain('rooms=1%2C2')
  })

  it('n’invente pas de recherche quand la ville est inconnue', () => {
    // Une recherche sur une commune vide ouvre une page vide : c'est pire
    // que pas de lien du tout.
    for (const vide of ['', '   ']) {
      const liens = liensLogement(vide)
      expect(liens).toHaveLength(1)
      expect(liens[0]!.cle).toBe('crous')
    }
  })

  it('dit « chercher », jamais « trouver »', () => {
    // Le site n'a aucun lien avec ces services et ne peut pas vérifier ce
    // qu'on y trouve. Promettre un résultat serait une promesse d'autrui.
    for (const lien of liensLogement('Nancy')) {
      expect(lien.libelle.toLowerCase()).not.toMatch(/\btrouve[rz]?\b/)
      expect(lien.url.startsWith('https://')).toBe(true)
    }
  })
})
