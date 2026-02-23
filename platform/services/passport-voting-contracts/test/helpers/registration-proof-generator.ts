import * as path from "path";
import * as fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs = require("snarkjs");

import { ProofPoints } from "./passport-data-loader";

const ASSETS_DIR = path.resolve(
  __dirname,
  "../../../passport-contracts/assets/registerIdentityLight256.dev",
);
const WASM_PATH = path.join(
  ASSETS_DIR,
  "registerIdentityLight256_js/RegisterIdentityLight256.wasm",
);
const ZKEY_PATH = path.join(ASSETS_DIR, "RegisterIdentityLight256.groth16.zkey");
const VKEY_PATH = path.join(ASSETS_DIR, "RegisterIdentityLight256.groth16.vkey.json");

/** Check if registration circuit artifacts are available. */
export function hasRegistrationCircuit(): boolean {
  return fs.existsSync(WASM_PATH) && fs.existsSync(ZKEY_PATH) && fs.existsSync(VKEY_PATH);
}

/**
 * Convert a hex-encoded DG1 to a 1024-element bit array (MSB first per byte).
 * The circuit expects dg1[1024] where each element is "0" or "1".
 */
export function dg1HexToBitArray(dg1Hex: string): string[] {
  const hex = dg1Hex.startsWith("0x") ? dg1Hex.slice(2) : dg1Hex;
  const bytes = Buffer.from(hex, "hex");
  const bits: string[] = [];

  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push(((byte >> i) & 1).toString());
    }
  }

  // Pad to 1024 bits (circuit input size)
  while (bits.length < 1024) {
    bits.push("0");
  }

  return bits.slice(0, 1024);
}

/**
 * Generate a random secret key for identity (field element < BN254 scalar field order).
 */
function randomSkIdentity(): bigint {
  const fieldOrder = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  // Generate random 31 bytes to stay well within the field
  const randomBytes = require("crypto").randomBytes(31);
  const val = BigInt("0x" + randomBytes.toString("hex"));
  return val % fieldOrder;
}

export interface RegistrationProofResult {
  proof: any;
  publicSignals: string[];
  skIdentity: bigint;
}

/**
 * Generate a real Groth16 registration proof from DG1 hex data.
 *
 * @param dg1Hex - Hex-encoded DG1 data from passport (93 bytes / 186 hex chars)
 * @param skIdentity - Optional secret key; random if not provided
 * @returns proof, publicSignals (3 elements: dg1Hash, dg1Commitment, pkIdentityHash), skIdentity
 */
export async function generateRegistrationProof(
  dg1Hex: string,
  skIdentity?: bigint,
): Promise<RegistrationProofResult> {
  if (!hasRegistrationCircuit()) {
    throw new Error(
      `Registration circuit artifacts not found at ${ASSETS_DIR}. ` +
        "Ensure passport-contracts package is installed with assets.",
    );
  }

  const sk = skIdentity ?? randomSkIdentity();
  const dg1Bits = dg1HexToBitArray(dg1Hex);

  const input = {
    dg1: dg1Bits,
    skIdentity: sk.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);

  return { proof, publicSignals, skIdentity: sk };
}

/**
 * Verify a registration proof off-chain using the verification key.
 */
export async function verifyRegistrationProofOffchain(
  proof: any,
  publicSignals: string[],
): Promise<boolean> {
  const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf-8"));
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}

/**
 * Convert snarkjs proof format to Solidity ProofPoints struct.
 * Same BN254 pi_b reversal as proofToProofPoints in passport-data-loader.ts.
 */
export function registrationProofToProofPoints(proof: any): ProofPoints {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}
