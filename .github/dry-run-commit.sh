#!/usr/bin/env bash
# Dry run only (.github/workflows/dry-run.yml): does with the output folders from scripts/pull-request.mjs
# (step output `paths`) what peter-evans/create-pull-request does with add-paths: git add, then commit on the
# pull request branch. Nothing is pushed. Fails when there is no folder or nothing to commit.
# Usage: .github/dry-run-commit.sh <body-file>
set -euo pipefail

# the latest `paths` output of this step (written by scripts/pull-request.mjs)
paths=$(awk '/^paths<<PAVLA_OUTPUT_END$/ {buf=""; on=1; next} /^PAVLA_OUTPUT_END$/ {on=0; next} on {buf=buf $0 "\n"} END {printf "%s", buf}' "$GITHUB_OUTPUT")
if [ -z "$paths" ]; then echo "::error::No output folders for the pull request."; exit 1; fi
readarray -t folders <<< "${paths%$'\n'}"
echo "git add -- ${folders[*]}"

git switch -q dry-run/obsah 2>/dev/null || git switch -q -c dry-run/obsah
git add -- "${folders[@]}"
git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -q -m "Content update from the test data (dry run)"
git show --stat --format='%s' HEAD | tail -n 1
{
  echo "## Pull request (neodeslán)"
  echo
  cat "$1"
} >> "$GITHUB_STEP_SUMMARY"
