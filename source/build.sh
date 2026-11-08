#!/bin/sh
# Rebuilds public/app.js from the source files. Needs Node.js. Only the owner of the code needs this;
# deploying the site needs only what is already in the repo (public/ and worker/).
#   npm install      (once, in this folder)
#   sh build.sh
set -e
cd "$(dirname "$0")"
ESB=./node_modules/.bin/esbuild
$ESB entry.js --bundle --minify --format=iife --target=es2020 --legal-comments=none --outfile=../public/app.js
