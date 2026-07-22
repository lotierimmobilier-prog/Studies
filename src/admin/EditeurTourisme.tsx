import type { LieuTourisme } from '../types'
import { Champ, CarteEdition, ZoneTexte } from './champs'

const LIEU_VIDE: LieuTourisme = {
  id: '',
  nom: '',
  categorie: 'À faire',
  icone: '📍',
  description: '',
  distance: '',
  telephone: '',
  siteWeb: '',
  lienCarte: '',
  conseilHote: '',
}

export default function EditeurTourisme({
  tourisme,
  onChange,
}: {
  tourisme: LieuTourisme[]
  onChange: (t: LieuTourisme[]) => void
}) {
  function maj(i: number, patch: Partial<LieuTourisme>) {
    onChange(tourisme.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }
  function supprimer(i: number) {
    onChange(tourisme.filter((_, j) => j !== i))
  }
  function ajouter() {
    onChange([...tourisme, { ...LIEU_VIDE, id: `lieu-${Date.now()}` }])
  }

  return (
    <div className="editeur">
      <div className="editeur-intro">
        <h2>Tourisme & bonnes adresses</h2>
        <p>
          Vos recommandations : restaurants, activités, services… avec leurs
          contacts et vos conseils personnels.
        </p>
      </div>

      {tourisme.map((l, i) => (
        <CarteEdition
          key={l.id || i}
          titre={`${l.icone} ${l.nom || 'Nouvelle adresse'}`}
          onSupprimer={() => supprimer(i)}
        >
          <div className="grille-champs">
            <Champ
              label="Nom"
              valeur={l.nom}
              onChange={(v) => maj(i, { nom: v })}
              placeholder="ex. Le Bistrot du Village"
            />
            <Champ
              label="Catégorie"
              valeur={l.categorie}
              onChange={(v) => maj(i, { categorie: v })}
              placeholder="ex. Restaurants"
            />
            <Champ
              label="Icône (emoji)"
              valeur={l.icone}
              onChange={(v) => maj(i, { icone: v })}
              placeholder="🍽️"
            />
            <Champ
              label="Distance"
              valeur={l.distance ?? ''}
              onChange={(v) => maj(i, { distance: v })}
              placeholder="ex. 5 min à pied"
            />
            <Champ
              label="Téléphone"
              valeur={l.telephone ?? ''}
              onChange={(v) => maj(i, { telephone: v })}
            />
            <Champ
              label="Site web"
              valeur={l.siteWeb ?? ''}
              onChange={(v) => maj(i, { siteWeb: v })}
              placeholder="https://…"
            />
            <Champ
              label="Lien carte"
              valeur={l.lienCarte ?? ''}
              onChange={(v) => maj(i, { lienCarte: v })}
              placeholder="https://maps.google.com/?q=…"
            />
          </div>
          <ZoneTexte
            label="Description"
            valeur={l.description}
            onChange={(v) => maj(i, { description: v })}
            lignes={2}
          />
          <ZoneTexte
            label="Votre conseil (facultatif)"
            valeur={l.conseilHote ?? ''}
            onChange={(v) => maj(i, { conseilHote: v })}
            lignes={2}
            placeholder="Un conseil personnel pour vos voyageurs…"
          />
        </CarteEdition>
      ))}

      <button type="button" className="btn-ajouter" onClick={ajouter}>
        + Ajouter une adresse
      </button>
    </div>
  )
}
