# ICAO Trust Chain Verification

This document describes the complete certificate trust chain from the ICAO Public Key Directory (PKD) down to the data stored on a passport's NFC chip, and how vote-pass verifies it end-to-end using zero-knowledge proofs.

## The Chain

```
UN CSCA (self-signed root)
  └─ signs → ICAO Master List Signer certificate
                └─ signs → ICAO Master List (536 CSCA certs from all countries)
                              └─ contains → Country Signing CA (CSCA) certificate
                                              └─ signs → Document Signing (DS) certificate
                                                           └─ signs → Security Object (SOD)
                                                                        └─ contains → DG1 hash
                                                                                       └─ matches → DG1 (identity data)
                                                                                                      └─ ZK proof → on-chain
```

Every link in this chain is cryptographically verified. No link is trusted on assertion alone.

## Layer by Layer

### 1. ICAO Master List

The ICAO Master List is a CMS SignedData file (DER-encoded) distributed by ICAO to member states. It contains the CSCA certificates for all participating countries.

**File**: `test/fixtures/icao/ICAO_ml_December2025.ml` (810 KB)

**Structure**:
- CMS OID: `1.2.840.113549.1.7.2` (signedData)
- Inner content OID: `2.23.136.1.1.2` (id-icao-cscaMasterList)
- ASN.1: `SEQUENCE { version INTEGER, certList SET OF Certificate }`
- Contains 536 CSCA certificates from countries worldwide
- Signed with SHA-256 + RSA

**Embedded signer certificates**:
1. **ICAO Master List Signer** — issued by the UN CSCA, valid Jun 2025 to Sep 2026
2. **United Nations CSCA** — self-signed root, valid Jun 2022 to Jun 2032

**Extraction**:
```bash
# Extract the raw MasterList content from the CMS envelope
openssl cms -inform DER -in ICAO_ml_December2025.ml -verify -noverify -nosigs -out master_list_content.der

# Note: openssl pkcs7 does NOT work on this file (wrong signerInfo format) — must use cms
```

**CMS signature verification**: The signed attributes block has IMPLICIT tag `0xa0` which must be replaced with `0x31` (SET) per RFC 5652 before verifying the RSA signature against the ML Signer certificate's public key.

### 2. Country Signing CA (CSCA) Certificates

CSCA certificates are the country-level roots. Each country has one or more CSCAs that sign Document Signing certificates embedded in passports.

**Example — US CSCAs**: 7 US CSCA certificates exist in the December 2025 ML. They are self-signed (subject === issuer) and contain the RSA public keys used to verify DS certificates.

Two US CSCAs share the same RSA key pair (different serials):
- Serial `4E32D006` — valid 2019-11-14 to 2040-05-14
- Serial `4E32D03F` — valid 2019-11-14 to 2040-05-14
- Same Subject Key Identifier, same public key

**Extraction from Master List**:
```bash
npx ts-node test/fixtures/icao/extract-csca.ts US
```

CSCA certificates are **public infrastructure** — distributed by ICAO to all member states, safe to store in version control.

### 3. Document Signing (DS) Certificate

The DS certificate is embedded in the passport's NFC chip (inside the SOD). It was issued by the country's CSCA and contains the public key used to sign the Security Object.

**Example — US passport DS cert**:
- Issuer: `C=US, O=U.S. Government, OU=Department of State, OU=MRTD, OU=Certification Authorities`
- Key type: RSA 2048-bit, exponent 65537
- No Authority Key Identifier extension (matching is done via signature verification)

**Verification**: `dsCert.verify(cscaCert.publicKey)` — the DS certificate's signature is verified against the CSCA's public key. This confirms the DS cert was issued by a legitimate CSCA from the ICAO Master List.

### 4. Security Object Document (SOD)

The SOD is a CMS SignedData structure stored on the passport's NFC chip. It contains:
- **Encapsulated content**: The LDSSecurityObject, which lists hashes of all data groups (DG1, DG2, etc.)
- **Signed attributes**: Metadata signed by the DS certificate's private key
- **Signature**: RSA signature over the signed attributes

**Parsing notes**:
- SOD from NFC is wrapped in ICAO tag `0x77` — must strip before CMS parsing
- Signed attributes have IMPLICIT tag `0xa0` — replace with `0x31` (SET) for signature verification
- `OctetString` from ASN.1 libraries stores data in `.buffer`, not directly as ArrayBuffer

### 5. Data Group 1 (DG1)

DG1 contains the Machine Readable Zone (MRZ) data: nationality, document number, dates, and the holder's name. Its hash is listed in the SOD's LDSSecurityObject.

**Verification**: Hash the DG1 bytes → compare against the hash stored in the SOD → verify SOD signature against the DS cert → verify DS cert against the CSCA → verify CSCA is in the ICAO Master List → verify ML signature against the UN CSCA.

## ZK Proof: What Goes On-Chain

None of the above data reaches the blockchain in cleartext. Instead, a Groth16 zero-knowledge proof attests to the entire chain:

