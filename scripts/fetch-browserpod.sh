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

# cfworker2browser (https://github.com/flisk-sh/cfworker2browser): runs a Cloudflare Worker in the visitor's tab. Plain JS files, served
# next to the pod at /cfworker2browser/ so a page that loads the pod can load it too (same CSP and CORS).
cd ..
CBASE="https://raw.githubusercontent.com/flisk-sh/cfworker2browser/v0.1.0/src"
cget() { # name sha256
  mkdir -p cfworker2browser/src
  curl -fsSL --retry 3 -o "cfworker2browser/src/$1.part" "$CBASE/$1"
  echo "$2  cfworker2browser/src/$1.part" | shasum -a 256 -c - >/dev/null || { echo "checksum mismatch: $1" >&2; rm -f "cfworker2browser/src/$1.part"; exit 1; }
  mv "cfworker2browser/src/$1.part" "cfworker2browser/src/$1"
}
cget index.js 35539b458e6a5ebdbbd1bcc72878ff3fd1ebbdd5c32d5f0c83513f2ea6f5475f
cget config.js 6e2fd68d109ba4c753635931bc7285f3eec78202745bf584c26d6ae395e09e5a
cget runtime.js 2b4a0ac1732b156353770acaa337d3f1bb0b89f5f18b538e5d00adaa8373e674
cget stores.js 3900a4dbf6dbfc60dbb9fac51da98fb157faad98b76b515621eed6c5c92ed585
cget d1.js 1962fc515bde78011cc85038c4b4517ba612027ffc29e001b4c2dada1bf8a103
cget idb.js be7f65534c7314905b5008fd6f4f280c6c3c7e98bb66098f93be7ded3dee9ad2
cget worker-entry.js 85e7e8094fa3435feee256aee953e93b4eb325c19ca68dd77c3216f73c0d2bcf
