/**
 * Des données fictives, pour construire vos écrans avant que l'API existe.
 *
 * Au module 3, vos pages lisent ce fichier. Dans les modules suivants, chaque
 * page le remplace par un appel à votre API, une page à la fois. Quand plus
 * aucun écran ne l'importe, supprimez-le.
 *
 * Les passagers, les chauffeurs, leurs véhicules et leurs courses sont
 * inventés. Les positions sont à Antananarivo.
 */

/** Les catégories de véhicule du parcours : une liste fixe (décision 0001). */
export type CategorieFictive = {
  slug: 'moto' | 'voiture' | 'familiale'
  nom: string
  places: number
  description: string
}

export const categoriesFictives: CategorieFictive[] = [
  { slug: 'moto', nom: 'Moto', places: 1, description: 'Le plus rapide dans les embouteillages' },
  { slug: 'voiture', nom: 'Voiture', places: 4, description: 'Une voiture pour quatre personnes' },
  { slug: 'familiale', nom: 'Familiale', places: 6, description: 'Six places, de la place pour les bagages' },
]

/** Le nom d'une catégorie, pour l'afficher : « Familiale » plutôt que « familiale ». */
export function nomCategorie(slug: string): string {
  return categoriesFictives.find((categorie) => categorie.slug === slug)?.nom ?? slug
}

/** Un prix en ariary, écrit comme on le lit : « 9 800 Ar ». */
export function prixLisible(ariary: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(ariary)} Ar`
}

/** Une durée en secondes, écrite comme on la lit : « 14 min ». */
export function dureeLisible(secondes: number): string {
  return `${Math.max(1, Math.round(secondes / 60))} min`
}

export type Position = { latitude: number; longitude: number }

/** Une estimation, comme l'API la rendra au module 8. */
export type EstimationFictive = {
  categorie: CategorieFictive['slug']
  distanceMetres: number
  dureeSecondes: number
  prix: number // en ariary, arrondi à la centaine
  attenteMinutes: number // le temps d'arrivée du chauffeur le plus proche (module 7)
}

/** Une demande en préparation, d'Analakely à Ivandry. */
export const demandeFictive = {
  depart: { libelle: 'Analakely, devant la pharmacie', position: { latitude: -18.9067, longitude: 47.5246 } },
  destination: { libelle: 'Ivandry, entrée du centre commercial', position: { latitude: -18.8744, longitude: 47.5279 } },
  estimations: [
    { categorie: 'moto', distanceMetres: 4_700, dureeSecondes: 677, prix: 3_500, attenteMinutes: 2 },
    { categorie: 'voiture', distanceMetres: 4_700, dureeSecondes: 846, prix: 7_700, attenteMinutes: 4 },
    { categorie: 'familiale', distanceMetres: 4_700, dureeSecondes: 846, prix: 11_300, attenteMinutes: 9 },
  ] satisfies EstimationFictive[],
}

/** Les chauffeurs disponibles autour du passager, comme les verra la carte (module 7). */
export const chauffeursProchesFictifs: { categorie: CategorieFictive['slug']; distanceKm: number; position: Position }[] = [
  { categorie: 'moto', distanceKm: 0.4, position: { latitude: -18.905, longitude: 47.523 } },
  { categorie: 'moto', distanceKm: 1.1, position: { latitude: -18.912, longitude: 47.531 } },
  { categorie: 'voiture', distanceKm: 0.9, position: { latitude: -18.899, longitude: 47.526 } },
  { categorie: 'voiture', distanceKm: 2.3, position: { latitude: -18.926, longitude: 47.519 } },
  { categorie: 'familiale', distanceKm: 3.8, position: { latitude: -18.88, longitude: 47.54 } },
]

/** Le chauffeur, tel que le passager le voit après l'acceptation (modules 6 et 10). */
export type ChauffeurFictif = {
  prenom: string
  photo: string | null
  note: number | null // sur 5; null sous cinq notes (module 17)
  vehicule: { categorie: CategorieFictive['slug']; marque: string; modele: string; couleur: string; plaque: string }
}

export const chauffeurFictif: ChauffeurFictif = {
  prenom: 'Haja',
  photo: null,
  note: 4.86,
  vehicule: { categorie: 'voiture', marque: 'Toyota', modele: 'Vitz', couleur: 'Blanche', plaque: '4821 TBC' },
}

/** Les statuts d'une course, dans l'ordre du trajet (décision 0003). */
export type StatutFictif = 'REQUESTED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'

export const libellesStatut: Record<StatutFictif, string> = {
  REQUESTED: 'Recherche d’un chauffeur',
  ACCEPTED: 'Votre chauffeur arrive',
  ARRIVED: 'Votre chauffeur est là',
  IN_PROGRESS: 'En route',
  COMPLETED: 'Arrivé à destination',
  CANCELLED: 'Annulée',
  EXPIRED: 'Aucun chauffeur disponible',
}

/** La course en cours, vue par le passager (module 13). */
export const courseEnCoursFictive = {
  id: 'c1',
  statut: 'ACCEPTED' as StatutFictif,
  depart: demandeFictive.depart.libelle,
  destination: demandeFictive.destination.libelle,
  prix: 7_700,
  codeDepart: '4738', // les quatre chiffres que le passager donne au chauffeur (module 10)
  arriveeDuChauffeurMinutes: 4,
  chauffeur: chauffeurFictif,
  positionDuChauffeur: { latitude: -18.9012, longitude: 47.5234 },
}

/** Une demande proposée à un chauffeur, sans rien du passager (module 10). */
export const demandesProposeesFictives = [
  { id: 'd1', categorie: 'voiture', distanceDepartKm: 0.8, longueurKm: 4.7, prix: 7_700 },
  { id: 'd2', categorie: 'voiture', distanceDepartKm: 1.9, longueurKm: 12.3, prix: 15_200 },
  { id: 'd3', categorie: 'voiture', distanceDepartKm: 2.6, longueurKm: 2.1, prix: 5_000 },
]

/** Les courses passées du passager, les plus récentes d'abord (modules 9 et 11). */
export const historiqueFictif = [
  {
    id: 'c9',
    date: '2030-07-15T16:40:00.000Z',
    depart: 'Ankorondrano',
    destination: 'Ivato, aéroport',
    categorie: 'voiture',
    statut: 'COMPLETED' as StatutFictif,
    prix: 28_400,
    paye: true,
  },
  {
    id: 'c8',
    date: '2030-07-14T06:10:00.000Z',
    depart: 'Analakely',
    destination: 'Ambohijatovo',
    categorie: 'moto',
    statut: 'COMPLETED' as StatutFictif,
    prix: 2_000,
    paye: true,
  },
  {
    id: 'c7',
    date: '2030-07-12T19:55:00.000Z',
    depart: 'Isoraka',
    destination: 'Ambatobe',
    categorie: 'voiture',
    statut: 'CANCELLED' as StatutFictif,
    prix: 2_000, // les frais d'une annulation tardive
    paye: true,
  },
]
