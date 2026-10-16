#!/bin/bash
# Builds Qalam's launcher icon, round icon, adaptive icon and splash screen from icons/q.png (the emblem «ق», green and gold):
# on black, as the emblem was drawn; 54% of the adaptive canvas, 70% of the legacy icon
set -e
R=android/app/src/main/res
ICON=icons/q.png
G1='#141414'; G2='#000000'
find $R -name 'ic_launcher*' -delete
for spec in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  IFS=: read d l f <<< "$spec"
  mkdir -p $R/mipmap-$d
  convert $ICON -trim +repage -resize $((f*54/100))x$((f*54/100)) -background none -gravity center -extent ${f}x${f} -depth 8 $R/mipmap-$d/ic_launcher_foreground.png
  convert -size ${l}x${l} gradient:"$G1-$G2" \( $ICON -trim +repage -resize $((l*70/100))x$((l*70/100)) \) -gravity center -composite -depth 8 $R/mipmap-$d/ic_launcher.png
  convert $R/mipmap-$d/ic_launcher.png -alpha set \( -size ${l}x${l} xc:none -fill white -draw "circle $((l/2)),$((l/2)) $((l/2)),0" \) -compose DstIn -composite -depth 8 PNG32:$R/mipmap-$d/ic_launcher_round.png
done
mkdir -p $R/mipmap-anydpi-v26 $R/values $R/drawable
# adaptive background: black
cat > $R/drawable/ic_launcher_bg.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient android:type="linear" android:angle="270" android:startColor="#141414" android:endColor="#000000"/>
</shape>
XML
cat > $R/mipmap-anydpi-v26/ic_launcher.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_bg"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XML
cp $R/mipmap-anydpi-v26/ic_launcher.xml $R/mipmap-anydpi-v26/ic_launcher_round.xml
cat > $R/values/ic_launcher_background.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#000000</color>
</resources>
XML
find $R -name 'splash.png' | while read -r f; do
  w=$(identify -format '%w' "$f"); h=$(identify -format '%h' "$f"); m=$(( w<h ? w : h ))
  convert -size ${w}x${h} xc:'#000000' \( icons/q.png -resize x$((m*30/100)) \) -gravity center -composite -depth 8 "$f"
done
# the in-app icon follows the launcher icon
if [ -d www/icons ]; then convert -size 192x192 gradient:"$G1-$G2" \( icons/q.png -trim +repage -resize 134x134 \) -gravity center -composite -depth 8 www/icons/icon-192.png; fi
