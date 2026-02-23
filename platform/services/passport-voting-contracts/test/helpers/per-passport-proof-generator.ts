import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs = require("snarkjs");

import { AsnConvert } from "@peculiar/asn1-schema";
import { ContentInfo, SignedData } from "@peculiar/asn1-cms";
import { Poseidon } from "@iden3/js-crypto";

import { ProofPoints } from "./passport-data-loader";

/**
 * Per-passport circuit proof generator for `registerIdentity_1_256_3_3_576_248_NA`.
 *
 * This circuit performs FULL certificate chain verification with 5 public signals,
 * unlike the Light256 circuit which only has 3 signals and delegates cert validation
 * to a backend signer.
 *
 * Circuit: RSA2048 + SHA-256, TD3 (passport), no Active Authentication
 * Total input signals: 3730
 * Public outputs: 5 (passportKey, passportHash, dgCommit, identityKey, certificatesRoot)
 */

const CIRCUIT_NAME = "registerIdentity_1_256_3_3_576_248_NA";

const ASSETS_DIR = path.resolve(
  __dirname,
  `../../../passport-contracts/assets/${CIRCUIT_NAME}.dev/${CIRCUIT_NAME}.dev`,
);
const WASM_PATH = path.join(ASSETS_DIR, `${CIRCUIT_NAME}.wasm`);
const ZKEY_PATH = path.join(ASSETS_DIR, "circuit_final.zkey");
const VKEY_PATH = path.join(ASSETS_DIR, "verification_key.json");

/** Check if per-passport circuit artifacts are available. */
export function hasPerPassportCircuit(): boolean {
  return fs.existsSync(WASM_PATH) && fs.existsSync(ZKEY_PATH) && fs.existsSync(VKEY_PATH);
}

// ---------------------------------------------------------------------------
// SHA-256 padding (FIPS 180-4)
// ---------------------------------------------------------------------------

/**
 * Apply SHA-256 message padding to a hex string.
 * Returns the padded hex string aligned to 512-bit (64-byte) blocks.
 *
 * Padding: message + 0x80 + zeros + 64-bit big-endian length
 */
function sha256Pad(hex: string): string {
  const blockSizeBytes = 64; // 512 bits
  const lengthSizeBytes = 8; // 64-bit length field

  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  const bytesLen = bytes.length;

  const totalLenWith1AndLength = bytesLen + 1 + lengthSizeBytes;
  const paddingLen = (blockSizeBytes - (totalLenWith1AndLength % blockSizeBytes)) % blockSizeBytes;
  const totalLen = bytesLen + 1 + paddingLen + lengthSizeBytes;

  const padded = new Uint8Array(totalLen);
  for (let i = 0; i < bytesLen; i++) {
    padded[i] = bytes[i];
  }
  padded[bytesLen] = 0x80;

  // Big-endian 64-bit length in bits
  const bitLen = BigInt(bytesLen) * 8n;
  for (let i = 0; i < 8; i++) {
    padded[totalLen - 1 - i] = Number((bitLen >> BigInt(i * 8)) & 0xffn);
  }

  let result = "";
  for (const b of padded) {
    result += b.toString(16).padStart(2, "0");
  }
  return result;
}

/**
 * Convert a padded hex string to a bit array (MSB first per byte).
 * Each element is "0" or "1".
 */
function hexToBitArray(hex: string): string[] {
  const bits: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    for (let j = 7; j >= 0; j--) {
      bits.push(((byte >> j) & 1).toString());
    }
  }
  return bits;
}

/**
 * Pad a DG1 hex to 1024 bits (2 SHA-256 blocks) using SHA-256 padding,
 * then convert to bit array.
 */
function padDG1ToBitArray(dg1Hex: string): string[] {
  const padded = sha256Pad(dg1Hex);
  const bits = hexToBitArray(padded);
  // Circuit expects exactly 1024 bits (2 blocks × 512)
  if (bits.length !== 1024) {
    throw new Error(`DG1 padded to ${bits.length} bits, expected 1024`);
  }
  return bits;
}

