# Format des fichiers Excel

Même format que l'application Streamlit d'origine : les fichiers existants fonctionnent tels quels.

## Emplacement

```
data/
  BENL/   Belgique NL
  BEFR/   Belgique FR
  BEEN/   Belgique EN (vide = « Données à venir »)
```

Seule la **première feuille** de chaque fichier est lue. Ligne 1 = noms de colonnes, une ligne par mot-clé.

## Colonnes

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `keyword` | oui | Mot-clé (les doublons sont ignorés) |
| `volume` | oui | Volume de recherche mensuel |
| `category` (ou `Category`) | oui | Catégorie. Majuscules/accents ignorés pour regrouper (`keukens` = `Keukens`) |
| `client_pos` | oui | Position de DeDecker. Vide ou 0 = non classé |
| `<domaine>_pos` | — | Une colonne par concurrent, ex. `vika.be_pos`, `x2o.be_pos`. Détectées automatiquement |
| `has_ai_overview` | — | `TRUE`/`FALSE` (aussi `1`, `yes`, `vrai`, `ja`) |
| `client_in_ai` | — | DeDecker cité dans l'AI Overview (`TRUE`/`FALSE`) |
| `client_url`, `client_ai_sources`, `cpc`, `competition`, `priority`, `subcategory`, `source`, `PAA` | — | Informations complémentaires |

Les catégories `Branding` et `Marque et valeurs` restent dans le fichier mais sont exclues des calculs (`EXCLUDED_CATEGORIES` dans `src/lib/config.ts`).

## Plusieurs fichiers par marché

- Le **fichier principal** est celui dont le nom ne contient aucun nom de catégorie. Il fournit mots-clés, volumes, catégories, positions DeDecker et AI Overviews, ainsi que les concurrents « par défaut ».
- Un fichier dont le nom contient une catégorie (ex. `Keywords_SERP_Final_badkamers_dedecker.xlsx` → `Badkamers`, `..._salle_de_bains.xlsx` → `Salle de bains`) n'ajoute que **ses concurrents**, affichés pour cette catégorie. Les lignes sont rapprochées par `keyword`.

## Règles de calcul (identiques à Streamlit)

- Position moyenne : un mot-clé non classé compte 100.
- Top 3 / 4–10 / 11–20 / 21+ / non classé.
- Taux de citation AI = mots-clés où DeDecker est cité / mots-clés avec AI Overview.
- La date affichée est la date de dernière modification enregistrée dans le fichier Excel.

Les concurrents sont affichés sous leur nom de domaine, dans l'ordre des colonnes ; couleurs : `COMPETITOR_COLORS` dans `src/lib/config.ts`.
