import type { SectionTexte, Textes } from '../types'
import { Champ, ListeChaines, ZoneTexte } from './champs'

/** Édite le titre + l'intro d'une section. */
function BlocSection({
  titre,
  valeur,
  onChange,
}: {
  titre: string
  valeur: SectionTexte
  onChange: (s: SectionTexte) => void
}) {
  return (
    <div className="carte-edition">
      <strong className="carte-edition-sous-titre">{titre}</strong>
      <Champ
        label="Titre"
        valeur={valeur.titre}
        onChange={(v) => onChange({ ...valeur, titre: v })}
      />
      <ZoneTexte
        label="Sous-titre"
        valeur={valeur.intro}
        onChange={(v) => onChange({ ...valeur, intro: v })}
        lignes={2}
      />
    </div>
  )
}

export default function EditeurTextes({
  textes,
  onChange,
}: {
  textes: Textes
  onChange: (t: Textes) => void
}) {
  function maj(patch: Partial<Textes>) {
    onChange({ ...textes, ...patch })
  }

  return (
    <div className="editeur">
      <div className="editeur-intro">
        <h2>Textes du site</h2>
        <p>
          Personnalisez tous les titres et messages vus par vos voyageurs.
          Laissez un champ vide pour revenir au texte par défaut.
        </p>
      </div>

      <div className="carte-edition">
        <strong className="carte-edition-sous-titre">Écran de connexion</strong>
        <Champ
          label="Titre"
          valeur={textes.connexionTitre}
          onChange={(v) => maj({ connexionTitre: v })}
          placeholder="Bienvenue"
        />
        <ZoneTexte
          label="Sous-titre"
          valeur={textes.connexionSousTitre}
          onChange={(v) => maj({ connexionSousTitre: v })}
          lignes={2}
        />
      </div>

      <div className="carte-edition">
        <strong className="carte-edition-sous-titre">
          Accueil — « Pour bien commencer »
        </strong>
        <Champ
          label="Titre du bloc"
          valeur={textes.checklistTitre}
          onChange={(v) => maj({ checklistTitre: v })}
        />
        <ListeChaines
          label="Points de la checklist (une ligne = un point, emoji possible)"
          valeurs={textes.checklist}
          onChange={(v) => maj({ checklist: v })}
          ajoutLabel="un point"
        />
      </div>

      <BlocSection
        titre="Section « Accès »"
        valeur={textes.acces}
        onChange={(acces) => maj({ acces })}
      />
      <BlocSection
        titre="Section « Tutoriels »"
        valeur={textes.tutoriels}
        onChange={(tutoriels) => maj({ tutoriels })}
      />
      <BlocSection
        titre="Section « Photos »"
        valeur={textes.galerie}
        onChange={(galerie) => maj({ galerie })}
      />
      <BlocSection
        titre="Section « Tourisme »"
        valeur={textes.tourisme}
        onChange={(tourisme) => maj({ tourisme })}
      />
      <BlocSection
        titre="Section « Contact »"
        valeur={textes.contact}
        onChange={(contact) => maj({ contact })}
      />
    </div>
  )
}
