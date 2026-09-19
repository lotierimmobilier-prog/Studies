import { describe, it, expect } from 'vitest'
import { coutDeLaVie, budgetMensuel } from '../../data/coutVie'

describe('coutDeLaVie', () => {
  it('trouve une ville connue (insensible aux accents/casse)', () => {
    expect(coutDeLaVie('Paris', 'Île-de-France').loyerStudio).toBe(900)
    expect(coutDeLaVie('LYON', 'Auvergne-Rhône-Alpes').loyerStudio).toBe(620)
  })

  it('retombe sur la moyenne régionale pour une ville inconnue', () => {
    const c = coutDeLaVie('Petitbourg', 'Bretagne')
    expect(c.loyerStudio).toBe(510)
  })

  it('retombe sur la moyenne nationale sans ville ni région connues', () => {
    expect(coutDeLaVie('Nulle-part', null).loyerStudio).toBe(520)
  })
})

describe('budgetMensuel', () => {
  it('additionne loyer et budget de vie', () => {
    const b = budgetMensuel('Rennes', 'Bretagne')
    expect(b).toBe(540 + 440)
  })
})
