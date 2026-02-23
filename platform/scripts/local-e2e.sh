#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Local E2E Setup Script
#
# Brings up the entire local stack for end-to-end testing:
#   1. Hardhat node (local EVM)
#   2. Contract deployment (with mock verifier + mock registration SMT)
#   3. Test proposal seeding
#   4. Docker services (relayers, auth service, nginx gateway)
#
# Prerequisites:
#   - Node.js 18+ and yarn
#   - Docker and docker-compose
#   - Docker images built for relayers (see below)
#
# Usage:
#   ./platform/scripts/local-e2e.sh          # Full setup
#   ./platform/scripts/local-e2e.sh --skip-docker  # Contracts only (no Docker services)
#   ./platform/scripts/local-e2e.sh --stop   # Stop everything
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$PLATFORM_DIR/services/passport-voting-contracts"
HARDHAT_PID_FILE="/tmp/hardhat-node.pid"
HARDHAT_LOG="/tmp/hardhat-node.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Stop command ─────────────────────────────────────────────────────────────

stop_all() {
    info "Stopping local E2E stack..."

    # Stop Docker services
    if docker compose -f "$PLATFORM_DIR/docker-compose-local.yaml" ps -q 2>/dev/null | grep -q .; then
        info "Stopping Docker services..."
        docker compose -f "$PLATFORM_DIR/docker-compose-local.yaml" down
        ok "Docker services stopped"
    fi

    # Stop Hardhat node
    if [ -f "$HARDHAT_PID_FILE" ]; then
        local pid
        pid=$(cat "$HARDHAT_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            info "Stopping Hardhat node (PID $pid)..."
            kill "$pid"
            rm -f "$HARDHAT_PID_FILE"
            ok "Hardhat node stopped"
        else
            rm -f "$HARDHAT_PID_FILE"
        fi
    fi

    ok "All services stopped"
    exit 0
}

# ── Parse arguments ──────────────────────────────────────────────────────────

SKIP_DOCKER=false
for arg in "$@"; do
    case $arg in
        --stop)     stop_all ;;
        --skip-docker) SKIP_DOCKER=true ;;
        --help|-h)
            echo "Usage: $0 [--skip-docker] [--stop] [--help]"
            echo ""
            echo "Options:"
            echo "  --skip-docker  Skip Docker services (just contracts + seed)"
            echo "  --stop         Stop all running services"
            echo "  --help         Show this help"
            exit 0
            ;;
    esac
done

# ── Step 1: Start Hardhat node ───────────────────────────────────────────────

start_hardhat() {
    # Check if already running
    if [ -f "$HARDHAT_PID_FILE" ]; then
        local pid
        pid=$(cat "$HARDHAT_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            ok "Hardhat node already running (PID $pid)"
            return
        fi
        rm -f "$HARDHAT_PID_FILE"
    fi

    # Check if port 8545 is in use
    if lsof -i :8545 -sTCP:LISTEN >/dev/null 2>&1; then
        warn "Port 8545 already in use — assuming Hardhat is running"
        return
    fi

    info "Starting Hardhat node..."
    cd "$CONTRACTS_DIR"
    npx hardhat node > "$HARDHAT_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$HARDHAT_PID_FILE"

    # Wait for node to be ready
    local attempts=0
    while ! curl -sf http://localhost:8545 -X POST -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; do
        attempts=$((attempts + 1))
        if [ $attempts -ge 30 ]; then
            error "Hardhat node failed to start after 30s"
            error "Check logs: $HARDHAT_LOG"
            exit 1
        fi
        sleep 1
    done

    ok "Hardhat node running (PID $pid, log: $HARDHAT_LOG)"
}

# ── Step 2: Deploy contracts ─────────────────────────────────────────────────

deploy_contracts() {
    info "Deploying contracts to localhost..."
    cd "$CONTRACTS_DIR"

    # Install deps if needed
    if [ ! -d "node_modules" ]; then
        info "Installing contract dependencies..."
        yarn install
    fi

    # Deploy
    npx hardhat migrate --network localhost 2>&1

    ok "Contracts deployed"

    # Print deployed addresses from report
    local report="$CONTRACTS_DIR/deployed/localhost.md"
    if [ -f "$report" ]; then
        info "Deployed contract addresses:"
        cat "$report"
    fi
}

# ── Step 3: Seed proposals ───────────────────────────────────────────────────

seed_proposals() {
    info "Seeding test proposals..."
    cd "$CONTRACTS_DIR"
    npx hardhat run scripts/seed-local.ts --network localhost 2>&1
    ok "Test proposals seeded"
}

# ── Step 4: Start Docker services ────────────────────────────────────────────

start_docker() {
    if [ "$SKIP_DOCKER" = true ]; then
        warn "Skipping Docker services (--skip-docker)"
        return
    fi

    # Check if Docker images exist
    local missing_images=()
    for image in registration-relayer:local proof-verification-relayer:local decentralized-auth-svc:local; do
        if ! docker image inspect "$image" >/dev/null 2>&1; then
            missing_images+=("$image")
        fi
    done

    if [ ${#missing_images[@]} -gt 0 ]; then
        warn "Missing Docker images: ${missing_images[*]}"
        warn "Build them first. Example:"
        warn "  cd platform/services/registration-relayer && docker build -t registration-relayer:local ."
        warn "  cd platform/services/proof-verification-relayer && docker build -t proof-verification-relayer:local ."
        warn "  cd platform/services/decentralized-auth-svc && docker build -t decentralized-auth-svc:local ."
        warn ""
        warn "Skipping Docker services. Contracts and proposals are ready."
        warn "The Android app can still connect to Hardhat directly at http://10.0.2.2:8545"
        return
    fi

    info "Starting Docker services..."
    cd "$PLATFORM_DIR"
    docker compose -f docker-compose-local.yaml up -d

    # Wait for health checks
    info "Waiting for services to be healthy..."
    local attempts=0
    while ! curl -sf http://localhost:8000/health >/dev/null 2>&1; do
        attempts=$((attempts + 1))
        if [ $attempts -ge 30 ]; then
            warn "Gateway health check timed out. Services may still be starting."
            break
        fi
        sleep 1
    done

    ok "Docker services running"
    echo ""
    info "Service endpoints:"
    echo "  Gateway:                 http://localhost:8000"
    echo "  Registration relayer:    http://localhost:8001"
    echo "  Proof verification:      http://localhost:8002"
    echo "  Auth service:            http://localhost:8003"
}

# ── Main ─────────────────────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  vote-pass Local E2E Setup"
echo "=========================================="
echo ""

start_hardhat
deploy_contracts
seed_proposals
start_docker

echo ""
echo "=========================================="
echo "  Setup Complete"
echo "=========================================="
echo ""
info "Hardhat RPC:    http://localhost:8545"
info "Hardhat log:    $HARDHAT_LOG"
if [ "$SKIP_DOCKER" = false ]; then
    info "API Gateway:    http://localhost:8000"
fi
echo ""
info "Android app (local flavor):"
echo "  - RPC endpoint:    http://10.0.2.2:8545 (emulator)"
echo "  - Build & install: cd app-android-biometric-passport-zk"
echo "                     ./gradlew installLocalDebug"
echo ""
info "To stop: $0 --stop"
echo ""
