# DeDecker · Tableau de bord sémantique (SEO + GEO)

Application Next.js (App Router, TypeScript) déployable sur Vercel. Elle remplace le prototype Streamlit
`DeDecker-Semantic-Analysis` et ajoute le suivi GEO, trois marchés, une interface FR/NL/EN, des imports
Excel validés et versionnés, et des comptes nominatifs.

| Vue | Contenu |
| --- | --- |
| `/seo` | KPI, distribution des positions, performance par catégorie, paysage concurrentiel, leaders, AI Overviews, explorateur triable et export CSV |
| `/geo` | Questions suivies/observées, réponses valides, taux de présence et de citation, évolution hebdo/mensuelle, liste et détail des questions, export CSV |
| `/admin/imports` | Téléversement, validation (onglet, ligne, champ), aperçu, publication, retour arrière, historique, journal |
| `/admin/users` | Comptes, rôles lecteur/admin, activation, réinitialisation du mot de passe |

Marchés : `BENL` (défaut), `BEFR`, `BEEN`. Un marché sans données publiées affiche « Données à venir ».

## Stack

Next.js 16 · React 19 · Tailwind 4 · Recharts · Drizzle ORM + PostgreSQL · Auth.js (Credentials, sessions JWT, rôle revérifié en base à chaque requête) · Vercel Blob privé · ExcelJS · Vitest.

## Développement local

```bash
cp .env.example .env.local        # renseigner DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dedecker -p 5432:5432 postgres:16
npm install
npm run db:migrate                # migrations + projet + marchés + compte admin initial
npm run dev                       # http://localhost:3000
```

Puis se connecter, ouvrir **Imports**, téléverser `public/templates/seo_template.xlsx` (ou le classeur converti) et publier.

| Script | Rôle |
| --- | --- |
| `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` | Vérifications |
| `npm run db:generate` | Génère une migration après modification de `src/lib/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations et crée l'admin initial (idempotent) |
| `npm run templates` | Régénère les modèles Excel fictifs SEO/GEO |
| `npm run convert:legacy -- --src data/sources [--benl-date AAAA-MM-JJ --befr-date AAAA-MM-JJ]` | Convertit les 4 classeurs historiques BENL/BEFR vers le contrat SEO (`data/out/seo_initial.xlsx`) |

Les tests de recette `tests/seo-reference.test.ts` vérifient les valeurs du prototype (BENL : 240 requêtes, 89 700 de volume, position moyenne 98,52 ; BEFR : 305, 126 650, 99,90) lorsque `data/out/seo_initial.xlsx` est présent. Les classeurs clients ne sont jamais commités (`/data` est ignoré).

## Déploiement Vercel

1. Importer le dépôt GitHub dans Vercel (framework Next.js détecté automatiquement).
2. **Storage → Marketplace → Neon** : crée la base et injecte `DATABASE_URL`.
3. **Storage → Blob** : créer un store, ce qui injecte `BLOB_READ_WRITE_TOKEN`. Les classeurs sont stockés en accès privé.
4. Variables d'environnement : `AUTH_SECRET` (`openssl rand -base64 32`), `CLIENT_DOMAINS` (ex. `dedecker.be`), et pour le premier déploiement `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
5. Appliquer les migrations depuis un poste : `vercel env pull .env.local && npm run db:migrate`.
6. Supprimer `ADMIN_PASSWORD` des variables Vercel après la création du compte, puis gérer les comptes dans `/admin/users`.

Après 5 mots de passe erronés, le compte est verrouillé 15 minutes (une réinitialisation par un admin le déverrouille). Une réinitialisation ou une désactivation révoque les sessions ouvertes.

Le site est privé : `robots.txt` interdit tout, en-têtes `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, réponses API `Cache-Control: private, no-store`, toutes les pages, routes, exports et lectures de fichiers vérifient la session et le rôle.

## Données et règles

Voir [docs/IMPORTS.md](docs/IMPORTS.md) pour le contrat des classeurs, la validation, la publication et les règles de calcul.

## Décisions ouvertes

- Langue/pays exacts du 3e marché (`BEEN` = Belgique anglais par hypothèse).
- Fournisseur d'identité (Credentials par défaut ; Auth.js permet d'ajouter Microsoft Entra ID ou Google).
- Dates exactes de collecte SEO historiques (provisoirement 07/04/2026 BENL et 08/04/2026 BEFR).
- Plateformes, source et cadence GEO ; domaines DeDecker comptés comme citations.
