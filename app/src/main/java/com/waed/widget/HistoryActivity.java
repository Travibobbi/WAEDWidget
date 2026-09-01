package com.waed.widget;

import android.app.Activity;
import android.os.Bundle;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.style.ForegroundColorSpan;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

public class HistoryActivity extends Activity {
    private static final int[] SERIES_COLORS = {0xFF006C4C, 0xFF1565C0, 0xFFC45100};
    private final Spinner[] hospitalSpinners = new Spinner[3];
    private HistoryChartView chart;
    private TextView summary;
    private List<EdHistoryStore.HospitalOption> hospitals = new ArrayList<>();
    private int selectedDays = 1;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_history);

        hospitalSpinners[0] = findViewById(R.id.history_hospital_1);
        hospitalSpinners[1] = findViewById(R.id.history_hospital_2);
        hospitalSpinners[2] = findViewById(R.id.history_hospital_3);
        chart = findViewById(R.id.history_chart);
        summary = findViewById(R.id.history_summary);
        findViewById(R.id.history_back).setOnClickListener(v -> finish());

        try (EdHistoryStore store = new EdHistoryStore(this)) {
            hospitals = store.loadHospitals();
        }

        List<String> hospitalNames = new ArrayList<>();
        hospitalNames.add("None");
        for (EdHistoryStore.HospitalOption hospital : hospitals) hospitalNames.add(hospital.shortName);
        for (int slot = 0; slot < hospitalSpinners.length; slot++) {
            ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item, hospitalNames);
            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
            hospitalSpinners[slot].setAdapter(adapter);
            hospitalSpinners[slot].setSelection(slot == 0 && !hospitals.isEmpty() ? 1 : 0, false);
            final int selectedSlot = slot;
            hospitalSpinners[slot].setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                    if (position > 0 && isSelectedElsewhere(selectedSlot, position)) {
                        hospitalSpinners[selectedSlot].setSelection(0);
                        Toast.makeText(HistoryActivity.this,
                            "That hospital is already shown on the graph.", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    loadChart();
                }

                @Override public void onNothingSelected(AdapterView<?> parent) {}
            });
        }

        ((RadioGroup) findViewById(R.id.history_period)).setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.history_7_days) selectedDays = 7;
            else if (checkedId == R.id.history_30_days) selectedDays = 30;
            else selectedDays = 1;
            loadChart();
        });

        if (hospitals.isEmpty()) {
            summary.setText("No history has been recorded yet. Refresh the widget to save the first reading.");
            chart.setHistories(new ArrayList<>(), selectedDays);
        } else {
            loadChart();
        }
    }

    private void loadChart() {
        List<HistoryChartView.HistorySeries> series = new ArrayList<>();
        SpannableStringBuilder summaryText = new SpannableStringBuilder();
        try (EdHistoryStore store = new EdHistoryStore(this)) {
            for (int slot = 0; slot < hospitalSpinners.length; slot++) {
                int position = hospitalSpinners[slot].getSelectedItemPosition();
                if (position <= 0 || position > hospitals.size()) continue;

                EdHistoryStore.HospitalOption hospital = hospitals.get(position - 1);
                List<EdHistoryStore.HistoryPoint> points = store.loadHistory(hospital.fullName, selectedDays);
                series.add(new HistoryChartView.HistorySeries(hospital.shortName, SERIES_COLORS[slot], points));
                appendSummary(summaryText, hospital.shortName, SERIES_COLORS[slot], points);
            }
        }
        chart.setHistories(series, selectedDays);

        if (series.isEmpty()) {
            summary.setText("Select up to three hospitals to compare their recorded wait times.");
            return;
        }
        summaryText.append("\nThe dashed line marks the 60-minute ATS 4 target.");
        summary.setText(summaryText);
    }

    private void appendSummary(SpannableStringBuilder text, String name, int color,
                               List<EdHistoryStore.HistoryPoint> points) {
        if (text.length() > 0) text.append('\n');
        int colorStart = text.length();
        text.append("● ").append(name);
        text.setSpan(new ForegroundColorSpan(color), colorStart, text.length(),
            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (points.isEmpty()) {
            text.append(": no readings in this period");
            return;
        }
        int minimum = Integer.MAX_VALUE;
        int maximum = Integer.MIN_VALUE;
        for (EdHistoryStore.HistoryPoint point : points) {
            minimum = Math.min(minimum, point.triage4Minutes);
            maximum = Math.max(maximum, point.triage4Minutes);
        }
        int latest = points.get(points.size() - 1).triage4Minutes;
        text.append(": Latest ").append(String.valueOf(latest))
            .append(" min  •  Low ").append(String.valueOf(minimum))
            .append("  •  High ").append(String.valueOf(maximum));
    }

    private boolean isSelectedElsewhere(int selectedSlot, int position) {
        for (int slot = 0; slot < hospitalSpinners.length; slot++) {
            if (slot != selectedSlot && hospitalSpinners[slot].getSelectedItemPosition() == position) return true;
        }
        return false;
    }
}
