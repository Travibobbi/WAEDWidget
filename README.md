# WA ED Widget

Current version: **2.0.2** (version code 11).

The GitHub release APK is the production-signed update for version 1.5. Install it in place without uninstalling or clearing storage. Existing history is read directly; CSV import is not needed for an upgrade. Export the current History CSV to Drive first as an extra copy. Release publication is gated on certificate matching and an actual 1.5-to-2.0.2 emulator upgrade test covering old/recent readings, nulls, timestamps, preferences, the full-history backup and isolation of CSV imports.

**Ramping** and **T4 Wait** provide a page for each of the ten metro hospitals, with Previous/Next controls. Ramping compares the source's current calendar month with the same month in the prior three years using hours per calendar day; current month-to-date rates are explicitly provisional against complete historical months. Red up / green down compares with the previous year's rate. Missing comparisons have no directional arrow. Totals and denominators remain available in details.

T4 Wait overlays the published daily ED median with the daily median of sampled widget T4 average readings, using Perth source dates. It shows gaps and sample counts and does not imply that these are the same statistic. Use **Import** to select a CSV from version 1.5's **History → Export CSV**. The original CSV is saved separately by content hash; it never updates either app's database. Repeated readings are deduplicated by hospital and source timestamp, with native readings taking precedence. Imported readings from the past 90 days enter the analysis; the complete CSV stays retained. Archive observations.json imports are still supported.

The analysis screen now opens to one highlighted trend at a time, with Previous/Next navigation, a historical chart and a shortcut into the archive explorer. Monthly highlights use the latest complete month. Notes, exact values and coverage information are collapsed by default. T4 highlights show daily medians of collected readings for each hospital with local history. The archive explorer remains available as a separate tab.

Debug builds install separately as **WA ED Preview** (`com.waed.widget.preview`), allowing testing alongside the existing app. They have independent history and cannot access version 1.5's private database. Release builds retain the original application ID for a future correctly signed in-place upgrade.

## Version 2 first deliverable

Open **Explore data & trends** from the app. The existing home-screen widget is unchanged.

- T4 coverage, source-time gaps, median and 90th percentile of published readings, and four-hour time-of-day summaries for each hospital, using the last 90 days of collected history.
- Offline explorer for 7,234 captured WA ED/SJWA observations bundled on 16 September 2026. Includes daily ED activity, ambulance response history and ramping history. Archive selectors preserve distinct periods, priorities and measures; complete monthly buckets support same-month year-over-year comparisons.
- Import a collector capture's `observations.json` using Android's document picker, including from Drive if installed. Imports are validated, saved separately and retained by content hash. The view chooses the latest captured revision. This version does not automatically sync private Drive archives.
- Export the selected analysis as a standalone HTML report.
- On first opening analysis, create a consistent full-history JSON ZIP safety copy in private app storage. **Backup** exports this first-open copy to your chosen destination. For all readings collected since that copy, use the existing **History → Export CSV**. The safety copy includes original snapshot IDs, source timestamp text and every reading column, including nulls. No in-app restore command is included in this first version.

The application ID remains `com.waed.widget`; `ed_history.db`, its version 1 schema, widget provider and widget layout are unchanged. Analysis reads the database without updating or deleting readings. Archive imports never enter it. The 90-day limit applies only to analysis, not retention.

Before an eventual phone upgrade, export the current history CSV to Drive. Install an APK signed with the **same certificate** as the installed app, as an in-place update. Do not uninstall or clear app storage. The local debug APK is for a test device; it is not a verified compatible upgrade for a release-signed installation. An unsigned release APK must be signed with the existing release key before installation.

Validation: `node --test app/src/test-analysis/analysis.test.cjs`, Android debug/release compilation and debug lint. No physical-device upgrade or Android runtime backup/restore test has been performed. The local emulator lacks its hypervisor driver.

`node preview-analysis.cjs` generates `deliverables/WAED-v2-analysis-preview.html`, a self-contained interactive archive preview. It intentionally contains no fabricated phone history. Add `--serve` to preview at localhost:8765.

Small native Android home-screen widget that reads the public WA Department of Health Emergency Department live activity page.

## Displays
- Hospital name (10 Perth metropolitan EDs)
- Published average wait for Triage Category 4 patients
- Number of patients waiting to be seen
- Total patients in ED
- Total-patient trend since the previous distinct WA Health update (`↑ +N`, `→ 0`, or `↓ −N`)
- Large ATS 4 target-based colour indicator beside each published wait
- WA Health source timestamp
- T4 average-wait history graphs for each hospital over 1, 7, or 30 days
- Compare up to three colour-coded hospitals on one history graph

## Behaviour
- Android widget update requested every 30 minutes (OS may defer background updates)
- Tap the ↻ icon to manually refresh
- Tap `WA ED STATUS` to open the official WA Health page
- Tap `History` on the widget or in the app to graph a selected hospital's locally recorded T4 waits
- Choose a preferred hospital in the main app to make it the default history graph selection
- Export the complete retained history as CSV through Android's document picker to device storage, OneDrive, or another installed provider
- The `30 mins` column shows the total-patient change since the prior WA Health update
- Tap `ⓘ` for the ATS 4 target, colour legend, and ACEM reference
- Last successful response and its trend are cached; if refresh fails, the widget keeps showing cached data and labels it as cached
- Every distinct WA Health snapshot is retained indefinitely in the app's private SQLite database
- History requires no account, server, companion app, or storage permission; in-place updates retain it, and Android backup/device transfer can restore it. Clearing app data still removes it.
- No accounts, analytics, tracking, advertising, or personal data

## Source
https://www.health.wa.gov.au/Reports-and-publications/Emergency-Department-activity/Data?report=ed_activity_now

## Build
With Android SDK 35 and JDK 17 installed, run:

```powershell
.\gradlew.bat assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions builds a debug APK for ordinary pushes and a consistently signed release APK for version tags.

Tagged releases require the repository secrets `WAED_KEYSTORE_BASE64`, `WAED_RELEASE_STORE_PASSWORD`, `WAED_RELEASE_KEY_ALIAS`, and `WAED_RELEASE_KEY_PASSWORD`. Keep the signing keystore permanently: Android only preserves app data when a newer APK has the same application ID and signing certificate. The tag must also use a higher `versionCode` than the installed build.

This project intentionally uses only Android platform APIs: no third-party runtime dependencies.
