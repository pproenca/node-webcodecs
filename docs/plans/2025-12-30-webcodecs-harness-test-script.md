# WebCodecs Harness Test Script Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-webcodecs-harness-test-script.md` to implement task-by-task.

**Goal:** Create an interactive bash script that can be run via `curl | bash` to validate node-webcodecs against the webcodecs-harness test suite, with pretty terminal output, JSON results, and optional Docker support.

**Architecture:** Single self-contained bash script (`scripts/test-harness.sh`) that:
1. Detects environment (local repo vs fresh clone, macOS vs Linux)
2. Installs dependencies (FFmpeg, Node.js if missing)
3. Clones and sets up webcodecs-harness in /tmp
4. Patches the polyfill to use node-webcodecs
5. Runs tests and produces colored terminal output + JSON report
6. Supports Docker execution via optional Dockerfile

**Tech Stack:** Bash (POSIX-compatible), Node.js 18+, npm, Vitest (from harness), Docker (optional)

---

## Task Group 1: Core Script Infrastructure (Parallel)

### Task 1: Create main script skeleton with argument parsing

**Files:**
- Create: `scripts/test-harness.sh`

**Step 1: Write the failing test** (2-5 min)

Create a simple test that verifies the script exists and is executable:

```bash
# test/scripts/test-harness.test.sh (manual verification script)
#!/bin/bash
set -e

# Test 1: Script exists
if [[ ! -f "scripts/test-harness.sh" ]]; then
  echo "FAIL: scripts/test-harness.sh does not exist"
  exit 1
fi

# Test 2: Script is executable
if [[ ! -x "scripts/test-harness.sh" ]]; then
  echo "FAIL: scripts/test-harness.sh is not executable"
  exit 1
fi

# Test 3: Script shows help with --help
if ! scripts/test-harness.sh --help 2>&1 | grep -q "Usage:"; then
  echo "FAIL: --help does not show usage"
  exit 1
fi

# Test 4: Script shows version with --version
if ! scripts/test-harness.sh --version 2>&1 | grep -q "test-harness"; then
  echo "FAIL: --version does not show version"
  exit 1
fi

echo "PASS: All skeleton tests passed"
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
chmod +x test/scripts/test-harness.test.sh && ./test/scripts/test-harness.test.sh
```

Expected: FAIL with `scripts/test-harness.sh does not exist`

**Step 3: Write minimal implementation** (2-5 min)

```bash
#!/bin/bash
#
# test-harness.sh - WebCodecs Harness Test Runner
#
# Run node-webcodecs against vjeux/webcodecs-harness test suite.
# Validates W3C WebCodecs API compliance.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/user/node-webcodecs/master/scripts/test-harness.sh | bash
#   ./scripts/test-harness.sh [options]
#
# Options:
#   --local          Use local node-webcodecs build instead of cloning
#   --docker         Run tests in Docker container (requires Docker)
#   --json-only      Output only JSON (no terminal colors)
#   --keep           Don't clean up temp directory after run
#   --help           Show this help message
#   --version        Show version

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
VERSION="1.0.0"
SCRIPT_NAME="test-harness"
HARNESS_REPO="https://github.com/vjeux/webcodecs-harness.git"
WEBCODECS_REPO="https://github.com/user/node-webcodecs.git"  # TODO: Update URL
WORK_DIR="/tmp/webcodecs-harness-test"
RESULTS_FILE="$WORK_DIR/results.json"

# ─────────────────────────────────────────────────────────────────────────────
# Colors (disabled if not a terminal or --json-only)
# ─────────────────────────────────────────────────────────────────────────────
if [[ -t 1 ]] && [[ "${JSON_ONLY:-}" != "true" ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  DIM='\033[2m'
  NC='\033[0m' # No Color
else
  RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' DIM='' NC=''
fi

# ─────────────────────────────────────────────────────────────────────────────
# Argument Parsing
# ─────────────────────────────────────────────────────────────────────────────
USE_LOCAL=false
USE_DOCKER=false
JSON_ONLY=false
KEEP_TEMP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      USE_LOCAL=true
      shift
      ;;
    --docker)
      USE_DOCKER=true
      shift
      ;;
    --json-only)
      JSON_ONLY=true
      RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' DIM='' NC=''
      shift
      ;;
    --keep)
      KEEP_TEMP=true
      shift
      ;;
    --help|-h)
      head -30 "$0" | tail -25
      exit 0
      ;;
    --version|-v)
      echo "$SCRIPT_NAME v$VERSION"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# Utility Functions
# ─────────────────────────────────────────────────────────────────────────────
log_step() { echo -e "${BLUE}▶${NC} ${BOLD}$1${NC}"; }
log_ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
log_err()  { echo -e "  ${RED}✗${NC} $1"; }
log_info() { echo -e "  ${DIM}$1${NC}"; }

# Placeholder for main logic
main() {
  log_step "WebCodecs Harness Test Runner v$VERSION"
  log_info "This is a skeleton - implementation coming soon"

  if [[ "$USE_LOCAL" == "true" ]]; then
    log_info "Mode: Local build"
  else
    log_info "Mode: Clone from GitHub"
  fi

  if [[ "$USE_DOCKER" == "true" ]]; then
    log_info "Execution: Docker container"
  else
    log_info "Execution: Native"
  fi
}

main "$@"
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
chmod +x scripts/test-harness.sh && ./test/scripts/test-harness.test.sh
```

Expected: PASS (All skeleton tests passed)

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh test/scripts/test-harness.test.sh
git commit -m "feat(harness): add test-harness.sh skeleton with argument parsing"
```

---

### Task 2: Create terminal UI components (banner, progress, spinners)

**Files:**
- Modify: `scripts/test-harness.sh:75-150`

**Step 1: Write the failing test** (2-5 min)

Add to `test/scripts/test-harness.test.sh`:

```bash
# Test 5: Banner displays correctly
if ! scripts/test-harness.sh 2>&1 | head -5 | grep -q "node-webcodecs"; then
  echo "FAIL: Banner does not display"
  exit 1
