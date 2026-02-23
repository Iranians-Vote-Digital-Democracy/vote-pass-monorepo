import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { AsnConvert } from "@peculiar/asn1-schema";
import { ContentInfo, SignedData } from "@peculiar/asn1-cms";
import { Poseidon } from "@iden3/js-crypto";
import MerkleTree from "merkletreejs";
import { keccak256 as ethersKeccak256 } from "ethers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainVerificationResult {
  signatureValid: boolean;
  issuerMatch: boolean;
  akiSkiMatch: boolean | null; // null if extensions not present
  dsCertValid: boolean;
  cscaValid: boolean;
}

// ---------------------------------------------------------------------------
// DS Cert → CSCA signature verification
// ---------------------------------------------------------------------------

/**
 * Verify that a Document Signing certificate was signed by a CSCA.
 *
 * Uses Node.js `crypto.X509Certificate.verify()` to check the DS cert's
 * signature against the CSCA's public key.
 */
export function verifyDSCertSignedByCSCA(dsCertPem: string, cscaCertPem: string): boolean {
  const dsCert = new crypto.X509Certificate(normalizePEM(dsCertPem));
  const cscaCert = new crypto.X509Certificate(normalizePEM(cscaCertPem));
  return dsCert.verify(cscaCert.publicKey);
}

/**
 * Comprehensive certificate chain verification between DS cert and CSCA.
 *
 * Checks:
 * - DS cert signature was made by the CSCA's key
 * - DS cert issuer DN matches CSCA subject DN
 * - Authority/Subject Key Identifier linkage (if extensions present)
 * - Both certificates are within their validity period
 */
export function verifyCertificateChain(
  dsCertPem: string,
  cscaCertPem: string,
): ChainVerificationResult {
  const dsCert = new crypto.X509Certificate(normalizePEM(dsCertPem));
  const cscaCert = new crypto.X509Certificate(normalizePEM(cscaCertPem));

  // 1. Signature verification
  let signatureValid = false;
  try {
    signatureValid = dsCert.verify(cscaCert.publicKey);
  } catch {
    signatureValid = false;
  }

  // 2. Issuer/Subject DN match
  const issuerMatch = normalizeDN(dsCert.issuer) === normalizeDN(cscaCert.subject);

  // 3. AKI/SKI match (may not be present on all certs)
  const aki = (dsCert as any).authorityKeyIdentifier as string | undefined;
  const ski = (cscaCert as any).subjectKeyIdentifier as string | undefined;
  let akiSkiMatch: boolean | null = null;
  if (aki && ski) {
    akiSkiMatch = aki.toUpperCase().includes(ski.toUpperCase());
  }

  // 4. Validity period checks
  const now = new Date();
  const dsCertValid =
    new Date(dsCert.validFrom) <= now && now <= new Date(dsCert.validTo);
  const cscaValid =
    new Date(cscaCert.validFrom) <= now && now <= new Date(cscaCert.validTo);

  return { signatureValid, issuerMatch, akiSkiMatch, dsCertValid, cscaValid };
}

// ---------------------------------------------------------------------------
// ICAO Master List Authenticity (CMS signature verification)
// ---------------------------------------------------------------------------

export interface ICAOMLVerificationResult {
  /** CMS signature over the ML content is valid */
  signatureValid: boolean;
  /** ML Signer cert was signed by the UN CSCA */
  signerCertValid: boolean;
  /** UN CSCA is self-signed */
  unCSCASelfSigned: boolean;
  /** ML Signer cert subject/issuer info */
  signerSubject: string;
  signerIssuer: string;
  /** UN CSCA subject info */
  unCSCASubject: string;
  /** Validity periods */
  signerCertWithinValidity: boolean;
  unCSCAWithinValidity: boolean;
  /** Number of CSCA certificates in the Master List content */
  cscaCount: number;
}

/**
 * Verify the ICAO Master List CMS envelope signature.
 *
 * The ML file is a CMS SignedData (RFC 5652) containing:
 * - Content: MasterList ASN.1 structure with CSCA certificates
 * - Signer: "ICAO Master List Signer" certificate
 * - CA: "United Nations CSCA" (self-signed root)
 *
 * This function verifies:
 * 1. The CMS signature over the signedAttrs is valid (using the ML Signer cert)
 * 2. The ML Signer cert was signed by the UN CSCA
 * 3. The UN CSCA is self-signed
 *
 * @param mlDerPath Path to the ICAO Master List .ml file (DER-encoded CMS)
 */
