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

### Test Quality Rewrite (fix/comprehensive-tests)
- Rewrote BioPassportVoting.test.ts per TESTING_GUIDE.md (Moloch testing philosophy)
- 28 tests: DRY helpers, verification functions, full require coverage
- Happy path (4): execute Groth16, executeNoir, event emission, multi-voter
- Validation errors (10): TD1 reject x2, citizenship, voting whitelist, proposal timing x2, vote count, overflow, zero vote, double vote
- Access control (2): non-whitelisted caller rejected, whitelisted caller succeeds
- Boundary conditions (8): empty/single-entry whitelist, max choice multichoice, power-of-2 single-select, non-power-of-2 reject, MAX+1 reject, minimum choice, exact start time
- Edge cases (4): single option, separate proposals, same nullifier different proposals, multichoice tally
- Commit: `837a126`