fi

# Test 6: Progress indicators work
if ! scripts/test-harness.sh --help 2>&1 | grep -q "Options:"; then
  echo "FAIL: Help options missing"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
./test/scripts/test-harness.test.sh
```

Expected: FAIL with `Banner does not display`

**Step 3: Write minimal implementation** (2-5 min)

Add to `scripts/test-harness.sh` after utility functions:

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Banner
# ─────────────────────────────────────────────────────────────────────────────
show_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}  ${BOLD}node-webcodecs${NC} Harness Test Runner                          ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  W3C WebCodecs API Compliance Validation                      ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Progress Spinner
# ─────────────────────────────────────────────────────────────────────────────
SPINNER_PID=""
SPINNER_FRAMES=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

start_spinner() {
  local message="$1"
  if [[ "$JSON_ONLY" == "true" ]]; then
    echo "$message"
    return
  fi

  (
    local i=0
    while true; do
      printf "\r  ${CYAN}${SPINNER_FRAMES[$i]}${NC} %s" "$message"
      i=$(( (i + 1) % ${#SPINNER_FRAMES[@]} ))
      sleep 0.1
    done
  ) &
  SPINNER_PID=$!
}

stop_spinner() {
  local success="${1:-true}"
  if [[ -n "$SPINNER_PID" ]]; then
    kill "$SPINNER_PID" 2>/dev/null || true
    wait "$SPINNER_PID" 2>/dev/null || true
    SPINNER_PID=""
    printf "\r"
    if [[ "$success" == "true" ]]; then
      echo -e "  ${GREEN}✓${NC} Done"
    else
      echo -e "  ${RED}✗${NC} Failed"
    fi
  fi
}

# Trap to clean up spinner on exit
cleanup_spinner() {
  if [[ -n "$SPINNER_PID" ]]; then
    kill "$SPINNER_PID" 2>/dev/null || true
  fi
}
trap cleanup_spinner EXIT

# ─────────────────────────────────────────────────────────────────────────────
# Progress Bar
# ─────────────────────────────────────────────────────────────────────────────
show_progress() {
  local current=$1
  local total=$2
  local label="${3:-Progress}"
  local width=40
  local percent=$((current * 100 / total))
  local filled=$((current * width / total))
  local empty=$((width - filled))

  printf "\r  ${DIM}%s${NC} [${GREEN}%s${NC}%s] %3d%%" \
    "$label" \
    "$(printf '█%.0s' $(seq 1 $filled 2>/dev/null || echo ""))" \
    "$(printf '░%.0s' $(seq 1 $empty 2>/dev/null || echo ""))" \
    "$percent"
}

finish_progress() {
  echo ""
}
```

Update `main()`:

```bash
main() {
  show_banner
  log_step "Initializing test harness..."
  # Rest of implementation
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
./test/scripts/test-harness.test.sh
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh test/scripts/test-harness.test.sh
git commit -m "feat(harness): add terminal UI components (banner, spinner, progress)"
```

---

### Task 3: Create environment detection functions

**Files:**
- Modify: `scripts/test-harness.sh:160-250`

**Step 1: Write the failing test** (2-5 min)

Add to test file:

```bash
# Test 7: Detects OS correctly
if ! scripts/test-harness.sh 2>&1 | grep -qE "(macOS|Linux)"; then
  echo "FAIL: OS detection not working"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
./test/scripts/test-harness.test.sh
```

**Step 3: Write minimal implementation** (2-5 min)

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Environment Detection
# ─────────────────────────────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin*) echo "macos" ;;
    Linux*)  echo "linux" ;;
    *)       echo "unknown" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64)  echo "x64" ;;
    aarch64) echo "arm64" ;;
    arm64)   echo "arm64" ;;
    *)       echo "$(uname -m)" ;;
  esac
}

detect_node() {
  if command -v node &>/dev/null; then
    node --version | sed 's/v//'
  else
    echo ""
  fi
}

detect_npm() {
  if command -v npm &>/dev/null; then
    npm --version
  else
    echo ""
  fi
}

detect_ffmpeg() {
  if command -v ffmpeg &>/dev/null; then
    ffmpeg -version 2>/dev/null | head -1 | sed 's/ffmpeg version //' | cut -d' ' -f1
  else
    echo ""
  fi
}

detect_docker() {
  if command -v docker &>/dev/null; then
    docker --version 2>/dev/null | sed 's/Docker version //' | cut -d',' -f1
  else
    echo ""
  fi
}

# Check if running inside node-webcodecs repo
detect_local_repo() {
  if [[ -f "package.json" ]] && grep -q '"name": "node-webcodecs"' package.json 2>/dev/null; then
    echo "true"
  else
    echo "false"
  fi
}

