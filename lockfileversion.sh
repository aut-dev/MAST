#!/bin/bash

#Stop scripts on any error :
set -e

PHP=php8.0
COMMIT="$1"
LOCKFILE="themes/front/package-lock.json"
LOCKFILEVERSION=""

if [[ "$COMMIT" != *"[skip npm]"* ]]; then
    if test -f "$LOCKFILE"; then
        LOCKFILEVERSION=$($PHP -r "\$json=json_decode(file_get_contents('$LOCKFILE'), true);echo \$json['lockfileVersion'] ?? '';")
        if [[ "$LOCKFILEVERSION" != "2" ]]; then
            echo "The lock file version must be 2, have you run npm with at least node 16 ?"
            exit 2;
        fi
    else
        echo "The file $LOCKFILE doesn't exist, run npm i locally before pushing"
        exit 3;
    fi
fi