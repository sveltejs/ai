#!/usr/bin/env bash

# Read the Bun version from .bunversion file
if [ -f ".bunversion" ]; then
  BUN_VERSION=$(cat .bunversion | tr -d '[:space:]')
  echo "Installing Bun version: $BUN_VERSION"
  curl -fsSL https://bun.com/install | bash -s "$BUN_VERSION"
else
  echo "Error: .bunversion file not found"
  exit 1
fi