# Check if required FFmpeg dev headers are installed
check_ffmpeg_dev() {
  local os="$1"
  if [[ "$os" == "macos" ]]; then
    # Check for Homebrew FFmpeg
    if [[ -d "/opt/homebrew/include/libavcodec" ]] || [[ -d "/usr/local/include/libavcodec" ]]; then
      return 0
    fi
  elif [[ "$os" == "linux" ]]; then
    # Check for FFmpeg dev headers
    if pkg-config --exists libavcodec libavformat libavutil libswscale libswresample libavfilter 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

print_environment() {
  local os=$(detect_os)
  local arch=$(detect_arch)
  local node_ver=$(detect_node)
  local npm_ver=$(detect_npm)
  local ffmpeg_ver=$(detect_ffmpeg)
  local docker_ver=$(detect_docker)
  local is_local=$(detect_local_repo)

  log_step "Environment"
  echo ""
  printf "  %-20s %s\n" "OS:" "${os} (${arch})"
  printf "  %-20s %s\n" "Node.js:" "${node_ver:-${RED}Not installed${NC}}"
  printf "  %-20s %s\n" "npm:" "${npm_ver:-${RED}Not installed${NC}}"
  printf "  %-20s %s\n" "FFmpeg:" "${ffmpeg_ver:-${RED}Not installed${NC}}"
  printf "  %-20s %s\n" "Docker:" "${docker_ver:-${DIM}Not installed${NC}}"
  printf "  %-20s %s\n" "Local repo:" "${is_local}"
  echo ""
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
./test/scripts/test-harness.test.sh
```

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh
git commit -m "feat(harness): add environment detection functions"
```

---

## Task Group 2: Dependency Installation (Sequential - depends on detection)

### Task 4: Implement FFmpeg installation for macOS and Linux

**Files:**
- Modify: `scripts/test-harness.sh:260-350`

**Step 1: Write the failing test** (2-5 min)

Add to test file:

```bash
# Test 8: Script has install_ffmpeg function
if ! grep -q "install_ffmpeg" scripts/test-harness.sh; then
  echo "FAIL: install_ffmpeg function not found"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
./test/scripts/test-harness.test.sh
```

**Step 3: Write minimal implementation** (2-5 min)

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Dependency Installation
# ─────────────────────────────────────────────────────────────────────────────
install_ffmpeg() {
  local os="$1"

  if check_ffmpeg_dev "$os"; then
    log_ok "FFmpeg development libraries already installed"
    return 0
  fi

  log_step "Installing FFmpeg development libraries"

  case "$os" in
    macos)
      if ! command -v brew &>/dev/null; then
        log_err "Homebrew not found. Please install it first:"
        log_info "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        return 1
      fi

      start_spinner "Installing FFmpeg via Homebrew..."
      if brew install ffmpeg pkg-config &>/dev/null; then
        stop_spinner true
        log_ok "FFmpeg installed successfully"
      else
        stop_spinner false
        log_err "Failed to install FFmpeg"
        return 1
      fi
      ;;

    linux)
      # Detect package manager
      if command -v apt-get &>/dev/null; then
        log_info "Using apt-get..."
        start_spinner "Installing FFmpeg development packages..."
        if sudo apt-get update -qq && sudo apt-get install -y -qq \
          libavcodec-dev \
          libavformat-dev \
          libavutil-dev \
          libswscale-dev \
          libswresample-dev \
          libavfilter-dev \
          pkg-config &>/dev/null; then
          stop_spinner true
          log_ok "FFmpeg installed successfully"
        else
          stop_spinner false
          log_err "Failed to install FFmpeg"
          return 1
        fi

      elif command -v dnf &>/dev/null; then
        log_info "Using dnf..."
        start_spinner "Installing FFmpeg development packages..."
        if sudo dnf install -y -q \
          ffmpeg-devel \
          pkg-config &>/dev/null; then
          stop_spinner true
          log_ok "FFmpeg installed successfully"
        else
          stop_spinner false
          log_err "Failed to install FFmpeg. Try enabling RPM Fusion."
          return 1
        fi

      elif command -v pacman &>/dev/null; then
        log_info "Using pacman..."
        start_spinner "Installing FFmpeg development packages..."
        if sudo pacman -S --noconfirm ffmpeg pkg-config &>/dev/null; then
          stop_spinner true
          log_ok "FFmpeg installed successfully"
        else
          stop_spinner false
          log_err "Failed to install FFmpeg"
          return 1
        fi

      else
        log_err "Unsupported package manager"
        log_info "Please install FFmpeg development libraries manually:"
        log_info "  libavcodec-dev libavformat-dev libavutil-dev"
        log_info "  libswscale-dev libswresample-dev libavfilter-dev"
        return 1
      fi
      ;;

    *)
      log_err "Unsupported operating system: $os"
      return 1
      ;;
  esac
}

install_node() {
  local required_version="18"
  local current_version=$(detect_node)

  if [[ -n "$current_version" ]]; then
    local major_version=$(echo "$current_version" | cut -d. -f1)
    if [[ "$major_version" -ge "$required_version" ]]; then
      log_ok "Node.js $current_version meets requirement (>= $required_version)"
      return 0
    fi
  fi

  log_warn "Node.js >= $required_version required (found: ${current_version:-none})"

  # Check for nvm
  if [[ -n "${NVM_DIR:-}" ]] && [[ -f "$NVM_DIR/nvm.sh" ]]; then
    log_info "Using nvm to install Node.js $required_version..."
    source "$NVM_DIR/nvm.sh"
    nvm install "$required_version"
    nvm use "$required_version"
    return 0
  fi

  # Check for fnm
  if command -v fnm &>/dev/null; then
    log_info "Using fnm to install Node.js $required_version..."
    fnm install "$required_version"
    fnm use "$required_version"
    return 0
  fi

  log_err "Please install Node.js $required_version or later"
  log_info "  Recommended: https://nodejs.org/en/download/"
  log_info "  Or use nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
  return 1
}

