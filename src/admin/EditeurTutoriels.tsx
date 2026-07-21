import type { SourceVideo, Tutoriel } from '../types'
import { Champ, CarteEdition, ListeChaines, ZoneTexte } from './champs'

const TUTO_VIDE: Tutoriel = {
  id: '',
  titre: '',
  categorie: 'Essentiels',
  icone: '🎬',
  description: '',
  video: { type: 'youtube', id: '' },
  etapes: [],
}

/** Éditeur de la source vidéo (type + identifiant / lien). */
function EditeurVideo({
  video,
  onChange,
}: {
  video: SourceVideo
  onChange: (v: SourceVideo) => void
}) {
  return (
    <div className="video-editeur">
      <label className="champ">
        <span className="champ-label">Type de vidéo</span>
        <select
          value={video.type}
          onChange={(e) => {
            const type = e.target.value as SourceVideo['type']
            if (type === 'fichier') onChange({ type: 'fichier', src: '' })
            else onChange({ type, id: '' })
          }}
        >
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
          <option value="fichier">Fichier hébergé (.mp4)</option>
        </select>
      </label>
      {video.type === 'fichier' ? (
        <Champ
          label="Chemin du fichier"
          valeur={video.src}
          onChange={(src) => onChange({ type: 'fichier', src })}
          placeholder="/videos/clim.mp4"
          aide="Fichier déposé dans public/videos/"
        />
      ) : (
        <Champ
          label={video.type === 'youtube' ? 'ID YouTube' : 'ID Vimeo'}
          valeur={video.id}
          onChange={(id) => onChange({ type: video.type, id })}
          placeholder={video.type === 'youtube' ? 'dQw4w9WgXcQ' : '76979871'}
          aide={
            video.type === 'youtube'
              ? "L'identifiant après « v= » ou youtu.be/"
              : "L'identifiant numérique de la vidéo Vimeo"
          }
        />
      )}
    </div>
  )
}

export default function EditeurTutoriels({
  tutoriels,
  onChange,
}: {
  tutoriels: Tutoriel[]
  onChange: (t: Tutoriel[]) => void
}) {
  function maj(i: number, patch: Partial<Tutoriel>) {
    onChange(tutoriels.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  }
  function supprimer(i: number) {
    onChange(tutoriels.filter((_, j) => j !== i))
  }
  function ajouter() {
    onChange([
      ...tutoriels,
      { ...TUTO_VIDE, id: `tuto-${Date.now()}` },
    ])
  }

  return (
    <div className="editeur">
      <div className="editeur-intro">
        <h2>Tutoriels vidéo</h2>
        <p>
          Une capsule vidéo par équipement. Mettez vos vidéos en ligne sur
          YouTube (réglage « Non répertoriée » conseillé) et collez leur
          identifiant.
        </p>
      </div>

      {tutoriels.map((t, i) => (
        <CarteEdition
          key={t.id || i}
          titre={`${t.icone} ${t.titre || 'Nouveau tutoriel'}`}
          onSupprimer={() => supprimer(i)}
        >
          <div className="grille-champs">
            <Champ
              label="Titre"
              valeur={t.titre}
              onChange={(v) => maj(i, { titre: v })}
              placeholder="ex. Utiliser la climatisation"
            />
            <Champ
              label="Catégorie"
              valeur={t.categorie}
              onChange={(v) => maj(i, { categorie: v })}
              placeholder="ex. Confort"
            />
            <Champ
              label="Icône (emoji)"
              valeur={t.icone}
              onChange={(v) => maj(i, { icone: v })}
              placeholder="❄️"
            />
          </div>
          <ZoneTexte
            label="Description"
            valeur={t.description}
            onChange={(v) => maj(i, { description: v })}
            lignes={2}
          />
          <EditeurVideo
            video={t.video}
            onChange={(v) => maj(i, { video: v })}
          />
          <ListeChaines
            label="Étapes (facultatif)"
            valeurs={t.etapes ?? []}
            onChange={(v) => maj(i, { etapes: v })}
            ajoutLabel="une étape"
          />
        </CarteEdition>
      ))}

      <button type="button" className="btn-ajouter" onClick={ajouter}>
        + Ajouter un tutoriel
      </button>
    </div>
  )
}
