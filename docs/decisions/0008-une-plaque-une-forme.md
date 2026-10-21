# 0008 : Une plaque d'immatriculation se range sous une seule forme

- Date : 2026-10-14
- Statut : Accepté, par l'Académie

## Le problème

Le passager reconnaît sa voiture à sa plaque, et l'équipe vérifie que la carte
grise d'un chauffeur correspond à son véhicule. Une même plaque s'écrit
pourtant de plusieurs façons : `1234 TBA`, `1234tba`, `1234-TBA`. Rangée telle
quelle, elle ne se compare plus : deux chauffeurs pourraient déclarer le même
véhicule.

## La décision

**Une plaque se range sous la forme de quatre chiffres, une espace, puis deux
ou trois lettres majuscules** : `1234 TBA`. Le serveur la calcule à
l'enregistrement du véhicule, quelle que soit la saisie, et refuse une plaque
qu'il ne sait pas ramener à cette forme.

**Une plaque n'appartient qu'à un chauffeur**, par une contrainte d'unicité
dans la base.

## Ce que ça coûte

Une fonction de plus, testée sur les écritures qu'on rencontre. Un véhicule
immatriculé à l'étranger, ou sous une forme plus ancienne, ne s'enregistre pas
tant que la règle n'est pas élargie.

## Ce qui a été écarté

**Ranger la saisie telle quelle, et comparer en nettoyant.** Chaque requête qui
compare deux plaques devrait refaire le nettoyage, et une seule oubliée suffit
à laisser passer un doublon.
