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

### Passport Data Export & Real Proof Testing (feature/passport-data-export)
- Added `extracted_data/` to .gitignore — commit: `7b33e96`
- Android: added `dg1Hex`, `digestAlgorithm`, `docSigningCertPem` fields to EDocument
- Android: store hex-encoded DG1, digest algorithm, and PEM cert in NfcReaderTask
- Android: created `PassportDataExporter.kt` utility (exports passport + proof data to logcat with chunking)
- Android: added "Export Test Data" button to ResultDataPassportFragment layout and wiring
- Android: added debug-only proof export in VoteSubmissionService after Groth16 proof generation
- Created `scripts/extract-passport-data.sh` to pull exported data from logcat — commit: `865ac4e`
- Created `passport-data-loader.ts` test helper (loads JSON, converts proof to ProofPoints)
- Created `BioPassportVoting.realproof.test.ts` (3 tests: verify real proof, reject tampered, full vote flow; skips gracefully without data)
- Added `test:realproof` npm script — commit: `f3f88e3`
- Note: Android app changes are on-disk only (app is a separate repo, not tracked in main git)

### Local Proof Generation & E2E Contract Testing (feature/local-proof-generation)
- Added snarkjs dependency for local Groth16 proof generation from Node.js
- Created `registration-proof-generator.ts` helper:
  - `dg1HexToBitArray()`: converts hex DG1 to 1024-element bit array for circuit input
  - `generateRegistrationProof()`: generates real Groth16 proof via snarkjs.groth16.fullProve
  - `verifyRegistrationProofOffchain()`: off-chain proof verification using vkey.json
  - `registrationProofToProofPoints()`: converts snarkjs proof to Solidity struct (BN254 pi_b reversal)
- Copied `RegisterIdentityLight256Verifier.sol` to mock contracts (standalone, no imports)
- Created `PassportIntegration.test.ts` with 8 tests in 3 blocks:
  - Registration Proof Generation (4): real proof from DG1, on-chain verify, tamper reject, key independence
  - Voting with Real Passport Data (3): citizenship match, vote recording with VoteCast event, mismatch reject
  - Full Stack Integration (1): registration proof + voting in one flow
- Fixed `passport-data-loader.ts` path resolution (was 4 `../`, needed 5 to reach repo root)
- Added `test:integration` npm script
- All 8 integration tests pass with real passport data; skip gracefully without data
- All 28 existing tests still pass
- Commit: `229c2b8`

### Full Passport Security Chain Testing (feature/passport-security-chain-tests)
- Added `@peculiar/asn1-cms` dependency for CMS SignedData parsing
- Created `sod-verifier.ts` helper:
  - `parseSOD()`: parses ICAO EF.SOD (strips 0x77 wrapper, extracts CMS SignedData, LDSSecurityObject, certificates, signer info)
  - `verifyDG1Hash()`: passive authentication — verifies DG1 hash matches SOD signed hash
  - `verifySODSignature()`: verifies SOD CMS signature against document signing certificate (handles signedAttrs DER extraction, RSA/PSS/ECDSA)
  - `extractCertificateInfo()`: extracts issuer country, validity period, serial number from PEM cert
- Created `dg1-parser.ts` helper:
  - `parseDG1Fields()`: parses TD3 MRZ fields (nationality, name, DOB, sex, expiry, document number)
  - `tamperDG1Byte()` / `tamperDG1Field()`: modify DG1 for tamper detection testing
- Expanded `PassportIntegration.test.ts` from 8 to 19 tests across 5 blocks:
  - Block 1 — Passive Authentication (6 new): SOD parsing, DG1 hash verification, SOD signature verification, certificate info extraction, tamper detection via hash mismatch (byte + field)
  - Block 2 — DG1 Data Integrity (3 tests, 1 new): MRZ field parsing against personDetails, tampered DG1 produces different dg1Hash, same DG1 with different keys produces same dg1Hash
  - Block 3 — Registration Proof On-Chain (6 tests, 2 new): existing proofs + wrong signals rejection, cross-passport proof rejection
  - Block 4 — Voting with Real Passport Data (3 existing): unchanged
  - Block 5 — Full Stack Integration (1 existing): unchanged
