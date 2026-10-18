# New in 2.0.3

- Fixes analysis being stuck on the September snapshot. WA ED, ambulance response and ramping reports now download automatically.
- The public-report collector checks daily at approximately 12:17 pm and 6:17 pm Perth time. Android checks in the background about every 12 hours and when Analysis opens; Refresh checks immediately. Internet access, Android battery restrictions and GitHub scheduling can delay updates.
- Analysis shows the report date for each source and the last successful check. Failed downloads keep the last good data and display an error; overdue feeds are labelled.
- Includes reports through 17 October 2026 for offline use. Source publication dates may lag today.
- Full public capture evidence and each published feed version are retained in portable JSON archives on the repository's data-feed branch. Private Drive archives and personal widget readings are not published.

## Install as an update

Install **WAEDWidget-v2.0.3.apk** over WA ED Widget 1.5 or 2.0.2. Do not uninstall or clear storage. This uses the same production application identity and signing certificate. The widget database, retained log, preferences and manual imports are preserved.

Release checks install the actual 1.5 APK, seed history, upgrade in place, download the live report feed, reject a corrupt update, and verify the original history and full-history backup remain intact.

The public feed captures current source reports going forward. Older private Drive captures remain available through Import; this update does not automatically download private Drive files.
