/**
 * Certificate parsing helpers for NID proof generation tests.
 *
 * Extracts TBS, public key, and signature from DER-encoded X.509 certificates
 * and prepares them as circuit inputs for the registerIdentity_inid_ca circuit.
 */

import { AsnConvert } from "@peculiar/asn1-schema";
import { Certificate } from "@peculiar/asn1-x509";
import { RSAPublicKey } from "@peculiar/asn1-rsa";
import * as crypto from "crypto";
import { Poseidon } from "@iden3/js-crypto";

// BN254 scalar field prime
const BN254_FIELD_PRIME = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

// Iran citizenship mask (from mobile app constants)
const IRAN_CITIZENSHIP_MASK = BigInt("0x20000000000000000000000000");

export interface ParsedCertificate {
  tbs: Uint8Array;
  tbsLength: number;
  modulus: bigint;
  exponent: bigint;
  signature: bigint;
}

/**
 * Parse a DER-encoded X.509 certificate and extract components needed for circuit.
 */
export function parseCertificate(certBytes: Uint8Array): ParsedCertificate {
  const cert = AsnConvert.parse(certBytes, Certificate);

  // Extract TBS (to-be-signed) certificate - this is what the signature covers
  const tbsBytes = new Uint8Array(AsnConvert.serialize(cert.tbsCertificate));

  // Extract RSA public key
  const rsaPubKey = AsnConvert.parse(
    cert.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey,
    RSAPublicKey
  );

  // Remove leading zero if present (ASN.1 integer encoding for positive numbers)
  const modulusBytes =
    rsaPubKey.modulus[0] === 0 ? rsaPubKey.modulus.slice(1) : rsaPubKey.modulus;

  const modulus = BigInt("0x" + Buffer.from(modulusBytes).toString("hex"));

  const exponentBytes =
    rsaPubKey.publicExponent[0] === 0
      ? rsaPubKey.publicExponent.slice(1)
      : rsaPubKey.publicExponent;

  const exponent = BigInt("0x" + Buffer.from(exponentBytes).toString("hex"));

  // Extract signature (also remove leading zero if present)
  const sigBytes =
    cert.signatureValue[0] === 0
      ? cert.signatureValue.slice(1)
      : cert.signatureValue;

  const signature = BigInt("0x" + Buffer.from(sigBytes).toString("hex"));

  return {
    tbs: tbsBytes,
    tbsLength: tbsBytes.length,
    modulus,
    exponent,
    signature,
  };
}

/**
 * Split a big integer into chunks of specified bit width.
 * Used to convert 2048-bit RSA values into 18 x 120-bit field elements.
 */
export function splitBigIntToChunks(
  value: bigint,
  chunkBits: number,
  numChunks: number
): bigint[] {
  const mask = (BigInt(1) << BigInt(chunkBits)) - BigInt(1);
  const chunks: bigint[] = [];
  let remaining = value;

  for (let i = 0; i < numChunks; i++) {
    chunks.push(remaining & mask);
    remaining >>= BigInt(chunkBits);
  }

  return chunks;
}

/**
 * Reconstruct a big integer from chunks (inverse of splitBigIntToChunks).
 * Useful for testing that split/reconstruct round-trips correctly.
 */
export function reconstructFromChunks(
  chunks: bigint[],
  chunkBits: number
): bigint {
  let result = BigInt(0);
  for (let i = chunks.length - 1; i >= 0; i--) {
    result = (result << BigInt(chunkBits)) | chunks[i];
  }
  return result;
}

/**
 * Compute Barrett reduction parameter for modular multiplication.
 *
 * The mobile app uses: 2^(2 * (nBits + 2)) / modulus = 2^(2 * 2050) / modulus
 * This is equivalent to: 2^4100 / modulus
 *
 * Our formula: 2^(2 * nBits + 4) / modulus = 2^(4096 + 4) / modulus = 2^4100 / modulus
 * Both produce the same result.
 */
export function computeBarrettReduction(
  modulus: bigint,
  nBits = 2048
): bigint[] {
  // 2^(2*nBits + 4) = 2^4100 for nBits=2048
  const reduction = (BigInt(1) << BigInt(2 * nBits + 4)) / modulus;
  return splitBigIntToChunks(reduction, 120, 18);
}

