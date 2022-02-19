#!/bin/bash

case "$OSTYPE" in
  darwin*)  echo "bootstrap on OSX" && ./cli/osx/cli -f ./bootstrap-commands.txt;; 
  linux*)   echo "bootstrap on LINUX" && ./cli/linux.x64/cli -f ./bootstrap-commands.txt;;
  msys*)    echo "bootstrap on WINDOWS" && ./cli/win/cli.exe -f ./bootstrap-commands.txt;;
  *)        echo "unknown: $OSTYPE" ;;
esac