package com.waed.widget;
import android.app.job.*;
import android.content.*;
public class ArchiveSyncJob extends JobService {
    static void schedule(Context c){
        JobScheduler scheduler=c.getSystemService(JobScheduler.class);
        ComponentName component=new ComponentName(c,ArchiveSyncJob.class);
        scheduler.schedule(new JobInfo.Builder(20403,component).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(12L*3600000).build());
        scheduler.schedule(new JobInfo.Builder(20404,component).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).build());
    }
    @Override public boolean onStartJob(JobParameters params){new Thread(()->{ArchiveSync.refresh(getApplicationContext(),false);jobFinished(params,false);},"public-report-sync").start();return true;}
    @Override public boolean onStopJob(JobParameters params){return true;}
}