// ---------------------------------------------------------------------------
// RSA big integer chunking
// ---------------------------------------------------------------------------

/**
 * Split a big integer into k chunks of n bits each (little-endian limb order).
 * Returns array of decimal strings.
 *
 * Matches Rarimo's bigintToArrayString(): chunks[0] is the least significant.
 */
function bigintToChunks(n: number, k: number, x: bigint): string[] {
  const mod = 1n << BigInt(n);
  const result: string[] = [];
  let val = x;
  for (let i = 0; i < k; i++) {
    result.push((val % mod).toString(10));
    val = val / mod;
  }
  return result;
}

// ---------------------------------------------------------------------------
// SOD data extraction for circuit inputs
// ---------------------------------------------------------------------------

/**
 * Minimal DER tag parser.
 */
function parseDERTag(buf: Buffer, offset: number): { tag: number; length: number; headerLen: number } {
  const tag = buf[offset];
  let length = 0;
  let headerLen = 2;

  if (buf[offset + 1] & 0x80) {
    const numLenBytes = buf[offset + 1] & 0x7f;
    headerLen = 2 + numLenBytes;
    for (let i = 0; i < numLenBytes; i++) {
      length = (length << 8) | buf[offset + 2 + i];
    }
  } else {
    length = buf[offset + 1];
  }

  return { tag, length, headerLen };
}

/**
 * Strip ICAO 0x77 wrapper from SOD if present.
 */
function stripICAOWrapper(sodBytes: Buffer): Buffer {
  if (sodBytes[0] === 0x77) {
    const { headerLen } = parseDERTag(sodBytes, 0);
    return sodBytes.subarray(headerLen);
  }
  return sodBytes;
}

export interface PerPassportCircuitInputs {
  dg1: string[];                       // 1024 bits
  skIdentity: string;                  // field element
  encapsulatedContent: string[];       // 1536 bits (3 × 512)
  signedAttributes: string[];          // 1024 bits (2 × 512)
  pubkey: string[];                    // 32 × 64-bit chunks
  signature: string[];                 // 32 × 64-bit chunks
  slaveMerkleRoot: string;             // Poseidon hash
  slaveMerkleInclusionBranches: string[]; // 80 zeros
}

/**
 * Extract and format all circuit inputs from passport data.
 *
 * @param dg1Hex - hex-encoded DG1 (93 bytes)
 * @param sodHex - hex-encoded SOD (CMS SignedData, may have ICAO 0x77 wrapper)
 * @param certPem - PEM-encoded document signing certificate
 * @param skIdentity - secret identity key (optional, random if not provided)
 */
