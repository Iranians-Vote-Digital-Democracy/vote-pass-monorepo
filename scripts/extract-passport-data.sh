#!/usr/bin/env bash
#
# extract-passport-data.sh
#
# Extracts passport/proof data exported by PassportDataExporter from Android logcat.
# Data is logged with tag PASSPORT_EXPORT, wrapped in start/end markers.
#
# Usage:
#   ./scripts/extract-passport-data.sh          # Extract latest export
#   ./scripts/extract-passport-data.sh --clear   # Clear logcat after extraction
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/extracted_data"

CLEAR_AFTER=false
if [[ "${1:-}" == "--clear" ]]; then
    CLEAR_AFTER=true
fi

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Capture logcat for our tag
RAW=$(adb logcat -d -s PASSPORT_EXPORT:I 2>/dev/null || true)

if [[ -z "$RAW" ]]; then
    echo "No PASSPORT_EXPORT data found in logcat."
    echo "Make sure you've tapped 'Export Test Data' in the app or submitted a vote."
    exit 1
fi

# Extract all blocks between start/end markers
# Each block is a separate export (passport_data or proof_data)
BLOCK=""
IN_BLOCK=false
BLOCK_COUNT=0

while IFS= read -r line; do
    # Strip logcat prefix — everything up to and including the tag colon
    content="${line##*PASSPORT_EXPORT: }"

    if [[ "$content" == *"--- PASSPORT_EXPORT_START ---"* ]]; then
        IN_BLOCK=true
        BLOCK=""
        continue
    fi

    if [[ "$content" == *"--- PASSPORT_EXPORT_END ---"* ]]; then
        IN_BLOCK=false
        if [[ -n "$BLOCK" ]]; then
            BLOCK_COUNT=$((BLOCK_COUNT + 1))

            # Detect type from JSON
            TYPE="unknown"
            if echo "$BLOCK" | grep -q '"type":"passport_data"'; then
                TYPE="passport-data"
            elif echo "$BLOCK" | grep -q '"type":"proof_data"'; then
                TYPE="proof-data"
            fi

            TIMESTAMP=$(date +%Y%m%d-%H%M%S)
            FILENAME="${TYPE}-${TIMESTAMP}-${BLOCK_COUNT}.json"
            FILEPATH="$OUTPUT_DIR/$FILENAME"

            # Pretty-print if python3 is available, otherwise save raw
            if command -v python3 &>/dev/null; then
                echo "$BLOCK" | python3 -m json.tool > "$FILEPATH" 2>/dev/null || echo "$BLOCK" > "$FILEPATH"
            else
                echo "$BLOCK" > "$FILEPATH"
            fi

            echo "Saved: $FILEPATH"
        fi
        continue
    fi

    if $IN_BLOCK; then
        BLOCK="${BLOCK}${content}"
    fi
done <<< "$RAW"

if [[ $BLOCK_COUNT -eq 0 ]]; then
    echo "Found PASSPORT_EXPORT log entries but no complete start/end blocks."
    echo "The export may have been interrupted. Try exporting again from the app."
    exit 1
fi

echo ""
echo "Extracted $BLOCK_COUNT export(s) to $OUTPUT_DIR/"

if $CLEAR_AFTER; then
    adb logcat -c
    echo "Logcat buffer cleared."
fi
