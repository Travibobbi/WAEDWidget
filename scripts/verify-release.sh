#!/usr/bin/env bash
set -euo pipefail
mkdir -p .upgrade-reference
curl -fL --retry 3 https://github.com/Travibobbi/WAEDWidget/releases/download/v1.5.0/WAEDWidget-v1.5.0.apk -o .upgrade-reference/v1.5.0.apk
echo 'a31085dfae8d9affb76686e8f02a108265015d9a0e590b002d049f942d0c73e7  .upgrade-reference/v1.5.0.apk' | sha256sum -c -
bt="$ANDROID_HOME/build-tools/35.0.0"
old_cert=$("$bt/apksigner" verify --print-certs .upgrade-reference/v1.5.0.apk | sed -n 's/Signer #1 certificate SHA-256 digest: //p')
new_cert=$("$bt/apksigner" verify --print-certs app/build/outputs/apk/release/app-release.apk | sed -n 's/Signer #1 certificate SHA-256 digest: //p')
test "$old_cert" = 'ed9a99fe42e0e088a12c595abcb0a8b0d700076b6471dbb0c16c33bee6d58f1c'
test "$old_cert" = "$new_cert"
"$bt/aapt" dump badging app/build/outputs/apk/release/app-release.apk > .upgrade-reference/badging.txt
python3 - <<'PY'
import re
s=open('.upgrade-reference/badging.txt').read()
assert re.search(r"package: name='com\.waed\.widget' ",s), 'Production app ID mismatch'
assert int(re.search(r"versionCode='(\d+)'",s)[1])>8, 'Not newer than version 1.5'
PY
git diff --exit-code v1.5.0 -- app/src/main/java/com/waed/widget/EdHistoryStore.java app/src/main/java/com/waed/widget/EdWidgetProvider.java app/src/main/res/layout/widget_ed.xml app/src/main/res/xml/backup_rules.xml app/src/main/res/xml/data_extraction_rules.xml app/stable-resource-ids.txt
echo 'Production signing certificate, application ID and unchanged history storage verified.'