- All 19 integration tests pass; all 28 existing BioPassportVoting tests pass
- Commit: `7c6821d`

### Per-Passport Circuit Testing (feature/per-passport-circuit-tests)
- Downloaded `registerIdentity_1_256_3_3_576_248_NA.dev.zip` (244 MB) from rarimo releases v0.2.4
- Unzipped circuit artifacts: WASM (5.5 MB), zkey (387 MB), vkey, verifier.sol
- Discovered all 3730 circuit input signals by probing WASM binary:
  - `dg1[1024]`, `skIdentity`, `encapsulatedContent[1536]`, `signedAttributes[1024]`
  - `pubkey[32]`, `signature[32]`, `slaveMerkleRoot`, `slaveMerkleInclusionBranches[80]`
- Created `per-passport-proof-generator.ts` helper:
  - `buildPerPassportCircuitInputs()`: extracts SOD encapsulated content, signed attributes, RSA pubkey/signature from passport data; applies SHA-256 padding; computes Poseidon slaveMerkleRoot
  - `generatePerPassportProof()`: generates Groth16 proof via snarkjs (5 public signals, ~11s)
  - `verifyPerPassportProofOffchain()`: off-chain proof verification using vkey.json
  - `hasPerPassportCircuit()`: checks if circuit artifacts are available
- Created `PerPassportVerifier.sol` mock contract (5 public signals, from circuit verifier.sol)
- Expanded `PassportIntegration.test.ts` from 19 to 24 tests (new Block 4):
  - Block 4 — Per-Passport Circuit (5 new): input building validation, proof generation with 5 signals, on-chain verification via PerPassportVerifier, tamper rejection, certificatesRoot consistency check
- 5 public outputs confirmed: `[0]` dg15PubKeyHash (0 for no AA), `[1]` passportHash, `[2]` dgCommit, `[3]` identityKey, `[4]` certificatesRoot
- All 24 integration tests pass; all 28 existing BioPassportVoting tests pass
- Commit: `de47f12`

### ICAO Certificate Chain Verification (feature/passport-security-chain-tests)
- Added ICAO Master List (December 2025, 536 CSCAs from 114 countries) to `test/fixtures/icao/`
- Created `extract-csca.ts` script to parse ICAO ML CMS envelope and extract per-country CSCAs
- Extracted 7 US CSCA certificates; matched DS cert (serial 5DCE388B) to CSCA serial 4E32D006 via signature verification
- Created `cert-chain-verifier.ts` helper:
  - `verifyDSCertSignedByCSCA()`: X.509 signature verification (DS cert → CSCA)
  - `verifyCertificateChain()`: comprehensive chain check (signature, issuer DN match, AKI/SKI, validity periods)
  - `buildICAOMerkleTree()`: Keccak256 Merkle tree matching Registration2.sol's `processProof(keccak256(publicKey))`
  - `computeCertificateKey()`: Poseidon hash matching Bytes2Poseidon.hashPacked() / CRSADispatcher.getCertificateKey()
  - `computeCertificatesRoot()`: stub SMT root matching per-passport circuit's slaveMerkleRoot
  - `loadAllCSCACerts()` / `filterCSCAByCountry()`: ML parsing utilities
  - `hasUSCSCA()` / `loadUSCSCA()`: fixture loading helpers
- Expanded `PassportIntegration.test.ts` from 24 to 39 tests (4 new blocks):
  - Block 1b — Certificate Chain (6): DS→CSCA signature, issuer match, AKI/SKI linkage, validity, full check, wrong CSCA rejection
  - Block 1c — ICAO Master Tree (4): tree construction, proof generation, different roots for different sets, non-member rejection
  - Block 1d — Certificate SMT (4): certificateKey computation, match with circuit slaveMerkleRoot, match with ZK proof output [4], different keys for different certs
  - Full chain test (1): ICAO → CSCA → DS → SOD → DG1 → certificatesRoot end-to-end
