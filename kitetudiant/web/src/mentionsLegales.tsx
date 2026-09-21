/**
 * La page des mentions légales.
 *
 * ── Ce qu'elle fait des faits manquants ──────────────────────────────────
 *
 * Raison sociale, adresse, SIREN, directeur de la publication, contact :
 * le code ne les connaît pas. Elle ne les invente pas et ne les tait pas
 * non plus — elle écrit « à compléter » à leur place, en clair.
 *
 * C'est délibérément visible. Une page légale à trous se corrige ; une page
 * légale qui a l'air complète parce que les trous ont été masqués ne se
 * corrige jamais, et c'est elle qui fait foi le jour d'un litige.
 */

import { useMetadonnees } from './metadonnees.ts'
import { adresseComplete, type Route } from './routes.ts'
import { FilAriane } from './filAriane.tsx'
import {
  IDENTITE,
  MENTIONS_DESCRIPTION,
  MENTIONS_TITRE,
  MENTIONS_TITRE_ONGLET,
  SECTIONS,
  type AFournir,
} from '../../packages/articles/src/mentionsLegales.ts'

/** Un fait d'identité, ou la mention de son absence. */
function Fait({ libelle, valeur }: { readonly libelle: string; readonly valeur: AFournir }) {
  return (
    <div className="compte-fait">
      <dt>{libelle}</dt>
      <dd>
        {valeur === null ? (
          <em className="legal-manquant">À compléter avant la mise en ligne.</em>
        ) : (
          valeur
        )}
      </dd>
    </div>
  )
}

export function MentionsLegales({ onNaviguer }: { readonly onNaviguer: (r: Route) => void }) {
  useMetadonnees({
    titre: MENTIONS_TITRE_ONGLET,
    description: MENTIONS_DESCRIPTION,
    canonique: adresseComplete({ vue: 'mentions' }),
  })

  const manquants = Object.values(IDENTITE).filter((v) => v === null).length

  return (
    <main className="app">
      <FilAriane
        maillons={[
          { libelle: 'Accueil', route: { vue: 'accueil' } },
          { libelle: MENTIONS_TITRE, route: null },
        ]}
        onNaviguer={onNaviguer}
      />

      <h1 className="article-titre">{MENTIONS_TITRE}</h1>

      {manquants > 0 ? (
        /* Un avertissement en haut, tant qu'il reste des trous. Il disparaît
           tout seul quand `IDENTITE` est renseignée : rien à penser à
           retirer, donc rien à oublier de retirer. */
        <p className="legal-avertissement" role="status">
          Cette page est incomplète : {manquants} information
          {manquants > 1 ? 's' : ''} d’identification de l’éditeur et de l’hébergeur
          {manquants > 1 ? ' restent' : ' reste'} à fournir. La loi les exige ; elles ne
          peuvent pas être devinées depuis le code.
        </p>
      ) : null}

      <section className="bloc">
        <h2>Éditeur du site</h2>
        <dl className="compte-faits">
          <Fait libelle="Éditeur" valeur={IDENTITE.editeur} />
          <Fait libelle="Forme juridique" valeur={IDENTITE.formeJuridique} />
          <Fait libelle="Adresse" valeur={IDENTITE.adresse} />
          <Fait libelle="SIREN / SIRET" valeur={IDENTITE.siren} />
          <Fait libelle="Directeur de la publication" valeur={IDENTITE.directeurPublication} />
          <Fait libelle="Contact" valeur={IDENTITE.contact} />
        </dl>
      </section>

      <section className="bloc">
        <h2>Hébergement</h2>
        <dl className="compte-faits">
          <Fait libelle="Hébergeur" valeur={IDENTITE.hebergeur} />
          <Fait libelle="Adresse de l’hébergeur" valeur={IDENTITE.adresseHebergeur} />
        </dl>
      </section>

      {SECTIONS.map((section) => (
        <section className="bloc" key={section.titre}>
          <h2>{section.titre}</h2>
          {section.corps.map((bloc, i) =>
            typeof bloc === 'string' ? (
              <p className="legal-paragraphe" key={`p-${i}`}>
                {bloc}
              </p>
            ) : (
              <ul className="legal-liste" key={`l-${i}`}>
                {bloc.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </main>
  )
}
