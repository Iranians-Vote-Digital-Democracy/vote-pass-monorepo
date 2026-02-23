# vote-pass: Passport-Only Voting Platform

## Project Overview

A secure digital voting platform using **passport NFC chips** (TD3 documents) for identity verification via zero-knowledge proofs. Users scan their passport to register, vote on proposals, and authenticate to view previous votes.

**IMPORTANT**: This project focuses **exclusively on passports** (TD3 documents). No national ID card (NID/TD1) support. Citizenship filtering is handled per-proposal via a whitelist in `BaseVoting._validateCitizenship` — empty whitelist accepts all countries.

## Architecture Reference

- [Rarimo ZK Passport Documentation](https://docs.rarimo.com/zk-passport/) - Underlying ZK identity system
- [Rarimo Audits](https://docs.rarimo.com/resources/audits) - Security audit reports

### Core Flow

1. **Registration**: User scans passport via NFC → App extracts DG1/SOD/certificates → Circom circuit generates ZK proof → Proof registered on-chain in Merkle tree
2. **Voting**: User selects proposal → App generates voteSMT proof → Proof submitted to voting contract with nullifier (prevents double-voting)
3. **Authentication**: User proves identity ownership via ZK proof to view voting history

---

## Repository Structure

```
~/vote-pass/
├── app-android-biometric-passport-zk/   # Native Android app (Kotlin)
│   └── app/src/main/java/org/iranUnchained/
│       ├── base/BaseConfig.kt           # Environment configs (endpoints, chain)
│       ├── feature/                     # UI features (passport scan, voting)
│       ├── logic/                       # Business logic (ZK proofs, NFC)
│       └── contracts/                   # Contract ABIs & wrappers
│
├── app-ios-biometric-passport-zk/       # Native iOS app (Swift)
│   └── IranUnchained/
│       ├── Code/                        # Swift source
│       └── SupportingFiles/Configs/     # Build configs (Local.xcconfig)
│
├── platform/                            # Backend services & contracts
│   ├── docker-compose.yaml              # Production Docker orchestration
│   ├── docker-compose-local.yaml        # Local dev Docker orchestration
│   ├── configs/                         # Service configs
│   │   ├── nginx.conf                   # API gateway (routes to services)
│   │   ├── registration-relayer.yaml
│   │   ├── proof-verification-relayer.yaml
│   │   └── decentralized-auth-svc.yaml
│   └── services/
│       ├── passport-contracts/              # Registration infra (Registration2, StateKeeper, PoseidonSMT)
│       ├── passport-voting-contracts/       # Voting contracts (BaseVoting, BioPassportVoting, verifiers)
│       ├── registration-relayer/            # Go: registration tx relay
│       ├── proof-verification-relayer/      # Go: vote submission + proposals + state
│       └── decentralized-auth-svc/          # Go: JWT auth via ZK proofs
│
├── docs/
│   └── TESTING_GUIDE.md             # Testing philosophy & practices
├── tasks.md                          # Current tasks in progress
├── done.md                           # Completed tasks with commit hashes
└── CLAUDE.md                         # This file
```

---

## Contract Architecture

### Key Contracts

| Contract | Purpose |
|----------|---------|
| `Registration2.sol` | Generic registration (dispatches by `zkType`) |
| `StateKeeper.sol` | Identity bond management |
| `PoseidonSMT.sol` | Sparse Merkle Tree |
| `BioPassportVoting.sol` | TD3 passport voting |
| `BaseVoting.sol` | Abstract voting logic + citizenship whitelist |
| `VotingVerifier.sol` | Groth16 on-chain verifier |

### Contract Entry Points

**Registration** (`Registration2.register`):
```solidity
function register(
    bytes32 certificatesRoot_,
    uint256 identityKey_,
    uint256 dgCommit_,
    Passport memory passport_,
    VerifierHelper.ProofPoints memory zkPoints_
)
```

**Voting** (`BioPassportVoting.execute`):
```solidity
function execute(
    bytes32 registrationRoot_,
    uint256 currentDate_,
    bytes memory userPayload_,
    VerifierHelper.ProofPoints memory zkPoints_
)
```

---

## Tech Stack

### Android App
- **Language**: Kotlin
- **Build**: Gradle
- **NFC**: jmrtd (passport NFC reading)
- **ZK Prover**: Groth16 via rapidsnark, Noir

### iOS App
- **Language**: Swift
- **Build**: Xcode
- **NFC**: NFCPassportReader
- **ZK Prover**: Groth16 via rapidsnark, Noir

### Platform
- **Contracts**: Solidity 0.8.28 (Hardhat)
- **Backend**: Go services
- **Infrastructure**: Docker, Nginx

---

## Common Commands

### Android App
```bash
cd app-android-biometric-passport-zk
./gradlew assembleDebug   # Build debug APK
./gradlew installDebug    # Install on connected device
```

### iOS App
```bash
cd app-ios-biometric-passport-zk
# Open IranUnchained.xcodeproj in Xcode, build & run on device
```

### Platform Contracts
```bash
cd platform/services/passport-voting-contracts
yarn install
yarn test                 # Run contract tests
yarn hardhat compile      # Compile contracts
```

### Local E2E Testing
```bash
# 1. Start Hardhat + deploy contracts + seed proposals (no Docker needed for basic test)
./platform/scripts/local-e2e.sh --skip-docker

# 2. Build and install the local flavor on emulator
cd app-android-biometric-passport-zk
./gradlew installLocalDebug

# 3. Stop everything when done
./platform/scripts/local-e2e.sh --stop
```

**Build flavors**:
- `localDebug` / `localRelease`: `IS_LOCAL_DEV=true`, connects to `10.0.2.2:8545` (Hardhat), mock proofs, auto-seeds fake identity, applicationId `org.iranUnchained.local`
- `prodDebug` / `prodRelease`: `IS_LOCAL_DEV=false`, connects to production Rarimo endpoints, applicationId `org.iranUnchained`

**What works without Docker**: App reads proposals directly from Hardhat via RPC. Polls screen shows 3 seeded proposals. Voting UI with dynamic options works.

**What needs Docker**: Vote submission goes through the relayer gateway (port 8000). Without Docker services, the final submit step fails.

**Emulator vs physical device**: `10.0.2.2` only works on Android emulator. For physical device, use `adb reverse tcp:8545 tcp:8545` (and `tcp:8000 tcp:8000` for Docker gateway) and set `LocalDev.HOST` to `127.0.0.1` in `BaseConfig.kt`. Do NOT use the machine's LAN IP — macOS firewall blocks incoming connections even when Hardhat binds `0.0.0.0`.

**Contract addresses**: Deterministic on fresh Hardhat node. Hardcoded in `BaseConfig.kt` LocalDev and relayer configs. If they change, update both.

### Local Services (Docker)
```bash
cd platform
docker-compose -f docker-compose-local.yaml up -d   # Start local services
```

---

## Pre-Work Checklist (CRITICAL)

Before starting ANY task, planning, or implementation:
1. **Read this entire CLAUDE.md first** — it contains project-specific instructions, common commands, and lessons learned that override default behavior.
2. **Check the Local E2E Testing section** if the task involves running or testing the app.
3. **Check done.md and tasks.md** for context on what's already been done.

**When things go wrong**: If you hit an error or make a mistake during work, write the problem AND the solution to the **Lessons Learned** section at the bottom of this file as soon as you fix it. This prevents repeating the same mistakes across sessions.

---

## Development Best Practices (CRITICAL)

You MUST follow these practices for ALL code changes.

### 1. Feature Branches
```bash
git checkout -b feature/<name>    # Always create a feature branch
# ... do work ...
git checkout main && git merge feature/<name>
```

### 2. Task Tracking
- Update `tasks.md` when starting work (mark tasks in progress)
- Update `done.md` when completing work (move completed tasks with details)
- Include git commit hashes in `done.md` for traceability

### 3. Test-Driven Development (TDD)
- Write tests BEFORE or alongside implementation
- Follow the testing guide at `docs/TESTING_GUIDE.md`
- Every function needs:
  - Happy path tests
  - Error/validation tests (one per `require!`)
  - Access control tests
  - Boundary condition tests (0, 1, MAX-1, MAX)

### 4. Comprehensive Unit Tests
Reference: `docs/TESTING_GUIDE.md` (adapted from Moloch testing philosophy)
- Use verification functions for ALL state changes
- DRY testing - refactor common setup into helpers
- 100% code path coverage
- Test ordering: happy path → errors → access control → boundaries → edge cases

### 5. Commit Frequently
- Commit after each logical unit of work
- Use descriptive commit messages: `feat(scope): description` or `fix(scope): description`
- Never leave work uncommitted at end of session

### 6. Keep Sub-Repos in Sync
The Android and iOS apps are separate git repos nested inside the main `vote-pass` repo:
- `app-android-biometric-passport-zk/` — separate `.git`
- `app-ios-biometric-passport-zk/` — separate `.git`

When changes span both the platform (main repo) and an app (sub-repo), **commit both repos together**. Don't commit the main repo and leave the sub-repo uncommitted (or vice versa).

### Planning Integration
When planning any implementation:
1. Identify which feature branch to create
2. List tests to write (following testing guide)
3. Plan task tracking updates
4. Include commit points in the plan

---

## Test Data Management

### Security Requirements

**CRITICAL**: Real passport data must NEVER be committed to git.

- Store test data in `testdata/` directory (gitignored)
- Use `TEST_PASSPORT_*` environment variable prefix
- Never log raw certificate data in CI

---

## Security Considerations

This is a voting platform — **security is paramount**.

### Key Security Areas
- **ZK Circuit Soundness**: Proofs must not leak identity information
- **Nullifier Privacy**: Cannot derive identity from voting nullifiers
- **Double-Vote Prevention**: Each passport can only vote once per proposal
- **Private Key Storage**: Keys never leave device, stored in secure enclave
- **Citizenship Filtering**: Per-proposal whitelist in voting contract

---

## Lessons Learned

Record mistakes and their solutions here so they never happen again.

- **Problem**: `npx hardhat migrate --network localhost` fails with "Transaction gas limit exceeds transaction gas cap of 16777216". The `@solarity/hardhat-migrate` plugin uses the full `blockGasLimit` as the tx gas, which exceeds Hardhat node's per-transaction RPC cap (16M). **Solution**: Set `gas: 12_000_000` on the `localhost` network in `hardhat.config.ts`. Do NOT increase `blockGasLimit` — that makes it worse.
- **Problem**: Deployed contract addresses differ from what's hardcoded in `BaseConfig.kt` LocalDev and relayer configs. This happens because Hardhat deterministic addresses depend on deployment order and nonce. **Solution**: After deploying, check the addresses in `deployed/localhost.md` and update `BaseConfig.kt` LocalDev + relayer configs if they changed.
- **Problem**: `seed-local.ts` fails with "Could not find deployed address for library PoseidonUnit3L" because `@solarity/hardhat-migrate` does NOT write artifact files to `deployed/localhost/`. **Solution**: Rewrote seed script to discover contracts by probing the chain instead of reading artifact files. Use `ethers.Contract` with ABI to attach to already-deployed proxies.
- **Problem**: Contract discovery finds the implementation contract before the proxy (both respond to `lastProposalId()`), causing BioPassportVoting matching to fail because it compares against the proxy address. **Solution**: Collect ALL candidates, then match BioPassportVoting.proposalsState() against any of them.
- **Problem**: `createProposal` reverts with "function selector was not recognized" because the human-readable ABI in seed script doesn't match the actual contract ABI. **Solution**: Use the compiled ABI from artifacts instead of hand-written ABI strings.
- **Problem**: APK path assumed `localDebug/app-local-debug.apk` but actual path is `local/debug/app-local-debug.apk`. **Solution**: Correct path is `app/build/outputs/apk/local/debug/app-local-debug.apk` (flavor/buildType subdirectories).
- **Problem**: Used `grep` and `head` via Bash to read log files instead of the Read tool. **Solution**: Always use the Read tool to read files. Never use `grep`, `head`, `tail`, `cat` via Bash for reading file contents.
- **Problem**: Forgot to update this Lessons Learned section immediately after making a mistake. **Solution**: Updating CLAUDE.md with the mistake and solution must be the VERY FIRST action after recognizing an error — before any other work continues.
- **Problem**: Hardhat node block timestamps start at `2004-01-01` (from `initialDate` in hardhat.config.ts), but seed script used `Date.now()` (real time ~2026). All proposals created with future timestamps → status=Waiting, nothing shows as "Active". **Solution**: Seed script must call `evm_setNextBlockTimestamp` + `evm_mine` to advance the Hardhat node's time to the present before creating proposals.
- **Problem**: Physical device can't reach Hardhat node despite binding to `0.0.0.0`. Used machine's LAN IP (`192.168.x.x`) in `BaseConfig.kt` `LocalDev.HOST`, but macOS firewall silently blocks incoming connections on port 8545. **Solution**: Use `adb reverse tcp:8545 tcp:8545` to tunnel the port over USB, and set `LocalDev.HOST = "127.0.0.1"` in `BaseConfig.kt`. This is reliable, requires no firewall changes, and works without Wi-Fi. Also forward port 8000 for Docker gateway: `adb reverse tcp:8000 tcp:8000`.
- **Problem**: web3j 4.8.8 `DynamicStruct` decoder throws `UnsupportedOperationException: Array types must be wrapped in a TypeReference` when decoding `getProposalInfo()` return value. Root cause: nested structs (ProposalInfo contains ProposalConfig) with `DynamicArray` fields — web3j can't determine the array element type via reflection during struct decoding. **Solution**: Bypass web3j's struct decoder entirely. Make raw `eth_call` via `web3j.ethCall()`, get hex response, and manually parse the ABI-encoded fields using offset/length arithmetic. See `ProposalProvider.decodeProposalInfo()` for the implementation.
