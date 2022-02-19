#!/bin/bash

set -e
set -x

mkdir -p /koinos/block_producer
pushd /koinos/block_producer
echo "5JY6DFyroXn3wthivhwXgpspAWbBoRrD49paoP6zWhDRAPcSSi4" > private.key
popd

mkdir -p /koinos/chain
rsync -a -v --ignore-existing /koinos-config/genesis_data.json /koinos/chain/genesis_data.json

mkdir -p /koinos/jsonrpc/descriptors
pushd /koinos/jsonrpc/descriptors

wget https://github.com/koinos/koinos-proto-descriptors/raw/$DESCRIPTORS_TAG/koinos_descriptors.pb

popd

rsync -a -v --ignore-existing /koinos-config/default-config.yml /koinos/config.yml
