package com.waed.widget;

import android.text.Html;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class WaHealthClient {
    static final String URL_STRING = "https://www.health.wa.gov.au/Reports-and-publications/Emergency-Department-activity/Data?report=ed_activity_now";

    private static final LinkedHashMap<String,String> HOSPITALS = new LinkedHashMap<>();
    static {
        HOSPITALS.put("Armadale Hospital", "Armadale");
        HOSPITALS.put("Fiona Stanley Hospital", "Fiona Stanley");
        HOSPITALS.put("Joondalup Health Campus", "Joondalup");
        HOSPITALS.put("King Edward Memorial Hospital For Women", "King Edward");
        HOSPITALS.put("Peel Health Campus", "Peel");
        HOSPITALS.put("Perth Children's Hospital", "PCH");
        HOSPITALS.put("Rockingham General Hospital", "Rockingham");
        HOSPITALS.put("Royal Perth Hospital", "RPH");
        HOSPITALS.put("Sir Charles Gairdner Hospital", "SCGH");
        HOSPITALS.put("St John of God Midland Public Hospital", "Midland");
    }

    static EdData fetch() throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(URL_STRING).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(12000);
        conn.setRequestProperty("User-Agent", "WAEDWidget/1.0 Android; public WA Health ED activity viewer");
        conn.setRequestProperty("Accept", "text/html,application/xhtml+xml");

        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) throw new IllegalStateException("WA Health returned HTTP " + code);

        StringBuilder html = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) html.append(line).append('\n');
        } finally {
            conn.disconnect();
        }
        return parse(html.toString());
    }

    static EdData parse(String html) {
        String cleaned = html
            .replaceAll("(?is)<script[^>]*>.*?</script>", " ")
            .replaceAll("(?is)<style[^>]*>.*?</style>", " ")
            .replaceAll("(?i)<br\\s*/?>", " ")
            .replaceAll("(?i)</(td|th|tr|p|div|li|h1|h2|h3|h4)>", " ")
            .replaceAll("(?s)<[^>]+>", " ");
        String text = Html.fromHtml(cleaned, Html.FROM_HTML_MODE_LEGACY).toString()
            .replace('\u00A0', ' ')
            .replaceAll("\\s+", " ")
            .trim();

        String timestamp = "WA Health time unavailable";
        Matcher tm = Pattern.compile("Preview of Emergency Department \\(ED\\) figures at (.+?)(?: Hospital Triage| Hospital\\s+Triage| Armadale Hospital)", Pattern.CASE_INSENSITIVE).matcher(text);
        if (tm.find()) timestamp = tm.group(1).trim();

        List<EdData.Hospital> rows = new ArrayList<>();
        for (Map.Entry<String,String> e : HOSPITALS.entrySet()) {
            String name = e.getKey();
            int start = text.indexOf(name);
            if (start < 0) continue;
            String tail = text.substring(start + name.length(), Math.min(text.length(), start + name.length() + 110));
            Matcher nums = Pattern.compile("^\\s*(\\d{1,4})\\s+(\\d{1,4})\\s+(\\d{1,4})(?:\\s|$)").matcher(tail);
            if (nums.find()) {
                rows.add(new EdData.Hospital(name, e.getValue(),
                    Integer.parseInt(nums.group(1)), Integer.parseInt(nums.group(2)), Integer.parseInt(nums.group(3))));
            }
        }
        if (rows.size() < 8) throw new IllegalStateException("Could only parse " + rows.size() + " hospital rows");
        return new EdData(timestamp, rows);
    }
}
