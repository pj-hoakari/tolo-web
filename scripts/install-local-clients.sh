#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
modules="$root/node_modules/@pj-hoakari"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

install_client() {
  name=$1
  tarball=$2
  archive="$root/vendor/$tarball"
  if [ ! -f "$archive" ]; then
    echo "missing local client tarball: $archive" >&2
    exit 1
  fi
  rm -rf "$modules/$name"
  mkdir -p "$modules"
  tar -xzf "$archive" -C "$tmp"
  mv "$tmp/package" "$modules/$name"
}

install_client \
  tolo-observation-client-es \
  pj-hoakari-tolo-observation-client-es-0.1.0.tgz
install_client \
  tolo-edge-bridge-client-es \
  pj-hoakari-tolo-edge-bridge-client-es-0.1.0.tgz
