#!/bin/bash
# Create OpenSpec proposals for all W3C WebCodecs spec sections
#
# Usage:
#   ./scripts/create-webcodecs-proposals.sh           # Interactive mode
#   ./scripts/create-webcodecs-proposals.sh --batch   # Non-interactive batch mode
#
# This script calls the Claude CLI with /openspec:proposal for each spec file
# in docs/specs/ to generate OpenSpec proposals for the W3C WebCodecs specification.

set -e

SPECS_DIR="docs/specs"
BATCH_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --batch|-b)
      BATCH_MODE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--batch|-b]"
      echo ""
      echo "Options:"
      echo "  --batch, -b    Run in non-interactive batch mode"
      echo "  --help, -h     Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Main spec sections (TOC files for hierarchical sections, direct files for flat ones)
SPEC_FILES=(
  "1-definitions.md"
  "2-codec-processing-model/TOC.md"
  "3-audiodecoder-interface/TOC.md"
  "4-videodecoder-interface/TOC.md"
  "5-audioencoder-interface/TOC.md"
  "6-videoencoder-interface/TOC.md"
  "7-configurations/TOC.md"
  "8-encoded-media-interfaces-chunks/TOC.md"
  "9-raw-media-interfaces/TOC.md"
  "10-image-decoding/TOC.md"
  "11-resource-reclamation.md"
  "12-security-considerations.md"
  "13-privacy-considerations.md"
  "14-best-practices-for-authors-using-webcodecs.md"
  "15-acknowledgements.md"
)

echo "Creating OpenSpec proposals for WebCodecs specs..."
echo "=================================================="
echo "Mode: $([ "$BATCH_MODE" = true ] && echo "batch (non-interactive)" || echo "interactive")"
echo "Specs directory: $SPECS_DIR"
echo "Total sections: ${#SPEC_FILES[@]}"
echo "=================================================="

PROCESSED=0
FAILED=0

for spec in "${SPEC_FILES[@]}"; do
  spec_path="${SPECS_DIR}/${spec}"

  if [[ -f "$spec_path" ]]; then
    echo ""
    echo "[$((PROCESSED + 1))/${#SPEC_FILES[@]}] Processing: $spec_path"
    echo "---"

    # Call Claude CLI with openspec:proposal skill
    if [ "$BATCH_MODE" = true ]; then
      # Non-interactive batch mode
      if claude --print --dangerously-skip-permissions "/openspec:proposal ${spec_path}"; then
        ((PROCESSED++))
        echo "--- Completed: $spec"
      else
        ((FAILED++))
        echo "--- FAILED: $spec"
      fi
    else
      # Interactive mode - no --print flag allows conversation
      if claude "/openspec:proposal ${spec_path}"; then
        ((PROCESSED++))
        echo "--- Completed: $spec"
      else
        ((FAILED++))
        echo "--- FAILED: $spec"
      fi
    fi
  else
    echo ""
    echo "WARNING: File not found: $spec_path"
    ((FAILED++))
  fi
done

echo ""
echo "=================================================="
echo "Summary:"
echo "  Processed: $PROCESSED"
echo "  Failed: $FAILED"
echo "=================================================="

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "Some proposals failed. Check the output above for details."
  exit 1
fi

echo ""
echo "All proposals created successfully!"
echo ""
echo "Next steps:"
echo "  1. Run 'openspec list' to see all proposals"
echo "  2. Run 'openspec validate <id> --strict' to validate each proposal"
echo "  3. Review proposals with 'openspec show <id>'"
