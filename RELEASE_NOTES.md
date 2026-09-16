# New in 2.0.2

- Highlights: one historical trend at a time, with Previous/Next navigation.
- Archive explorer: browse saved WA ED and SJWA data by hospital and measure.
- Ramping: ten metro hospital pages comparing the same month across four years, with provisional red/green direction indicators. Bars use hours per day to account for the incomplete current month.
- T4 Wait: published daily median waits overlaid with daily medians of your captured widget readings. The different measures are labelled explicitly.
- JSON archive and widget-history CSV imports, standalone report export, and a portable full-history safety backup created when analysis is first opened.

## Updating from 1.5

Download **WAEDWidget-v2.0.2.apk** below and install it over the existing **WA ED Widget**. Do **not** uninstall version 1.5 or clear its storage. Export History → Export CSV to Drive first as an extra copy.

This is the production-signed update, not the separate Preview app. It keeps `com.waed.widget`, the existing signing certificate, database name and schema, widget resources and preferences. Your existing history is read directly; you do not need to import it. The widget retains its current appearance.

Publication is gated on a disposable-emulator test that installs the actual 1.5 APK, seeds old and recent history, installs this release with `adb install -r`, and verifies all readings, nulls, timestamps, preferences, safety-backup contents and isolation of CSV imports.

Saved archive data is bundled from 16 September 2026; use Import for newer collector observations.json files. Private Google Drive archives are not automatically synced by this app.
