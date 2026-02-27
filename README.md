# vote-pass

A secure digital voting platform that uses **passport NFC chips** (TD3 documents) for identity verification via zero-knowledge proofs. Scan your passport to register, vote on proposals, and authenticate to view your voting history — all without revealing your identity.

## How It Works

```
Passport NFC Scan → ZK Proof Generation → On-Chain Registration → Anonymous Voting
```

1. **Register**: Scan your passport via NFC. The app extracts cryptographic data (DG1, SOD, certificates) and generates a ZK proof of passport validity. The proof is registered on-chain in a Merkle tree — no personal data touches the blockchain.

2. **Vote**: Select a proposal and cast your vote. The app generates a Sparse Merkle Tree membership proof with a nullifier that prevents double-voting. The contract verifies the ZK proof (Groth16) and records the vote.

3. **Authenticate**: Prove identity ownership via ZK proof to view your voting history. The auth service issues a JWT without learning who you are.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Mobile Apps                       │
│  ┌──────────────────┐    ┌──────────────────┐       │
│  │  Android (Kotlin) │    │   iOS (Swift)    │       │
│  │  NFC + rapidsnark │    │  NFC + rapidsnark│       │
│  └────────┬─────────┘    └────────┬─────────┘       │
└───────────┼───────────────────────┼─────────────────┘
            │                       │
            ▼                       ▼