/**
 * Compute the pk_hash as the circuit does: extract first 960 bits of pk,
 * repack into 5 Poseidon inputs (each packing 3 x 64-bit chunks), and hash.
 *
 * This replicates the `extract_pk_hash` function in register_identity.nr.
 */
export function extractPkHash(pkChunks: bigint[]): bigint {
  // Extract 960 bits from pk chunks[0..8] (each 120 bits, little-endian)
  const pkBits: number[] = new Array(960).fill(0);
  for (let i = 0; i < 8; i++) {
    let val = pkChunks[i];
    for (let j = 0; j < 120; j++) {
      pkBits[i * 120 + j] = Number(val & 1n);
      val >>= 1n;
    }
  }

  // Repack into 15 x 64-bit chunks
  const chunks64: bigint[] = new Array(15).fill(0n);
  for (let i = 0; i < 15; i++) {
    let current = 1n;
    for (let j = 0; j < 64; j++) {
      chunks64[i] += BigInt(pkBits[i * 64 + j]) * current;
      current *= 2n;
    }
  }

  // Pack into 5 Poseidon inputs: each = chunks64[i*3] * 2^128 + chunks64[i*3+1] * 2^64 + chunks64[i*3+2]
  const TWO_POW_128 = 340282366920938463463374607431768211456n;
  const TWO_POW_64 = 18446744073709551616n;
  const poseidonInputs: bigint[] = [];
  for (let i = 0; i < 5; i++) {
    poseidonInputs.push(
      chunks64[i * 3] * TWO_POW_128 +
        chunks64[i * 3 + 1] * TWO_POW_64 +
        chunks64[i * 3 + 2]
    );
  }

  return Poseidon.hash(poseidonInputs);
}

/**
 * Compute smt_hash1(key, value) = Poseidon(key, value, 1)
 * This replicates the `smt_hash1` function in smt.nr.
 */
export function smtHash1(key: bigint, value: bigint): bigint {
  return Poseidon.hash([key, value, 1n]);
}

/**
 * Compute the icao_root for a single-leaf SMT with all-zero siblings.
 * When siblings are all zeros, the SMT root equals smt_hash1(leaf, leaf)
 * where leaf = key = extract_pk_hash(pk).
 */
export function computeIcaoRootForIsolatedTest(pkChunks: bigint[]): bigint {
  const leaf = extractPkHash(pkChunks);
  return smtHash1(leaf, leaf);
}

/**
 * Prepare all circuit inputs from a certificate.
 *
 * IMPORTANT: The circuit verifies that the signing certificate was signed by
 * the auth certificate's key. For real NID cards:
 * - tbs & signature come from the SIGNING certificate
 * - pk (public key) comes from the AUTH certificate
 *
 * If authPubKey is not provided, falls back to the signing cert's own public key
 * (which will fail verification for real certs, but works for synthetic test data).
 *
 * IMPORTANT: The circuit's SHA-256 implementation always pads to 1152 bytes
 * (18 blocks of 64 bytes). This produces the CORRECT hash only when the TBS
 * length is between 1080 and 1143 bytes (so standard SHA-256 also pads to
 * 18 blocks). Real NID certificates have TBS ~1096 bytes which is in range.
 * Test certificates must be generated with sufficient extensions to reach
 * this TBS size range.
 *
 * @param certBytes - DER-encoded X.509 certificate (signing certificate)
 * @param skIdentity - User's secret identity key
 * @param authPubKey - Auth certificate's RSA modulus (required for real certs)
 * @param icaoRoot - Merkle root of ICAO certificate tree (auto-computed if not provided)
 * @param inclusionBranches - Merkle proof siblings (zeros for isolated tests)
 */
