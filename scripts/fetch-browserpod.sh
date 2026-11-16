#!/bin/sh
# The browser pod now lives in https://github.com/flisk-sh/linux2wasm. Fleet still serves it at /browserpod/ because other
# sites (chat.flisk.si) load it from here. This fetches a pinned release of pod.js and its downloader (checked against
# sha256), then the engine and Linux image (get.sh checks those). Nothing it fetches is in git. `wrangler deploy` runs it.
set -eu
mkdir -p "$(dirname "$0")/../web/browserpod"
cd "$(dirname "$0")/../web/browserpod"
TAG=v0.1.0
BASE="https://raw.githubusercontent.com/flisk-sh/linux2wasm/$TAG"
get() { # path-in-repo local-path sha256
  mkdir -p "$(dirname "$2")"
  curl -fsSL --retry 3 -o "$2.part" "$BASE/$1"
  echo "$3  $2.part" | shasum -a 256 -c - >/dev/null || { echo "checksum mismatch: $1" >&2; rm -f "$2.part"; exit 1; }
  mv "$2.part" "$2"
}
get pod.js pod.js 82c95cf4bc115077acd4388b04b6d2cd60f619c6490e47f87b952593aaec859c
get index.html index.html d14c62d7960a7721db91be249b233153f172c297bccdb05e224f93d087a6340f
get vendor/get.sh vendor/get.sh d21d1b6f769c38fac7db3ce0f75ba6b4172a530bf189b4c39b36c48b5b1d8bb9
sh vendor/get.sh
