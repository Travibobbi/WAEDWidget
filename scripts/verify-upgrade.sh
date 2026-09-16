#!/usr/bin/env bash
set -euo pipefail
adb install .upgrade-reference/v1.5.0.apk
adb install upgrade-probe/build/outputs/apk/release/upgrade-probe-release.apk
adb shell am instrument -w -e mode seed com.waed.upgradeprobe/com.waed.upgradeprobe.UpgradeProbe | tee .upgrade-reference/seed.log
grep -q 'UPGRADE_SEED_OK' .upgrade-reference/seed.log
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am instrument -w -e mode verify com.waed.upgradeprobe/com.waed.upgradeprobe.UpgradeProbe | tee .upgrade-reference/verify.log
grep -q 'UPGRADE_DATA_OK' .upgrade-reference/verify.log
