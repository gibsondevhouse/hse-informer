# Coursera evidence index

Captured September 7, 2026, America/New_York. Browser already signed in; individual states can vary. Viewports below are CSS dimensions; cropped PNG dimensions differ. Retained screenshot content belongs to Coursera and its providers and is for attributed audit reference.

| ID | Screenshot | Source | Viewport | State |
|---|---|---|---|---|
| E01 | [01-dashboard-desktop.png](01-dashboard-desktop.png) | [Coursera](https://www.coursera.org/) | 1440 × 1000 | Recommendation region; cropped to omit personal greeting |
| E02 | [02-mega-menu-desktop.png](02-mega-menu-desktop.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety) | 1440 × 1000 | Open desktop catalog mega menu; partial header frame |
| E03 | [03-search-suggestions.png](03-search-suggestions.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety) | 1440 × 1000 | Focused empty search with recent query, trending topics, and suggested courses |
| E04 | [04-search-desktop.png](04-search-desktop.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety) | 1440 × 1000 | Unfiltered result grid |
| E05 | [05-filter-dialog-desktop.png](05-filter-dialog-desktop.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety) | 1440 × 1000 | Right filter drawer with Level expanded |
| E06 | [06-filter-selected.png](06-filter-selected.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety&productDifficultyLevel=Beginner&sortBy=BEST_MATCH) | 1440 × 1000 | Selected Beginner checkbox and dynamic View count in desktop drawer |
| E07 | [07-search-mobile.png](07-search-mobile.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety&productDifficultyLevel=Beginner&sortBy=BEST_MATCH) | 390 × 844 | Mobile search top and compact rows |
| E08 | [08-filter-mobile.png](08-filter-mobile.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety&productDifficultyLevel=Beginner&sortBy=BEST_MATCH) | 390 × 844 | Full-width mobile filter panel |
| E09 | [09-navigation-mobile.png](09-navigation-mobile.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety) | 390 × 844 | Nested mobile category navigation with Back and Close controls |
| E10 | [10-search-tablet.png](10-search-tablet.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety&productDifficultyLevel=Beginner&sortBy=BEST_MATCH) | 768 × 1024 | Two-column results; mobile-style navigation |
| E11 | [11-search-320.png](11-search-320.png) | [Coursera](https://www.coursera.org/search?query=occupational%20safety&productDifficultyLevel=Beginner&sortBy=BEST_MATCH) | 320 × 800 | Narrow reflow; local chip strip |
| E12 | [12-course-detail-desktop.png](12-course-detail-desktop.png) | [Coursera](https://www.coursera.org/learn/occupational-safety-and-health-administration-osha-basics) | 1440 × 1000 | Course header with assistant rail closed |
| E12a | [12a-course-ai-panel.png](12a-course-ai-panel.png) | [Coursera](https://www.coursera.org/learn/occupational-safety-and-health-administration-osha-basics) | 1440 × 1000 | Assistant rail expanded on arrival; no prompt sent |
| E13 | [13-module-expanded.png](13-module-expanded.png) | [Coursera](https://www.coursera.org/learn/occupational-safety-and-health-administration-osha-basics) | 1440 × 1000 | First syllabus module expanded; sticky section navigation |
| E14 | [14-faq-desktop.png](14-faq-desktop.png) | [Coursera](https://www.coursera.org/learn/occupational-safety-and-health-administration-osha-basics) | 1440 × 1000 | First FAQ expanded |
| E15 | [15-course-mobile.png](15-course-mobile.png) | [Coursera](https://www.coursera.org/learn/occupational-safety-and-health-administration-osha-basics) | 390 × 844 | Stacked course hero and full-width CTA |
| E16 | [16-unmatched-query.png](16-unmatched-query.png) | [Coursera](https://www.coursera.org/search?query=zzqhseaudittestzzq) | 1440 × 1000 | Single unmatched-query probe; broad results still shown |
| E17 | [17-learning-empty.png](17-learning-empty.png) | [Coursera](https://www.coursera.org/my-learning) | 1440 × 1000 | Empty In Progress panel and tabs; personal heading cropped out |

## Measurement and interaction records

- [measurements.json](measurements.json): selected visible rendered elements; names/greetings excluded. Observed offscreen carousel content is not treated as viewport content.
- [card-geometry.json](card-geometry.json) and [card-container-geometry.json](card-container-geometry.json): DOM ancestry and CSS geometry of a result card.
- [dashboard-paint-summary.json](dashboard-paint-summary.json): rendered colors and radius frequencies; counts are sampling artifacts, not tokens.
- [filter-escape-observation.json](filter-escape-observation.json): first lingering aria-hidden/BODY-focus observation.
- [filter-escape-repeat.json](filter-escape-repeat.json): later successful dismissal restoring visible accessibility content and trigger focus. This limits the finding to intermittent behavior.

## Keyboard tab observation

My Learning: ArrowRight from In Progress focused Completed while In Progress remained selected (manual activation pattern). Focus outline measured rgb(128,78,228), 1px solid, 2px offset. No populated learning record was opened.
