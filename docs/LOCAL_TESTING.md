# Local Testing Guide

End-to-end testing of the vote-pass platform on a local Hardhat chain, using either an Android emulator or a physical device with a real passport.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | |
| Yarn | 1.x | |
| JDK | 17 | `brew install openjdk@17` on macOS |
| Android SDK | API 34 | `minSdk 27`, `targetSdk 34` |
| ADB | any | For device install |
| Docker | (optional) | Only needed for relayer services |

Set JDK 17 before building:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="$JAVA_HOME/bin:$PATH"
```

## Quick Start

```bash
# 1. Start Hardhat + deploy contracts + seed proposals
./platform/scripts/local-e2e.sh --skip-docker

# 2. Build and install on emulator
cd app-android-biometric-passport-zk
./gradlew installLocalDebug

# 3. Open the app — proposals appear immediately

# 4. Stop when done
./platform/scripts/local-e2e.sh --stop
```

## Physical Device Setup

The emulator uses `10.0.2.2` to reach the host machine. For a physical device, use **ADB reverse port forwarding** over USB — this tunnels ports from the phone back to your machine without any firewall or Wi-Fi issues.

> **Do NOT use your machine's LAN IP.** macOS firewall silently blocks incoming connections even when Hardhat binds `0.0.0.0`. ADB reverse is the reliable approach.

### 1. Set up ADB reverse forwarding

Connect the phone via USB with USB debugging enabled, then:

```bash
adb reverse tcp:8545 tcp:8545   # Hardhat RPC
adb reverse tcp:8000 tcp:8000   # Docker gateway (if using Docker)
adb reverse --list               # verify
```

This makes `127.0.0.1:8545` on the phone forward to `localhost:8545` on your machine.

> **Note:** `adb reverse` must be re-run each time you reconnect the USB cable or restart ADB.

### 2. Verify BaseConfig.kt uses 127.0.0.1

The `LocalDev.HOST` should be set to `127.0.0.1` (the default for physical device testing):

```kotlin
object LocalDev {
    private const val HOST = "127.0.0.1"   // works with adb reverse
    // ...
}
```

If you're switching back to emulator, change `HOST` to `10.0.2.2`.

### 3. Build and install

```bash
cd app-android-biometric-passport-zk
./gradlew assembleLocalDebug

