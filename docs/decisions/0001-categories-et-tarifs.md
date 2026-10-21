# 0001 : Trois catégories de véhicule, et leurs tarifs rangés dans la base

- Date : 2026-10-14
- Statut : Accepté, par l'Académie

## Le problème

Un passager pressé prend une moto; une famille avec des bagages a besoin de
six places. Si chaque chauffeur décrit son véhicule à sa façon, « berline »,
« taxi », « 4x4 », le passager ne sait plus quoi choisir, et le serveur ne sait
plus quel prix annoncer.

Les prix, eux, changent : le carburant augmente, une concurrence arrive. Un
prix écrit dans le code ne se change qu'en redéployant l'application.

## La décision

**La catégorie d'un véhicule se choisit dans une liste fixe**, rangée dans une
table et remplie par une migration. Les vérifications emploient celles-ci :

| Slug | Nom affiché | Places | Vitesse moyenne en ville |
| --- | --- | --- | --- |
| `moto` | Moto | 1 | 25 km/h |
| `voiture` | Voiture | 4 | 20 km/h |
| `familiale` | Familiale | 6 | 20 km/h |

**Le tarif de chaque catégorie est une ligne de données**, dans sa propre
table, une ligne par catégorie :

| Catégorie | Prise en charge | Par kilomètre | Par minute | Minimum |
| --- | --- | --- | --- | --- |
| `moto` | 1 000 Ar | 400 Ar | 50 Ar | 2 000 Ar |
| `voiture` | 2 000 Ar | 900 Ar | 100 Ar | 5 000 Ar |
| `familiale` | 3 000 Ar | 1 300 Ar | 150 Ar | 8 000 Ar |

Le calcul du prix est écrit dans la décision 0002.

## Ce que ça coûte

Deux tables de plus, et une lecture de la base à chaque estimation. Un
chauffeur dont le véhicule ne correspond à aucune catégorie choisit la plus
proche.

## Ce qui a été écarté

**Une catégorie en texte libre.** Plus simple à écrire, mais le passager ne
peut plus filtrer, et le serveur ne sait plus quel tarif appliquer.

**Les tarifs dans le code**, dans un objet JavaScript. C'est le plus rapide à
écrire, mais une hausse du carburant demanderait un nouveau déploiement, et
personne ne pourrait dire, six mois plus tard, quel tarif s'appliquait à une
course donnée.