ensure_dependencies() {
  local os="$1"

  log_step "Checking dependencies"
  echo ""

  # Check/install Node.js
  if ! install_node; then
    return 1
  fi

  # Check/install FFmpeg
  if ! install_ffmpeg "$os"; then
    return 1
  fi

  echo ""
  log_ok "All dependencies satisfied"
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
./test/scripts/test-harness.test.sh
```

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh
git commit -m "feat(harness): add FFmpeg and Node.js installation"
```

---

## Task Group 3: Repository Management (Sequential)

### Task 5: Implement repository cloning and setup

**Files:**
- Modify: `scripts/test-harness.sh:360-450`

**Step 1: Write the failing test** (2-5 min)

```bash
# Test 9: Script has clone_repos function
if ! grep -q "clone_repos\|setup_repos" scripts/test-harness.sh; then
  echo "FAIL: repository setup function not found"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

**Step 3: Write minimal implementation** (2-5 min)

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Repository Management
# ─────────────────────────────────────────────────────────────────────────────
setup_work_directory() {
  log_step "Setting up work directory"

  if [[ -d "$WORK_DIR" ]]; then
    log_info "Cleaning existing work directory..."
    rm -rf "$WORK_DIR"
  fi

  mkdir -p "$WORK_DIR"
  log_ok "Created $WORK_DIR"
}

clone_webcodecs_harness() {
  log_step "Cloning webcodecs-harness"

  start_spinner "Cloning $HARNESS_REPO..."
  if git clone --depth 1 "$HARNESS_REPO" "$WORK_DIR/harness" &>/dev/null; then
    stop_spinner true
    log_ok "Cloned webcodecs-harness"
  else
    stop_spinner false
    log_err "Failed to clone webcodecs-harness"
    return 1
  fi
}

setup_node_webcodecs() {
  local os="$1"

  log_step "Setting up node-webcodecs"

  if [[ "$USE_LOCAL" == "true" ]] && [[ "$(detect_local_repo)" == "true" ]]; then
    log_info "Using local repository..."

    # Get absolute path of current repo
    local local_repo=$(pwd)

    # Check if already built
    if [[ ! -f "$local_repo/dist/index.js" ]]; then
      log_warn "Local build not found, building..."
      start_spinner "Building node-webcodecs..."
      if (cd "$local_repo" && npm run build) &>/dev/null; then
        stop_spinner true
      else
        stop_spinner false
        log_err "Build failed"
        return 1
      fi
    else
      log_ok "Using existing local build"
    fi

    # Create symlink in work directory
    ln -sf "$local_repo" "$WORK_DIR/node-webcodecs"
    log_ok "Linked local node-webcodecs"

  else
    # Clone and build
    start_spinner "Cloning node-webcodecs..."
    if git clone --depth 1 "$WEBCODECS_REPO" "$WORK_DIR/node-webcodecs" &>/dev/null; then
      stop_spinner true
    else
      stop_spinner false
      log_err "Failed to clone node-webcodecs"
      return 1
    fi

    start_spinner "Installing dependencies..."
    if (cd "$WORK_DIR/node-webcodecs" && npm ci) &>/dev/null; then
      stop_spinner true
    else
      stop_spinner false
      log_err "npm install failed"
      return 1
    fi

    start_spinner "Building node-webcodecs..."
    if (cd "$WORK_DIR/node-webcodecs" && npm run build) &>/dev/null; then
      stop_spinner true
      log_ok "Built node-webcodecs"
    else
      stop_spinner false
      log_err "Build failed"
      return 1
    fi
  fi
}

patch_harness_polyfill() {
  log_step "Patching harness to use node-webcodecs"

  local polyfill="$WORK_DIR/harness/src/polyfill.js"
  local webcodecs_path="$WORK_DIR/node-webcodecs"

  # Create patched polyfill
  cat > "$polyfill" << 'EOF'
// Patched by test-harness.sh to use local node-webcodecs
import * as nodeWebcodecs from 'node-webcodecs';

export async function polyfillWebCodecsApi() {
  // Inject all WebCodecs classes into globalThis
  globalThis.VideoDecoder ??= nodeWebcodecs.VideoDecoder;
  globalThis.VideoEncoder ??= nodeWebcodecs.VideoEncoder;
  globalThis.AudioDecoder ??= nodeWebcodecs.AudioDecoder;
  globalThis.AudioEncoder ??= nodeWebcodecs.AudioEncoder;
  globalThis.EncodedVideoChunk ??= nodeWebcodecs.EncodedVideoChunk;
  globalThis.EncodedAudioChunk ??= nodeWebcodecs.EncodedAudioChunk;
  globalThis.VideoFrame ??= nodeWebcodecs.VideoFrame;
  globalThis.VideoColorSpace ??= nodeWebcodecs.VideoColorSpace;
  globalThis.AudioData ??= nodeWebcodecs.AudioData;

  // Additional classes if needed
  if (nodeWebcodecs.ImageDecoder) {
    globalThis.ImageDecoder ??= nodeWebcodecs.ImageDecoder;
  }
}
EOF

  # Update harness package.json to use local node-webcodecs
  local harness_pkg="$WORK_DIR/harness/package.json"

  # Use node to patch the package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$harness_pkg', 'utf8'));
    pkg.dependencies['node-webcodecs'] = 'file:../node-webcodecs';
    fs.writeFileSync('$harness_pkg', JSON.stringify(pkg, null, 2));
  "

  log_ok "Patched polyfill.js"
  log_ok "Updated package.json to use local node-webcodecs"

  # Install harness dependencies
  start_spinner "Installing harness dependencies..."
  if (cd "$WORK_DIR/harness" && npm install) &>/dev/null; then
    stop_spinner true
    log_ok "Installed harness dependencies"
  else
    stop_spinner false
    log_err "Failed to install harness dependencies"
    return 1
  fi
}
```

**Step 4: Run test to verify it passes** (30 sec)

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh
git commit -m "feat(harness): add repository cloning and patching"
```

---

## Task Group 4: Test Execution and Reporting (Sequential)

### Task 6: Implement test runner with JSON output

**Files:**
- Modify: `scripts/test-harness.sh:460-550`

**Step 1: Write the failing test** (2-5 min)

```bash
# Test 10: Script has run_tests function
if ! grep -q "run_tests" scripts/test-harness.sh; then
  echo "FAIL: run_tests function not found"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

**Step 3: Write minimal implementation** (2-5 min)

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Test Execution
# ─────────────────────────────────────────────────────────────────────────────
run_tests() {
  log_step "Running WebCodecs Harness Tests"
  echo ""

  local harness_dir="$WORK_DIR/harness"
  local start_time=$(date +%s)

  # Run vitest with JSON reporter
  local json_output="$WORK_DIR/vitest-results.json"

  # Run tests, capturing both output and exit code
  local exit_code=0
  (
    cd "$harness_dir"

    # Run node-webcodecs specific tests
    npx vitest run test/node-webcodecs \
      --reporter=json \
      --outputFile="$json_output" \
      2>&1
  ) | while IFS= read -r line; do
    # Parse and colorize test output
    if [[ "$JSON_ONLY" != "true" ]]; then
      if [[ "$line" =~ "✓" ]] || [[ "$line" =~ "PASS" ]]; then
        echo -e "  ${GREEN}$line${NC}"
      elif [[ "$line" =~ "✗" ]] || [[ "$line" =~ "FAIL" ]]; then
        echo -e "  ${RED}$line${NC}"
      elif [[ "$line" =~ "⊙" ]] || [[ "$line" =~ "SKIP" ]]; then
        echo -e "  ${YELLOW}$line${NC}"
      else
        echo -e "  ${DIM}$line${NC}"
      fi
    fi
  done || exit_code=$?

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  echo ""
  log_info "Tests completed in ${duration}s"

  # Parse JSON results
  if [[ -f "$json_output" ]]; then
    parse_test_results "$json_output"
  else
    log_warn "No JSON output file found"
  fi

  return $exit_code
}

parse_test_results() {
  local json_file="$1"

  # Use node to parse the vitest JSON output
  local results=$(node -e "
    const fs = require('fs');
    try {
      const data = JSON.parse(fs.readFileSync('$json_file', 'utf8'));

      const summary = {
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        duration: data.testResults?.reduce((acc, t) => acc + (t.endTime - t.startTime), 0) || 0,
        failures: []
      };

      for (const testFile of (data.testResults || [])) {
        for (const assertion of (testFile.assertionResults || [])) {
          summary.total++;
          if (assertion.status === 'passed') {
            summary.passed++;
          } else if (assertion.status === 'failed') {
            summary.failed++;
            summary.failures.push({
              name: assertion.fullName || assertion.title,
              message: assertion.failureMessages?.join('\\n') || 'Unknown error'
            });
          } else {
            summary.skipped++;
          }
        }
      }

      console.log(JSON.stringify(summary));
    } catch (e) {
      console.log(JSON.stringify({ error: e.message }));
    }
  ")

  echo "$results" > "$RESULTS_FILE"

  # Display summary
  local passed=$(echo "$results" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).passed || 0)")
  local failed=$(echo "$results" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).failed || 0)")
  local skipped=$(echo "$results" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).skipped || 0)")
  local total=$(echo "$results" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).total || 0)")

  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}                        ${BOLD}Test Results${NC}                           ${CYAN}║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
  printf "${CYAN}║${NC}  %-15s ${GREEN}%3d${NC} / %3d                                   ${CYAN}║${NC}\n" "Passed:" "$passed" "$total"
  printf "${CYAN}║${NC}  %-15s ${RED}%3d${NC}                                          ${CYAN}║${NC}\n" "Failed:" "$failed"
  printf "${CYAN}║${NC}  %-15s ${YELLOW}%3d${NC}                                          ${CYAN}║${NC}\n" "Skipped:" "$skipped"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

  # Show failures if any
  if [[ "$failed" -gt 0 ]]; then
    echo ""
    log_err "Failed tests:"
    node -e "
      const data = JSON.parse(require('fs').readFileSync('$RESULTS_FILE', 'utf8'));
      for (const f of (data.failures || [])) {
        console.log('  • ' + f.name);
        console.log('    ' + f.message.split('\\n')[0]);
      }
    "
  fi

  # Output JSON if requested
  if [[ "$JSON_ONLY" == "true" ]]; then
    cat "$RESULTS_FILE"
  else
    echo ""
    log_info "Full results saved to: $RESULTS_FILE"
  fi
}
```

**Step 4: Run test to verify it passes** (30 sec)

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh
git commit -m "feat(harness): add test runner with JSON output and pretty results"
```