export function verifyICAOMLAuthenticity(mlDerPath: string): ICAOMLVerificationResult {
  const der = fs.readFileSync(mlDerPath);
  const contentInfo = AsnConvert.parse(der, ContentInfo);
  const signedData = AsnConvert.parse(contentInfo.content, SignedData);

  // Extract embedded certificates
  const certs = extractCMSCertificates(signedData);
  if (certs.length < 2) {
    throw new Error(`Expected at least 2 certificates in CMS, found ${certs.length}`);
  }

  // Identify signer cert (OU=Master List Signers) and CA cert (OU=Certification Authorities)
  const signerCert = certs.find((c) => c.x509.subject.includes("Master List Signers"));
  const caCert = certs.find((c) =>
    c.x509.subject.includes("Certification Authorities") &&
    c.x509.subject.includes("United Nations"),
  );

  if (!signerCert) throw new Error("ICAO ML Signer certificate not found in CMS");
  if (!caCert) throw new Error("UN CSCA certificate not found in CMS");

  // 1. Verify CMS signature
  const signatureValid = verifyCMSSignature(signedData, signerCert.pem);

  // 2. Verify signer cert was signed by UN CSCA
  let signerCertValid = false;
  try {
    signerCertValid = signerCert.x509.verify(caCert.x509.publicKey);
  } catch {
    signerCertValid = false;
  }

  // 3. Verify UN CSCA is self-signed
  let unCSCASelfSigned = false;
  try {
    unCSCASelfSigned = caCert.x509.verify(caCert.x509.publicKey);
  } catch {
    unCSCASelfSigned = false;
  }

  // 4. Validity checks
  const now = new Date();
  const signerCertWithinValidity =
    new Date(signerCert.x509.validFrom) <= now &&
    now <= new Date(signerCert.x509.validTo);
  const unCSCAWithinValidity =
    new Date(caCert.x509.validFrom) <= now &&
    now <= new Date(caCert.x509.validTo);

  // 5. Count CSCA certs in the ML content
  let cscaCount = 0;
  try {
    const eContent = signedData.encapContentInfo.eContent;
    if (eContent?.single) {
      const raw = (eContent.single as any).buffer ?? eContent.single;
      let contentBuf = Buffer.from(new Uint8Array(raw));
      if (contentBuf.length === 0) {
        const serialized = AsnConvert.serialize(eContent.single);
        const serBuf = Buffer.from(new Uint8Array(serialized));
        const { headerLen } = parseDERTag(serBuf, 0);
        contentBuf = serBuf.subarray(headerLen);
      }
      cscaCount = countCertificatesInMasterList(contentBuf);
    }
  } catch {
    // Best effort
  }

  return {
    signatureValid,
    signerCertValid,
    unCSCASelfSigned,
    signerSubject: signerCert.x509.subject,
    signerIssuer: signerCert.x509.issuer,
    unCSCASubject: caCert.x509.subject,
    signerCertWithinValidity,
    unCSCAWithinValidity,
    cscaCount,
  };
}

/**
 * Check if the ICAO Master List .ml file exists.
 */
export function hasICAOMasterList(): boolean {
  return fs.existsSync(path.join(ICAO_DIR, "ICAO_ml_December2025.ml"));
}

/**
 * Get the path to the ICAO Master List .ml file.
 */
export function getICAOMasterListPath(): string {
  return path.join(ICAO_DIR, "ICAO_ml_December2025.ml");
}

/**
 * Extract the ICAO ML Signer and UN CSCA certificates from the ML CMS envelope.
 */
export function extractICAOMLCertificates(mlDerPath: string): {
  signerPem: string;
  unCSCAPem: string;
} {
  const der = fs.readFileSync(mlDerPath);
  const contentInfo = AsnConvert.parse(der, ContentInfo);
  const signedData = AsnConvert.parse(contentInfo.content, SignedData);

  const certs = extractCMSCertificates(signedData);
  const signer = certs.find((c) => c.x509.subject.includes("Master List Signers"));
  const ca = certs.find((c) =>
    c.x509.subject.includes("Certification Authorities") &&
    c.x509.subject.includes("United Nations"),
  );

  if (!signer) throw new Error("ICAO ML Signer certificate not found");
  if (!ca) throw new Error("UN CSCA certificate not found");

  return { signerPem: signer.pem, unCSCAPem: ca.pem };
}

