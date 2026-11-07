/**
 * Mise en forme des nombres, en français.
 *
 * L'implémentation vit dans le moteur budgétaire, parce que le moteur écrit
 * lui aussi du texte lu par l'élève — le champ `hypothese` de chaque ligne de
 * budget s'affiche tel quel. Deux implémentations auraient divergé : c'est
 * exactement ce qui s'est produit tant que celle-ci était seule, et le moteur
 * affichait « 16.326 €/m² » pendant que l'interface écrivait « 16,33 € ».
 *
 * Le sens unique des dépendances est respecté : le web importe le moteur,
 * jamais l'inverse.
 *
 * Toutes les mises en forme de nombres du site passent par ici. Un
 * `toLocaleString` appelé directement ailleurs réintroduirait le défaut sans
 * que rien ne le signale ; nombres.test.ts l'interdit.
 */

export {
  FINE_INSECABLE,
  INSECABLE,
  euros,
  eurosAuCentime,
  eurosPrecis,
  lisible,
  nombre,
} from '../../packages/budget-engine/src/nombres.ts'
