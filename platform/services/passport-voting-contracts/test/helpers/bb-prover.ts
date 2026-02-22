/**
 * Proof generation and verification using the `bb` CLI (Barretenberg native binary).
 *
 * The @noir-lang/backend_barretenberg npm package (max 0.36.0) cannot parse
 * Noir 1.0.0-beta.x bytecode. The `bb` CLI v0.66.0 is the correct version
 * for our circuits and handles proof generation natively.
 *
 * Flow:
 * 1. Generate witness via noir_js (ACVM handles 1.0.0 bytecode)
 * 2. Write witness Uint8Array to a temp .gz file
 * 3. Call `bb prove` / `bb write_vk` / `bb verify` via child_process
 * 4. Read results back
 *
 * IMPORTANT: Uses UltraPlonk (`bb prove`), NOT UltraHonk (`bb prove_ultra_honk`).
 * Our on-chain verifier (NoirTD1Verifier_ID_Card_I.sol) uses BaseUltraVerifier.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BB_PATH = path.join(os.homedir(), ".bb", "bb");

/**
 * Check that the bb CLI is installed and accessible.
 * Throws if not found.
 */
export function checkBBInstalled(): string {
  if (!fs.existsSync(BB_PATH)) {
    throw new Error(
      `bb CLI not found at ${BB_PATH}. Install with: curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/installation/install | bash && bbup -v 0.66.0`
    );
  }
  const version = execSync(`${BB_PATH} --version`, { encoding: "utf-8" }).trim();
  return version;
}

/**
 * Generate a proof using the bb CLI.
 *
 * @param circuitPath - Path to the circuit JSON file (byte_code.json)
 * @param witness - Raw witness bytes from noir_js execute() (gzip-compressed bincode WitnessStack)
 * @returns The raw proof bytes
 */
export function generateProofWithBB(
  circuitPath: string,
  witness: Uint8Array
): Buffer {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-prove-"));

  try {
    const witnessPath = path.join(tmpDir, "witness.gz");
    const proofPath = path.join(tmpDir, "proof");

    // Write witness directly - noir_js returns gzip-compressed bincode WitnessStack
    fs.writeFileSync(witnessPath, witness);

    // Generate proof (UltraPlonk)
    execSync(
      `${BB_PATH} prove -b ${circuitPath} -w ${witnessPath} -o ${proofPath}`,
      {
        encoding: "utf-8",
        timeout: 300000, // 5 minutes
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    if (!fs.existsSync(proofPath)) {
      throw new Error("bb prove did not produce a proof file");
    }

    return fs.readFileSync(proofPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Write a verification key for a circuit using bb CLI.
 *
 * @param circuitPath - Path to the circuit JSON file (byte_code.json)
 * @returns The raw VK bytes
 */
export function writeVKWithBB(circuitPath: string): Buffer {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-vk-"));

  try {
    const vkPath = path.join(tmpDir, "vk");

    execSync(`${BB_PATH} write_vk -b ${circuitPath} -o ${vkPath}`, {
      encoding: "utf-8",
      timeout: 300000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (!fs.existsSync(vkPath)) {
      throw new Error("bb write_vk did not produce a VK file");
    }

    return fs.readFileSync(vkPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Verify a proof using the bb CLI.
 *
 * @param circuitPath - Path to the circuit JSON file (byte_code.json)
 * @param proof - Raw proof bytes from generateProofWithBB
 * @returns true if valid, false if invalid
 */
export function verifyProofWithBB(
  circuitPath: string,
  proof: Buffer
): boolean {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-verify-"));

  try {
    const proofPath = path.join(tmpDir, "proof");
    const vkPath = path.join(tmpDir, "vk");

    // Write proof
    fs.writeFileSync(proofPath, proof);

    // Generate VK
    execSync(`${BB_PATH} write_vk -b ${circuitPath} -o ${vkPath}`, {
      encoding: "utf-8",
      timeout: 300000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Verify
    try {
      execSync(`${BB_PATH} verify -p ${proofPath} -k ${vkPath}`, {
        encoding: "utf-8",
        timeout: 120000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return true;
    } catch {
      return false;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
