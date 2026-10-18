# Public WA ED / SJWA report feed

latest.json points to a validated gzip JSON snapshot. SHA-256 and bytes describe the uncompressed snapshot. All dates and source IDs are explicit. Observations preserve units, periods, nulls, priorities, capture IDs and source dates. The mobile view contains 90 days of daily records and all available monthly records.

captures/ contains immutable gzip JSON with original source requests/responses, manifests and normalized observations. snapshots/ retains every published mobile view. Neither directory is pruned. These files can be migrated without Google or GitHub-specific storage formats.

Sources: public WA Health ED and St John WA Power BI reports. No private Drive files, credentials or personal widget readings. Automated capture runs twice daily from the main branch workflow. Failed validation leaves latest.json unchanged.