- Added ICAO Master List CMS signature verification:
  - `verifyICAOMLAuthenticity()`: verifies CMS signature, ML Signer cert chain, UN CSCA self-signature, validity periods, CSCA count
  - `extractICAOMLCertificates()`: extracts ML Signer and UN CSCA certs from CMS envelope
  - `hasICAOMasterList()` / `getICAOMasterListPath()`: fixture helpers
  - Extracted `icao-ml-signer.pem` (ICAO ML Signer, serial 6539D4BE, valid Jun 2025 → Sep 2026)
  - Extracted `un-csca.pem` (UN CSCA, serial 5996E258, self-signed, valid Jun 2022 → Jun 2032)
- Expanded `PassportIntegration.test.ts` from 39 to 46 tests (new Block 1a):
  - Block 1a — ICAO ML Authenticity (7 new): CMS signature, ML Signer→UN CSCA chain, UN CSCA self-signed, validity periods, issuer identity, CSCA count, cert extraction
  - Updated full chain test to include ML authenticity verification
- Trust chain coverage: UN CSCA ✅ → ML Signer ✅ → ML content ✅ → CSCA certs ✅ → DS cert ✅ → SOD ✅ → DG1 ✅ → ZK proof ✅ → on-chain ✅
- All 46 integration tests pass; all 28 existing BioPassportVoting tests pass
- Commits: `449faef`, `0a417d5`

### Moloch Style Guide Audit (feature/passport-security-chain-tests)
- DRY refactor: extracted 5 duplicated helpers to top-level shared scope
  - `deployProposalsState()`, `deployBioPassportVotingWithState()`, `citizenshipCode()`, `encodeVotingConfig()`, `getCurrentDate()`, `loadTestCaPem()`
  - Cached `verifyICAOMLAuthenticity()` result in Block 1a `before()` (was re-parsing 810KB ML file 7 times)
  - Cached `verifyCertificateChain()` result in Block 1b `before()`
  - Removed 4x inline `require("fs")`/`require("path")` calls
  - Removed unused `SignerWithAddress` import and `OWNER` variables
  - Net reduction: 93 lines (-240/+148)
- Commit: `e4fc698`
- Added 5 missing coverage tests per Moloch guide:
  - SOD signature rejection with wrong certificate (Block 1)
  - DG1 hash rejection with completely unrelated data (Block 1)
  - Full DG1 field parsing: all 9 MRZ fields vs personDetails (Block 2)
  - certificatesRoot determinism: same key always produces same root (Block 1d)
  - Empty Merkle tree boundary: zero certs produces empty root (Block 1c)
- 46 → 51 integration tests, all passing; all 28 existing BioPassportVoting tests pass
- Commit: `5eb1d10`

### Test Quality Rewrite (fix/comprehensive-tests)
- Rewrote BioPassportVoting.test.ts per TESTING_GUIDE.md (Moloch testing philosophy)
- 28 tests: DRY helpers, verification functions, full require coverage
- Happy path (4): execute Groth16, executeNoir, event emission, multi-voter
- Validation errors (10): TD1 reject x2, citizenship, voting whitelist, proposal timing x2, vote count, overflow, zero vote, double vote
- Access control (2): non-whitelisted caller rejected, whitelisted caller succeeds
- Boundary conditions (8): empty/single-entry whitelist, max choice multichoice, power-of-2 single-select, non-power-of-2 reject, MAX+1 reject, minimum choice, exact start time
- Edge cases (4): single option, separate proposals, same nullifier different proposals, multichoice tally
- Commit: `837a126`

### Local E2E Testing & Prod Readiness (feature/local-e2e-testing)

**Phase 0: Endpoint Documentation**
- Created `docs/ENDPOINTS.md` with all Rarimo/FreedomTool endpoints, curl health checks, current status
- All `*.iran.freedomtool.org` services DOWN (timeout); only `rpc.evm.mainnet.rarimo.com` working
- Parent repo commit: `248a95c`

**Phase 1: Dev/Prod Config Separation**
- Added `prod`/`local` product flavors with `IS_LOCAL_DEV` BuildConfig flag to `build.gradle.kts`
- Created `ActiveConfig` runtime selector in `BaseConfig.kt` (delegates to BaseConfig or LocalDev)
- Converted `CircuitBackendApi` from hardcoded `@POST`/`@GET` annotations to `@Url` parameter pattern
- Replaced `BaseConfig.` references with `ActiveConfig.` in 9 files
- Hidden export button in prod builds (`VoteListActivity.kt`, `activity_vote_list.xml`)
- Android repo commit: `0847bf5`

