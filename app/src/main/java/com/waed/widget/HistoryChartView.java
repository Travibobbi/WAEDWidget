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
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class HistoryChartView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private List<EdHistoryStore.HistoryPoint> points = new ArrayList<>();
    private int days = 1;

    public HistoryChartView(Context context, AttributeSet attrs) {
        super(context, attrs);
        paint.setTypeface(android.graphics.Typeface.create("sans", android.graphics.Typeface.NORMAL));
    }

    void setHistory(List<EdHistoryStore.HistoryPoint> points, int days) {
        this.points = new ArrayList<>(points);
        this.days = days;
        setContentDescription(points.isEmpty() ? "No history recorded for this period" :
            "Line graph containing " + points.size() + " Triage Category 4 wait readings");
        invalidate();
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float density = getResources().getDisplayMetrics().density;
        float left = 46f * density;
        float right = getWidth() - 14f * density;
        float top = 20f * density;
        float bottom = getHeight() - 34f * density;

        paint.setStyle(Paint.Style.FILL);
        paint.setTextSize(11f * density);
        paint.setColor(Color.rgb(92, 107, 99));

        if (points.isEmpty()) {
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText("No recorded data for this period", getWidth() / 2f, getHeight() / 2f, paint);
            return;
        }

        int dataMaximum = 60;
        for (EdHistoryStore.HistoryPoint point : points) dataMaximum = Math.max(dataMaximum, point.triage4Minutes);
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
        Path path = new Path();
        for (int i = 0; i < points.size(); i++) {
            EdHistoryStore.HistoryPoint point = points.get(i);
            float fraction = Math.max(0f, Math.min(1f, (point.recordedAt - startTime) / (float) (endTime - startTime)));
            float x = left + (right - left) * fraction;
            float y = bottom - (bottom - top) * point.triage4Minutes / axisMaximum;
            if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2.5f * density);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(Color.rgb(0, 108, 76));
        canvas.drawPath(path, paint);

        paint.setStyle(Paint.Style.FILL);
        for (EdHistoryStore.HistoryPoint point : points) {
            float fraction = Math.max(0f, Math.min(1f, (point.recordedAt - startTime) / (float) (endTime - startTime)));
            float x = left + (right - left) * fraction;
            float y = bottom - (bottom - top) * point.triage4Minutes / axisMaximum;
            canvas.drawCircle(x, y, 2.5f * density, paint);
        }

        SimpleDateFormat format = new SimpleDateFormat(days == 1 ? "h:mm a" : "d MMM", Locale.getDefault());
        paint.setTextSize(10f * density);
        paint.setColor(Color.rgb(92, 107, 99));
        paint.setTextAlign(Paint.Align.LEFT);
        canvas.drawText(format.format(new Date(startTime)), left, getHeight() - 10f * density, paint);
        paint.setTextAlign(Paint.Align.RIGHT);
        canvas.drawText("Now", right, getHeight() - 10f * density, paint);
    }
}
