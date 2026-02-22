# Done

## Platform Integration (feature/bio-passport-voting)

### Phase 1: Initialize git repo & copy platform infrastructure
- Initialized git repo at ~/vote-pass root
- Copied 5 services from ~/vote/platform/services/: passport-contracts, passport-voting-contracts, registration-relayer, proof-verification-relayer, decentralized-auth-svc
- Copied Docker compose files and service configs
- Created tasks.md and done.md
- Commit: `888246c`

### Phase 2: Create BioPassportVoting contract (TD3)
- Created `BioPassportVoting.sol` using `PublicSignalsBuilder` (23 signals, TD3)
- `_buildPublicSignals()` implements TD3 signal construction
- `_buildPublicSignalsTD1()` reverts with "TD1 voting is not supported."
- Deleted IDCardVoting.sol, NoirTD1Verifier_ID_Card_I.sol, deploy/id_i/
- Created deploy/2_voting.migration.ts for BioPassportVoting + VotingVerifier
- 11 initial tests passing (Groth16, Noir, TD1 rejection, citizenship, double-vote, boundaries)
- Commit: `758481c`

### Phase 3: Adapt proof verification relayer for TD3
- Changed `vote_v3.go` line 173: `executeTD1Noir` -> `executeNoir`
- NoirVoting ABI already contains both methods, no binding regen needed
- Commit: `4465947`

### Phase 4: Docker & config setup
- Added decentralized-auth-svc container (port 8003) to docker-compose.yaml
- Fixed build context paths: `./registration-relayer` -> `./services/registration-relayer`
- Added decentralized-auth-svc to docker-compose-local.yaml
- Added auth service upstream and route to nginx.conf
- Commit: `2d673ee`

### Phase 5: Mobile app API configuration
- Android: Added `LocalDev` object in BaseConfig.kt with Docker platform endpoints
- iOS: Added `Local.xcconfig` with localhost Docker service endpoints
- Android commit: `0167863` (in app-android-biometric-passport-zk repo)
- iOS commit: `a0034f6` (in app-ios-biometric-passport-zk repo)

### Test Quality Rewrite (fix/comprehensive-tests)
- Rewrote BioPassportVoting.test.ts per TESTING_GUIDE.md (Moloch testing philosophy)
- 28 tests: DRY helpers, verification functions, full require coverage
- Happy path (4): execute Groth16, executeNoir, event emission, multi-voter
- Validation errors (10): TD1 reject x2, citizenship, voting whitelist, proposal timing x2, vote count, overflow, zero vote, double vote
- Access control (2): non-whitelisted caller rejected, whitelisted caller succeeds
- Boundary conditions (8): empty/single-entry whitelist, max choice multichoice, power-of-2 single-select, non-power-of-2 reject, MAX+1 reject, minimum choice, exact start time
- Edge cases (4): single option, separate proposals, same nullifier different proposals, multichoice tally
- Commit: `837a126`
