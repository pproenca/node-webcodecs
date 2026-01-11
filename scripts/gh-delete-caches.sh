#!/usr/bin/env bash
#
# Bulk delete all GitHub Actions caches from a repository.
# Usage: ./gh-delete-caches.sh [--dry-run] [--repo owner/repo]
#

set -euo pipefail

#######################################
# Constants
#######################################
readonly DEFAULT_REPO="pproenca/node-webcodecs"
readonly PER_PAGE=100

#######################################
# Globals (modified by argument parsing)
#######################################
REPO="${DEFAULT_REPO}"
DRY_RUN=false

#######################################
# Print error message to stderr.
# Arguments:
#   Error message
#######################################
err() {
  echo "Error: $*" >&2
}

#######################################
# Print usage information.
#######################################
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Delete all GitHub Actions caches from a repository.

Options:
  --dry-run       Show what would be deleted without actually deleting
  --repo REPO     Repository in owner/repo format (default: ${DEFAULT_REPO})
  -h, --help      Show this help message

Examples:
  $(basename "$0")                    # Delete all caches
  $(basename "$0") --dry-run          # Preview deletions
  $(basename "$0") --repo user/repo   # Use different repository
EOF
}

#######################################
# Parse command line arguments.
# Globals:
#   REPO
#   DRY_RUN
# Arguments:
#   Command line arguments
#######################################
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --repo)
        REPO="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        err "Unknown option: $1"
        usage >&2
        exit 1
        ;;
    esac
  done
}

#######################################
# Check that required tools are available.
#######################################
check_dependencies() {
  if ! command -v gh &>/dev/null; then
    err "gh CLI is not installed. Install it from https://cli.github.com/"
    exit 1
  fi

  if ! gh auth status &>/dev/null; then
    err "Not authenticated with gh CLI. Run 'gh auth login' first."
    exit 1
  fi
}

#######################################
# Fetch all cache IDs from the repository.
# Globals:
#   REPO
#   PER_PAGE
# Outputs:
#   Cache IDs, one per line
#######################################
fetch_cache_ids() {
  local page=1
  local response
  local ids
  local count

  while true; do
    response=$(gh api "repos/${REPO}/actions/caches?per_page=${PER_PAGE}&page=${page}" 2>/dev/null) \
      || response='{"actions_caches":[]}'

    ids=$(echo "${response}" | jq -r '.actions_caches[].id // empty' 2>/dev/null)

    if [[ -z "${ids}" ]]; then
      break
    fi

    echo "${ids}"

    count=$(echo "${response}" | jq '.actions_caches | length')
    if [[ "${count}" -lt "${PER_PAGE}" ]]; then
      break
    fi

    page=$((page + 1))
  done
}

#######################################
# Delete caches and report results.
# Globals:
#   REPO
# Arguments:
#   Cache IDs array (passed by name)
#######################################
delete_caches() {
  local -n ids_ref=$1
  local deleted=0
  local failed=0
  local id

  for id in "${ids_ref[@]}"; do
    echo -n "Deleting cache ${id}... "
    if gh api -X DELETE "repos/${REPO}/actions/caches/${id}" &>/dev/null; then
      echo "done"
      deleted=$((deleted + 1))
    else
      echo "FAILED"
      failed=$((failed + 1))
    fi
  done

  echo ""
  echo "Summary:"
  echo "  Deleted: ${deleted}"
  echo "  Failed:  ${failed}"
  echo "  Total:   ${#ids_ref[@]}"
}

#######################################
# Main entry point.
#######################################
main() {
  parse_args "$@"
  check_dependencies

  echo "Fetching caches from ${REPO}..."

  local -a cache_ids=()
  local id

  while IFS= read -r id; do
    [[ -n "${id}" ]] && cache_ids+=("${id}")
  done < <(fetch_cache_ids)

  local total=${#cache_ids[@]}

  if [[ "${total}" -eq 0 ]]; then
    echo "No caches found in ${REPO}"
    exit 0
  fi

  echo "Found ${total} cache(s)"

  if [[ "${DRY_RUN}" == true ]]; then
    echo "[DRY RUN] Would delete ${total} cache(s):"
    for id in "${cache_ids[@]}"; do
      echo "  - Cache ID: ${id}"
    done
    exit 0
  fi

  local confirm
  read -r -p "Delete ${total} cache(s) from ${REPO}? [y/N] " confirm
  if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi

  delete_caches cache_ids
}

main "$@"
