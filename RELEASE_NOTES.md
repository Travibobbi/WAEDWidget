# New in 2.0.5

- Adds a Roster page with one page per metro hospital, separate day/night views, and Black/Green/Red/Blue comparison bars for captured T4 waits.
- Uses the user-confirmed continuous eight-day cycle anchored to 18 September 2026: Black days/Blue nights, Green/Black, Red/Green, Blue/Red, each for two days. Days are 07:00–18:00 Perth; nights are 18:00–07:00 and belong to their starting date.
- Compares the median of each shift's captured-reading median, giving each observed shift equal weight. Repeated timestamps are deduplicated, missing observations are not zero, and coverage shows shifts, samples and sampled hour slots.
- Marks limited coverage and explains that roster timing is not a measure of crew performance. Daily ED totals and monthly SJWA reports are not attributed to shifts.
- Roster analysis uses existing local history and refreshes with the other tabs. It does not change or upload the widget log.

Install WAEDWidget-v2.0.5.apk over the existing app without uninstalling or clearing storage. The production identity and signing certificate are unchanged. Release tests verify the actual 1.5 in-place upgrade, preserved history and live report downloads.
