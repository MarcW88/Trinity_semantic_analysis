# Trinity · Tableau de bord sémantique SEO

Version Next.js (App Router, TypeScript), déployable sur Vercel, du prototype Streamlit `DeDecker-Semantic-Analysis` : mêmes données Excel, mêmes calculs, interface FR/NL/EN animée.

- `/seo` : indicateurs clés, distribution des positions, performance par catégorie, paysage concurrentiel, leaders, AI Overviews, explorateur triable et export CSV.
- Marchés `BENL` (défaut), `BEFR`, `BEEN`. Un marché sans fichier affiche « Données à venir ».
- Pas de base de données : les fichiers Excel sont dans `data/<MARCHÉ>/` (format : [docs/EXCEL.md](docs/EXCEL.md)).
- Accès protégé par un mot de passe partagé (`DASHBOARD_PASSWORD`).

## Mettre à jour les données

Déposez le ou les fichiers Excel dans `data/BENL`, `data/BEFR` ou `data/BEEN` sur GitHub et commitez. Vercel redéploie automatiquement.

> Le dépôt doit rester **privé** : les fichiers Excel y sont lisibles par toute personne ayant accès au dépôt.

## Déploiement Vercel

1. Importer le dépôt GitHub dans Vercel (Next.js détecté automatiquement).
2. Ajouter la variable d'environnement `DASHBOARD_PASSWORD` (le mot de passe du tableau de bord), pour Production et Preview.
3. Déployer. Changer le mot de passe déconnecte tout le monde.

## Développement local

```bash
npm install
DASHBOARD_PASSWORD=mon-mot-de-passe npm run dev
```

| Commande | Rôle |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Tests Vitest (dont les valeurs de référence Streamlit si `data/` contient les fichiers) |
| `npm run build` | Build de production |

## Structure

- `src/lib/seo/excel.ts` : lecture des Excel au format Streamlit, fusion des fichiers par marché.
- `src/lib/seo/source.ts` : chargement de `data/<MARCHÉ>/*.xlsx` (mis en cache, relu si un fichier change).
- `src/lib/seo/compute.ts` : calculs (position moyenne avec non classé = 100, buckets, visibilité, leaders, AI Overviews).
- `src/lib/config.ts` : marchés, catégories exclues, couleurs.

## Évolutions prévues

Base de données (Supabase), suivi GEO et comptes nominatifs pourront être réintroduits plus tard ; la version précédente reste dans l'historique Git.