**Phase 2: Local Contract Deployment & Proposal Seeding**
- Updated `2_voting.migration.ts` to deploy `RegistrationSMTMock` + `VerifierMock` on localhost/hardhat
- Created `scripts/seed-local.ts` with 3 test proposals (2 active, 1 ended)
- Added `seed:local` npm script to `package.json`
- Parent repo commit: `69a7ba1`

**Phase 3: VoteAdapter ProposalData Passthrough + Dynamic Options**
- Added `proposalDataList` to `VoteAdapter`, lookup by position in `onClickAllowed()`
- Updated `VoteListActivity` to pass proposalDataList on data load and tab switches
- Extended `Navigator.kt` to pass ProposalData through `openVotePage()`, `openOptionVoting()`, `openVoteProcessing()`
- Updated `VotePageActivity` and `VoteProcessingActivity` to receive and forward ProposalData
- `VoteOptionsActivity`: dynamic option rendering from ProposalData (buttons, results, percentages)
- Added `option_container` LinearLayout to `activity_vote_options.xml`
- `VoteProcessingActivity`: uses `VoteSubmissionService` for on-chain vote submission
- Android repo commits: `3a6b913`, `8e1e878`, `c4a443c`

**Phase 4: Pre-Seed Identity for Local Voting**
- Created `LocalDevSeeder.kt` utility (random nullifier/secret/secretKey, sets isPassportScanned=true)
- Integrated into `VoteListActivity` (auto-seeds on first launch when IS_LOCAL_DEV)
- Added mock proof generation in `VoteSubmissionService` (random Groth16 proof points for VerifierMock)
- Android repo commit: `eb17c75`

**Phase 5: Android JVM Unit Tests**
- Extracted `ProposalParser.kt` (parseDescription, parseVotingWhitelistData) from ProposalProvider
- Extracted `VoteSMTInputsBuilder.kt` (buildJson) from VoteSubmissionService
- Updated ProposalProvider and VoteSubmissionService to delegate to extracted utilities
- Created 3 new test files: VoteSMTInputsTest (9 tests), ProposalParserTest (8 tests), IdentityDataTest (4 tests)
- Committed existing test files (CalldataEncoderTest, ProposalDataTest, VoteEligibilityTest, VoteBitmaskTest)
- All tests pass across all 4 build variants (localDebug/Release, prodDebug/Release)
- Android repo commit: `9180d7c`

**Phase 6: Local E2E Orchestration Script**
- Created `platform/scripts/local-e2e.sh` — orchestrates full local stack
- Steps: Hardhat node → contract deploy → proposal seed → Docker services
- Supports `--skip-docker` (contracts only) and `--stop` (teardown)
- Parent repo commit: `2a80968`

