package com.waed.widget;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

public class HistoryActivity extends Activity {
    private Spinner hospitalSpinner;
    private HistoryChartView chart;
    private TextView summary;
    private List<EdHistoryStore.HospitalOption> hospitals = new ArrayList<>();
    private int selectedDays = 1;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_history);

        hospitalSpinner = findViewById(R.id.history_hospital);
        chart = findViewById(R.id.history_chart);
        summary = findViewById(R.id.history_summary);
        findViewById(R.id.history_back).setOnClickListener(v -> finish());

        try (EdHistoryStore store = new EdHistoryStore(this)) {
            hospitals = store.loadHospitals();
        }

        ArrayAdapter<EdHistoryStore.HospitalOption> adapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, hospitals);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        hospitalSpinner.setAdapter(adapter);
        hospitalSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                loadChart();
            }

            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });

        ((RadioGroup) findViewById(R.id.history_period)).setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.history_7_days) selectedDays = 7;
            else if (checkedId == R.id.history_30_days) selectedDays = 30;
            else selectedDays = 1;
            loadChart();
        });

        if (hospitals.isEmpty()) {
            summary.setText("No history has been recorded yet. Refresh the widget to save the first reading.");
            chart.setHistory(new ArrayList<>(), selectedDays);
        } else {
            loadChart();
        }
    }

    private void loadChart() {
        int position = hospitalSpinner.getSelectedItemPosition();
        if (position < 0 || position >= hospitals.size()) return;

        EdHistoryStore.HospitalOption hospital = hospitals.get(position);
        List<EdHistoryStore.HistoryPoint> points;
        try (EdHistoryStore store = new EdHistoryStore(this)) {
            points = store.loadHistory(hospital.fullName, selectedDays);
        }
        chart.setHistory(points, selectedDays);

        if (points.isEmpty()) {
            summary.setText("No readings recorded for " + hospital.shortName + " in the selected period.");
            return;
        }

        int minimum = Integer.MAX_VALUE;
        int maximum = Integer.MIN_VALUE;
        for (EdHistoryStore.HistoryPoint point : points) {
            minimum = Math.min(minimum, point.triage4Minutes);
            maximum = Math.max(maximum, point.triage4Minutes);
        }
        int latest = points.get(points.size() - 1).triage4Minutes;
        summary.setText("Latest " + latest + " min   •   Low " + minimum + " min   •   High " + maximum
            + " min\n" + points.size() + " recorded reading" + (points.size() == 1 ? "" : "s")
            + " in the selected period. The dashed line marks the 60-minute ATS 4 target.");
    }
}
