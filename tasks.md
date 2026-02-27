# Tasks

## In Progress

### Local E2E Testing & Prod Readiness (feature/local-e2e-testing)
- [x] Phase 0: ENDPOINTS.md documentation — `248a95c`
- [x] Phase 1: Dev/prod build flavors + ActiveConfig — `0847bf5` (android)
- [x] Phase 2: Mock contract deployment + proposal seeding — `69a7ba1`
- [x] Phase 3: VoteAdapter ProposalData passthrough + dynamic options — `3a6b913`, `c4a443c` (android)
- [x] Phase 4: Pre-seed identity + mock proof for local dev — `eb17c75` (android)
- [x] Phase 5: Extract pure functions + JVM unit tests (21 new) — `9180d7c` (android)
- [x] Phase 6: Local E2E orchestration script — `2a80968`
- [x] E2E bug fixes: ABI encoding, locale dates, vote bitmask, mock proof — `0b4a60a` (android), `21f961a` (platform)
- [x] **E2E vote successfully submitted on-chain** (tx 0xadbb4cd9, 487k gas)
- [ ] Phase 7: Self-host identity-provider-service (follow-up)

### Real ZK Proof Generation on Phone (feature/real-zk-proofs)
- [x] Modify LocalDevSeeder to use Go Identity library (proper key derivation) — `6429050`
- [x] Add USE_REAL_PROOFS build flag, enable SEED_MOCK_IDENTITY by default — `6429050`
- [x] Modify VoteSubmissionService to use real proofs when USE_REAL_PROOFS=true — `6429050`
- [x] JVM tests: no new pure functions to test; 84/85 existing tests pass (1 pre-existing failure)

## Completed

### Platform Integration
- [x] Phase 1: Initialize git repo & copy platform infrastructure
- [x] Phase 2: Create BioPassportVoting contract (TD3)
- [x] Phase 3: Adapt proof verification relayer for TD3
- [x] Phase 4: Docker & config setup
- [x] Phase 5: Mobile app API configuration
