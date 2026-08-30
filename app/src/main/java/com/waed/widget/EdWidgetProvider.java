package com.waed.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class EdWidgetProvider extends AppWidgetProvider {
    static final String ACTION_REFRESH = "com.waed.widget.REFRESH";
    private static final String PREFS = "ed_cache";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    private static final int[] HOSPITAL_IDS = {R.id.hospital_1,R.id.hospital_2,R.id.hospital_3,R.id.hospital_4,R.id.hospital_5,R.id.hospital_6,R.id.hospital_7,R.id.hospital_8,R.id.hospital_9,R.id.hospital_10};
    private static final int[] WAIT_IDS = {R.id.wait_1,R.id.wait_2,R.id.wait_3,R.id.wait_4,R.id.wait_5,R.id.wait_6,R.id.wait_7,R.id.wait_8,R.id.wait_9,R.id.wait_10};
    private static final int[] WAITING_IDS = {R.id.waiting_1,R.id.waiting_2,R.id.waiting_3,R.id.waiting_4,R.id.waiting_5,R.id.waiting_6,R.id.waiting_7,R.id.waiting_8,R.id.waiting_9,R.id.waiting_10};
    private static final int[] TOTAL_IDS = {R.id.total_1,R.id.total_2,R.id.total_3,R.id.total_4,R.id.total_5,R.id.total_6,R.id.total_7,R.id.total_8,R.id.total_9,R.id.total_10};
    private static final int[] TREND_IDS = {R.id.trend_1,R.id.trend_2,R.id.trend_3,R.id.trend_4,R.id.trend_5,R.id.trend_6,R.id.trend_7,R.id.trend_8,R.id.trend_9,R.id.trend_10};

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        super.onUpdate(context, manager, appWidgetIds);
        for (int id : appWidgetIds) showCachedOrLoading(context, manager, id);
        refreshAll(context, manager, appWidgetIds);
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, EdWidgetProvider.class));
            refreshAll(context, manager, ids);
        }
    }

    private void refreshAll(Context context, AppWidgetManager manager, int[] ids) {
        final PendingResult pending = goAsync();
        EXECUTOR.execute(() -> {
            try {
                for (int id : ids) setStatus(context, manager, id, "Refreshing…");
                EdData data;
                try (EdHistoryStore history = new EdHistoryStore(context)) {
                    // Preserve the pre-database cache as the first historical point
                    // when an existing installation upgrades to history storage.
                    history.seedIfEmpty(load(context));
                    data = history.addTrendsAndRecord(WaHealthClient.fetch());
                }
                save(context, data);
                for (int id : ids) render(context, manager, id, data, false, null);
            } catch (Exception ex) {
                EdData cached = load(context);
                for (int id : ids) render(context, manager, id, cached, true, ex.getMessage());
            } finally {
                pending.finish();
            }
        });
    }

    private void showCachedOrLoading(Context context, AppWidgetManager manager, int id) {
        EdData cached = load(context);
        render(context, manager, id, cached, false, null);
    }

    private void setStatus(Context context, AppWidgetManager manager, int id, String text) {
        RemoteViews rv = baseViews(context);
        rv.setTextViewText(R.id.updated, text);
        manager.updateAppWidget(id, rv);
    }

    private RemoteViews baseViews(Context context) {
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_ed);

        Intent refresh = new Intent(context, EdWidgetProvider.class).setAction(ACTION_REFRESH);
        PendingIntent refreshPi = PendingIntent.getBroadcast(context, 1001, refresh, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.refresh, refreshPi);

        Intent source = new Intent(Intent.ACTION_VIEW, Uri.parse(WaHealthClient.URL_STRING));
        PendingIntent sourcePi = PendingIntent.getActivity(context, 1002, source, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.title, sourcePi);

        Intent info = new Intent(context, MainActivity.class)
            .putExtra(MainActivity.EXTRA_SHOW_WAIT_INFO, true)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent infoPi = PendingIntent.getActivity(context, 1003, info, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.info, infoPi);
        return rv;
    }

    private void render(Context context, AppWidgetManager manager, int id, EdData data, boolean failed, String error) {
        RemoteViews rv = baseViews(context);
        for (int i=0;i<10;i++) {
            rv.setTextViewText(HOSPITAL_IDS[i], "—");
            rv.setTextViewText(WAIT_IDS[i], "—");
            rv.setTextViewText(WAITING_IDS[i], "—");
            rv.setTextViewText(TOTAL_IDS[i], "—");
            rv.setTextViewText(TREND_IDS[i], "—");
            setNumericRowColor(context, rv, i, R.color.widget_muted);
        }

        if (data != null) {
            for (int i=0;i<Math.min(10, data.hospitals.size());i++) {
                EdData.Hospital h = data.hospitals.get(i);
                rv.setTextViewText(HOSPITAL_IDS[i], h.shortName);
                rv.setTextViewText(WAIT_IDS[i], h.triage4Minutes + "m");
                rv.setTextViewText(WAITING_IDS[i], String.valueOf(h.waiting));
                rv.setTextViewText(TOTAL_IDS[i], String.valueOf(h.total));
                rv.setTextViewText(TREND_IDS[i], formatTrend(h.totalChange));
                setNumericRowColor(context, rv, i, failed ? R.color.widget_muted : waitColor(h.triage4Minutes));
            }
            rv.setTextViewText(R.id.updated, (failed ? "Cached • " : "WA Health • ") + data.sourceTimestamp);
            rv.setTextViewText(R.id.status, failed ? "Refresh failed — showing last saved data" : "Trend = total change since prior WA Health update • tap title for source");
        } else {
            rv.setTextViewText(R.id.updated, failed ? "Couldn't load WA Health" : "Loading WA Health data…");
            rv.setTextViewText(R.id.status, failed ? "Tap ↻ to try again" : "WA Health • Triage 4 average");
        }
        manager.updateAppWidget(id, rv);
    }

    private static void save(Context context, EdData data) {
        try {
            JSONArray arr = new JSONArray();
            for (EdData.Hospital h : data.hospitals) {
                JSONObject o = new JSONObject();
                o.put("full", h.fullName); o.put("short", h.shortName); o.put("t4", h.triage4Minutes); o.put("waiting", h.waiting); o.put("total", h.total);
                if (h.totalChange != null) o.put("totalChange", h.totalChange);
                arr.put(o);
            }
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("timestamp", data.sourceTimestamp).putString("rows", arr.toString()).apply();
        } catch (Exception ignored) {}
    }

    private static EdData load(Context context) {
        try {
            SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String rows = p.getString("rows", null);
            if (rows == null) return null;
            JSONArray arr = new JSONArray(rows);
            List<EdData.Hospital> list = new ArrayList<>();
            for (int i=0;i<arr.length();i++) {
                JSONObject o = arr.getJSONObject(i);
                Integer totalChange = o.has("totalChange") ? o.getInt("totalChange") : null;
                list.add(new EdData.Hospital(o.getString("full"),o.getString("short"),o.getInt("t4"),o.getInt("waiting"),o.getInt("total"),totalChange));
            }
            return new EdData(p.getString("timestamp", "saved data"), list);
        } catch (Exception ignored) { return null; }
    }

    private static String formatTrend(Integer change) {
        if (change == null) return "—";
        if (change > 0) return "↑ +" + change;
        if (change < 0) return "↓ −" + Math.abs(change);
        return "→ 0";
    }

    private static int waitColor(int minutes) {
        if (minutes <= 30) return R.color.wait_within_target;
        if (minutes <= 60) return R.color.wait_near_target;
        if (minutes <= 120) return R.color.wait_over_target;
        return R.color.wait_well_over_target;
    }

    private static void setNumericRowColor(Context context, RemoteViews rv, int index, int colorResource) {
        int color = context.getColor(colorResource);
        rv.setTextColor(WAIT_IDS[index], color);
        rv.setTextColor(WAITING_IDS[index], color);
        rv.setTextColor(TOTAL_IDS[index], color);
        rv.setTextColor(TREND_IDS[index], color);
    }
}