adb devices                    # verify phone appears
adb uninstall org.iranUnchained.local 2>/dev/null   # remove old version
adb install app/build/outputs/apk/local/debug/app-local-debug.apk
```

## What the Setup Script Does

`platform/scripts/local-e2e.sh` runs these steps:

1. **Start Hardhat node** — local EVM on port 8545 (log: `/tmp/hardhat-node.log`)
2. **Deploy contracts** — `npx hardhat migrate --network localhost`
   - `RegistrationSMTMock` — accepts any root (always returns true)
   - `VerifierMock` — accepts any proof (always returns true)
   - `ProposalsState` — ERC1967 proxy for proposal storage
   - `BioPassportVoting` — voting contract wired to the mocks
3. **Seed test proposals** — `npx hardhat run scripts/seed-local.ts --network localhost`
4. **Docker services** (unless `--skip-docker`) — relayers + auth + nginx gateway

### Flags

| Flag | Effect |
|------|--------|
| (none) | Full setup: Hardhat + contracts + seed + Docker |
| `--skip-docker` | Skip Docker services (contracts only) |
| `--stop` | Stop all running services |

### Seeded Proposals

| # | Title | Options | Status | Duration |
|---|-------|---------|--------|----------|
| 1 | Community Budget Allocation | Parks / Education / Infrastructure | Active | 30 days |
| 2 | Platform Governance Vote | Yes / No | Active | 7 days |
| 3 | Previous Quarter Review | Approve / Reject | Ended | (closed 60 days ago) |

## Contract Addresses

Addresses are deterministic on a fresh Hardhat node (same nonce order every time):

| Contract | Address |
|----------|---------|
| RegistrationSMT | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` |
| ProposalsState | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |
| BioPassportVoting | `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` |
| VotingVerifier | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` |

These are hardcoded in `BaseConfig.kt` `LocalDev`. If they change after deployment, check `deployed/localhost.md` and update the config.

## Build Flavors

| Flavor | `IS_LOCAL_DEV` | applicationId | Chain | Proofs |
|--------|---------------|---------------|-------|--------|
| `local` | `true` | `org.iranUnchained.local` | Hardhat (localhost) | Mock (VerifierMock accepts any) |
| `prod` | `false` | `org.iranUnchained` | Rarimo L2 Mainnet | Real Groth16 via rapidsnark |

Build commands:
```bash
./gradlew assembleLocalDebug     # Local flavor, debug signing
./gradlew assembleProdDebug      # Production flavor, debug signing
./gradlew installLocalDebug      # Build + install on connected device
```

## App Behavior in Local Mode

### Mock Identity (`SEED_MOCK_IDENTITY`)

Controlled by the `SEED_MOCK_IDENTITY` flag in `app/build.gradle.kts` (local flavor):

```kotlin
// app/build.gradle.kts — inside the "local" flavor
buildConfigField("boolean", "SEED_MOCK_IDENTITY", "false")  // require real passport scan
buildConfigField("boolean", "SEED_MOCK_IDENTITY", "true")   // auto-seed fake identity
```

When **enabled** (`true`): On first launch, `LocalDevSeeder` generates a random fake identity (nullifier, secret, secretKey) and saves it to secure prefs. No passport scan required — the polls screen loads immediately and voting works with mock proofs.

When **disabled** (`false`, the default): The app requires a real passport scan before voting. Tapping a proposal shows the "verify your passport" screen. Use the **"Scan & Export Passport"** button on the polls screen to scan your passport via NFC.

### Mock Proof Submission
When you vote, `VoteSubmissionService` generates random proof points instead of running the Groth16 prover. The on-chain `VerifierMock` accepts any proof, so votes always succeed. This applies regardless of the `SEED_MOCK_IDENTITY` flag.

### Direct-to-Chain
Votes go directly to the Hardhat node (no relayer needed). The app signs with Hardhat account #0.

## Passport Scanning on Physical Device

The local flavor has a **"Scan & Export Passport"** button on the polls screen. This opens the real NFC scan flow:

1. Tap the button → opens camera for MRZ scanning
2. Position the MRZ (bottom of passport data page) in the camera frame
3. Once MRZ is read → NFC scan begins
4. Hold the passport data page flat against the phone's NFC reader
5. Wait for DG1/SOD/certificates extraction (a few seconds)
6. Results screen shows extracted data + "Export Test Data" button

### Extracting Passport Data to Your Machine

After a scan, tap "Export Test Data" on the results screen. This writes the passport data to Android logcat. Then pull it:

```bash
# From the repo root:
./scripts/extract-passport-data.sh
# Saves to extracted_data/passport-data-<timestamp>.json
```

The extracted JSON contains DG1 hex, SOD hex, DS certificate PEM, and parsed MRZ fields. This data can be used with the contract integration tests:

```bash
cd platform/services/passport-voting-contracts
npx hardhat test test/voting/PassportIntegration.test.ts
```

## What Works Without Docker

| Feature | Works? |
|---------|--------|
| Proposals display | Yes — app reads directly from Hardhat RPC |
| Tab filtering (Active/Completed) | Yes |
| Passport NFC scan | Yes — hardware only, no backend needed |
| Vote submission | Yes — direct-to-chain with mock proofs |
| Export passport data | Yes — via logcat |

## What Needs Docker

| Feature | Why |
|---------|-----|
| Relayer-mediated vote submission | Goes through `proof-verification-relayer` on port 8000 |
| Registration flow | Goes through `registration-relayer` |
| JWT authentication | Goes through `decentralized-auth-svc` |

To start Docker services:
```bash
# Build images first (one-time):
cd platform/services/registration-relayer && docker build -t registration-relayer:local .
cd platform/services/proof-verification-relayer && docker build -t proof-verification-relayer:local .
cd platform/services/decentralized-auth-svc && docker build -t decentralized-auth-svc:local .

# Then run without --skip-docker:
./platform/scripts/local-e2e.sh
```

## Troubleshooting

### Phone can't reach Hardhat
- Verify ADB reverse is active: `adb reverse --list` should show `tcp:8545 tcp:8545`
- Re-run `adb reverse tcp:8545 tcp:8545` after reconnecting USB
- Check Hardhat is running on host: `curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
- Do **not** use LAN IP — macOS firewall blocks it. Use `127.0.0.1` with ADB reverse.

### Proposals don't show up
- Check Hardhat is running: `lsof -i :8545`
- Check `HOST` in `BaseConfig.kt` `LocalDev` is `127.0.0.1` (physical device) or `10.0.2.2` (emulator)
- Verify ADB reverse is set up (physical device only)

### Contract addresses mismatch
- Happens if Hardhat node was restarted without a clean slate
- Stop everything: `./platform/scripts/local-e2e.sh --stop`
- Start fresh: the script auto-deploys to a clean node
- Check `deployed/localhost.md` and compare with `BaseConfig.kt`

### APK install fails with version downgrade
```bash
adb uninstall org.iranUnchained.local
adb install app/build/outputs/apk/local/debug/app-local-debug.apk
```

### NFC scan fails
- NFC must be enabled in phone settings
- Hold passport flat and still against the NFC antenna (usually upper back of phone)
- Keep the passport data page (with MRZ) facing the phone
- Some phone cases interfere with NFC — try removing the case
