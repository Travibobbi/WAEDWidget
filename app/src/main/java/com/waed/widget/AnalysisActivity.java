package com.waed.widget;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.*;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AnalysisActivity extends Activity {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private WebView web; private TextView status; private String pendingReport; private static final int IMPORT=3001,BACKUP=3002,REPORT=3003;
    @Override public void onCreate(Bundle saved){super.onCreate(saved);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(0xfff4f7f5);
        LinearLayout bar=new LinearLayout(this);bar.setOrientation(LinearLayout.HORIZONTAL);
        button(bar,"Back",()->finish());button(bar,"Import",()->choose(IMPORT,"*/*",""));button(bar,"Backup",()->choose(BACKUP,"application/zip","WAEDWidget-first-open-backup.zip"));
        button(bar,"Report",()->web.evaluateJavascript("window.reportHtml ? window.reportHtml() : ''",v->{try{pendingReport=(String)new JSONTokener(v).nextValue();if(!pendingReport.isEmpty())choose(REPORT,"text/html","WAED-analysis-report.html");}catch(Exception e){status.setText("Report is not ready yet.");}}));root.addView(bar);
        status=new TextView(this);status.setPadding(16,8,16,8);status.setText("Preparing a safety copy and reading history…");root.addView(status);
        web=new WebView(this);web.setBackgroundColor(0xfff4f7f5);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,String url){return true;}@Override public void onPageFinished(WebView v,String url){if(url.equals("file:///android_asset/analysis/index.html"))load();}});
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);web.loadUrl("file:///android_asset/analysis/index.html");
    }
    private void button(LinearLayout bar,String title,Runnable action){Button b=new Button(this);b.setText(title);b.setTextSize(12);b.setPadding(2,2,2,2);bar.addView(b,new LinearLayout.LayoutParams(0,-2,1));b.setOnClickListener(v->action.run());}
    private void ui(Runnable action){runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())action.run();});}
    private void load(){worker.execute(()->{try{AnalysisRepository.backup(this);JSONObject data=new JSONObject().put("widget",AnalysisRepository.widget(this)).put("archives",AnalysisRepository.archives(this));String payload=JSONObject.quote(data.toString());ui(()->{if(isFinishing())return;web.evaluateJavascript("window.receive(JSON.parse("+payload+"))",null);status.setText("");});}catch(Exception e){ui(()->status.setText("Could not load analysis: "+e.getMessage()+". Widget history is unchanged."));}});}
    private void choose(int code,String mime,String name){Intent i=new Intent(code==IMPORT?Intent.ACTION_OPEN_DOCUMENT:Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime);if(code!=IMPORT)i.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(i,code);}
    @Override protected void onActivityResult(int code,int result,Intent data){super.onActivityResult(code,result,data);if(result!=RESULT_OK||data==null||data.getData()==null)return;worker.execute(()->{try{
        if(code==IMPORT)AnalysisRepository.importData(this,AnalysisRepository.read(getContentResolver().openInputStream(data.getData())));
        else try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new IOException("Cannot open destination");if(code==BACKUP){try(InputStream in=new FileInputStream(AnalysisRepository.backup(this))){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}}else out.write(pendingReport.getBytes(StandardCharsets.UTF_8));}
        ui(()->{status.setText(code==IMPORT?"Archive imported. Widget history unchanged.":code==BACKUP?"First-open safety backup exported. For latest readings use History → Export CSV.":"Standalone report exported.");if(code==IMPORT)load();});
    }catch(Exception e){ui(()->status.setText("Could not complete action: "+e.getMessage()));}});}
    @Override protected void onDestroy(){worker.shutdown();web.destroy();super.onDestroy();}
}
