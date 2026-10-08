#!/usr/bin/env bash
# The issue of a failing workflow (deploy.yml, check.yml): a failed run opens an issue assigned to the repository
# owner, or comments on the open one with the same title, so he gets an e-mail whoever started the run; a passing
# run closes it. This repository is public: the body is only what the workflow passes (a link to the run, the commit).
# Needs GH_TOKEN with "issues: write" and GH_REPO.
# Usage: .github/failure-issue.sh <title> <failed: true|false> <body>
set -euo pipefail

title=$1
failed=$2
body=$3
run_url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"

# open issues with exactly this title (the search alone also matches similar titles)
open=$(ISSUE_TITLE="$title" gh issue list --state open --search "in:title \"$title\"" --json number,title \
  --jq '.[] | select(.title == env.ISSUE_TITLE) | .number')

if [ "$failed" = "true" ]; then
  first=$(head -n 1 <<< "$open")
  if [ -n "$first" ]; then
    gh issue comment "$first" --body "$body"
  else
    gh issue create --title "$title" --body "$body" --assignee "$GITHUB_REPOSITORY_OWNER"
  fi
else
  for n in $open; do gh issue close "$n" --comment "Další běh prošel: $run_url"; done
fi
