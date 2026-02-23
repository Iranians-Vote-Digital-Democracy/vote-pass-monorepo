import * as fs from "fs";
import * as path from "path";

const EXTRACTED_DATA_DIR = path.resolve(__dirname, "../../../../../extracted_data");

export interface PassportData {
  version: number;
  type: "passport_data";
  exportedAt: string;
  dg1Hex: string;
  sodHex: string;
  digestAlgorithm: string;
  docSigningCertPem: string;
  personDetails: {
    name: string;
    surname: string;
    nationality: string;
    issuerAuthority: string;
    dateOfBirth: string;
    dateOfExpiry: string;
    documentNumber: string;
    gender: string;
  };
}

export interface ProofData {
  version: number;
  type: "proof_data";
  exportedAt: string;
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
  };
  pubSignals: string[];
  votingInputs: {
    registrationRootHex: string;
    currentDate: string;
    proposalEventId: string;
    nullifier: string;
    citizenship: string;
    identityCreationTimestamp: string;
    votes: string[];
  };
}

export interface ProofPoints {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

/** Check if any extracted data JSON files exist. */
export function hasExtractedData(): boolean {
  if (!fs.existsSync(EXTRACTED_DATA_DIR)) return false;
  const files = fs.readdirSync(EXTRACTED_DATA_DIR).filter((f) => f.endsWith(".json"));
  return files.length > 0;
}

/** Check if proof data specifically exists. */
export function hasProofData(): boolean {
  if (!fs.existsSync(EXTRACTED_DATA_DIR)) return false;
  return fs.readdirSync(EXTRACTED_DATA_DIR).some((f) => f.startsWith("proof-data") && f.endsWith(".json"));
}

/** Check if passport data specifically exists. */
export function hasPassportData(): boolean {
  if (!fs.existsSync(EXTRACTED_DATA_DIR)) return false;
  return fs.readdirSync(EXTRACTED_DATA_DIR).some((f) => f.startsWith("passport-data") && f.endsWith(".json"));
}

/** Load the most recent passport data JSON. */
export function loadPassportData(): PassportData {
  const files = fs
    .readdirSync(EXTRACTED_DATA_DIR)
    .filter((f) => f.startsWith("passport-data") && f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    throw new Error("No passport data files found in extracted_data/");
  }

  const latest = files[files.length - 1];
  return JSON.parse(fs.readFileSync(path.join(EXTRACTED_DATA_DIR, latest), "utf-8"));
}

/** Load the most recent proof data JSON. */
export function loadProofData(): ProofData {
  const files = fs
    .readdirSync(EXTRACTED_DATA_DIR)
    .filter((f) => f.startsWith("proof-data") && f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    throw new Error("No proof data files found in extracted_data/");
  }

  const latest = files[files.length - 1];
  return JSON.parse(fs.readFileSync(path.join(EXTRACTED_DATA_DIR, latest), "utf-8"));
}

/**
 * Convert snarkJS-style proof to contract ProofPoints struct.
 *
 * snarkJS proof format:
 *   pi_a: [x, y, "1"]  (3 elements, last is "1")
 *   pi_b: [[x1, x2], [y1, y2], ["1", "0"]]  (3 pairs, last is identity)
 *   pi_c: [x, y, "1"]  (3 elements, last is "1")
 *
 * Contract expects:
 *   a: [x, y]  (2 elements)
 *   b: [[x2, x1], [y2, y1]]  (2 pairs, NOTE: reversed within each pair for BN254)
 *   c: [x, y]  (2 elements)
 */
export function proofToProofPoints(proof: ProofData["proof"]): ProofPoints {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}
