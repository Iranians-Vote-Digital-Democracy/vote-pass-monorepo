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
- [x] Android: PassportDataLoader + auto-inject in LocalDevSeeder — `1f78680`

### Voting UX & Correctness Fixes (feature/real-zk-proofs)
- [x] **Fix vote encoding/display bug**: Root cause was `votingResults[index].sum()` treating outer array index as option index. Fixed to `votingResults[0][index]`. Added diagnostic logging. Verified: Infrastructure vote → bitmask 4 → results[0][2]=1 ✅
- [x] **Double-vote prevention**: Verified end-to-end:
  - Contract: ProposalSMT.add(nullifier) rejects duplicate nullifiers with "key already exists" ✅
  - App error handling: VoteProcessingActivity catches "key already exists" → shows "already voted" dialog ✅
  - App UI: VotePageActivity shows "You voted for: X" and "See Results" instead of "Participate" ✅
  - Note: In local dev, `pm clear` creates new identity (new nullifier) → contract sees different voter (expected). In production, passport-derived nullifier is deterministic → same nullifier → contract rejects.
  - Remaining: App queries SharedPreferences only (not on-chain SMT) — vote status lost on app reinstall/data clear. Follow-up task.
- [x] **Post-vote UX**: "See Results" button, "You voted for: X" status, re-fetch results from chain ✅
- [x] **Vote results re-fetch**: VoteOptionsActivity now re-fetches votingResults from chain via ProposalProvider.getVotingResults() instead of using stale cached data ✅

### iOS Voting Parity (feature/ios-voting-parity → tracked in main repo)
- [x] Port PassportDataLoader to iOS (PassportDataLoader.swift) — `462b6c6`
- [x] Port LocalDevSeeder to iOS (LocalDevSeeder.swift) — `462b6c6`
- [x] Add Config.isLocalDev + simulator auto-seeding in AppView — `462b6c6`
- [x] Add PassportDataLoaderTests.swift (7 tests) — `462b6c6`
- [x] Update project.pbxproj (new files + Local.xcconfig ref) — `462b6c6`
- [x] **Voting feature parity**: Complete voting UI + submission pipeline — `615e4ba`, `9d58ea4`
  - ProposalData model, RawRPCClient, ProposalProvider (manual ABI hex parsing)
  - ProposalListView, ProposalDetailView, VoteOptionsView, VoteProcessingView
  - CalldataEncoder, VoteSMTInputsBuilder, VoteSubmissionService
  - All Android UX fixes ported: votingResults[0][index], chain re-fetch, "You voted for: X", double-vote handling
- [ ] **BUILD VERIFICATION**: Compile iOS app with Xcode (waiting for Xcode install)
- [ ] Fix any compile errors from the port
- [ ] Create Xcode test target for IranUnchainedTests (none exists yet)
- [ ] Create "Local" build scheme pointing to Local.xcconfig (only Dev/Prod schemes exist)

## Completed

### Platform Integration
- [x] Phase 1: Initialize git repo & copy platform infrastructure
- [x] Phase 2: Create BioPassportVoting contract (TD3)
- [x] Phase 3: Adapt proof verification relayer for TD3
- [x] Phase 4: Docker & config setup
- [x] Phase 5: Mobile app API configuration
