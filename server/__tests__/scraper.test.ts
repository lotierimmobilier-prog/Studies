import { describe, it, expect } from 'vitest'
import {
  htmlVersTexte,
  trouverMontantsEuros,
  extrairePrix,
} from '../scraper'

describe('htmlVersTexte', () => {
  it('retire les balises, scripts et entités', () => {
    const html = '<div>Frais&nbsp;: 9&nbsp;500&euro;<script>x=1</script></div>'
    expect(htmlVersTexte(html)).toBe('Frais : 9 500€')
  })
})

describe('trouverMontantsEuros', () => {
  it('détecte plusieurs formats de montants', () => {
    const m = trouverMontantsEuros('9 500 € puis 12000€ et 8.200 euros')
    expect(m.map((x) => x.valeur)).toEqual([9500, 12000, 8200])
  })
})

describe('extrairePrix', () => {
  it('choisit le montant proche du mot-clé « frais de scolarité »', () => {
    const html = `
      <p>Notre campus accueille 3000 étudiants.</p>
      <p>Frais de scolarité : 9 500 € par an.</p>
      <footer>Capital social 50000 €</footer>`
    expect(extrairePrix(html)).toBe(9500)
  })

  it('écarte les montants aberrants hors bornes', () => {
    const html = 'Frais de scolarité : 250000 € (coquille)'
    expect(extrairePrix(html)).toBeNull()
  })

  it('renvoie null si aucun montant proche d\'un indice', () => {
    const html = 'Le bâtiment a coûté 5000 € de peinture. Rien sur les tarifs.'
    // 5000 € n'est proche d'aucun mot-clé prix/annuel -> null
    expect(extrairePrix(html, { distanceMax: 30 })).toBeNull()
  })
})
