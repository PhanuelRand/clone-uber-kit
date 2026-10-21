# 0002 : Un prix ferme, entier, en ariary

- Date : 2026-10-14
- Statut : Accepté, par l'Académie

## Le problème

Le prix d'une course additionne une prise en charge, une part pour la
distance et une part pour la durée, puis ajoute parfois un tarif de nuit en
pourcentage. Chaque calcul est une occasion de perdre ou d'inventer quelques
ariary.

Le passager, lui, veut savoir combien il paiera **avant** de monter, et payer
exactement ce prix, même si le chauffeur a pris un détour.

## La décision

**Tout montant est un entier, en ariary**, qui n'a pas de centimes :
9 800 Ar se rangent `9800`. Les colonnes sont de type `integer` ou `bigint`,
jamais `numeric`, `real` ni `money`.

Le prix se calcule toujours de la même façon, avec le tarif de la catégorie
(décision 0001) :

| Étape | Calcul |
| --- | --- |
| Brut | prise en charge + par kilomètre × mètres ÷ 1 000 + par minute × secondes ÷ 60, chaque part arrondie à l'ariary inférieur |
| Nuit | de 22 h 00 à 5 h 00, heure de Madagascar : 20 % du brut en plus, arrondis à l'ariary inférieur (décision 0006) |
| Minimum | le prix ne descend jamais sous le minimum du tarif |
| Arrondi | le prix s'arrondit à la centaine d'ariary supérieure : personne n'a de monnaie pour 39 Ar |

Les pourcentages se calculent en entiers : `Math.floor(brut * 20 / 100)`, sans
passer par `0.2`.

**Le prix est ferme.** Il se calcule à la demande, sur une distance estimée,
et la course le garde dans sa propre colonne. C'est ce prix que le passager
paie, quel que soit le trajet réel et même si le tarif change pendant la
course.

## Ce que ça coûte

Le prix ne suit pas le trajet réel : un embouteillage imprévu coûte au
chauffeur, un raccourci lui profite. Et une colonne de prix dans chaque course,
qui semble répéter le tarif : elle ne dit pas la même chose, le tarif du jour
et le prix de cette course-là.

## Ce qui a été écarté

**Un nombre à virgule.** `0.1 + 0.2` ne vaut pas `0.3` en virgule flottante.
Une somme d'argent ne tolère aucune approximation.

**Un prix au compteur, calculé à l'arrivée.** C'est ce que font les taxis, et
c'est précisément ce que les passagers reprochent aux taxis : ne pas savoir
combien ils paieront.

**Croire le prix envoyé par le navigateur.** N'importe qui peut modifier une
demande avant de l'envoyer. Le serveur recalcule tout.
