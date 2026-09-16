package com.waed.upgradeprobe;

import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipInputStream;

/** Runs only in a disposable emulator, signed with the target app certificate. Never shipped. */
public class UpgradeProbe extends Instrumentation {
    private String mode;
    @Override public void onCreate(Bundle args){super.onCreate(args);mode=args.getString("mode");start();}
    private static void require(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    private String snapshot(Context c)throws Exception{
        JSONObject result=new JSONObject();
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(c.getDatabasePath("ed_history.db").getPath(),null,SQLiteDatabase.OPEN_READONLY)){
            require(db.getVersion()==1,"Database version changed");
            for(String table:new String[]{"snapshots","readings"}){
                JSONArray rows=new JSONArray();try(Cursor q=db.rawQuery("SELECT * FROM "+table+" ORDER BY "+(table.equals("snapshots")?"id":"snapshot_id,hospital_name"),null)){
                    while(q.moveToNext()){JSONObject row=new JSONObject();for(int i=0;i<q.getColumnCount();i++)row.put(q.getColumnName(i),q.isNull(i)?JSONObject.NULL:q.getType(i)==Cursor.FIELD_TYPE_INTEGER?q.getLong(i):q.getString(i));rows.put(row);}
                }result.put(table,rows);
            }
        }
        result.put("preference",c.getSharedPreferences("user_settings",0).getString("preferred_hospital",""));return result.toString();
    }
    @Override public void onStart(){
        Bundle output=new Bundle();
        try{
            Context c=getTargetContext();require(c.getPackageName().equals("com.waed.widget"),"Wrong target app");
            File reference=new File(c.getFilesDir(),"upgrade-fixture.json");
            if("seed".equals(mode)){
                // MainActivity from the actual published 1.5 APK creates its own schema.
                startActivitySync(new Intent().setClassName(c,"com.waed.widget.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                try(SQLiteDatabase db=SQLiteDatabase.openDatabase(c.getDatabasePath("ed_history.db").getPath(),null,SQLiteDatabase.OPEN_READWRITE)){
                    try(Cursor q=db.rawQuery("SELECT COUNT(*) FROM snapshots",null)){q.moveToFirst();require(q.getLong(0)==0,"Test target is not empty");}
                    db.execSQL("INSERT INTO snapshots(id,source_timestamp,recorded_at) VALUES(101,?,?)",new Object[]{"Monday, 1 January 2024 10:00 AM",1704074400000L});
                    db.execSQL("INSERT INTO snapshots(id,source_timestamp,recorded_at) VALUES(102,?,?)",new Object[]{"Wednesday, 16 September 2026 10:00 AM",System.currentTimeMillis()});
                    db.execSQL("INSERT INTO readings VALUES(101,?,?,120,4,20,NULL)",new Object[]{"Royal Perth Hospital","RPH"});
                    db.execSQL("INSERT INTO readings VALUES(102,?,?,45,7,30,-2)",new Object[]{"Perth Children's Hospital","PCH"});
                }
                require(c.getSharedPreferences("user_settings",0).edit().putString("preferred_hospital","Royal Perth Hospital").commit(),"Preference write failed");
                try(FileOutputStream f=new FileOutputStream(reference)){f.write(snapshot(c).getBytes(StandardCharsets.UTF_8));}
                output.putString("result","UPGRADE_SEED_OK");
            }else{
                require("verify".equals(mode),"Unknown mode");
                String before=new String(java.nio.file.Files.readAllBytes(reference.toPath()),StandardCharsets.UTF_8);
                require(before.equals(snapshot(c)),"History or preference changed during installation");
                startActivitySync(new Intent().setClassName(c,"com.waed.widget.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                startActivitySync(new Intent().setClassName(c,"com.waed.widget.AnalysisActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                File backup=new File(c.getFilesDir(),"history-backups/widget-history-v2-first-open.zip");
                long deadline=System.currentTimeMillis()+30000;while(!backup.exists()&&System.currentTimeMillis()<deadline)Thread.sleep(200);
                require(backup.exists(),"Analysis did not create the first-open safety backup");
                JSONObject saved;try(ZipInputStream z=new ZipInputStream(new FileInputStream(backup));ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
                    require(z.getNextEntry()!=null,"Empty backup");byte[] buffer=new byte[4096];int n;while((n=z.read(buffer))!=-1)bytes.write(buffer,0,n);saved=new JSONObject(bytes.toString("UTF-8"));
                }
                JSONObject original=new JSONObject(before);
                require(saved.getJSONArray("snapshots").toString().equals(original.getJSONArray("snapshots").toString()),"Backup did not preserve all snapshots, including old history");
                require(saved.getJSONArray("readings").toString().equals(original.getJSONArray("readings").toString()),"Backup did not preserve readings and nulls");
                Class<?> repo=Class.forName("com.waed.widget.AnalysisRepository",true,c.getClassLoader());
                java.lang.reflect.Method importer=repo.getDeclaredMethod("importData",Context.class,String.class);importer.setAccessible(true);
                String csv="recorded_at,source_timestamp,hospital_name,short_name,triage4_minutes,waiting,total,total_change\n"
                    +"2026-09-16T10:00:00+08:00,\"Wednesday, 16 September 2026 10:00 AM\",Royal Perth Hospital,RPH,32,4,20,\n";
                importer.invoke(null,c,csv);importer.invoke(null,c,csv);
                require(new File(c.getFilesDir(),"widget-csv-imports").listFiles().length==1,"Duplicate CSV import created multiple files");
                require(before.equals(snapshot(c)),"Opening analysis or importing CSV changed retained history");
                output.putString("result","UPGRADE_DATA_OK: original rows, nulls, timestamps, preferences and full-history backup preserved; CSV imports isolated");
            }
            finish(-1,output);
        }catch(Throwable e){output.putString("result","UPGRADE_FAILED: "+e);e.printStackTrace();finish(0,output);}
    }
}
