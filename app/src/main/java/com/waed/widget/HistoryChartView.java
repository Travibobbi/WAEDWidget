package com.waed.widget;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.AttributeSet;
import android.view.View;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class HistoryChartView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private List<HistorySeries> series = new ArrayList<>();
    private int days = 1;

    static final class HistorySeries {
        final String name;
        final int color;
        final List<EdHistoryStore.HistoryPoint> points;

        HistorySeries(String name, int color, List<EdHistoryStore.HistoryPoint> points) {
            this.name = name;
            this.color = color;
            this.points = new ArrayList<>(points);
        }
    }

    public HistoryChartView(Context context, AttributeSet attrs) {
        super(context, attrs);
        paint.setTypeface(android.graphics.Typeface.create("sans", android.graphics.Typeface.NORMAL));
    }

    void setHistories(List<HistorySeries> series, int days) {
        this.series = new ArrayList<>(series);
        this.days = days;
        int readingCount = 0;
        for (HistorySeries item : series) readingCount += item.points.size();
        setContentDescription(readingCount == 0 ? "No history recorded for this period" :
            "Line graph comparing " + series.size() + " hospitals using " + readingCount
                + " Triage Category 4 wait readings");
        invalidate();
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float density = getResources().getDisplayMetrics().density;
        float left = 46f * density;
        float right = getWidth() - 14f * density;
        float top = 20f * density;
        float bottom = getHeight() - (days == 7 ? 48f : 36f) * density;

        paint.setStyle(Paint.Style.FILL);
        paint.setTextSize(11f * density);
        paint.setColor(Color.rgb(92, 107, 99));

        boolean hasPoints = false;
        for (HistorySeries item : series) hasPoints |= !item.points.isEmpty();
        if (!hasPoints) {
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText("No recorded data for this period", getWidth() / 2f, getHeight() / 2f, paint);
            return;
        }

        int dataMaximum = 60;
        for (HistorySeries item : series) {
            for (EdHistoryStore.HistoryPoint point : item.points) {
                dataMaximum = Math.max(dataMaximum, point.triage4Minutes);
            }
        }
        int axisMaximum = Math.max(90, ((dataMaximum + 29) / 30) * 30);

        paint.setStrokeWidth(1f * density);
        paint.setTextAlign(Paint.Align.RIGHT);
        for (int i = 0; i <= 3; i++) {
            int value = axisMaximum * i / 3;
            float y = bottom - (bottom - top) * i / 3f;
            paint.setColor(Color.rgb(217, 226, 221));
            canvas.drawLine(left, y, right, y, paint);
            paint.setColor(Color.rgb(92, 107, 99));
            canvas.drawText(String.valueOf(value), left - 7f * density, y + 4f * density, paint);
        }

        float targetY = bottom - (bottom - top) * 60f / axisMaximum;
        paint.setColor(Color.rgb(133, 88, 0));
        paint.setPathEffect(new DashPathEffect(new float[]{6f * density, 5f * density}, 0));
        canvas.drawLine(left, targetY, right, targetY, paint);
        paint.setPathEffect(null);
        paint.setTextAlign(Paint.Align.LEFT);
        canvas.drawText("60 min target", left + 5f * density, targetY - 5f * density, paint);

        long endTime = System.currentTimeMillis();
        long startTime = endTime - days * 24L * 60L * 60L * 1000L;
        drawTimeAxis(canvas, startTime, endTime, left, right, bottom, density);

        for (HistorySeries item : series) {
            Path path = new Path();
            for (int i = 0; i < item.points.size(); i++) {
                EdHistoryStore.HistoryPoint point = item.points.get(i);
                float fraction = Math.max(0f, Math.min(1f, (point.recordedAt - startTime) / (float) (endTime - startTime)));
                float x = left + (right - left) * fraction;
                float y = bottom - (bottom - top) * point.triage4Minutes / axisMaximum;
                if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
            }
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1.25f * density);
            paint.setStrokeJoin(Paint.Join.ROUND);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setColor(item.color);
            canvas.drawPath(path, paint);

            paint.setStyle(Paint.Style.FILL);
            for (EdHistoryStore.HistoryPoint point : item.points) {
                float fraction = Math.max(0f, Math.min(1f, (point.recordedAt - startTime) / (float) (endTime - startTime)));
                float x = left + (right - left) * fraction;
                float y = bottom - (bottom - top) * point.triage4Minutes / axisMaximum;
                canvas.drawCircle(x, y, 1.25f * density, paint);
            }
        }

    }

    private void drawTimeAxis(Canvas canvas, long startTime, long endTime, float left, float right,
                              float bottom, float density) {
        Calendar tick = Calendar.getInstance();
        tick.setTimeInMillis(startTime);
        tick.set(Calendar.MINUTE, 0);
        tick.set(Calendar.SECOND, 0);
        tick.set(Calendar.MILLISECOND, 0);

        int stepHours;
        SimpleDateFormat primaryFormat;
        SimpleDateFormat secondaryFormat = null;
        if (days == 1) {
            stepHours = 4;
            int hour = tick.get(Calendar.HOUR_OF_DAY);
            tick.set(Calendar.HOUR_OF_DAY, hour - hour % stepHours);
            primaryFormat = new SimpleDateFormat("HH:00", Locale.getDefault());
        } else if (days == 7) {
            stepHours = 12;
            tick.set(Calendar.HOUR_OF_DAY, tick.get(Calendar.HOUR_OF_DAY) < 12 ? 0 : 12);
            primaryFormat = new SimpleDateFormat("EEE", Locale.getDefault());
            secondaryFormat = new SimpleDateFormat("HH", Locale.getDefault());
        } else {
            stepHours = 7 * 24;
            tick.set(Calendar.HOUR_OF_DAY, 0);
            primaryFormat = new SimpleDateFormat("d MMM", Locale.getDefault());
        }

        if (tick.getTimeInMillis() < startTime) tick.add(Calendar.HOUR_OF_DAY, stepHours);

        paint.setStyle(Paint.Style.FILL);
        paint.setStrokeWidth(1f * density);
        paint.setTextSize((days == 7 ? 8f : 9f) * density);
        paint.setTextAlign(Paint.Align.CENTER);
        while (tick.getTimeInMillis() <= endTime) {
            long tickTime = tick.getTimeInMillis();
            float fraction = (tickTime - startTime) / (float) (endTime - startTime);
            float x = left + (right - left) * fraction;

            paint.setColor(Color.rgb(231, 237, 234));
            canvas.drawLine(x, 20f * density, x, bottom, paint);
            canvas.drawLine(x, bottom, x, bottom + 4f * density, paint);

            paint.setColor(Color.rgb(92, 107, 99));
            canvas.drawText(primaryFormat.format(new Date(tickTime)), x, bottom + 15f * density, paint);
            if (secondaryFormat != null) {
                canvas.drawText(secondaryFormat.format(new Date(tickTime)), x, bottom + 27f * density, paint);
            }
            tick.add(Calendar.HOUR_OF_DAY, stepHours);
        }
    }
}
