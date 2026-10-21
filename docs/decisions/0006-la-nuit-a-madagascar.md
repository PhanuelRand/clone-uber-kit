# 0006 : Un instant se range en UTC, la nuit se lit à Madagascar

- Date : 2026-10-14
- Statut : Accepté, par l'Académie

## Le problème

Le tarif de nuit s'applique de 22 h 00 à 5 h 00, heure d'Antananarivo. Votre
serveur tournera peut-être en Europe ou aux États-Unis, et l'heure de son
horloge n'est pas celle du passager. Un serveur qui compare « 22 h 00 » à son
heure à lui appliquerait le tarif de nuit trois heures trop tôt, ou trop tard.

La nuit pose un second problème : elle commence un jour et finit le lendemain.

## La décision

**Un instant se range dans une colonne `timestamptz`**, qui garde un point
précis dans le temps, quel que soit le fuseau du serveur : le moment d'une
demande, d'une acceptation, d'un paiement.

**On compare en ramenant l'instant à l'heure de Madagascar**, le fuseau
`Indian/Antananarivo`, soit UTC+3, sans heure d'été.

La nuit va de 22 h 00 compris à 5 h 00 non compris. Elle se lit donc en deux
comparaisons : « à partir de 22 h 00 », ou « avant 5 h 00 ».

L'instant présent est passé en paramètre au lieu d'être lu sur l'horloge, pour
qu'une course de 23 h 00 se vérifie sans attendre 23 h 00. C'est l'instant de
la **demande** qui compte : une course demandée à 21 h 50 garde son prix de
jour, même si elle finit à 22 h 30.

## Ce que ça coûte

Il faut convertir avant de comparer, et ne jamais découper un instant avec
`toISOString()`, qui donne la date et l'heure en UTC : la veille, entre minuit
et 3 heures du matin à Madagascar.

## Ce qui a été écarté

**Lire l'heure du serveur.** C'est la plus courte à écrire, et elle est juste
tant que le serveur tourne à Antananarivo. Un hébergeur gratuit le fera tourner
ailleurs.

**Ranger les instants en heure locale, sans fuseau** (`timestamp`). Un instant
sans fuseau ne se compare plus dès que deux machines ne sont pas réglées de la
même façon.