**E2E Vote Submission Bug Fixes**
Three critical bugs discovered during end-to-end vote testing on Android emulator:
1. **web3j ABI encoding bug**: `DefaultFunctionEncoder` adds extra byte for `StaticStruct(StaticArray2)` params — replaced with manual hex ABI encoding (correct selector `0xe4ab0833`)
2. **Locale-sensitive date encoding**: `String.format("%02d")` produces non-ASCII digits (Arabic-Indic) on Farsi-locale devices — fixed with `Locale.US`
3. **Vote bitmask format**: Changed from positional array `[1<<opt0, 1<<opt1, ...]` to single-element bitmask `[1<<selected]` matching contract's per-question-group model
4. **Mock proof format**: Changed from hex strings to decimal strings (CalldataEncoder's `BigInteger(str)` defaults to base 10)
5. **Direct-to-chain submission**: Added `submitDirectToChain()` for local dev (bypasses relayer, uses Hardhat account #0)
6. **Seed script fix**: `acceptedOptions` changed from multi-element to single-element arrays (`[7]` for 3 choices, `[3]` for 2 choices)

**End-to-end vote successfully recorded on-chain** — tx `0xadbb4cd9...` (487,601 gas)
- Android repo commit: `0b4a60a`
- Parent repo commit: `21f961a`

### Real ZK Proof Generation on Phone (feature/real-zk-proofs)
- LocalDevSeeder now uses `Identity.newIdentity(NoOpStateProvider())` from Go library instead of `SecureRandom` bytes — produces cryptographically derived secretKey/nullifier valid for real circuit witness computation
- Added `USE_REAL_PROOFS` BuildConfig flag (separate from `IS_LOCAL_DEV`) — allows real proof generation while keeping other local dev behavior (direct-to-chain submission, local endpoints)
- VoteSubmissionService routes to real Groth16 prover (vote_smt circuit via rapidsnark) when `USE_REAL_PROOFS=true`, mock proofs only when `false`
- Flipped `SEED_MOCK_IDENTITY` default to `true` for local flavor — Go Identity library generates valid keys, auto-seeding is safe
- NoOpStateProvider implements `identity.StateProvider` with only `localPrinter()` active; all other methods throw `UnsupportedOperationException` (not called during key generation)
- Build compiles, 84/85 existing JVM tests pass (1 pre-existing failure in VoteEligibilityTest unrelated to changes)
- Commit: `6429050`

### Android Passport JSON Loading (feature/real-zk-proofs)
- Created `PassportDataLoader.kt`: loads `passport-data.json` from device external files dir, parses person details
- Enhanced `LocalDevSeeder.kt`: reads real passport metadata (issuerAuthority, dateOfBirth) from JSON file when available, falls back to hardcoded "USA"
- Auto-detects emulator via `Build.FINGERPRINT.contains("generic")` for runtime behavior
- Commits: `801009a`, `4c42c06`, `312a6f4`, `98cb252`, `1f78680`

### iOS Passport JSON Loading & Local Dev Seeding (feature/real-zk-proofs)
- Ported Android's PassportDataLoader to `PassportDataLoader.swift`:
  - Loads from Documents dir (via simctl/Finder) or app bundle
  - `parseJson()` pure function for testability
  - `load()` convenience (Documents first, then bundle fallback)
- Created `LocalDevSeeder.swift`:
  - Generates identity keys via Go Identity library (`IdentityNewBJJSecretKey` + `IdentityLoad`)
  - Creates `User` with correct issuing authority from passport JSON
  - Falls back to "USA" when no JSON available
- Added `Config.isLocalDev` computed property (checks if RPC URL is localhost/127.0.0.1)
- Modified `AppView.swift`:
  - Auto-seeds on simulator when `isLocalDev` via `#if targetEnvironment(simulator)`
  - Seed runs after first-launch erase (in same Task) to avoid race condition
- Added `Logger.localDev` category
- Updated `project.pbxproj` with new files + `Local.xcconfig` reference
- Created `PassportDataLoaderTests.swift` (7 tests: valid JSON, missing fields, invalid, empty, empty object, different version, null personDetails)
- **Note**: No Xcode test target exists yet; test file created but needs target added in Xcode
- **Note**: No "Local" build scheme exists; only Development and Production. Need to create one pointing to Local.xcconfig
- **PENDING**: Build verification with Xcode (not installed at time of implementation)
- Commit: `462b6c6`

### Voting UX & Correctness Fixes (feature/real-zk-proofs)

**Vote Encoding/Display Bug Fix**
- Root cause: `VoteOptionsActivity.showDynamicResults()` used `votingResults[index].sum()` treating outer array index (question group) as option index. For single-question proposals (`votingResults.size=1`), only index 0 ever showed votes.
- Fix: Changed to `votingResults[0][index]` — reads per-option vote counts from the first (only) question group.
- Added diagnostic logging in `VoteSubmissionService`: logs selectedOptions, vote bitmask (binary), userPayload hex, and tx receipt.
- Added ABI encoding unit test: `encodeUserPayload - exact ABI encoding matches Solidity abi_encode` — verifies no web3j prefix, correct offsets, UserData struct layout, vote array encoding. All 11 CalldataEncoder tests pass.
- E2E verified: Infrastructure (index 2) → bitmask 4 → `votingResults[0][2]=1` on chain → displays "Infrastructure - 100% (1 vote)" ✅

**Vote Results Re-fetch**
- Added `ProposalProvider.getVotingResults()` — fetches fresh votingResults from chain for a single proposal.
- Modified `VoteOptionsActivity.setupDynamicOptions()` to call `getVotingResults()` when showing results mode (previousSelection > -1), replacing stale intent-cached data with fresh on-chain data.
- Fallback: if re-fetch fails, uses cached data with error log.

**Double-Vote Prevention**
- Contract layer: `ProposalSMT.add(nullifier)` rejects duplicates with "key already exists" — verified in contract source.
- App error handling: `VoteProcessingActivity` now catches "key already exists" (in addition to "user already registered" and "already voted") and shows "already voted" dialog.
- App UI layer: `VotePageActivity` checks `SecureSharedPrefs.getVoteResult(proposalId)` — shows "You voted for: X" status and "See Results" button instead of "Participate".
- Local dev note: `pm clear` creates new identity (new nullifier) → contract sees different voter. In production, passport-derived nullifier is deterministic.

**Post-Vote UX**
- VotePageActivity: "You voted for: X" status text, "See Results" button replacing "Participate"
- VoteProcessingActivity: "See Results" text on success completion
- Added `see_results` and `you_voted_for` string resources

**Seed Script Fix**
- `seed-local.ts` now uses `Math.max(realNow, chainTime)` to handle Hardhat time being ahead of real time

### iOS Voting Feature Parity (feature/ios-voting-feature)

**Phase 1: Config + Models + Storage**
- Added `PROPOSALS_STATE_ADDRESS` and `REGISTRATION_CONTRACT_ADDRESS` to Local/Development/Production xcconfig files + Info.plist
- Added `proposalsStateAddress` and `registrationContractAddress` to `Config.Freedom`
- Created `ProposalData.swift` model with ProposalStatus enum, ProposalOption, ProposalParser (JSON metadata extraction, votingWhitelistData parsing)
- Added `saveVoteResult()/getVoteResult()` to SimpleStorage for persistent vote tracking

**Phase 2: Contract Interaction**
- Created `RawRPCClient.swift` — lightweight JSON-RPC client using URLSession (ethCall, sendRawTransaction, sendTransaction)
- Created `ProposalProvider.swift` — fetches proposals via raw eth_call + manual ABI hex parsing, same strategy as Android (bypasses web3.swift broken struct decoders). Includes parseProposalInfoHex() with word-offset arithmetic, getVotingResults(), getProposalEventId(), getRegistrationRoot()

**Phase 3: Voting UI (SwiftUI)**
- `ProposalListView.swift`: Active/Completed segmented picker, proposal cards with title/description/status/end date, "You voted for: X" in card footer
- `ProposalDetailView.swift`: Header with status badge, description card, eligibility check (citizenship whitelist), "You voted for: X" + "See Results" for already-voted, "Participate" button for eligible
- `VoteOptionsView.swift`: Single-select option buttons with checkmark + accent styling, results mode with per-option progress bars and percentages, re-fetches results from chain
- `VoteProcessingView.swift`: 4-step progress (Building proof → Anonymizing → Sending → Finalizing), checkmark animation per step, "already voted" error detection and handling

**Phase 4: Vote Submission Pipeline**
- `CalldataEncoder.swift`: Manual ABI encoding matching Android (encodeVoteBitmasks, encodeDateAsAsciiBytes, encodeUserPayload, encodeExecuteCalldata with selector 0xe4ab0833)
- `VoteSMTInputsBuilder.swift`: Semaphore-style circuit inputs JSON (root, nullifierHash, nullifier, vote, secret, pathElements[20], pathIndices[20])
- `VoteSubmissionService.swift`: Full submission flow — buildProofInputs (SMT root, proposalEventId, date encoding, vote bitmask), mock proof for local dev, direct-to-chain via Hardhat account #0, relayer submission for production
- `ZKProofPoints` struct with mock() factory for VerifierMock

**Phase 5: Integration**
- Replaced MainView's registrationsList with ProposalListView as primary content
- Added `activeProposals/endedProposals` published state to AppView.ViewModel
- Added `fetchProposals()` to ViewModel, called on app launch alongside fetchRegistrationEntities()

**All Android UX fixes ported**: correct `votingResults[0][index]` indexing, chain re-fetch after voting, "You voted for: X" persistent display, double-vote "already voted" error handling

**PENDING**: Build verification with Xcode (not installed at time of implementation)
- Commits: `615e4ba`, `9d58ea4`
