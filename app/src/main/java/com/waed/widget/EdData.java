package com.waed.widget;

import java.util.List;

final class EdData {
    final String sourceTimestamp;
    final List<Hospital> hospitals;

    EdData(String sourceTimestamp, List<Hospital> hospitals) {
        this.sourceTimestamp = sourceTimestamp;
        this.hospitals = hospitals;
    }

    static final class Hospital {
        final String fullName;
        final String shortName;
        final int triage4Minutes;
        final int waiting;
        final int total;

        Hospital(String fullName, String shortName, int triage4Minutes, int waiting, int total) {
            this.fullName = fullName;
            this.shortName = shortName;
            this.triage4Minutes = triage4Minutes;
            this.waiting = waiting;
            this.total = total;
        }
    }
}
