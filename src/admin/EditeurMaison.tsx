import type { Maison, NumeroUtile } from '../types'
import { Champ, ListeChaines, ZoneTexte } from './champs'
import ChampPhoto from './ChampPhoto'

export default function EditeurMaison({
  maison,
  onChange,
}: {
  maison: Maison
  onChange: (m: Maison) => void
}) {
  function maj(patch: Partial<Maison>) {
    onChange({ ...maison, ...patch })
  }

  function majNumero(i: number, patch: Partial<NumeroUtile>) {
    maj({
      numerosUtiles: maison.numerosUtiles.map((n, j) =>
        j === i ? { ...n, ...patch } : n,
      ),
    })
  }

  return (
    <div className="editeur">
      <div className="editeur-intro">
        <h2>La maison</h2>
        <p>
          Informations affichées à vos voyageurs une fois connectés (accès,
          Wi-Fi, règlement, contacts).
        </p>
      </div>

      <div className="carte-edition">
        <ChampPhoto
          label="Photo de la façade (page d'accueil)"
          valeur={maison.photo ?? ''}
          onChange={(photo) => maj({ photo })}
          aide="Affichée en grand sur la page d'accueil des voyageurs. Format paysage conseillé."
        />
        <div className="grille-champs">
          <Champ
            label="Nom de la maison"
            valeur={maison.nom}
            onChange={(v) => maj({ nom: v })}
          />
          <Champ
            label="Sous-titre"
            valeur={maison.sousTitre ?? ''}
            onChange={(v) => maj({ sousTitre: v })}
            placeholder="ex. Votre maison de vacances"
          />
          <Champ
            label="Adresse"
            valeur={maison.adresse}
            onChange={(v) => maj({ adresse: v })}
          />
          <Champ
            label="Lien carte (Google Maps)"
            valeur={maison.lienCarte ?? ''}
            onChange={(v) => maj({ lienCarte: v })}
            placeholder="https://maps.google.com/?q=…"
          />
          <Champ
            label="Wi-Fi — réseau"
            valeur={maison.wifi.reseau}
            onChange={(v) => maj({ wifi: { ...maison.wifi, reseau: v } })}
          />
          <Champ
            label="Wi-Fi — mot de passe"
            valeur={maison.wifi.motDePasse}
            onChange={(v) => maj({ wifi: { ...maison.wifi, motDePasse: v } })}
          />
          <Champ
            label="Code boîte à clés"
            valeur={maison.codeAcces ?? ''}
            onChange={(v) => maj({ codeAcces: v })}
          />
        </div>
        <ZoneTexte
          label="Stationnement"
          valeur={maison.parking ?? ''}
          onChange={(v) => maj({ parking: v })}
          lignes={2}
        />
      </div>

      <div className="carte-edition">
        <ListeChaines
          label="Instructions d'arrivée"
          valeurs={maison.instructionsArrivee}
          onChange={(v) => maj({ instructionsArrivee: v })}
          ajoutLabel="une instruction d'arrivée"
        />
      </div>

      <div className="carte-edition">
        <ListeChaines
          label="Instructions de départ"
          valeurs={maison.instructionsDepart}
          onChange={(v) => maj({ instructionsDepart: v })}
          ajoutLabel="une instruction de départ"
        />
      </div>

      <div className="carte-edition">
        <ListeChaines
          label="Règlement de la maison"
          valeurs={maison.reglement}
          onChange={(v) => maj({ reglement: v })}
          ajoutLabel="une règle"
        />
      </div>

      <div className="carte-edition">
        <strong className="carte-edition-sous-titre">Votre hôte</strong>
        <div className="grille-champs">
          <Champ
            label="Nom de l'hôte"
            valeur={maison.hote.nom}
            onChange={(v) => maj({ hote: { ...maison.hote, nom: v } })}
          />
          <Champ
            label="Téléphone"
            valeur={maison.hote.telephone ?? ''}
            onChange={(v) => maj({ hote: { ...maison.hote, telephone: v } })}
            placeholder="+33 6 …"
          />
          <Champ
            label="E-mail"
            valeur={maison.hote.email ?? ''}
            onChange={(v) => maj({ hote: { ...maison.hote, email: v } })}
          />
          <Champ
            label="WhatsApp (indicatif + numéro)"
            valeur={maison.hote.whatsapp ?? ''}
            onChange={(v) => maj({ hote: { ...maison.hote, whatsapp: v } })}
            placeholder="33612345678"
            aide="Sans le « + », ex. 33612345678"
          />
        </div>
      </div>

      <div className="carte-edition">
        <strong className="carte-edition-sous-titre">Numéros utiles</strong>
        {maison.numerosUtiles.map((n, i) => (
          <div className="ligne-duo" key={i}>
            <Champ
              label="Libellé"
              valeur={n.libelle}
              onChange={(v) => majNumero(i, { libelle: v })}
              placeholder="ex. Médecin de garde"
            />
            <Champ
              label="Numéro"
              valeur={n.numero}
              onChange={(v) => majNumero(i, { numero: v })}
            />
            <button
              type="button"
              className="btn-supprimer-ligne btn-supprimer-ligne--bas"
              onClick={() =>
                maj({
                  numerosUtiles: maison.numerosUtiles.filter(
                    (_, j) => j !== i,
                  ),
                })
              }
              aria-label="Supprimer ce numéro"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-ajouter-ligne"
          onClick={() =>
            maj({
              numerosUtiles: [
                ...maison.numerosUtiles,
                { libelle: '', numero: '' },
              ],
            })
          }
        >
          + un numéro utile
        </button>
      </div>
    </div>
  )
}