export function buildPerPassportCircuitInputs(
  dg1Hex: string,
  sodHex: string,
  certPem: string,
  skIdentity?: bigint,
): PerPassportCircuitInputs {
  const dg1HexClean = dg1Hex.startsWith("0x") ? dg1Hex.slice(2) : dg1Hex;
  const sodHexClean = sodHex.startsWith("0x") ? sodHex.slice(2) : sodHex;

  // --- Parse SOD ---
  const rawBytes = Buffer.from(sodHexClean, "hex");
  const sodBytes = stripICAOWrapper(rawBytes);

  const contentInfo = AsnConvert.parse(sodBytes, ContentInfo);
  const signedData = AsnConvert.parse(contentInfo.content, SignedData);

  // --- 1. Encapsulated Content (LDSSecurityObject) ---
  const eContent = signedData.encapContentInfo.eContent;
  let ecHex: string;
  if (eContent?.single) {
    const raw = (eContent.single as any).buffer ?? eContent.single;
    let ecBuf = Buffer.from(new Uint8Array(raw));
    if (ecBuf.length === 0) {
      const serialized = AsnConvert.serialize(eContent.single);
      const serBuf = Buffer.from(new Uint8Array(serialized));
      const { headerLen } = parseDERTag(serBuf, 0);
      ecBuf = serBuf.subarray(headerLen);
    }
    ecHex = ecBuf.toString("hex");
  } else if (eContent?.any) {
    ecHex = Buffer.from(new Uint8Array(eContent.any)).toString("hex");
  } else {
    throw new Error("SOD has no encapsulated content");
  }

  // Pad EC to 3 blocks (1536 bits) — circuit parameter ecBlocks=3
  const ecPadded = sha256Pad(ecHex);
  const ecBits = hexToBitArray(ecPadded);
  if (ecBits.length !== 1536) {
    throw new Error(`Encapsulated content padded to ${ecBits.length} bits, expected 1536 (3 blocks)`);
  }

  // --- 2. Signed Attributes ---
  // Re-serialize SignerInfo and extract signedAttrs DER
  const si = signedData.signerInfos[0];
  const siDer = Buffer.from(new Uint8Array(AsnConvert.serialize(si)));

  // Walk SignerInfo SEQUENCE: version → sid → digestAlgorithm → signedAttrs [0]
  let off = 0;
  const outerSeq = parseDERTag(siDer, off);
  off += outerSeq.headerLen;

  // version INTEGER
  const ver = parseDERTag(siDer, off);
  off += ver.headerLen + ver.length;

  // sid SignerIdentifier (SEQUENCE)
  const sid = parseDERTag(siDer, off);
  off += sid.headerLen + sid.length;

  // digestAlgorithm AlgorithmIdentifier (SEQUENCE)
  const da = parseDERTag(siDer, off);
  off += da.headerLen + da.length;

  // signedAttrs [0] (tag 0xa0)
  const saTag = parseDERTag(siDer, off);
  if (saTag.tag !== 0xa0) {
    throw new Error(`Expected signedAttrs tag 0xa0, got 0x${saTag.tag.toString(16)}`);
  }
  const saRaw = siDer.subarray(off, off + saTag.headerLen + saTag.length);

  // Replace tag 0xa0 with 0x31 (SET) for circuit input — same as process_passport.js
  const saHex = "31" + Buffer.from(saRaw).toString("hex").slice(2);

  // Pad SA to 2 blocks (1024 bits)
  const saPadded = sha256Pad(saHex);
  const saBits = hexToBitArray(saPadded);
  if (saBits.length !== 1024) {
    throw new Error(`Signed attributes padded to ${saBits.length} bits, expected 1024 (2 blocks)`);
  }

  // --- 3. RSA Public Key (from certificate) ---
  const normalizedPem = certPem.replace(/([^\n])(-----END)/g, "$1\n$2");
  const publicKey = crypto.createPublicKey(normalizedPem);
  const keyDetails = publicKey.export({ type: "pkcs1", format: "der" });
  // PKCS#1 DER: SEQUENCE { INTEGER modulus, INTEGER exponent }
  const keyDer = Buffer.from(keyDetails);
  let kOff = 0;
  const keySeq = parseDERTag(keyDer, kOff);
  kOff += keySeq.headerLen;
  // modulus INTEGER
  const modTag = parseDERTag(keyDer, kOff);
  let modBytes = keyDer.subarray(kOff + modTag.headerLen, kOff + modTag.headerLen + modTag.length);
  // Strip leading zero byte if present (DER INTEGER is signed)
  if (modBytes[0] === 0x00 && modBytes.length > 256) {
    modBytes = modBytes.subarray(1);
  }
  const modulus = BigInt("0x" + modBytes.toString("hex"));

  // Chunk modulus into 32 × 64-bit limbs
  const pubkeyChunks = bigintToChunks(64, 32, modulus);

  // --- 4. Signature from SOD ---
  const sigBuf = (() => {
    const val = si.signature;
    if ((val as any).buffer) return Buffer.from(new Uint8Array((val as any).buffer));
    if (val instanceof ArrayBuffer) return Buffer.from(new Uint8Array(val));
    return Buffer.from(val as any);
  })();
  const sigInt = BigInt("0x" + sigBuf.toString("hex"));
  const sigChunks = bigintToChunks(64, 32, sigInt);

  // --- 5. slaveMerkleRoot = Poseidon hash of pubkey ---
  // From getFakeIdenData() in process_passport.js:
  // For RSA: pk_arr = bigintToArray(64, 15, modulus)
  //   pk_hash = poseidon([ pk_arr[0]*2^128 + pk_arr[1]*2^64 + pk_arr[2],
  //                        pk_arr[3]*2^128 + pk_arr[4]*2^64 + pk_arr[5],
  //                        pk_arr[6]*2^128 + pk_arr[7]*2^64 + pk_arr[8],
  //                        pk_arr[9]*2^128 + pk_arr[10]*2^64 + pk_arr[11],
  //                        pk_arr[12]*2^128 + pk_arr[13]*2^64 + pk_arr[14] ])
  //   root = poseidon([pk_hash, pk_hash, 1])
  const pkArr15 = bigintToChunks(64, 15, modulus).map(BigInt);
  const poseidonInputs: bigint[] = [];
  for (let i = 0; i < 5; i++) {
    poseidonInputs.push(
      pkArr15[3 * i] * (1n << 128n) + pkArr15[3 * i + 1] * (1n << 64n) + pkArr15[3 * i + 2],
    );
  }
  const pkHash = Poseidon.hash(poseidonInputs);
  const root = Poseidon.hash([pkHash, pkHash, 1n]);

  // --- 6. skIdentity ---
  const fieldOrder = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  let sk: bigint;
  if (skIdentity !== undefined) {
    sk = skIdentity;
  } else {
    // From getFakeIdenData(): SHA-256 of encapsulatedContent, first 62 hex chars
    const ecHash = crypto.createHash("sha256").update(Buffer.from(ecHex, "hex")).digest("hex");
    sk = BigInt("0x" + ecHash.slice(0, 62)) % fieldOrder;
  }

  // --- 7. DG1 bit array ---
  const dg1Bits = padDG1ToBitArray(dg1HexClean);

  return {
    dg1: dg1Bits,
    skIdentity: "0x" + sk.toString(16),
    encapsulatedContent: ecBits,
    signedAttributes: saBits,
    pubkey: pubkeyChunks,
    signature: sigChunks,
    slaveMerkleRoot: "0x" + root.toString(16),
    slaveMerkleInclusionBranches: new Array(80).fill("0"),
  };
}