---

### Task 7: Add cleanup and final summary

**Files:**
- Modify: `scripts/test-harness.sh:560-650`

**Step 1: Write the failing test** (2-5 min)

```bash
# Test 11: Script has cleanup function
if ! grep -q "cleanup\|final_summary" scripts/test-harness.sh; then
  echo "FAIL: cleanup function not found"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

**Step 3: Write minimal implementation** (2-5 min)

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────────────────
cleanup() {
  if [[ "$KEEP_TEMP" == "true" ]]; then
    log_info "Keeping work directory: $WORK_DIR"
    return
  fi

  log_step "Cleaning up"

  if [[ -d "$WORK_DIR" ]]; then
    # Save results before cleanup
    if [[ -f "$RESULTS_FILE" ]]; then
      local home_results="$HOME/.node-webcodecs-harness-results.json"
      cp "$RESULTS_FILE" "$home_results"
      log_info "Results saved to: $home_results"
    fi

    rm -rf "$WORK_DIR"
    log_ok "Removed $WORK_DIR"
  fi
}

final_summary() {
  local exit_code="$1"

  echo ""
  if [[ "$exit_code" -eq 0 ]]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}${GREEN}✓ All tests passed!${NC}                                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  node-webcodecs is compliant with webcodecs-harness          ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║${NC}  ${BOLD}${RED}✗ Some tests failed${NC}                                         ${RED}║${NC}"
    echo -e "${RED}║${NC}  Review the failures above and fix the issues                ${RED}║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
  fi
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────────────────────────────────────
main() {
  local exit_code=0

  show_banner

  # Detect environment
  local os=$(detect_os)
  local is_local=$(detect_local_repo)

  print_environment

  # Auto-enable local mode if running from node-webcodecs repo
  if [[ "$is_local" == "true" ]] && [[ "$USE_LOCAL" != "true" ]]; then
    log_info "Detected node-webcodecs repository - enabling local mode"
    USE_LOCAL=true
  fi

  # Docker mode
  if [[ "$USE_DOCKER" == "true" ]]; then
    run_docker
    return $?
  fi

  # Ensure dependencies
  if ! ensure_dependencies "$os"; then
    log_err "Dependency check failed"
    return 1
  fi

  # Setup work directory
  setup_work_directory

  # Clone/setup repos
  if ! clone_webcodecs_harness; then
    return 1
  fi

  if ! setup_node_webcodecs "$os"; then
    return 1
  fi

  if ! patch_harness_polyfill; then
    return 1
  fi

  # Run tests
  if ! run_tests; then
    exit_code=1
  fi

  # Cleanup
  cleanup

  # Final summary
  final_summary "$exit_code"

  return $exit_code
}

# Run main with all arguments
main "$@"
exit $?
```

