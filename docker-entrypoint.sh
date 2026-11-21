#!/bin/sh
set -e

# `migrate`, never `push`: push diffs against the live database and stops on a
# confirmation prompt for destructive changes, which a container can't answer
# (it then exits 0 having applied nothing). migrate runs the committed SQL in
# drizzle/ and exits non-zero on failure, so `set -e` keeps a broken schema
# from serving traffic.
bun --bun drizzle-kit migrate

exec bun .output/server/index.mjs
