# 0003 : Un seul endroit décide des passages

- Date : 2026-10-14
- Statut : Accepté, par l'Académie

## Le problème

Une course traverse plusieurs situations : demandée, acceptée par un
chauffeur, chauffeur arrivé, commencée, terminée, ou annulée, ou expirée faute
de chauffeur. Si plusieurs fichiers se permettent de changer cette situation,
chacun applique sa propre lecture des règles.

On voit alors un passager qui annule une course déjà commencée, ou un
chauffeur qui « termine » une course où personne n'est monté, sans pouvoir dire
quel fichier en est la cause.

## La décision

**Les passages autorisés sont décrits dans un seul objet, et une seule méthode
les applique.** Elle lève une erreur quand le passage demandé n'est pas permis.
Aucun autre code ne modifie le statut d'une course.

| Depuis | Vers |
| --- | --- |
| `REQUESTED` | `ACCEPTED`, `CANCELLED`, `EXPIRED` |
| `ACCEPTED` | `ARRIVED`, `CANCELLED` |
| `ARRIVED` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED` |
| `COMPLETED`, `CANCELLED`, `EXPIRED` | aucun |

Une fois le passager monté, une course ne s'annule plus : elle se termine.

## Ce que ça coûte

Un détour : un service qui veut marquer le chauffeur arrivé ne peut pas écrire
le nouveau statut directement, il doit passer par cette méthode.

## Ce qui a été écarté

**Un `if` à chaque endroit qui change l'état.** C'est plus rapide à écrire les
trois premières fois. Au dixième, plus personne ne sait quelles règles
s'appliquent réellement, et les corriger demande de toutes les retrouver.
