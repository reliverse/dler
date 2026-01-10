#!/usr/bin/env bash

# Removes common build artifacts and deps

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Start timing
if date +%s.%3N >/dev/null 2>&1; then
    start_time=$(date +%s.%3N)
    TIME_PRECISION="ms"
else
    start_time=$(date +%s)
    TIME_PRECISION="s"
fi

# Function to format elapsed time
format_elapsed_time() {
    if [ "$TIME_PRECISION" = "ms" ]; then
        local end_time=$(date +%s.%3N)
    else
        local end_time=$(date +%s)
    fi
    local elapsed=$(echo "$end_time - $start_time" | LC_ALL=C bc)

    awk -v elapsed="$elapsed" '
    BEGIN {
        if (elapsed < 1) {
            if (elapsed > 0.001) {
                ms = int(elapsed * 1000)
                printf "%dms", ms
            } else {
                printf "%.1fms", elapsed * 1000
            }
        } else if (elapsed < 60) {
            printf "%.2fs", elapsed
        } else {
            minutes = int(elapsed / 60)
            remaining = elapsed - (minutes * 60)
            printf "%dm %.2fs", minutes, remaining
        }
    }'
}

# Parse arguments
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run|-d)
            DRY_RUN=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Remove common build artifacts and dependencies with timing information."
            echo ""
            echo "Options:"
            echo "  -d, --dry-run    Show what would be removed without actually removing"
            echo "  -v, --verbose    Show detailed output"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 2
            ;;
    esac
done

if $DRY_RUN; then
    echo -e "${YELLOW}🧹 Dry run mode - showing what would be cleaned...${NC}"
else
    echo -e "${BLUE}🧹 Cleaning up codebase...${NC}"
fi

# Build find patterns for directories and files
DIR_PATTERNS=""
for dir in node_modules dist .output .source .tanstack .cache .turbo .next .nitro .expo android ios target; do
    DIR_PATTERNS="${DIR_PATTERNS} -name ${dir} -o"
done
DIR_PATTERNS="${DIR_PATTERNS% -o}" # Remove trailing -o

FILE_PATTERNS=""
for file in bun.lock; do
    FILE_PATTERNS="${FILE_PATTERNS} -name ${file} -o"
done
FILE_PATTERNS="${FILE_PATTERNS% -o}" # Remove trailing -o

removed_count=0
error_count=0

# Remove directories
if [ -n "$DIR_PATTERNS" ]; then
    while IFS= read -r -d '' dir; do
        if [ -d "$dir" ] && [[ "$dir" != *"/.bun/"* ]]; then
            if $VERBOSE || $DRY_RUN; then
                echo -e "${YELLOW}🗑️  Would remove directory: $dir${NC}"
            fi
            if ! $DRY_RUN; then
                if rm -rf "$dir" 2>/dev/null; then
                    ((removed_count++))
                    if $VERBOSE; then
                        echo -e "${GREEN}✅ Removed directory: $dir${NC}"
                    fi
                else
                    ((error_count++))
                    echo -e "${RED}❌ Failed to remove directory: $dir${NC}" >&2
                fi
            else
                ((removed_count++))
            fi
        fi
    done < <(find . -type d \( $DIR_PATTERNS \) -print0 2>/dev/null)
fi

# Remove files
if [ -n "$FILE_PATTERNS" ]; then
    while IFS= read -r -d '' file; do
        if [ -f "$file" ]; then
            if $VERBOSE || $DRY_RUN; then
                echo -e "${YELLOW}🗑️  Would remove file: $file${NC}"
            fi
            if ! $DRY_RUN; then
                if rm -f "$file" 2>/dev/null; then
                    ((removed_count++))
                    if $VERBOSE; then
                        echo -e "${GREEN}✅ Removed file: $file${NC}"
                    fi
                else
                    ((error_count++))
                    echo -e "${RED}❌ Failed to remove file: $file${NC}" >&2
                fi
            else
                ((removed_count++))
            fi
        fi
    done < <(find . -type f \( $FILE_PATTERNS \) -print0 2>/dev/null)
fi

elapsed_time=$(format_elapsed_time)

if $DRY_RUN; then
    echo -e "${BLUE}✨ Dry run complete! Would remove $removed_count items in ${elapsed_time}.${NC}"
    exit 0
elif [ $removed_count -gt 0 ]; then
    if [ $error_count -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Cleanup partially complete! Removed $removed_count items, $error_count errors in ${elapsed_time}.${NC}"
        exit 1
    else
        echo -e "${GREEN}✨ Cleanup complete! Removed $removed_count items in ${elapsed_time}.${NC}"
        exit 0
    fi
else
    echo -e "${BLUE}✨ Nothing to cleanup! (${elapsed_time})${NC}"
    exit 0
fi
