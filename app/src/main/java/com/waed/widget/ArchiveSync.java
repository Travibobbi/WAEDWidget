package com.waed.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Locale;
import java.util.zip.GZIPInputStream;

/** Rebuildable public-report cache; never writes widget history or imports. */
final class ArchiveSync {
    static final String BASE="https://raw.githubusercontent.com/Travibobbi/WAEDWidget/data-feed/";
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("report-sync",0);}
    private static AtomicFile file(Context c){return new AtomicFile(new File(c.getFilesDir(),"report-feed.json"));}
    static synchronized JSONObject cached(Context c){try{return new JSONObject(AnalysisRepository.read(file(c).openRead()));}catch(Exception e){return null;}}
    static byte[] download(String path,boolean gzip,int limit) throws Exception {
        HttpURLConnection con=(HttpURLConnection)new URL(BASE+path).openConnection();
        con.setConnectTimeout(20000);con.setReadTimeout(30000);con.setInstanceFollowRedirects(false);
        try{if(con.getResponseCode()!=200)throw new IOException("Report service HTTP "+con.getResponseCode());
            try(InputStream in=gzip?new GZIPInputStream(con.getInputStream()):con.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("Report exceeds size limit");out.write(b,0,n);}return out.toByteArray();
            }
        }finally{con.disconnect();}
    }
    static synchronized void refresh(Context c,boolean force){
        SharedPreferences p=prefs(c);long now=System.currentTimeMillis();if(!force&&now-p.getLong("checked",0)<3600000)return;
        p.edit().putLong("checked",now).apply();
        try{
            JSONObject pointer=new JSONObject(new String(download("latest.json",false,65536),StandardCharsets.UTF_8));
            String path=pointer.getString("path");if(pointer.getInt("schema_version")!=1||!path.matches("snapshots/[A-Za-z0-9-]+\\.json\\.gz"))throw new IOException("Unsupported report feed");
            byte[] bytes=download(path,true,AnalysisRepository.MAX_IMPORT);
            install(c,pointer,bytes);
            p.edit().putLong("success",now).remove("error").apply();
        }catch(Exception e){p.edit().putString("error",e.getMessage()==null?"Download failed":e.getMessage()).apply();}
    }
    static synchronized void install(Context c,JSONObject pointer,byte[] bytes) throws Exception {
        StringBuilder hash=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))hash.append(String.format(Locale.US,"%02x",b&255));
        if(!hash.toString().equals(pointer.getString("sha256"))||bytes.length!=pointer.getInt("bytes"))throw new IOException("Report checksum mismatch");
        JSONObject data=AnalysisRepository.validateArchive(new String(bytes,StandardCharsets.UTF_8));
        if(data.getJSONArray("observations").length()!=pointer.getInt("observations")||!data.getString("generated_at_utc").equals(pointer.getString("generated_at_utc")))throw new IOException("Report manifest mismatch");
        Instant generated=Instant.parse(data.getString("generated_at_utc"));if(generated.toEpochMilli()>System.currentTimeMillis()+3600000)throw new IOException("Invalid report timestamp");
        JSONObject previous=cached(c),dates=data.getJSONObject("source_dates");
        if(previous!=null&&generated.isBefore(Instant.parse(previous.getString("generated_at_utc"))))throw new IOException("Older report feed rejected");
        for(String source:new String[]{"wa-health-ed-daily","sjwa-response","sjwa-ramping"}){
            String date=dates.getString(source);java.time.LocalDate.parse(date);
            if(!date.equals(pointer.getJSONObject("source_dates").getString(source)))throw new IOException("Source date mismatch");
            if(previous!=null&&date.compareTo(previous.getJSONObject("source_dates").getString(source))<0)throw new IOException("Older source report rejected");
        }
        AtomicFile target=file(c);FileOutputStream out=null;
        try{out=target.startWrite();out.write(bytes);target.finishWrite(out);}catch(Exception e){if(out!=null)target.failWrite(out);throw e;}
    }
    static String status(Context c){
        SharedPreferences p=prefs(c);JSONObject data=cached(c);String text="Saved reports · tap Refresh to check";
        try{if(data!=null){JSONObject dates=data.getJSONObject("source_dates");text="ED "+dates.getString("wa-health-ed-daily")+" · Response "+dates.getString("sjwa-response")+" · Ramping "+dates.getString("sjwa-ramping");
            if(System.currentTimeMillis()-Instant.parse(data.getString("generated_at_utc")).toEpochMilli()>3L*86400000)text+=" · Feed overdue";}}
        catch(Exception ignored){}
        if(p.contains("error"))return text+"\nUpdate failed; showing saved data. "+p.getString("error","");
        long checked=p.getLong("success",0);if(checked>0)text+="\nChecked "+android.text.format.DateFormat.format("d MMM HH:mm",checked)+" · automatic daily updates";
        return text;
    }
}
