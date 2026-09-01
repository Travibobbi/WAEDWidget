# WA ED Widget

Current version: **1.4.0**

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

## Behaviour
- Android widget update requested every 30 minutes (OS may defer background updates)
- Tap the ↻ icon to manually refresh
- Tap `WA ED STATUS` to open the official WA Health page
- Tap `History` on the widget or in the app to graph a selected hospital's locally recorded T4 waits
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