export function prepareCircuitInputs(
  certBytes: Uint8Array,
  skIdentity: bigint,
  authPubKey?: bigint,
  icaoRoot?: bigint,
  inclusionBranches: bigint[] = Array(80).fill(0n)
) {
  const { tbs, tbsLength, modulus, signature } = parseCertificate(certBytes);

  // Use auth certificate's public key if provided, otherwise fall back to signing cert's key
  // Note: For real NID certs, authPubKey is REQUIRED for the circuit to verify correctly
  const pk = authPubKey ?? modulus;

  // Pad TBS to 1200 bytes (circuit requirement)
  const tbsPadded = new Uint8Array(1200);
  tbsPadded.set(tbs);

  // Split 2048-bit values into 18 x 120-bit chunks
  const pkChunks = splitBigIntToChunks(pk, 120, 18);
  const sig = splitBigIntToChunks(signature, 120, 18);
  const reduction = computeBarrettReduction(pk);

  // Auto-compute icao_root for isolated testing (single-leaf SMT with zero siblings)
  const root =
    icaoRoot !== undefined
      ? icaoRoot
      : computeIcaoRootForIsolatedTest(pkChunks);

  return {
    tbs: Array.from(tbsPadded),
    pk: pkChunks.map(String),
    reduction: reduction.map(String),
    signature: sig.map(String),
    len: tbsLength,
    icao_root: String(root),
    inclusion_branches: inclusionBranches.map(String),
    sk_identity: String(skIdentity),
  };
}

// ============================================
// QUERY (VOTING) CIRCUIT HELPERS
// ============================================

/**
 * Parse raw TBS bytes to extract fields used for DG1.
 * Ported from mobile app's _parseRawTbs in eid-based-query-identity-circuit.ts.
 *
 * Navigates ASN.1 TBS structure using hardcoded offsets specific to Iranian NID cards.
 */
export function parseRawTbs(tbsBytes: Uint8Array): {
  country_name: Uint8Array;
  validity: [Uint8Array, Uint8Array];
  given_name: Uint8Array;
  surname: Uint8Array;
  common_name: Uint8Array;
} {
  let current_offset = 28;
  current_offset += tbsBytes[current_offset] + 1;
  current_offset += tbsBytes[current_offset + 1] + 2;

  const validity_len = tbsBytes[current_offset + 3];
  const validity: [Uint8Array, Uint8Array] = [
    new Uint8Array(16),
    new Uint8Array(16),
  ];

  for (let i = 0; i < 16; i++) {
    if (i < validity_len) {
      validity[0][i] = tbsBytes[current_offset + 4 + i];
      validity[1][i] = tbsBytes[current_offset + 6 + validity_len + i];
    }
  }

  validity[0][15] = validity_len;
  validity[1][15] = validity_len;

  current_offset += tbsBytes[current_offset + 1] + 2;

  const country_name = new Uint8Array(2);
  country_name[0] = tbsBytes[current_offset + 13];
  country_name[1] = tbsBytes[current_offset + 14];

  current_offset += tbsBytes[current_offset + 3] + 4;
  current_offset += tbsBytes[current_offset + 1] + 2;
  current_offset += 7 + tbsBytes[current_offset + 5];

  const given_name = new Uint8Array(31);
  const given_name_len = tbsBytes[current_offset];
  for (let i = 0; i < 30; i++) {
    if (i < given_name_len) {
      given_name[i] = tbsBytes[current_offset + 1 + i];
    }
  }
  given_name[30] = given_name_len;
  current_offset += given_name_len + 1;

  current_offset += 7 + tbsBytes[current_offset + 5];

  const surname = new Uint8Array(31);
  const surname_len = tbsBytes[current_offset];
  for (let i = 0; i < 30; i++) {
    if (i < surname_len) {
      surname[i] = tbsBytes[current_offset + 1 + i];
    }
  }
  surname[30] = surname_len;
  current_offset += surname_len + 1;

  current_offset += 7 + tbsBytes[current_offset + 5];

  const common_name = new Uint8Array(31);
  const common_name_len = tbsBytes[current_offset];
  for (let i = 0; i < 30; i++) {
    if (i < common_name_len) {
      common_name[i] = tbsBytes[current_offset + 1 + i];
    }
  }
  common_name[30] = common_name_len;

  return {
    country_name,
    validity,
    given_name,
    surname,
    common_name,
  };
}

