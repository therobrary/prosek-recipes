#!/usr/bin/env bash
set -euo pipefail

OPENCODE_BIN=${OPENCODE_BIN:-$HOME/.hermes/node/bin/opencode}
MODE=${1:-}

if [[ "$MODE" == "--help" || "$MODE" == "-h" ]]; then
  printf '%s\n' "Usage: scripts/opencode_review_loop.sh [--review-only | --smoke-test]"
  printf '%s\n' ""
  printf '%s\n' "Runs the real read-only OpenCode review subagent by asking the primary"
  printf '%s\n' "build agent to invoke it through the task tool."
  printf '%s\n' ""
  printf '%s\n' "Options:"
  printf '%s\n' "  --review-only   Run only the review step and print findings."
  printf '%s\n' "  --smoke-test    Verify subagent invocation with a fast no-op check."
  exit 0
fi

if [[ ! -x "$OPENCODE_BIN" ]]; then
  printf '%s\n' "OpenCode binary not found at $OPENCODE_BIN" >&2
  exit 1
fi

read -r -d '' REVIEW_PROMPT <<'EOF' || true
Review the current working tree changes through the read-only `review` subagent.
Do not perform the review yourself.
First inspect the diff and touched files as the build agent. Then invoke the `review` subagent via the task tool and pass that diff/file context into the task.
Explicitly tell the `review` subagent not to run bash commands and to review only from the context you provide, since its bash permission is `ask`.
Return only the review subagent's final findings, preserving its configured output format exactly.
EOF

if [[ "$MODE" == "--smoke-test" ]]; then
  REVIEW_PROMPT="Use the review subagent to answer this. Have it reply with exactly REVIEW_SUBAGENT_OK, then return only that exact string."
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
REVIEW_OUT="$TMP_DIR/review.txt"

printf '%s\n' "Running review subagent..." >&2
"$OPENCODE_BIN" run \
  --agent build \
  --title "Review loop: subagent review" \
  "$REVIEW_PROMPT" | tee "$REVIEW_OUT"

if [[ "$MODE" == "--review-only" || "$MODE" == "--smoke-test" ]]; then
  exit 0
fi

if grep -Eq '^Approved$' "$REVIEW_OUT"; then
  printf '%s\n' "Review approved; no fixes required." >&2
  exit 0
fi

REVIEW_TEXT=$(python3 -c 'import json, pathlib, sys; print(json.dumps(pathlib.Path(sys.argv[1]).read_text()))' "$REVIEW_OUT")
FIX_PROMPT=$(python3 -c 'import json, sys; review_text=json.loads(sys.argv[1]); print("Apply only the fixes required by this review report. Do not make unrelated changes. After fixing, run the appropriate verification for the touched frontend files and summarize what you changed.\n\nReview report:\n" + review_text)' "$REVIEW_TEXT")

printf '%s\n' "" >&2
printf '%s\n' "Running build fix pass..." >&2
"$OPENCODE_BIN" run \
  --agent build \
  --title "Review loop: build fixes" \
  "$FIX_PROMPT"
