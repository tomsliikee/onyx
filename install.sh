#!/usr/bin/env bash
# Installs Onyx for the current user: compiles its settings schema, links
# the extension and enables it. Updating is a plain "git pull" and a new
# login (run this again if the schema changed).
#
#   ./install.sh            install
#   ./install.sh --remove   remove the link and disable Onyx
set -euo pipefail

UUID="onyx@thomashaiden"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
TARGET="$DATA/gnome-shell/extensions/$UUID"

# Removes one entry from a gsettings string list.
drop() {
    local list
    list="$(gsettings get org.gnome.shell "$1")"
    list="$(echo "$list" | sed -E "s/'$2'(, )?//; s/, \]/]/")"
    gsettings set org.gnome.shell "$1" "$list"
}

# Adds one entry to a gsettings string list.
add() {
    local list
    list="$(gsettings get org.gnome.shell "$1")"
    [[ "$list" == *"'$2'"* ]] && return
    if [[ "$list" == "@as []" || "$list" == "[]" ]]; then
        gsettings set org.gnome.shell "$1" "['$2']"
    else
        gsettings set org.gnome.shell "$1" "${list%]}, '$2']"
    fi
}

if [ "${1:-}" = "--remove" ]; then
    drop enabled-extensions "$UUID"
    [ -L "$TARGET" ] && rm "$TARGET"
    echo "Removed. Your settings stay in dconf under /org/gnome/shell/extensions/onyx/."
    exit 0
fi

shell="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -n 1 || true)"
if [ "$shell" != "50" ]; then
    echo "This is GNOME Shell ${shell:-of an unknown version}; Onyx names version 50 only and may not load." >&2
fi

if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
    echo "$TARGET exists and is not a link. Move it away first." >&2
    exit 1
fi

glib-compile-schemas "$REPO/extension/schemas"
mkdir -p "$(dirname "$TARGET")"
ln -sfn "$REPO/extension" "$TARGET"
echo "Linked $TARGET"

# Written to the setting directly: the running shell only learns about a new
# extension at the next login, and "gnome-extensions enable" fails until then.
add enabled-extensions "$UUID"
drop disabled-extensions "$UUID" 2>/dev/null || true
echo "Enabled. Log out and back in to see Onyx."
