# Tasks

## In Progress

### Per-Passport Circuit Testing (feature/per-passport-circuit-tests)
- [x] Download `registerIdentity_1_256_3_3_576_248_NA.dev.zip` (244 MB) from rarimo releases v0.2.4
- [x] Unzip circuit artifacts (WASM 5.5 MB, zkey 387 MB, vkey, verifier.sol)
- [x] Discover all 3730 circuit input signals by probing WASM
- [x] Extract circuit inputs from real passport data (SOD → encapsulatedContent, signedAttributes, signature; cert → pubkey)
- [x] Generate Groth16 proof with per-passport circuit (11s, 5 public signals)
- [x] Verify proof on-chain with PerPassportVerifier.sol
- [x] Write integration tests (5 new tests, 24 total integration + 28 existing = all passing)
- [x] Commit: `de47f12`

## Completed

### Platform Integration
- [x] Phase 1: Initialize git repo & copy platform infrastructure
- [x] Phase 2: Create BioPassportVoting contract (TD3)
- [x] Phase 3: Adapt proof verification relayer for TD3
- [x] Phase 4: Docker & config setup
- [x] Phase 5: Mobile app API configuration
