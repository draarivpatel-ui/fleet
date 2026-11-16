#!/bin/sh
# Fetches the browser pod (flisk-sh/linux2wasm, pinned release) into web/browserpod/, then its engine and Linux image.
# Nothing here is in git: `wrangler deploy` runs it (wrangler.toml [build]).
set -eu
cd "$(dirname "$0")/.."
TAG=v0.1.0
rm -rf web/browserpod && mkdir -p web/browserpod
curl -fsSL --retry 3 "https://github.com/flisk-sh/linux2wasm/archive/refs/tags/$TAG.tar.gz" | tar -xz -C web/browserpod --strip-components=1
sh web/browserpod/vendor/get.sh