┌─────────────────────────────────────────────────────┐
│              Nginx API Gateway (:8000)               │
│  /integrations/registration-relayer/*                │
│  /integrations/proof-verification-relayer/*           │
│  /integrations/decentralized-auth-svc/*              │
└──────┬──────────────┬──────────────┬────────────────┘
       ▼              ▼              ▼
┌────────────┐ ┌─────────────┐ ┌──────────────┐
│Registration│ │    Proof     │ │  Auth Service │
│  Relayer   │ │ Verification │ │  (JWT via ZK) │
│   (Go)     │ │Relayer (Go)  │ │    (Go)       │
└─────┬──────┘ └──────┬──────┘ └──────┬───────┘
      │               │               │
      ▼               ▼               ▼
┌─────────────────────────────────────────────────────┐
│           Smart Contracts (Solidity)                 │
│  Registration2 · BioPassportVoting · ProposalsState  │
│  PoseidonSMT · VotingVerifier · StateKeeper          │
└─────────────────────────────────────────────────────┘
```

## Repository Structure

```
vote-pass/
├── app-android-biometric-passport-zk/   # Android app (Kotlin)
│   └── app/src/main/java/org/iranUnchained/
│       ├── base/BaseConfig.kt           # Endpoints, contract addresses
│       ├── feature/                     # UI: voting, passport scan, onboarding
│       ├── logic/                       # NFC reading, ZK proofs, state
│       └── contracts/                   # ABI wrappers, calldata encoding
│
├── app-ios-biometric-passport-zk/       # iOS app (Swift)
│   └── IranUnchained/
│       ├── Code/Features/               # SwiftUI views and view models
│       └── Frameworks/                  # Identity.xcframework (ZK prover)
│
├── platform/
│   ├── services/
│   │   ├── passport-voting-contracts/   # Solidity contracts + Hardhat tests
│   │   ├── passport-contracts/          # Upstream Rarimo registration infra
│   │   ├── registration-relayer/        # Go: relays registration txs
│   │   ├── proof-verification-relayer/  # Go: submits votes + manages proposals
│   │   └── decentralized-auth-svc/      # Go: JWT auth via ZK proofs
│   ├── configs/                         # Nginx, relayer, and auth configs
│   ├── scripts/local-e2e.sh             # Local dev orchestration
│   ├── docker-compose.yaml              # Production
│   └── docker-compose-local.yaml        # Local development
│
└── docs/
    ├── ICAO_TRUST_CHAIN.md              # ICAO PKD → CSCA → DS → passport verification
    ├── LOCAL_TESTING.md                 # E2E setup guide
    ├── TESTING_GUIDE.md                 # Testing philosophy
    └── ENDPOINTS.md                     # Service endpoints reference
```

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| `Registration2` | Dispatches passport registration by ZK type |
| `StateKeeper` | Manages identity bonds |
| `PoseidonSMT` | Sparse Merkle Tree for identity storage |
| `ProposalsState` | Stores proposals and voting configuration |
| `BioPassportVoting` | TD3 passport voting with citizenship filtering |
| `BaseVoting` | Abstract voting logic, per-proposal country whitelist |
| `VotingVerifier` | Groth16 on-chain proof verifier |

Citizenship filtering is per-proposal via a whitelist in `BaseVoting._validateCitizenship` — an empty whitelist accepts all countries.

## Tech Stack

| Component | Stack |
|-----------|-------|
| Android | Kotlin, Gradle, jmrtd (NFC), web3j, rapidsnark (Groth16) |
| iOS | Swift, SwiftUI, NFCPassportReader, rapidsnark (Groth16) |
| Contracts | Solidity 0.8.28, Hardhat, OpenZeppelin, Rarimo |
| Backend | Go 1.22, PostgreSQL 15, Nginx |
| Infra | Docker Compose |

## Getting Started

### Prerequisites

- Node.js 18+ and Yarn
- Go 1.22+
- Docker and Docker Compose
- Android Studio (for Android) or Xcode (for iOS)
- JDK 17 (for Android builds)

### Local Development (Contracts + App)

The quickest way to get a working local environment:

```bash
# 1. Start Hardhat node, deploy contracts, seed test proposals
./platform/scripts/local-e2e.sh --skip-docker

# 2. Build and install the Android app (local flavor)
cd app-android-biometric-passport-zk
export JAVA_HOME=/path/to/jdk17
./gradlew installLocalDebug

# 3. When done
./platform/scripts/local-e2e.sh --stop
```

This gives you 3 seeded proposals on a local Hardhat chain. The app reads proposals directly via RPC.

### Full Stack (with Docker services)

```bash
# 1. Start everything including backend services
./platform/scripts/local-e2e.sh

# 2. Services available at:
#    Hardhat:  localhost:8545
#    Gateway:  localhost:8000
#    Postgres: localhost:5432
```

### Physical Device Testing

```bash
# Tunnel ports over USB (re-run after each USB reconnect)
adb reverse tcp:8545 tcp:8545   # Hardhat
adb reverse tcp:8000 tcp:8000   # Gateway (if using Docker)
```

Set `LocalDev.HOST = "127.0.0.1"` in `BaseConfig.kt`. Do not use the machine's LAN IP — macOS firewall blocks it.

### Build Flavors

| Flavor | `IS_LOCAL_DEV` | Connects to | Proofs | App ID |
|--------|---------------|-------------|--------|--------|
| `localDebug` | `true` | Hardhat (`10.0.2.2:8545`) | Mock | `org.iranUnchained.local` |
| `prodDebug` | `false` | Rarimo production | Real Groth16 | `org.iranUnchained` |

### Running Contract Tests

```bash
cd platform/services/passport-voting-contracts
yarn install
npx hardhat test test/voting/BioPassportVoting.test.ts
```

## Security

This is a voting platform — security is the top priority.

- **Zero-knowledge proofs** ensure no personal data reaches the blockchain
- **Nullifiers** prevent double-voting without revealing voter identity
- **Private keys** never leave the device (stored in secure enclave)
- **Citizenship filtering** is enforced per-proposal on-chain
- **No PII in this repository** — real passport data is gitignored and never committed

Based on [Rarimo ZK Passport](https://docs.rarimo.com/zk-passport/). See [audit reports](https://docs.rarimo.com/resources/audits). For details on how the ICAO certificate chain (PKD → CSCA → DS → passport) is verified end-to-end, see [ICAO Trust Chain Verification](docs/ICAO_TRUST_CHAIN.md).

## Contributing

See `docs/TESTING_GUIDE.md` for testing standards (100% code path coverage, boundary testing, DRY fixtures). See `CLAUDE.md` for development practices and lessons learned.

## License

MIT
