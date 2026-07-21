import type { Maison } from '../types'

/** Nettoie un numéro pour les liens tel: / wa.me. */
function numTel(n: string): string {
  return n.replace(/[^\d+]/g, '')
}

export default function SectionContact({ maison }: { maison: Maison }) {
  const { hote } = maison
  return (
    <section className="section">
      <h1 className="section-titre">Contact & urgences</h1>
      <p className="section-intro">
        Nous restons joignables pendant tout votre séjour.
      </p>

      <div className="carte carte--hote">
        <span className="carte-etiquette">Votre hôte</span>
        <h2>{hote.nom}</h2>
        <div className="hote-actions">
          {hote.telephone && (
            <a className="lien-bouton lien-bouton--plein" href={`tel:${numTel(hote.telephone)}`}>
              📞 {hote.telephone}
            </a>
          )}
          {hote.whatsapp && (
            <a
              className="lien-bouton"
              href={`https://wa.me/${hote.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              💬 WhatsApp
            </a>
          )}
          {hote.email && (
            <a className="lien-bouton" href={`mailto:${hote.email}`}>
              ✉️ E-mail
            </a>
          )}
        </div>
      </div>

      <div className="carte">
        <h2>🚨 Numéros utiles</h2>
        <ul className="liste-numeros">
          {maison.numerosUtiles.map((n) => (
            <li key={n.libelle}>
              <span>{n.libelle}</span>
              <a href={`tel:${numTel(n.numero)}`}>{n.numero}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
