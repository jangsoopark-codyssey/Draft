#!/bin/bash

project_root="$(dirname ${PWD})"

pushd ${project_root} > /dev/null

python3 -m http.server 8000

popd > /dev/null