// ---------------------------------------------------------------------------
// CMS signature verification (internal)
// ---------------------------------------------------------------------------

interface CMSCertInfo {
  pem: string;
  x509: crypto.X509Certificate;
}

function extractCMSCertificates(signedData: SignedData): CMSCertInfo[] {
  const result: CMSCertInfo[] = [];
  if (!signedData.certificates) return result;

  for (const certChoice of signedData.certificates) {
    const cert = certChoice.certificate;
    if (!cert) continue;

    const certDer = Buffer.from(new Uint8Array(AsnConvert.serialize(cert)));
    const b64 = certDer.toString("base64");
    const lines = b64.match(/.{1,64}/g) || [];
    const pem = `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;

    try {
      const x509 = new crypto.X509Certificate(pem);
      result.push({ pem, x509 });
    } catch {
      // Skip unparseable certs
    }
  }

  return result;
}

function verifyCMSSignature(signedData: SignedData, signerCertPem: string): boolean {
  const si = signedData.signerInfos[0];
  const publicKey = crypto.createPublicKey(normalizePEM(signerCertPem));

  // Extract signature bytes
  const sigBuf = (() => {
    const val = si.signature;
    if ((val as any).buffer) return Buffer.from(new Uint8Array((val as any).buffer));
    if (val instanceof ArrayBuffer) return Buffer.from(new Uint8Array(val));
    return Buffer.from(val as any);
  })();

  // Extract signedAttrs DER from the re-serialized SignerInfo
  const siDer = Buffer.from(new Uint8Array(AsnConvert.serialize(si)));

  let off = 0;
  const outerSeq = parseDERTag(siDer, off);
  off += outerSeq.headerLen;

  // version INTEGER
  const ver = parseDERTag(siDer, off);
  off += ver.headerLen + ver.length;

  // sid SignerIdentifier
  const sid = parseDERTag(siDer, off);
  off += sid.headerLen + sid.length;

  // digestAlgorithm
  const da = parseDERTag(siDer, off);
  off += da.headerLen + da.length;

  // signedAttrs [0] (tag 0xa0)
  const saTag = parseDERTag(siDer, off);
  if (saTag.tag !== 0xa0) {
    return false;
  }

  const saRaw = Buffer.from(siDer.subarray(off, off + saTag.headerLen + saTag.length));
  // Replace tag 0xa0 with 0x31 (SET) for signature verification per RFC 5652
  const saForVerify = Buffer.from(saRaw);
  saForVerify[0] = 0x31;

  // Determine digest algorithm from SignerInfo
  const digestOid = si.digestAlgorithm.algorithm;
  const digestName = digestOid === "2.16.840.1.101.3.4.2.1" ? "sha256" :
                     digestOid === "2.16.840.1.101.3.4.2.2" ? "sha384" :
                     digestOid === "2.16.840.1.101.3.4.2.3" ? "sha512" : "sha256";

  try {
    const verify = crypto.createVerify(digestName);
    verify.update(saForVerify);
    return verify.verify(publicKey, sigBuf);
  } catch {
    return false;
  }
}

function countCertificatesInMasterList(contentBuf: Buffer): number {
  // MasterList: SEQUENCE { version INTEGER, certList SET OF Certificate }
  const outerSeq = parseDERTag(contentBuf, 0);
  let off = outerSeq.headerLen;

  // Skip version
  const verTag = parseDERTag(contentBuf, off);
  off += verTag.headerLen + verTag.length;

  // SET OF Certificate
  const setTag = parseDERTag(contentBuf, off);
  let certOff = off + setTag.headerLen;
  const setEnd = off + setTag.headerLen + setTag.length;

  let count = 0;
  while (certOff < setEnd) {
    const certTag = parseDERTag(contentBuf, certOff);
    certOff += certTag.headerLen + certTag.length;
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// ICAO Merkle Tree (Keccak256, matches Registration2.sol)
// ---------------------------------------------------------------------------

/**
 * Build a Keccak256 Merkle tree from CSCA public key bytes.
 *
 * Matches Registration2.registerCertificate():
 *   `icaoMerkleProof_.processProof(keccak256(icaoMember_.publicKey))`
 *
 * Uses OpenZeppelin's MerkleProof convention: sorted pairs.
 *
 * @param cscaCertPems Array of PEM-encoded CSCA certificates
 * @returns Tree root and proof generator
 */
export function buildICAOMerkleTree(cscaCertPems: string[]): {
  root: string;
  getProof: (certPem: string) => string[];
  leaves: string[];
} {
  const keccak256 = (data: Buffer) => {
    const hash = ethersKeccak256(data);
    return Buffer.from(hash.slice(2), "hex");
  };

  // Leaf = keccak256(raw public key bytes in DER/SPKI format)
  const leaves = cscaCertPems.map((pem) => {
    const pubKeyBytes = extractRawPublicKeyBytes(pem);
    return keccak256(pubKeyBytes);
  });

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  return {
    root: tree.getHexRoot(),
    getProof: (certPem: string) => {
      const pubKeyBytes = extractRawPublicKeyBytes(certPem);
      const leaf = keccak256(pubKeyBytes);
      return tree.getHexProof(leaf);
    },
    leaves: leaves.map((l) => "0x" + l.toString("hex")),
  };
}

// ---------------------------------------------------------------------------
// Certificate Key (Poseidon hash, matches Bytes2Poseidon.hashPacked)
// ---------------------------------------------------------------------------

/**
 * Compute the Poseidon "certificate key" for a DS cert's RSA public key.
 *
 * Matches `CRSADispatcher.getCertificateKey()` which calls
 * `Bytes2Poseidon.hashPacked()`.
 *
 * hashPacked() reads the last 120 bytes of the key, takes 5 groups of 3×8-byte
 * chunks from the end, reverses the chunk order within each group, and feeds
 * the 5 resulting values into Poseidon5.
 *
 * This is equivalent to the per-passport circuit's `pkHash` computation:
 *   pkArr15 = bigintToChunks(64, 15, modulus)  // 15 × 64-bit LE limbs
 *   poseidonInputs[i] = pkArr15[3i] * 2^128 + pkArr15[3i+1] * 2^64 + pkArr15[3i+2]
 *   pkHash = Poseidon5(poseidonInputs)
 */
export function computeCertificateKey(certPem: string): bigint {
  const modulus = extractRSAModulus(certPem);
  return computeCertificateKeyFromModulus(modulus);
}

/**
 * Compute certificate key from an RSA modulus bigint.
 */
export function computeCertificateKeyFromModulus(modulus: bigint): bigint {
  const pkArr15 = bigintToChunks(64, 15, modulus).map(BigInt);
  const poseidonInputs: bigint[] = [];
  for (let i = 0; i < 5; i++) {
    poseidonInputs.push(
      pkArr15[3 * i] * (1n << 128n) +
        pkArr15[3 * i + 1] * (1n << 64n) +
        pkArr15[3 * i + 2],
    );
  }
  return Poseidon.hash(poseidonInputs);
}

// ---------------------------------------------------------------------------
// Certificates SMT (Poseidon, matches PoseidonSMT on-chain)
// ---------------------------------------------------------------------------

/**
 * Compute the "slave Merkle root" (certificatesRoot) from a certificate key.
 *
 * This is the stub SMT root used when a single certificate is registered:
 *   root = Poseidon([pkHash, pkHash, 1])
 *
 * Matches the per-passport circuit's slaveMerkleRoot computation.
 */
export function computeCertificatesRoot(certificateKey: bigint): bigint {
  return Poseidon.hash([certificateKey, certificateKey, 1n]);
}

// ---------------------------------------------------------------------------
// ICAO Master List parsing
// ---------------------------------------------------------------------------

/**
 * Load all CSCA certificates from the extracted ICAO Master List content.
 *
 * @param contentDerPath Path to the extracted master_list_content.der
 * @returns Array of PEM-encoded CSCA certificates
 */
export function loadAllCSCACerts(contentDerPath: string): string[] {
  const der = fs.readFileSync(contentDerPath);
  const certs: string[] = [];

  // MasterList: SEQUENCE { version INTEGER, certList SET OF Certificate }
  const outerSeq = parseDERTag(der, 0);
  let off = outerSeq.headerLen;

  // Skip version INTEGER
  const verTag = parseDERTag(der, off);
  off += verTag.headerLen + verTag.length;

  // SET OF Certificate
  const setTag = parseDERTag(der, off);
  let certOff = off + setTag.headerLen;
  const setEnd = off + setTag.headerLen + setTag.length;

  while (certOff < setEnd) {
    const certTag = parseDERTag(der, certOff);
    const certDer = der.subarray(certOff, certOff + certTag.headerLen + certTag.length);

    try {
      const b64 = certDer.toString("base64");
      const lines = b64.match(/.{1,64}/g) || [];
      const pem = `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
      // Validate it parses
      new crypto.X509Certificate(pem);
      certs.push(pem);
    } catch {
      // Skip unparseable certs
    }

    certOff += certTag.headerLen + certTag.length;
  }

  return certs;
}