/**
 * Extract DG1 (108 bytes) from TBS certificate bytes.
 * Ported from mobile app's getDg1 in eid-based-query-identity-circuit.ts.
 *
 * DG1 layout (108 bytes):
 * [0-1]    Country name (2 bytes)
 * [2-14]   Issue date (13 bytes)
 * [15-27]  Expiration date (13 bytes)
 * [28-58]  Given name (31 bytes, incl. length at byte 30)
 * [59-89]  Surname (31 bytes, incl. length at byte 30)
 * [90-107] Common name (18 bytes)
 */
export function extractDg1FromTbs(tbsBytes: Uint8Array): Uint8Array {
  const { country_name, validity, given_name, surname, common_name } =
    parseRawTbs(tbsBytes);
  const dg1 = new Uint8Array(108);

  dg1[0] = country_name[0];
  dg1[1] = country_name[1];

  for (let j = 0; j < 13; j++) {
    dg1[j + 2] = validity[0][j];
    dg1[j + 15] = validity[1][j];
  }

  for (let j = 0; j < 31; j++) {
    dg1[j + 28] = given_name[j];
    dg1[j + 59] = surname[j];
  }

  for (let j = 0; j < 18; j++) {
    dg1[j + 90] = common_name[j];
  }

  return dg1;
}

/**
 * Compute the id_state_root for an isolated query circuit test.
 *
 * In the identity state SMT:
 * - tree_position = Poseidon(pk_passport_hash, pk_identity_hash)
 * - leaf_value = Poseidon(dg1_commitment, identity_counter, timestamp)
 * - root = smtHash1(tree_position, leaf_value) = Poseidon(pos, val, 1)
 */
export function computeIdStateRootForIsolatedTest(
  passportHash: bigint,
  pkIdentityHash: bigint,
  dg1Commitment: bigint,
  identityCounter = 0n,
  timestamp = 0n
): bigint {
  const treePosition = Poseidon.hash([passportHash, pkIdentityHash]);
  const leafValue = Poseidon.hash([
    dg1Commitment,
    identityCounter,
    timestamp,
  ]);
  return smtHash1(treePosition, leafValue);
}

/**
 * Prepare query circuit inputs from registration circuit outputs.
 *
 * The query circuit proves that the user has a registered identity
 * and produces a nullifier for double-vote prevention.
 *
 * @param certBytes - DER-encoded X.509 certificate (same cert used for registration)
 * @param skIdentity - User's secret identity key (same as used for registration)
 * @param regReturnValue - Array of 5 return values from registration circuit execute()
 */
export function prepareQueryCircuitInputs(
  certBytes: Uint8Array,
  skIdentity: bigint,
  regReturnValue: string[]
): Record<string, any> {
  const { tbs } = parseCertificate(certBytes);
  const dg1 = extractDg1FromTbs(tbs);

  const passportHash = BigInt(regReturnValue[1]);
  const dg1Commitment = BigInt(regReturnValue[2]);
  const pkIdentityHash = BigInt(regReturnValue[3]);

  const idStateRoot = computeIdStateRootForIsolatedTest(
    passportHash,
    pkIdentityHash,
    dg1Commitment
  );

  // Random event_id and event_data for voting
  const eventId = BigInt("0x" + crypto.randomBytes(31).toString("hex"));
  const eventData = BigInt("0x" + crypto.randomBytes(31).toString("hex"));

  return {
    event_id: String(eventId),
    event_data: String(eventData),
    id_state_root: String(idStateRoot),
    selector: "262143", // all 18 bits set = no filtering
    timestamp_lowerbound: "0",
    timestamp_upperbound: String(BN254_FIELD_PRIME - 1n),
    timestamp: "0",
    identity_count_lowerbound: "0",
    identity_count_upperbound: String(BN254_FIELD_PRIME - 1n),
    identity_counter: "0",
    birth_date_lowerbound: "0",
    birth_date_upperbound: String(BN254_FIELD_PRIME - 1n),
    expiration_date_lowerbound: "0",
    expiration_date_upperbound: String(BN254_FIELD_PRIME - 1n),
    citizenship_mask: String(IRAN_CITIZENSHIP_MASK),
    sk_identity: String(skIdentity),
    pk_passport_hash: String(passportHash),
    dg1: Array.from(dg1).map(String),
    siblings: Array(80).fill("0"),
    current_date: "0",
  };
}
