// Approuve un chauffeur, ou lui retire son approbation (module 10).
//
// Usage :
//   node --env-file=.env scripts/approuver-chauffeur.mjs courriel@example.org
//   node --env-file=.env scripts/approuver-chauffeur.mjs courriel@example.org --retirer
//
// Un chauffeur s'inscrit depuis l'application, puis enregistre son véhicule :
// son compte passe « en attente ». La vérification de ses papiers (pièce
// d'identité, permis de conduire, carte grise et assurance du véhicule) se
// fait hors de l'application. Une fois les papiers vus, ce script l'approuve,
// et il peut accepter des courses.
//
// En production, donnez l'adresse de la base de production pour cette seule
// commande, comme pour `npm run migrate` au module 15.
//
// Ce fichier vous appartient. Remplacez les noms ci-dessous par ceux de vos
// tables et de vos colonnes : le script ne les devine pas.

import pg from 'pg'

const TABLE_DES_COMPTES = 'comptes'
const COLONNE_COURRIEL = 'courriel'
const COLONNE_STATUT_CHAUFFEUR = 'statut_chauffeur' // 'NONE', 'PENDING' ou 'APPROVED'

const [courriel, option] = process.argv.slice(2)
if (!courriel) {
  console.error('Indiquez le courriel du compte, puis --retirer pour retirer l’approbation.')
  process.exit(2)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL est vide. Lancez le script avec --env-file=.env.')
  process.exit(2)
}

const retirer = option === '--retirer'
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  // On n'approuve qu'un compte qui a demandé à conduire.
  const { rowCount } = await client.query(
    `update ${TABLE_DES_COMPTES}
        set ${COLONNE_STATUT_CHAUFFEUR} = $2
      where lower(${COLONNE_COURRIEL}) = lower($1)
        and ${COLONNE_STATUT_CHAUFFEUR} = $3`,
    retirer ? [courriel, 'PENDING', 'APPROVED'] : [courriel, 'APPROVED', 'PENDING'],
  )
  if (rowCount === 0) {
    console.log(
      retirer
        ? 'Aucun chauffeur approuvé avec ce courriel.'
        : 'Aucun chauffeur en attente avec ce courriel. A-t-il bien demandé à conduire ?',
    )
  } else {
    console.log(retirer ? 'Approbation retirée : le chauffeur est de nouveau en attente.' : 'Ce chauffeur est approuvé.')
  }
} finally {
  await client.end()
}
