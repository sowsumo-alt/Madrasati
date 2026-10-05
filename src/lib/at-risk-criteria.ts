/**
 * Critères de déclenchement, énoncés en clair pour l'interface : un directeur
 * qui voit un élève signalé doit pouvoir vérifier la règle appliquée, sinon
 * l'alerte reste une boîte noire qu'il ne saura ni défendre auprès des parents
 * ni contester.
 */
export const AT_RISK_CRITERIA = [
  "Moyenne générale inférieure à 10/20, pondérée par les coefficients comme sur le bulletin",
  "Baisse de plus de 3 points entre les deux derniers examens",
  "Taux de présence inférieur à 80 % sur les 30 derniers jours (à partir de 5 appels)",
  "Au moins 2 incidents disciplinaires depuis le début du mois",
];
