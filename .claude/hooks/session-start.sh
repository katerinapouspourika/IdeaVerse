#!/bin/bash
# Prepares Claude Code cloud sessions to build and test the solution.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# The .NET install script host is blocked in cloud sessions; Ubuntu's archive carries the SDK.
if ! command -v dotnet >/dev/null 2>&1 || ! dotnet --list-sdks | grep -q '^10\.'; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq dotnet-sdk-10.0
fi

# GitVersion cannot compute versions from a shallow clone.
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  git fetch --unshallow --quiet origin || true
fi

echo 'export DOTNET_CLI_TELEMETRY_OPTOUT=1' >> "$CLAUDE_ENV_FILE"
echo 'export DOTNET_NOLOGO=1' >> "$CLAUDE_ENV_FILE"

solution=$(find . -maxdepth 1 -name '*.slnx' | head -n 1)
if [ -n "$solution" ]; then
  dotnet restore "$solution" --verbosity quiet
fi
