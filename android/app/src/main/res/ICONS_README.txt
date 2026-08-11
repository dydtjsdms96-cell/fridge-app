Adaptive launcher icons (ic_launcher)
=====================================

Current setup uses a green background (#2E5B4C) + vector foreground placeholder:
  - values/colors.xml → ic_launcher_background / splash_background
  - drawable/ic_launcher_foreground_placeholder.xml
  - mipmap-anydpi-v26/ic_launcher.xml
  - mipmap-anydpi-v26/ic_launcher_round.xml

To replace with your final artwork later:
  1. Add density PNGs (or WebP):
       mipmap-mdpi/ic_launcher_foreground.png     (108x108)
       mipmap-hdpi/ic_launcher_foreground.png     (162x162)
       mipmap-xhdpi/ic_launcher_foreground.png    (216x216)
       mipmap-xxhdpi/ic_launcher_foreground.png   (324x324)
       mipmap-xxxhdpi/ic_launcher_foreground.png  (432x432)
     Keep important content inside the ~66dp safe zone.
  2. Point adaptive XML foreground to @mipmap/ic_launcher_foreground
     (or keep using a single vector in drawable/).
  3. Optional legacy fallbacks: mipmap-*/ic_launcher.png + ic_launcher_round.png

Splash:
  - drawable/splash.xml (layer-list) + drawable/splash_logo.xml (vector)
  - Brand color #2E5B4C via @color/splash_background
  - Do NOT add splash.png — same resource name conflicts with splash.xml
