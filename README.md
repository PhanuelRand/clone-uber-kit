# Kit de départ — Clone Uber

Ce dossier contient le **harnais de vérification** du parcours « Clone Uber »
(ADR-0014). Il est publié dans le dépôt modèle GitHub dont chaque participant
part, et la plateforme compare son empreinte à chaque remise.

## Ce qui est versionné ici

| Chemin | Rôle |
|---|---|
| `.github/workflows/academie.yml` | Exécute les suites de conformité à chaque push, dans l'intégration continue du participant |
| `academie/checks/**` | Les suites écrites par la plateforme, cumulatives d'un module au suivant |
| `academie/run.mjs` | Lanceur local : `node academie/run.mjs 3` reproduit exactement ce que fait l'intégration continue |

Ces fichiers sont les seuls dont l'empreinte est vérifiée. Le reste du dépôt
modèle — `src/`, `tsconfig.json`, `Dockerfile` — appartient au participant et
n'est pas comparé : c'est son travail.

## Pourquoi l'empreinte est vérifiée

Le harnais vit dans le dépôt du participant, donc il peut le modifier. La
plateforme relit ces fichiers au commit remis et compare leur empreinte à la
version canonique publiée ici.

Une différence ne prononce pas l'échec : elle confie la remise à un mentor, qui
voit la modification dans l'historique Git et tranche. C'est le bon niveau pour
un produit éducatif; ce n'est pas un système anti-fraude.

## Faire évoluer le harnais

1. modifier les fichiers ici;
2. relever `kit.version` dans la bibliothèque de parcours
   (`packages/core/src/modules/catalog/infrastructure/course-library.ts`);
3. exécuter `pnpm catalog:sync`, qui recalcule les empreintes depuis ce dossier;
4. publier le dépôt modèle GitHub à jour.

Les participants déjà inscrits gardent la version du kit figée à leur
inscription : réviser le harnais ne change pas ce qui leur a été demandé.