**Step 4: Run test to verify it passes** (30 sec)

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh
git commit -m "feat(harness): add cleanup and final summary"
```

---

## Task Group 5: Docker Support (Parallel with Group 4)

### Task 8: Create Dockerfile for reproducible testing

**Files:**
- Create: `scripts/Dockerfile.harness`

**Step 1: Write the failing test** (2-5 min)

```bash
# Test 12: Dockerfile exists
if [[ ! -f "scripts/Dockerfile.harness" ]]; then
  echo "FAIL: scripts/Dockerfile.harness does not exist"
  exit 1
fi

# Test 13: Dockerfile has correct base image
if ! grep -q "node:20" scripts/Dockerfile.harness; then
  echo "FAIL: Dockerfile missing Node.js 20 base"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

**Step 3: Write minimal implementation** (2-5 min)

```dockerfile
# Dockerfile.harness - Reproducible WebCodecs Harness Testing Environment
#
# Build:
#   docker build -f scripts/Dockerfile.harness -t webcodecs-harness .
#
# Run:
#   docker run --rm webcodecs-harness
#   docker run --rm -v $(pwd):/src webcodecs-harness --local

FROM node:20-bookworm

LABEL org.opencontainers.image.title="WebCodecs Harness"
LABEL org.opencontainers.image.description="Reproducible testing environment for node-webcodecs"
LABEL org.opencontainers.image.source="https://github.com/user/node-webcodecs"

# Install FFmpeg development libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    pkg-config \
    git \
    cmake \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install cmake-js globally
RUN npm install -g cmake-js

# Set working directory
WORKDIR /workspace

# Copy the test script
COPY scripts/test-harness.sh /usr/local/bin/test-harness
RUN chmod +x /usr/local/bin/test-harness

# Default: mount local source to /src for --local mode
VOLUME ["/src"]

# Environment variables
ENV NODE_ENV=test
ENV CI=true

# Entrypoint
ENTRYPOINT ["/usr/local/bin/test-harness"]
CMD []
```

**Step 4: Run test to verify it passes** (30 sec)

**Step 5: Commit** (30 sec)

```bash
git add scripts/Dockerfile.harness
git commit -m "feat(harness): add Dockerfile for reproducible testing"
```

---

### Task 9: Implement Docker execution mode in script

**Files:**
- Modify: `scripts/test-harness.sh:180-220`

**Step 1: Write the failing test** (2-5 min)

```bash
# Test 14: Script has run_docker function
if ! grep -q "run_docker" scripts/test-harness.sh; then
  echo "FAIL: run_docker function not found"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

**Step 3: Write minimal implementation** (2-5 min)

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Docker Execution
# ─────────────────────────────────────────────────────────────────────────────
run_docker() {
  log_step "Running in Docker container"

  local docker_ver=$(detect_docker)
  if [[ -z "$docker_ver" ]]; then
    log_err "Docker not found"
    log_info "Install Docker: https://docs.docker.com/get-docker/"
    return 1
  fi

  log_ok "Docker $docker_ver found"

  # Get script directory
  local script_dir
  if [[ -f "scripts/Dockerfile.harness" ]]; then
    script_dir="$(pwd)"
  else
    script_dir="$(dirname "$(readlink -f "$0")")/.."
  fi

  local dockerfile="$script_dir/scripts/Dockerfile.harness"

  if [[ ! -f "$dockerfile" ]]; then
    log_err "Dockerfile not found: $dockerfile"
    return 1
  fi

  # Build Docker image
  local image_name="webcodecs-harness:latest"

  start_spinner "Building Docker image..."
  if docker build -f "$dockerfile" -t "$image_name" "$script_dir" &>/dev/null; then
    stop_spinner true
    log_ok "Built Docker image"
  else
    stop_spinner false
    log_err "Failed to build Docker image"
    return 1
  fi

  # Run container
  log_step "Running tests in container"
  echo ""

  local docker_args=()
  docker_args+=(--rm)

  # If local mode, mount current directory
  if [[ "$USE_LOCAL" == "true" ]] && [[ "$(detect_local_repo)" == "true" ]]; then
    docker_args+=(-v "$(pwd):/src")
    docker_args+=(-e "USE_LOCAL=true")
  fi

  # Pass through JSON_ONLY flag
  if [[ "$JSON_ONLY" == "true" ]]; then
    docker_args+=(-e "JSON_ONLY=true")
  fi

  # Run the container
  docker run "${docker_args[@]}" "$image_name" ${USE_LOCAL:+--local} ${JSON_ONLY:+--json-only}

  return $?
}
```

**Step 4: Run test to verify it passes** (30 sec)

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh
git commit -m "feat(harness): add Docker execution mode"
```

---

## Task Group 6: Documentation and Polish (Parallel)

### Task 10: Create README for harness script

**Files:**
- Create: `scripts/README.md`

**Step 1: Write the failing test** (2-5 min)

```bash
# Test 15: README exists
if [[ ! -f "scripts/README.md" ]]; then
  echo "FAIL: scripts/README.md does not exist"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

**Step 3: Write minimal implementation** (2-5 min)

