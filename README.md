# WA ED Widget

Small native Android home-screen widget that reads the public WA Department of Health Emergency Department live activity page.

## Displays
- Hospital name (10 Perth metropolitan EDs)
- Published average wait for Triage Category 4 patients
- Number of patients waiting to be seen
- Total patients in ED
- Queue pressure / waiting share (`waiting / total × 100`), which is not a capacity measure
- WA Health source timestamp

## Behaviour
- Android widget update requested every 30 minutes (OS may defer background updates)
- Tap the ↻ icon to manually refresh
- Tap `WA ED STATUS` to open the official WA Health page
- Last successful response is cached; if refresh fails, the widget keeps showing cached data and labels it as cached
- No accounts, analytics, tracking, advertising, or personal data

## Source
https://www.health.wa.gov.au/Reports-and-publications/Emergency-Department-activity/Data?report=ed_activity_now

## Build
With Android SDK 35 and JDK 17 installed, run:

```powershell
.\gradlew.bat assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions also builds and uploads the debug APK on every push and pull request.

This project intentionally uses only Android platform APIs: no third-party runtime dependencies.
