# Imports Excel : contrat, validation et publication

Modèles fictifs : `public/templates/seo_template.xlsx` et `public/templates/geo_template.xlsx` (téléchargeables depuis `/admin/imports`).

## Règles communes

- Fichier `.xlsx` uniquement, 10 Mo maximum ; contenu décompressé, nombre de cellules, de requêtes, de positions et d'analyses plafonnés (`src/lib/config.ts`).
- Refusés : macros, liens externes, formules (saisir des valeurs), cellules en erreur, cellules fusionnées.
- En-têtes exacts en ligne 1 (colonnes inconnues ignorées avec un avertissement). Chaque anomalie indique l'onglet, la ligne, le champ et la valeur.
- Le SHA-256 du fichier identifie la tentative : un fichier déjà importé renvoie la tentative existante.
- Le fichier est stocké en privé (Vercel Blob, ou `./storage` en local) avant la validation.

## SEO (`schema_version = 1`)

| Onglet | Colonnes obligatoires | Facultatives |
| --- | --- | --- |
| Meta | schema_version, market, snapshot_date, source | notes, device, serp_depth, currency |
| Categories | market, category_id, label, include_in_dashboard, sort_order | |
| Keywords | market, keyword_id, keyword, volume, category_id, has_ai_overview, client_in_ai | client_pos, client_url, client_ai_sources, subcategory, priority, source, cpc, competition, paa, legacy_ilwa_pos |
| Competitors | market, domain, label, sort_order | color_hex |
| CompetitorScopes | market, scope (`default` ou un category_id), domain, sort_order | |
| Rankings | market, keyword_id, domain, position | |

Contrôles : marché connu et présent dans Meta, catégories et références existantes, doublons de requêtes après normalisation (casse, accents, espaces), positions entières ≥ 1, URL HTTP(S), `client_in_ai` impossible sans AI Overview, un scope `default` par marché. Les catégories `include_in_dashboard = false` (ex. « Marque et valeurs ») sont exclues des calculs.

Publication : une version SEO contient tous les marchés du classeur. Publier remplace la version active de façon transactionnelle ; si la version active a changé depuis l'aperçu, la publication est refusée (409). « Republier » une ancienne version valide est un retour arrière et exige un motif, consigné au journal.

Calculs : volume sommé ; « classée » = position présente ; Top 20 = position ≤ 20 ; Top 10 = position ≤ 10 ; position moyenne avec non-classées = 100 ; taux de citation IA = citations / requêtes avec AI Overview ; arrondi uniquement à l'affichage ; positions absentes triées en dernier ; les filtres de l'explorateur ne modifient pas les autres sections.

## GEO (`schema_version = 1`, un marché par classeur)

| Onglet | Colonnes obligatoires | Facultatives |
| --- | --- | --- |
| Meta | schema_version, market, source, collected_from, collected_to | notes |
| Questions | question_id, question_version, question, status (`active`/`archived`) | category_id, seo_keyword_id, persona, topic_group_id |
| Runs | run_id, question_id, question_version, observed_at (ISO 8601, UTC si pas de fuseau), platform, model, web_search (`on`/`off`/`unknown`), status (`success`/`error`), brand_mentioned | answer_text, error_code, replaces_run_id |
| Citations | run_id, cited_url, citation_order | |

- `question_id` et `run_id` sont stables. Modifier un libellé = nouvelle `question_version`.
- Un `run_id` déjà importé avec un contenu identique est ignoré (import idempotent) ; avec un contenu différent, il faut l'invalider dans l'application puis importer un run de remplacement (`replaces_run_id`). « Revalider » relance le contrôle après invalidation.
- Archiver une question conserve tout son historique.

Calculs : questions suivies = questions actives du marché/catégorie ; observées = questions avec au moins une réponse valide ; présence = réponses valides mentionnant DeDecker / réponses valides ; citation = réponses valides citant au moins un domaine DeDecker (`CLIENT_DOMAINS`, sous-domaines inclus, plusieurs URL comptent une fois) / réponses valides. Les erreurs et runs invalidés sont exclus des taux mais restent comptés. Sans réponse valide, un tiret est affiché. Stockage UTC, affichage et regroupement hebdo/mensuel en Europe/Brussels ; les périodes sans réponse valide restent vides dans les courbes.