```markdown
# WebCodecs Harness Test Script

Validate `node-webcodecs` against the [vjeux/webcodecs-harness](https://github.com/vjeux/webcodecs-harness) test suite.

## Quick Start

### One-liner (curl | bash)

```bash
curl -sSL https://raw.githubusercontent.com/user/node-webcodecs/master/scripts/test-harness.sh | bash
```

### From repository

```bash
./scripts/test-harness.sh
```

### Local development

```bash
# From within node-webcodecs repo
./scripts/test-harness.sh --local
```

## Options

| Flag | Description |
|------|-------------|
| `--local` | Use local node-webcodecs build instead of cloning |
| `--docker` | Run tests in Docker container (reproducible environment) |
| `--json-only` | Output only JSON (for CI/automation) |
| `--keep` | Don't clean up temp directory after run |
| `--help` | Show help message |
| `--version` | Show version |

## Requirements

### Native execution

- **Node.js** >= 18
- **FFmpeg** development libraries
  - macOS: `brew install ffmpeg pkg-config`
  - Ubuntu/Debian: `sudo apt install libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev pkg-config`
- **Git**
- **CMake** and C++17 compiler (for building native addon)

### Docker execution

- Docker

## What it does

1. **Environment detection** - Checks OS, Node.js, FFmpeg, and other dependencies
2. **Dependency installation** - Installs missing FFmpeg/Node.js (with user consent)
3. **Repository setup** - Clones webcodecs-harness and node-webcodecs (or uses local)
4. **Polyfill patching** - Configures harness to use node-webcodecs
5. **Test execution** - Runs all applicable tests with vitest
6. **Results reporting** - Pretty terminal output + JSON file

## Output

### Terminal

```
╔══════════════════════════════════════════════════════════════╗
║  node-webcodecs Harness Test Runner                          ║
║  W3C WebCodecs API Compliance Validation                     ║
╚══════════════════════════════════════════════════════════════╝

▶ Environment
  OS:                 macos (arm64)
  Node.js:            20.10.0
  FFmpeg:             6.1.1
  Docker:             24.0.7

▶ Running WebCodecs Harness Tests
  ✓ VideoFrame constructor with RGBA format
  ✓ VideoEncoder encodes H.264 baseline
  ...

╔══════════════════════════════════════════════════════════════╗
║                        Test Results                           ║
╠══════════════════════════════════════════════════════════════╣
║  Passed:          42 / 45                                     ║
║  Failed:           2                                          ║
║  Skipped:          1                                          ║
╚══════════════════════════════════════════════════════════════╝
```

### JSON

Results are saved to `~/.node-webcodecs-harness-results.json`:

```json
{
  "passed": 42,
  "failed": 2,
  "skipped": 1,
  "total": 45,
  "duration": 12345,
  "failures": [
    {
      "name": "VideoEncoder > encodes HEVC",
      "message": "HEVC not supported on this platform"
    }
  ]
}
```

## CI Integration

### GitHub Actions

```yaml
- name: Run WebCodecs Harness Tests
  run: |
    ./scripts/test-harness.sh --json-only > results.json
    cat results.json
```

### With Docker

```yaml
- name: Run WebCodecs Harness Tests (Docker)
  run: |
    docker build -f scripts/Dockerfile.harness -t harness .
    docker run --rm harness --json-only > results.json
```

## Development

### Testing the script itself

```bash
./test/scripts/test-harness.test.sh
```

### Building Docker image

```bash
docker build -f scripts/Dockerfile.harness -t webcodecs-harness .
docker run --rm webcodecs-harness --help
```
```

**Step 4: Run test to verify it passes** (30 sec)

**Step 5: Commit** (30 sec)

```bash
git add scripts/README.md
git commit -m "docs: add README for harness test script"
```

---

### Task 11: Add error handling and edge cases

**Files:**
- Modify: `scripts/test-harness.sh` (various locations)

**Step 1: Write the failing test** (2-5 min)

```bash
# Test 16: Script handles Ctrl+C gracefully
# (Manual test - verify trap is set)
if ! grep -q "trap.*EXIT\|trap.*INT" scripts/test-harness.sh; then
  echo "FAIL: No signal traps found"
  exit 1
fi

# Test 17: Script validates git is installed
if ! grep -q "command -v git" scripts/test-harness.sh; then
  echo "FAIL: Git availability check not found"
  exit 1
fi
```

**Step 2: Run test to verify it fails** (30 sec)

**Step 3: Write minimal implementation** (2-5 min)

Add to script after constants:

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Signal Handling
# ─────────────────────────────────────────────────────────────────────────────
CLEANUP_DONE=false

handle_interrupt() {
  if [[ "$CLEANUP_DONE" == "true" ]]; then
    exit 130
  fi
  CLEANUP_DONE=true

  echo ""
  echo -e "${YELLOW}▶ Interrupted${NC}"

  # Kill any running spinners
  cleanup_spinner

  # Clean up work directory unless --keep
  if [[ "$KEEP_TEMP" != "true" ]] && [[ -d "$WORK_DIR" ]]; then
    echo -e "  ${DIM}Cleaning up...${NC}"
    rm -rf "$WORK_DIR"
  fi

  exit 130
}

handle_error() {
  local line=$1
  local code=$2

  echo ""
  echo -e "${RED}▶ Error on line $line (exit code: $code)${NC}"

  # Clean up
  cleanup_spinner
  if [[ "$KEEP_TEMP" != "true" ]] && [[ -d "$WORK_DIR" ]]; then
    rm -rf "$WORK_DIR"
  fi

  exit $code
}

trap handle_interrupt INT TERM
trap 'handle_error ${LINENO} $?' ERR

