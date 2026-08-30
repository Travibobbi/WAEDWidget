package com.waed.widget;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** App-private, append-only history of distinct WA Health snapshots. */
final class EdHistoryStore extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "ed_history.db";
    private static final int DATABASE_VERSION = 1;

    EdHistoryStore(Context context) {
        super(context.getApplicationContext(), DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE snapshots ("
            + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
            + "source_timestamp TEXT NOT NULL UNIQUE,"
            + "recorded_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE readings ("
            + "snapshot_id INTEGER NOT NULL,"
            + "hospital_name TEXT NOT NULL,"
            + "short_name TEXT NOT NULL,"
            + "triage4_minutes INTEGER NOT NULL,"
            + "waiting INTEGER NOT NULL,"
            + "total INTEGER NOT NULL,"
            + "total_change INTEGER,"
            + "PRIMARY KEY (snapshot_id, hospital_name),"
            + "FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE)");
        db.execSQL("CREATE INDEX readings_hospital_idx ON readings(hospital_name, snapshot_id)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Future schema upgrades must preserve the append-only history.
    }

    void seedIfEmpty(EdData cached) {
        if (cached == null) return;
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor cursor = db.rawQuery("SELECT 1 FROM snapshots LIMIT 1", null)) {
            if (cursor.moveToFirst()) return;
        }
        addTrendsAndRecord(cached);
    }

    EdData addTrendsAndRecord(EdData current) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            Long existingId = findSnapshotId(db, current.sourceTimestamp);
            if (existingId != null) {
                EdData stored = loadSnapshot(db, existingId, current.sourceTimestamp);
                db.setTransactionSuccessful();
                return stored;
            }

            Map<String, Integer> previousTotals = loadLatestTotals(db);
            ContentValues snapshot = new ContentValues();
            snapshot.put("source_timestamp", current.sourceTimestamp);
            snapshot.put("recorded_at", System.currentTimeMillis());
            long snapshotId = db.insertOrThrow("snapshots", null, snapshot);

            List<EdData.Hospital> rows = new ArrayList<>();
            for (EdData.Hospital hospital : current.hospitals) {
                Integer previousTotal = previousTotals.get(hospital.fullName);
                Integer change = previousTotal == null ? null : hospital.total - previousTotal;

                ContentValues reading = new ContentValues();
                reading.put("snapshot_id", snapshotId);
                reading.put("hospital_name", hospital.fullName);
                reading.put("short_name", hospital.shortName);
                reading.put("triage4_minutes", hospital.triage4Minutes);
                reading.put("waiting", hospital.waiting);
                reading.put("total", hospital.total);
                if (change == null) reading.putNull("total_change"); else reading.put("total_change", change);
                db.insertOrThrow("readings", null, reading);

                rows.add(new EdData.Hospital(hospital.fullName, hospital.shortName,
                    hospital.triage4Minutes, hospital.waiting, hospital.total, change));
            }

            db.setTransactionSuccessful();
            return new EdData(current.sourceTimestamp, rows);
        } finally {
            db.endTransaction();
        }
    }

    private static Long findSnapshotId(SQLiteDatabase db, String timestamp) {
        try (Cursor cursor = db.query("snapshots", new String[]{"id"},
            "source_timestamp = ?", new String[]{timestamp}, null, null, null, "1")) {
            return cursor.moveToFirst() ? cursor.getLong(0) : null;
        }
    }

    private static Map<String, Integer> loadLatestTotals(SQLiteDatabase db) {
        Map<String, Integer> totals = new HashMap<>();
        String sql = "SELECT r.hospital_name, r.total FROM readings r "
            + "WHERE r.snapshot_id = (SELECT MAX(id) FROM snapshots)";
        try (Cursor cursor = db.rawQuery(sql, null)) {
            while (cursor.moveToNext()) totals.put(cursor.getString(0), cursor.getInt(1));
        }
        return totals;
    }

    private static EdData loadSnapshot(SQLiteDatabase db, long snapshotId, String timestamp) {
        List<EdData.Hospital> rows = new ArrayList<>();
        try (Cursor cursor = db.query("readings",
            new String[]{"hospital_name", "short_name", "triage4_minutes", "waiting", "total", "total_change"},
            "snapshot_id = ?", new String[]{String.valueOf(snapshotId)}, null, null, "rowid")) {
            while (cursor.moveToNext()) {
                Integer change = cursor.isNull(5) ? null : cursor.getInt(5);
                rows.add(new EdData.Hospital(cursor.getString(0), cursor.getString(1), cursor.getInt(2),
                    cursor.getInt(3), cursor.getInt(4), change));
            }
        }
        return new EdData(timestamp, rows);
    }
}