export interface PerPassportProofResult {
  proof: any;
  publicSignals: string[];
  skIdentity: bigint;
}

/**
 * Generate a Groth16 proof using the per-passport circuit.
 *
 * WARNING: This takes 1-5 minutes and uses ~2-4 GB RAM due to the 387 MB zkey.
 */
export async function generatePerPassportProof(
  dg1Hex: string,
  sodHex: string,
  certPem: string,
  skIdentity?: bigint,
): Promise<PerPassportProofResult> {
  if (!hasPerPassportCircuit()) {
    throw new Error(
      `Per-passport circuit artifacts not found at ${ASSETS_DIR}. ` +
        "Download from https://github.com/rarimo/passport-zk-circuits/releases/tag/v0.2.4",
    );
  }

  const inputs = buildPerPassportCircuitInputs(dg1Hex, sodHex, certPem, skIdentity);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, WASM_PATH, ZKEY_PATH);

  const skHex = inputs.skIdentity.startsWith("0x") ? inputs.skIdentity.slice(2) : inputs.skIdentity;
  const sk = BigInt("0x" + skHex);

  return { proof, publicSignals, skIdentity: sk };
}

/**
 * Verify a per-passport proof off-chain using the verification key.
 */
export async function verifyPerPassportProofOffchain(
  proof: any,
  publicSignals: string[],
): Promise<boolean> {
  const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf-8"));
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}
