package com.waed.widget;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.JsonWriter;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Reads widget history; analysis imports never enter the widget database. */
final class AnalysisRepository {
    static final int MAX_IMPORT = 25 * 1024 * 1024;
    static long sourceTime(String text) {
        for (String pattern : new String[]{"EEEE, d MMMM yyyy hh:mm a", "EEEE, d MMMM yyyy HH:mm", "d MMMM yyyy hh:mm a"}) {
            SimpleDateFormat f = new SimpleDateFormat(pattern, Locale.ENGLISH);
            f.setLenient(false); f.setTimeZone(TimeZone.getTimeZone("Australia/Perth"));
            ParsePosition p = new ParsePosition(0); Date d = f.parse(text, p);
            if (d != null && p.getIndex() == text.length()) return d.getTime();
        }
        return 0;
    }
    static JSONObject widget(Context context) throws Exception {
        JSONObject result = new JSONObject(); JSONArray rows = new JSONArray();
        try (EdHistoryStore store = new EdHistoryStore(context)) {
            SQLiteDatabase db = store.getReadableDatabase();
            try (Cursor c = db.rawQuery("SELECT COUNT(*),MIN(recorded_at),MAX(recorded_at) FROM snapshots", null)) {
                c.moveToFirst(); result.put("snapshots", c.getLong(0)); result.put("first_recorded", c.getLong(1)); result.put("last_recorded", c.getLong(2));
            }
            // Bounded analysis window only; the retained history itself is never truncated.
            String sql = "SELECT s.source_timestamp,s.recorded_at,r.hospital_name,r.short_name,r.triage4_minutes,r.waiting,r.total FROM snapshots s JOIN readings r ON r.snapshot_id=s.id WHERE s.recorded_at>=? ORDER BY s.recorded_at,r.hospital_name";
            try (Cursor c = db.rawQuery(sql, new String[]{String.valueOf(System.currentTimeMillis()-90L*86400000)})) {
                while(c.moveToNext()) {
                    long t = sourceTime(c.getString(0));
                    rows.put(new JSONObject().put("source_timestamp", c.getString(0)).put("source_time", t)
                        .put("recorded_at",c.getLong(1)).put("hospital",c.getString(2)).put("name",c.getString(3))
                        .put("wait",c.getInt(4)).put("waiting",c.getInt(5)).put("total",c.getInt(6)));
                }
            }
        }
        // Imported CSV remains a separate, immutable file. Prefer native readings for duplicates.
        Map<String,JSONObject> combined=new LinkedHashMap<>();
        File[] imports=new File(context.getFilesDir(),"widget-csv-imports").listFiles((d,n)->n.endsWith(".csv"));
        long cutoff=System.currentTimeMillis()-90L*86400000;
        if(imports!=null){Arrays.sort(imports);for(File f:imports){for(JSONObject o:csvRows(read(new FileInputStream(f)))){
            if(o.getLong("source_time")>=cutoff)combined.put(o.getString("hospital")+"|"+o.getLong("source_time"),o);
        }}}
        for(int i=0;i<rows.length();i++){JSONObject o=rows.getJSONObject(i);combined.put(o.getString("hospital")+"|"+(o.getLong("source_time")>0?o.getLong("source_time"):o.getString("source_timestamp")),o);}
        JSONArray merged=new JSONArray();for(JSONObject o:combined.values())merged.put(o);
        return result.put("rows",merged).put("window_days",90).put("csv_imports",imports==null?0:imports.length).put("is_preview",context.getPackageName().endsWith(".preview"));
    }
    static List<JSONObject> csvRows(String text) throws Exception {
        List<JSONObject> result=new ArrayList<>();
        for(List<String> r:WidgetCsv.parse(text)){
            long source=sourceTime(r.get(1));if(source==0)throw new IOException("CSV has an unrecognised WA Health source timestamp.");
            long recorded=java.time.OffsetDateTime.parse(r.get(0)).toInstant().toEpochMilli();
            result.add(new JSONObject().put("source_timestamp",r.get(1)).put("source_time",source).put("recorded_at",recorded)
                .put("hospital",r.get(2)).put("name",r.get(3)).put("wait",Integer.parseInt(r.get(4)))
                .put("waiting",Integer.parseInt(r.get(5))).put("total",Integer.parseInt(r.get(6))));
        }
        return result;
    }
    static void importData(Context context,String text) throws Exception {
        if(text.trim().startsWith("{")){importArchive(context,text);return;}
        csvRows(text); // Validate every row before saving anything; no database writes.
        File dir=new File(context.getFilesDir(),"widget-csv-imports");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create CSV import folder.");
        byte[] bytes=text.getBytes(StandardCharsets.UTF_8);StringBuilder hash=new StringBuilder();
        for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))hash.append(String.format(Locale.US,"%02x",b&255));
        File dest=new File(dir,hash+".csv");if(dest.exists())return;
        File tmp=File.createTempFile("csv-",".tmp",dir);try(FileOutputStream out=new FileOutputStream(tmp)){out.write(bytes);out.getFD().sync();}
        if(!tmp.renameTo(dest))throw new IOException("Cannot complete CSV import.");
    }
    static String read(InputStream input) throws Exception {
        try(InputStream in=input; ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>MAX_IMPORT)throw new IOException("File exceeds 25 MB; select one capture's observations.json.");out.write(b,0,n);}return out.toString("UTF-8").replaceFirst("^\\uFEFF", "");
        }
    }
    static JSONObject archives(Context context) throws Exception {
        JSONObject base=new JSONObject(read(context.getAssets().open("analysis/archive.json")));
        JSONArray batches=new JSONArray().put(base); File dir=new File(context.getFilesDir(),"analysis-imports");
        File[] files=dir.listFiles((d,n)->n.endsWith(".json")); if(files!=null){Arrays.sort(files);for(File f:files)batches.put(new JSONObject(read(new FileInputStream(f))));}
        return new JSONObject().put("batches",batches).put("imported_files",files==null?0:files.length);
    }
    static void importArchive(Context context, String text) throws Exception {
        JSONObject data=new JSONObject(text); JSONArray rows=data.getJSONArray("observations");
        if(data.optInt("schema_version")!=1||rows.length()==0||rows.length()>100000)throw new IOException("Not a supported observations.json capture.");
        for(int i=0;i<rows.length();i++) {
            JSONObject o=rows.getJSONObject(i);String source=o.getString("source_id");
            if(!Arrays.asList("wa-health-ed-daily","sjwa-response","sjwa-ramping").contains(source))throw new IOException("Unsupported data source.");
            for(String k:new String[]{"capture_id","captured_at_utc","reporting_date","establishment_id","metric_id","unit","status"})if(o.optString(k).isEmpty())throw new IOException("Missing field: "+k);
            if(!o.has("value")||!o.isNull("value")&&(!(o.get("value") instanceof Number)||!Double.isFinite(o.getDouble("value"))||o.getDouble("value")<0))throw new IOException("Invalid observation value.");
            java.time.Instant.parse(o.getString("captured_at_utc"));
            java.time.LocalDate.parse(o.getString("reporting_date"));
            for(String k:new String[]{"period_start","period_end","as_of_date"})if(o.has(k)&&!o.isNull(k))java.time.LocalDate.parse(o.getString(k));
            if(source.startsWith("sjwa-")&&!o.has("period_type"))throw new IOException("Missing reporting period.");
        }
        File dir=new File(context.getFilesDir(),"analysis-imports");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create import folder.");
        byte[] bytes=text.getBytes(StandardCharsets.UTF_8);StringBuilder hash=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))hash.append(String.format(Locale.US,"%02x",b&255));
        File dest=new File(dir,hash+".json");if(dest.exists())return;
        File tmp=File.createTempFile("import-",".tmp",dir);try(FileOutputStream out=new FileOutputStream(tmp)){out.write(bytes);out.getFD().sync();}if(!tmp.renameTo(dest))throw new IOException("Cannot complete import.");
    }
    static File backup(Context context) throws Exception {
        File dir=new File(context.getFilesDir(),"history-backups");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create backup folder.");
        File dest=new File(dir,"widget-history-v2-first-open.zip");if(dest.exists())return dest;
        File tmp=new File(dir,"history-backup.tmp");
        try(EdHistoryStore store=new EdHistoryStore(context); FileOutputStream file=new FileOutputStream(tmp); ZipOutputStream zip=new ZipOutputStream(file)) {
            SQLiteDatabase db=store.getReadableDatabase();db.beginTransactionNonExclusive();
            try {
                zip.putNextEntry(new ZipEntry("widget-history.json"));
                JsonWriter w=new JsonWriter(new OutputStreamWriter(zip,StandardCharsets.UTF_8));w.beginObject().name("schema_version").value(1).name("application_id").value(context.getPackageName()).name("created_at_epoch_ms").value(System.currentTimeMillis());
                for(String table:new String[]{"snapshots","readings"}){
                    w.name(table).beginArray();try(Cursor c=db.rawQuery("SELECT * FROM "+table,null)){while(c.moveToNext()){w.beginObject();for(int i=0;i<c.getColumnCount();i++){w.name(c.getColumnName(i));if(c.isNull(i))w.nullValue();else if(c.getType(i)==Cursor.FIELD_TYPE_INTEGER)w.value(c.getLong(i));else w.value(c.getString(i));}w.endObject();}}w.endArray();
                }w.endObject();w.flush();zip.closeEntry();db.setTransactionSuccessful();
            } finally {db.endTransaction();}
            zip.finish();zip.flush();file.getFD().sync();
        }
        if(!tmp.renameTo(dest))throw new IOException("Could not complete history backup.");return dest;
    }
}