# ─────────────────────────────────────────────────────────────────────────────
# Prerequisite Checks
# ─────────────────────────────────────────────────────────────────────────────
check_prerequisites() {
  local missing=()

  # Git is required
  if ! command -v git &>/dev/null; then
    missing+=("git")
  fi

  # curl or wget for downloads
  if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
    missing+=("curl or wget")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_err "Missing required tools: ${missing[*]}"
    log_info "Please install these before continuing"
    return 1
  fi

  return 0
}
```

Update main() to call check_prerequisites early:

```bash
main() {
  # Check basic prerequisites first
  if ! check_prerequisites; then
    return 1
  fi

  # ... rest of main
}
```

**Step 4: Run test to verify it passes** (30 sec)

**Step 5: Commit** (30 sec)

```bash
git add scripts/test-harness.sh
git commit -m "feat(harness): add signal handling and prerequisite checks"
```

---

### Task 12: Integration testing - verify full flow works

**Files:**
- Modify: `test/scripts/test-harness.test.sh`

**Step 1: Write comprehensive integration test** (2-5 min)

```bash
#!/bin/bash
# test/scripts/test-harness.test.sh - Integration tests for test-harness.sh
set -e

SCRIPT="scripts/test-harness.sh"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  \033[0;32m✓\033[0m $1"; ((PASS_COUNT++)); }
fail() { echo -e "  \033[0;31m✗\033[0m $1"; ((FAIL_COUNT++)); }

echo "Running test-harness.sh tests..."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Unit Tests
# ─────────────────────────────────────────────────────────────────────────────
echo "Unit Tests:"

# Test 1: Script exists
[[ -f "$SCRIPT" ]] && pass "Script exists" || fail "Script does not exist"

# Test 2: Script is executable
[[ -x "$SCRIPT" ]] && pass "Script is executable" || fail "Script is not executable"

# Test 3: Help flag works
$SCRIPT --help 2>&1 | grep -q "Usage:" && pass "--help shows usage" || fail "--help missing"

# Test 4: Version flag works
$SCRIPT --version 2>&1 | grep -q "test-harness" && pass "--version works" || fail "--version missing"

# Test 5: Unknown option fails
! $SCRIPT --unknown 2>&1 | grep -q "Unknown option" && fail "Unknown option not rejected" || pass "Unknown option rejected"

# Test 6: Has required functions
grep -q "detect_os" "$SCRIPT" && pass "Has detect_os function" || fail "Missing detect_os"
grep -q "install_ffmpeg" "$SCRIPT" && pass "Has install_ffmpeg function" || fail "Missing install_ffmpeg"
grep -q "clone_webcodecs_harness" "$SCRIPT" && pass "Has clone function" || fail "Missing clone function"
grep -q "run_tests" "$SCRIPT" && pass "Has run_tests function" || fail "Missing run_tests"
grep -q "run_docker" "$SCRIPT" && pass "Has run_docker function" || fail "Missing run_docker"

# Test 7: Has signal traps
grep -q "trap.*INT" "$SCRIPT" && pass "Has interrupt trap" || fail "Missing interrupt trap"
grep -q "trap.*ERR" "$SCRIPT" && pass "Has error trap" || fail "Missing error trap"

# Test 8: Dockerfile exists
[[ -f "scripts/Dockerfile.harness" ]] && pass "Dockerfile exists" || fail "Dockerfile missing"

# Test 9: README exists
[[ -f "scripts/README.md" ]] && pass "README exists" || fail "README missing"

echo ""
echo "─────────────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# Integration Tests (only if --integration flag passed)
# ─────────────────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--integration" ]]; then
  echo ""
  echo "Integration Tests (this will take a while):"

  # Test 10: Dry run detection
  OUTPUT=$($SCRIPT 2>&1 | head -20)
  echo "$OUTPUT" | grep -q "Environment" && pass "Environment detection works" || fail "Environment detection failed"
  echo "$OUTPUT" | grep -qE "(macOS|Linux|macos|linux)" && pass "OS detected" || fail "OS detection failed"

  # Test 11: Local mode detection (if in repo)
  if [[ -f "package.json" ]] && grep -q '"name": "node-webcodecs"' package.json; then
    echo "$OUTPUT" | grep -qi "local" && pass "Local repo detected" || fail "Local repo not detected"
  fi

  echo ""
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo "─────────────────────────────────────────────────────────────────────────"
echo ""
echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo ""
  echo "Some tests failed!"
  exit 1
else
  echo ""
  echo "All tests passed!"
  exit 0
fi
```

**Step 2: Run test to verify it passes** (30 sec)

```bash
chmod +x test/scripts/test-harness.test.sh
./test/scripts/test-harness.test.sh
```

Expected: All unit tests pass

**Step 3: Commit** (30 sec)

```bash
git add test/scripts/test-harness.test.sh
git commit -m "test: add comprehensive integration tests for harness script"
```

---

## Parallel Task Groupings

| Group | Tasks | Rationale |
|-------|-------|-----------|
| Group 1 | 1, 2, 3 | Core script infrastructure - no file overlap |
| Group 2 | 4 | Dependency installation - depends on detection (Task 3) |
| Group 3 | 5 | Repository management - depends on dependencies |
| Group 4 | 6, 7 | Test execution - depends on repo setup |
| Group 5 | 8, 9 | Docker support - parallel with Group 4 |
| Group 6 | 10, 11, 12 | Documentation and polish - can run after Groups 4-5 |

---

## Final Task: Code Review

After all tasks complete, run:

```bash
git diff main..HEAD --stat
git log main..HEAD --oneline
```

Review:
1. All functions documented
2. Error handling comprehensive
3. Signal traps working
4. Tests passing
5. README accurate

---

## Verification Checklist

Before marking complete:

- [ ] `./scripts/test-harness.sh --help` works
- [ ] `./scripts/test-harness.sh --version` works
- [ ] `./test/scripts/test-harness.test.sh` passes all tests
- [ ] Script runs successfully in local mode
- [ ] Docker build succeeds
- [ ] JSON output is valid
- [ ] Terminal colors display correctly
- [ ] Ctrl+C cleanup works
- [ ] README is comprehensive