### Circuit Inputs (private — never revealed)

| Signal | Size (bits) | Source |
|--------|-------------|--------|
| `dg1` | 1024 | DG1 bit array (MRZ data) |
| `skIdentity` | 254 | User's secret identity key |
| `encapsulatedContent` | 1536 | SOD's LDSSecurityObject (padded to 3 SHA-256 blocks) |
| `signedAttributes` | 1024 | SOD signed attributes (padded to 2 SHA-256 blocks) |
| `pubkey` | 2048 | DS certificate RSA modulus (32 x 64-bit chunks) |
| `signature` | 2048 | SOD RSA signature (32 x 64-bit chunks) |
| `slaveMerkleRoot` | 254 | Poseidon hash of pubkey chunks |
| `slaveMerkleInclusionBranches` | 80 x 254 | SMT inclusion proof |

### Circuit Outputs (public — posted on-chain)

| Index | Signal | Description |
|-------|--------|-------------|
| 0 | `dg15PubKeyHash` | Hash of Active Authentication key (0 if passport has no DG15) |
| 1 | `passportHash` | Hash of encapsulated content + signature |
| 2 | `dgCommit` | Poseidon commitment to DG1 bits |
| 3 | `identityKey` | Derived from `skIdentity` — user's public identity |
| 4 | `certificatesRoot` | Certificates SMT root (Poseidon hash of DS cert pubkey) |

The contract verifies the Groth16 proof and checks that `certificatesRoot` matches a known CSCA in the on-chain ICAO Merkle tree. This closes the trust chain: the proof demonstrates possession of a valid passport signed by a legitimate authority, without revealing any personal data.

### Certificates Root Computation

The `certificatesRoot` (output [4]) is computed as:

```
RSA modulus (2048 bits)
  → 15 x 64-bit chunks
  → group into 5 x 192-bit values: chunks[3i] * 2^128 + chunks[3i+1] * 2^64 + chunks[3i+2]
  → pkHash = Poseidon5(five 192-bit values)
  → certificatesRoot = Poseidon3(pkHash, pkHash, 1)
```

On-chain, `Registration2.registerCertificate()` stores CSCA public keys as `keccak256(SPKI DER bytes)` in an OpenZeppelin MerkleProof tree.

## Circuit Selection

Different passports use different cryptographic parameters, requiring different circuits:

| Passport Type | Signature | Hash | Circuit |
|--------------|-----------|------|---------|
| US (and most modern) | RSA 2048 + SHA-256 | SHA-256 | `registerIdentity_1_256_3_3_576_248_NA` |
| Older biometric | RSA 2048 + SHA-1 | SHA-1 | `registerIdentity_3_160_3_3_336_200_NA` |
| Universal fallback | RSA 2048 (any) | Any | `registerIdentityUniversalRSA2048` |

Circuit naming convention: `registerIdentity_{sigType}_{dgHashBits}_{docType}_{ecBlocks}_{ecShiftBits}_{dg1ShiftBits}_{aaParams}`

All circuit artifacts are published at [rarimo/passport-zk-circuits releases](https://github.com/rarimo/passport-zk-circuits/releases).

## Proof Performance

Benchmarked on Apple Silicon (M-series), Node.js with snarkjs:

| Operation | Time | Notes |
|-----------|------|-------|
| Build circuit inputs | < 1s | Parse SOD, pad, chunk |
| Full proof generation | ~11s | 387 MB zkey, ~3 GB RAM |
| Off-chain verification | < 1s | Using vkey.json |
| On-chain verification | < 1s | Groth16 verifier contract |
| Light circuit proof | ~0.7s | Smaller circuit, backend-assisted |

## Two Registration Paths

vote-pass supports two trust models:

1. **Full on-chain verification** (`Registration2` + per-passport circuit): The ZK proof covers the entire chain from DS cert signature to DG1. The contract verifies the CSCA against the on-chain ICAO Merkle tree. No backend trust required.

2. **Backend-assisted** (`RegistrationSimple` + `RegisterIdentityLight256`): The backend validates the CSCA → DS cert chain offline and signs the result. The contract trusts the backend signature. Smaller circuit (3 signals vs 5), faster proving (~0.7s vs ~11s).

## File Locations

| File | Description |
|------|-------------|
| `test/fixtures/icao/ICAO_ml_December2025.ml` | ICAO Master List (DER-encoded CMS) |
| `test/fixtures/icao/master_list_content.der` | Extracted ML content (gitignored, regeneratable) |
| `test/fixtures/icao/extract-csca.ts` | Script to extract CSCA certs by country |
| `test/fixtures/icao/csca-us-*.pem` | All 7 US CSCA certificates |
| `test/fixtures/icao/un-csca.pem` | United Nations root CA |
| `test/fixtures/icao/icao-ml-signer.pem` | ML signer certificate |
| `test/fixtures/us-csca.pem` | Primary US CSCA (convenience copy) |

All paths relative to `platform/services/passport-voting-contracts/`.
