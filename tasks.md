# Tasks

## In Progress

### ICAO Certificate Chain Verification (feature/passport-security-chain-tests)
- [x] Download ICAO Master List (December 2025, 536 CSCAs)
- [x] Parse ML, extract 7 US CSCA certificates
- [x] Match DS cert to CSCA via signature verification (serial 4E32D006)
- [x] Create `cert-chain-verifier.ts` helper (DS→CSCA, ICAO tree, Cert SMT)
- [x] Add 15 new integration tests (3 blocks + 1 full chain test)
- [x] All 39 integration tests pass, all 28 existing tests pass
- [x] Commit: `449faef`

## Completed

### Platform Integration
- [x] Phase 1: Initialize git repo & copy platform infrastructure
- [x] Phase 2: Create BioPassportVoting contract (TD3)
- [x] Phase 3: Adapt proof verification relayer for TD3
- [x] Phase 4: Docker & config setup
- [x] Phase 5: Mobile app API configuration
