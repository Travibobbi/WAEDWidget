package com.waed.widget;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.Toast;

import java.util.List;

public class MainActivity extends Activity {
    static final String SOURCE_URL = "https://www.health.wa.gov.au/Reports-and-publications/Emergency-Department-activity/Data?report=ed_activity_now";
    static final String ACEM_TRIAGE_URL = "https://acem.org.au/Content-Sources/Advancing-Emergency-Medicine/Better-Outcomes-for-Patients/Triage";
    static final String EXTRA_SHOW_WAIT_INFO = "show_wait_info";
    static final String USER_PREFS = "user_settings";
    static final String PREF_PREFERRED_HOSPITAL = "preferred_hospital";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        Button add = findViewById(R.id.add_widget);
        add.setOnClickListener(v -> {
            AppWidgetManager manager = AppWidgetManager.getInstance(this);
            ComponentName provider = new ComponentName(this, EdWidgetProvider.class);
            if (manager.isRequestPinAppWidgetSupported()) {
                manager.requestPinAppWidget(provider, null, null);
            } else {
                Toast.makeText(this, "Long-press the home screen → Widgets → WA ED Widget", Toast.LENGTH_LONG).show();
            }
        });

        setupPreferredHospital();

        findViewById(R.id.open_source).setOnClickListener(v ->
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(SOURCE_URL))));

        findViewById(R.id.wait_colour_info).setOnClickListener(v -> showWaitColourInfo());
        findViewById(R.id.open_history).setOnClickListener(v ->
            startActivity(new Intent(this, HistoryActivity.class)));
        findViewById(R.id.open_analysis).setOnClickListener(v ->
            startActivity(new Intent(this, AnalysisActivity.class)));

        if (getIntent().getBooleanExtra(EXTRA_SHOW_WAIT_INFO, false)) {
            showWaitColourInfo();
        }
    }

    private void setupPreferredHospital() {
        Spinner spinner = findViewById(R.id.preferred_hospital);
        List<EdHistoryStore.HospitalOption> hospitals;
        try (EdHistoryStore store = new EdHistoryStore(this)) {
            hospitals = store.loadHospitals();
        }

        if (hospitals.isEmpty()) {
            ArrayAdapter<String> emptyAdapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item,
                new String[]{"No recorded hospitals yet"});
            spinner.setAdapter(emptyAdapter);
            spinner.setEnabled(false);
            return;
        }

        ArrayAdapter<EdHistoryStore.HospitalOption> adapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, hospitals);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter);

        SharedPreferences preferences = getSharedPreferences(USER_PREFS, MODE_PRIVATE);
        String preferred = preferences.getString(PREF_PREFERRED_HOSPITAL, null);
        int preferredPosition = 0;
        for (int i = 0; i < hospitals.size(); i++) {
            if (hospitals.get(i).fullName.equals(preferred)) {
                preferredPosition = i;
                break;
            }
        }
        spinner.setSelection(preferredPosition, false);
        if (preferred == null) {
            preferences.edit().putString(PREF_PREFERRED_HOSPITAL,
                hospitals.get(preferredPosition).fullName).apply();
        }

        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                preferences.edit().putString(PREF_PREFERRED_HOSPITAL,
                    hospitals.get(position).fullName).apply();
            }

            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });
    }

    private void showWaitColourInfo() {
        new AlertDialog.Builder(this)
            .setTitle("Triage Category 4 wait indicator")
            .setMessage("The large dot beside each T4 wait is based on WA Health's published average for Triage Category 4 (ATS 4). ACEM's maximum target for ATS 4 assessment and treatment is 60 minutes.\n\n" +
                "Green — 0–30 min, within target\n" +
                "Amber — 31–60 min, near target\n" +
                "Red — 61–120 min, over target\n" +
                "Dark red — over 120 min, well over target\n" +
                "Grey — unavailable or cached after a failed refresh\n\n" +
                "Patients are seen according to clinical urgency. The published average is indicative, not a guaranteed personal waiting time.")
            .setNeutralButton("ACEM source", (dialog, which) ->
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(ACEM_TRIAGE_URL))))
            .setPositiveButton("Close", null)
            .show();
    }
}
