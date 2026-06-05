#!/bin/sh
cd "$(dirname "$0")" || exit 1
if [ ! -d client-data ]; then
  echo "client-data folder was not found."
  exit 1
fi
mkdir -p client-data/backups
stamp=$(date +"%Y%m%d-%H%M%S")
zip -r "client-data/backups/client-data-$stamp.zip" client-data/company client-data/exports client-data/pdfs client-data/prices client-data/projects client-data/templates
