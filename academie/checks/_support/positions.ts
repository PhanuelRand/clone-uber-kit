/**
 * Des positions et des instants pour les suites qui font rouler des courses.
 *
 * Les suites passent des instants choisis, comme ceux de la semaine du lundi
 * 15 juillet 2030, ou l'instant présent quand la course doit être fraîche :
 * aucune vérification ne dépend de l'heure à laquelle elle tourne.
 *
 * Les chauffeurs d'essai travaillent autour de positions tirées au hasard dans
 * l'intérieur de l'île : un chauffeur d'une suite ne voit pas les demandes
 * d'une autre.
 *
 * Ce fichier fait partie du harnais.
 */

/**
 * L'instant, en UTC, qui correspond à cette date et à cette heure à
 * Madagascar. Madagascar a trois heures d'avance sur UTC, sans heure d'été.
 *
 *   inMadagascar('2030-07-15', '12:00')  ->  '2030-07-15T09:00:00.000Z'
 */
export function inMadagascar(date: string, time: string) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hours - 3, minutes)).toISOString()
}

/** L'instant présent, décalé de `minutes` minutes (négatif : dans le passé). */
export function inMinutes(minutes: number, from = Date.now()) {
  return new Date(from + minutes * 60_000).toISOString()
}

/**
 * Un instant tiré au hasard entre 2031 et 2040, à la minute près. Une suite qui
 * cherche les chauffeurs proches s'en sert comme « maintenant » : les
 * chauffeurs d'une autre suite, dont la position date d'un autre instant, ne
 * sont jamais frais à celui-ci.
 */
export function uniqueInstant() {
  const start = Date.UTC(2031, 0, 1)
  const minutes = Math.floor(Math.random() * 5_000_000)
  return new Date(start + minutes * 60_000).toISOString()
}

/** Le centre d'Antananarivo. Un degré de latitude vaut environ 111,2 km. */
export const TANA = { latitude: -18.9137, longitude: 47.5361 }

/** Une position à `km` kilomètres au nord de `from`. */
export function north(km: number, from = TANA) {
  return { latitude: from.latitude + km / 111.19493, longitude: from.longitude }
}

/**
 * Un point au hasard dans l'intérieur de Madagascar, loin des autres essais :
 * les chauffeurs d'une suite ne voient pas les demandes d'une autre.
 */
export function somewhere() {
  return {
    latitude: -14 - Math.random() * 8,
    longitude: 45 + Math.random() * 3,
  }
}
