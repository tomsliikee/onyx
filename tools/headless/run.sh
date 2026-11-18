#!/usr/bin/env bash
# Runs Onyx in a GNOME Shell without a screen, with its own settings, and
# lets a script drive it and take screenshots. Adapted from Islands' rig.
#
#   tools/headless/run.sh <script> [seconds]
#
# <script> is a file in tools/headless/scripts, without ".js". Screenshots
# and the log go to $ONYX_OUT (default: a folder in the system's temp).
#
#   ONYX_SCHEME=light|dark   the desktop's colour scheme at start (default dark).
#   ONYX_WITH="<uuid>[=<path>] ..."  loads other extensions too (Blur my Shell).
#   ONYX_WALLPAPER=<uri>     a picture instead of the plain blue.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
export ONYX_OUT="${ONYX_OUT:-${TMPDIR:-/tmp}/onyx-headless}"
ENV="$ONYX_OUT/env"
EXTENSIONS="$ENV/data/gnome-shell/extensions"

glib-compile-schemas "$REPO/extension/schemas"
# Each run starts clean.
rm -rf "$ENV/config/dconf" "$ENV/cache" "$ENV/state"
mkdir -p "$EXTENSIONS" "$ENV/config" "$ENV/cache" "$ONYX_OUT/shots"
rm -f "$ONYX_OUT/shots/"*.png "$ONYX_OUT/log.txt"
ln -sfn "$REPO/extension" "$EXTENSIONS/onyx@thomashaiden"
ln -sfn "$HERE/driver" "$EXTENSIONS/onyx-driver@test"
EXTRA=""
for pair in ${ONYX_WITH:-}; do
    uuid="${pair%%=*}"
    path="${pair#*=}"
    if [ "$path" = "$pair" ]; then
        path="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid"
        [ -d "$path" ] || path="/usr/share/gnome-shell/extensions/$uuid"
    fi
    ln -sfn "$path" "$EXTENSIONS/$uuid"
    EXTRA+="\"$uuid\", "
done
ln -sfn "${XDG_DATA_HOME:-$HOME/.local/share}/fonts" "$ENV/data/fonts"

export ENABLED="[$EXTRA\"onyx@thomashaiden\", \"onyx-driver@test\"]"
export ONYX_WALLPAPER="${ONYX_WALLPAPER:-}"
export ONYX_SCHEME="${ONYX_SCHEME:-dark}"
export ONYX_SCRIPT="$HERE/scripts/$1.js"
export ONYX_SECONDS="${2:-60}"
export XDG_CONFIG_HOME="$ENV/config" XDG_CACHE_HOME="$ENV/cache" XDG_DATA_HOME="$ENV/data" XDG_STATE_HOME="$ENV/state"
export G_MESSAGES_DEBUG=Gjs-Console
unset WAYLAND_DISPLAY DISPLAY

exec dbus-run-session -- bash -c '
gsettings set org.gnome.shell enabled-extensions "$ENABLED"
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell welcome-dialog-last-shown-version "99"
gsettings set org.gnome.desktop.interface color-scheme "$( [ "$ONYX_SCHEME" = dark ] && echo prefer-dark || echo default )"
gsettings set org.gnome.desktop.interface enable-hot-corners false
gsettings set org.gnome.mutter dynamic-workspaces false
if [ -n "${ONYX_WALLPAPER:-}" ]; then
    gsettings set org.gnome.desktop.background picture-uri "$ONYX_WALLPAPER"
    gsettings set org.gnome.desktop.background picture-uri-dark "$ONYX_WALLPAPER"
    gsettings set org.gnome.desktop.background picture-options zoom
else
    gsettings set org.gnome.desktop.background picture-options none
    gsettings set org.gnome.desktop.background color-shading-type solid
    gsettings set org.gnome.desktop.background primary-color "#3a4a6b"
fi
timeout -k 10 "$ONYX_SECONDS" gnome-shell --headless --virtual-monitor 1280x800 --wayland-display onyx-test --no-x11 2>&1'
