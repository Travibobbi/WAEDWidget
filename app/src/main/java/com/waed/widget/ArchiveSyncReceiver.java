package com.waed.widget;
import android.content.*;
public class ArchiveSyncReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent intent){ArchiveSyncJob.schedule(c);}
}
