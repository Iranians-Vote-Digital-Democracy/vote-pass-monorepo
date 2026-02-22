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

### Local Services
```bash
cd platform
docker-compose up         # Start local services
```

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
