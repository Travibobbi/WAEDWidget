# New in 2.1.0 — WA ED Insights

The app now opens directly into Highlights, with four main pages in bottom navigation: Highlights, Ramping, T4 Wait and Roster. The existing home-screen widget remains available. Archive explorer, widget settings, saved history, imports, backups and report export are under More.

- Highlights: recomputed from each available St John report, showing daily response percentages and previous-day changes where available, plus the largest same-month ramping daily-rate differences. Missing days are not treated as daily changes or connected on the chart.
- Ramping: retains current-month vs the same month in previous years and adds the previous three consecutive months. Both use hours per day so partial totals and unequal month lengths do not create misleading comparisons. Current-month labels and estimates remain provisional.
- T4 Wait: retains both existing series and adds horizontal reference lines every hour, labelled 1 h, 2 h, etc. Values and exact comparisons remain in minutes.
- Roster: retains colour, day/night, hospital and coverage comparisons within the new navigation.

Install WAEDWidget-v2.1.0.apk over the existing app. It is now labelled WA ED Insights but keeps the same production package, signing certificate, widget resources and history database. Do not uninstall or clear storage. Release checks verify the actual 1.5 in-place upgrade, saved history, new launcher destination and live report downloads.