/**
 * Filter CSCA certificates by country code.
 */
export function filterCSCAByCountry(certs: string[], countryCode: string): string[] {
  return certs.filter((pem) => {
    try {
      const x509 = new crypto.X509Certificate(pem);
      const match = x509.issuer.match(/C=([A-Z]{2})/);
      return match && match[1] === countryCode.toUpperCase();
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Fixture loading helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const ICAO_DIR = path.join(FIXTURES_DIR, "icao");

/**
 * Check if the US CSCA certificate fixture exists.
 */
export function hasUSCSCA(): boolean {
  return fs.existsSync(path.join(FIXTURES_DIR, "us-csca.pem"));
}

/**
 * Load the US CSCA certificate from test fixtures.
 * Returns the first certificate if multiple are concatenated.
 */
export function loadUSCSCA(): string {
  const content = fs.readFileSync(path.join(FIXTURES_DIR, "us-csca.pem"), "utf-8");
  // If multiple certs are concatenated, return just the first one
  const match = content.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/,
  );
  if (!match) throw new Error("No certificate found in us-csca.pem");
  return match[0];
}

/**
 * Check if the ICAO Master List content has been extracted.
 */
export function hasICAOMasterListContent(): boolean {
  return fs.existsSync(path.join(ICAO_DIR, "master_list_content.der"));
}

/**
 * Get the path to the ICAO Master List content file.
 */
export function getICAOMasterListContentPath(): string {
  return path.join(ICAO_DIR, "master_list_content.der");
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function normalizePEM(pem: string): string {
  return pem.replace(/([^\n])(-----END)/g, "$1\n$2");
}

function normalizeDN(dn: string): string {
  return dn
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

function parseDERTag(
  buf: Buffer,
  offset: number,
): { tag: number; length: number; headerLen: number } {
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
 * Extract raw public key bytes from a PEM certificate.
 * Returns the DER-encoded SubjectPublicKeyInfo.
 */
function extractRawPublicKeyBytes(certPem: string): Buffer {
  const publicKey = crypto.createPublicKey(normalizePEM(certPem));
  const spki = publicKey.export({ type: "spki", format: "der" });
  return Buffer.from(spki);
}

/**
 * Extract the RSA modulus from a PEM certificate as a bigint.
 */
function extractRSAModulus(certPem: string): bigint {
  const publicKey = crypto.createPublicKey(normalizePEM(certPem));
  const keyDer = Buffer.from(publicKey.export({ type: "pkcs1", format: "der" }));

  // PKCS#1 DER: SEQUENCE { INTEGER modulus, INTEGER exponent }
  let off = 0;
  const keySeq = parseDERTag(keyDer, off);
  off += keySeq.headerLen;

  // modulus INTEGER
  const modTag = parseDERTag(keyDer, off);
  let modBytes = keyDer.subarray(off + modTag.headerLen, off + modTag.headerLen + modTag.length);
  // Strip leading zero byte (DER INTEGER is signed)
  if (modBytes[0] === 0x00 && modBytes.length > 256) {
    modBytes = modBytes.subarray(1);
  }

  return BigInt("0x" + modBytes.toString("hex"));
}

/**
 * Split a big integer into k chunks of n bits each (little-endian limb order).
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
