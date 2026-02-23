import * as crypto from "crypto";

import { AsnConvert } from "@peculiar/asn1-schema";
import { ContentInfo, SignedData } from "@peculiar/asn1-cms";
import { Certificate } from "@peculiar/asn1-x509";

/**
 * ICAO 9303 LDS Security Object (LDSSecurityObject).
 *
 * The SOD encapContentInfo contains a DER-encoded LDSSecurityObject:
 *   LDSSecurityObject ::= SEQUENCE {
 *     version            INTEGER,
 *     hashAlgorithm      AlgorithmIdentifier,
 *     dataGroupHashValues SEQUENCE OF DataGroupHash
 *   }
 *
 * DataGroupHash ::= SEQUENCE {
 *     dataGroupNumber  INTEGER,
 *     dataGroupHashValue OCTET STRING
 *   }
 *
 * We parse this manually from the DER bytes since there's no @peculiar type for it.
 */

export interface DataGroupHash {
  dataGroupNumber: number;
  dataGroupHashValue: Buffer;
}

export interface LDSSecurityObject {
  version: number;
  hashAlgorithmOid: string;
  dataGroupHashes: DataGroupHash[];
}

export interface SODParseResult {
  signedData: SignedData;
  ldsSecurityObject: LDSSecurityObject;
  embeddedCertificate?: Certificate;
  signerInfo: {
    digestAlgorithmOid: string;
    signatureAlgorithmOid: string;
    signature: Buffer;
    signedAttrsRaw?: Buffer;
  };
}

export interface CertificateInfo {
  issuerCountry?: string;
  issuerOrg?: string;
  subjectCountry?: string;
  subjectOrg?: string;
  notBefore: Date;
  notAfter: Date;
  publicKeyAlgorithmOid: string;
  serialNumber: string;
}

/**
 * Well-known OID mappings for digest/signature algorithms.
 */
const OID_NAMES: Record<string, string> = {
  "2.16.840.1.101.3.4.2.1": "SHA-256",
  "2.16.840.1.101.3.4.2.2": "SHA-384",
  "2.16.840.1.101.3.4.2.3": "SHA-512",
  "1.3.14.3.2.26": "SHA-1",
  "1.2.840.113549.1.1.1": "RSA",
  "1.2.840.113549.1.1.5": "SHA1withRSA",
  "1.2.840.113549.1.1.11": "SHA256withRSA",
  "1.2.840.113549.1.1.12": "SHA384withRSA",
  "1.2.840.113549.1.1.13": "SHA512withRSA",
  "1.2.840.113549.1.1.10": "RSASSA-PSS",
  "1.2.840.10045.2.1": "EC",
  "1.2.840.10045.4.3.2": "ECDSA-SHA256",
};

function oidName(oid: string): string {
  return OID_NAMES[oid] ?? oid;
}

/**
 * Minimal DER parser — enough to extract the LDSSecurityObject fields.
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
 * Parse an OID from DER bytes.
 */
function parseOID(buf: Buffer): string {
  const parts: number[] = [];
  parts.push(Math.floor(buf[0] / 40));
  parts.push(buf[0] % 40);

  let value = 0;
  for (let i = 1; i < buf.length; i++) {
    value = (value << 7) | (buf[i] & 0x7f);
    if (!(buf[i] & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }

  return parts.join(".");
}

/**
 * Parse the LDSSecurityObject from raw DER bytes.
 */
function parseLDSSecurityObject(derBytes: Buffer): LDSSecurityObject {
  let offset = 0;

  // Outer SEQUENCE
  const outerSeq = parseDERTag(derBytes, offset);
  offset += outerSeq.headerLen;

  // version INTEGER
  const versionTag = parseDERTag(derBytes, offset);
  const version = derBytes[offset + versionTag.headerLen]; // single byte integer
  offset += versionTag.headerLen + versionTag.length;

  // hashAlgorithm AlgorithmIdentifier (SEQUENCE)
  const algoSeq = parseDERTag(derBytes, offset);
  const algoStart = offset + algoSeq.headerLen;
  // First element is OID
  const oidTag = parseDERTag(derBytes, algoStart);
  const hashAlgorithmOid = parseOID(derBytes.subarray(algoStart + oidTag.headerLen, algoStart + oidTag.headerLen + oidTag.length));
  offset += algoSeq.headerLen + algoSeq.length;

  // dataGroupHashValues SEQUENCE OF DataGroupHash
  const dgHashesSeq = parseDERTag(derBytes, offset);
  offset += dgHashesSeq.headerLen;
  const dgHashesEnd = offset + dgHashesSeq.length;

  const dataGroupHashes: DataGroupHash[] = [];
  while (offset < dgHashesEnd) {
    // DataGroupHash SEQUENCE
    const dgSeq = parseDERTag(derBytes, offset);
    let innerOffset = offset + dgSeq.headerLen;

    // dataGroupNumber INTEGER
    const dgNumTag = parseDERTag(derBytes, innerOffset);
    let dgNum = 0;
    for (let i = 0; i < dgNumTag.length; i++) {
      dgNum = (dgNum << 8) | derBytes[innerOffset + dgNumTag.headerLen + i];
    }
    innerOffset += dgNumTag.headerLen + dgNumTag.length;

    // dataGroupHashValue OCTET STRING
    const dgHashTag = parseDERTag(derBytes, innerOffset);
    const dgHashValue = Buffer.from(derBytes.subarray(innerOffset + dgHashTag.headerLen, innerOffset + dgHashTag.headerLen + dgHashTag.length));

    dataGroupHashes.push({ dataGroupNumber: dgNum, dataGroupHashValue: dgHashValue });
    offset += dgSeq.headerLen + dgSeq.length;
  }

  return { version, hashAlgorithmOid, dataGroupHashes };
}

/**
 * Strip the ICAO EF.SOD wrapper (tag 0x77) if present.
 *
 * Passport NFC chips return the SOD wrapped in an ICAO-specific tag:
 *   0x77 <length> <CMS ContentInfo>
 *
 * The actual CMS ContentInfo (tag 0x30 = SEQUENCE) is inside this wrapper.
 */
function stripICAOWrapper(sodBytes: Buffer): Buffer {
  if (sodBytes[0] === 0x77) {
    // Parse length of outer wrapper
    const { headerLen } = parseDERTag(sodBytes, 0);
    return sodBytes.subarray(headerLen);
  }
  return sodBytes;
}

/**
 * Extract the raw DER-encoded signedAttrs from a SignerInfo by re-serializing
 * and walking the DER structure.
 *
 * The signedAttrs in CMS SignerInfo use tag [0] IMPLICIT (0xa0). For signature
 * verification, this tag must be replaced with SET (0x31).
 */
function extractSignedAttrsDER(si: any): Buffer {
  const siDer = Buffer.from(new Uint8Array(AsnConvert.serialize(si)));

  // Walk SignerInfo SEQUENCE: version, sid, digestAlgorithm, then signedAttrs [0]
  let off = 0;
  const outerSeq = parseDERTag(siDer, off);
  off += outerSeq.headerLen;

  // 1. version INTEGER
  const ver = parseDERTag(siDer, off);
  off += ver.headerLen + ver.length;

  // 2. sid SignerIdentifier (SEQUENCE)
  const sid = parseDERTag(siDer, off);
  off += sid.headerLen + sid.length;

  // 3. digestAlgorithm AlgorithmIdentifier (SEQUENCE)
  const da = parseDERTag(siDer, off);
  off += da.headerLen + da.length;

  // 4. signedAttrs [0] (tag 0xa0)
  const next = parseDERTag(siDer, off);
  if (next.tag !== 0xa0) {
    throw new Error(`Expected signedAttrs tag 0xa0, got 0x${next.tag.toString(16)}`);
  }

  return Buffer.from(siDer.subarray(off, off + next.headerLen + next.length));
}

/**
 * Parse the SOD (Document Security Object) from hex-encoded DER bytes.
 *
 * The SOD is a CMS SignedData (RFC 5652) wrapping an ICAO LDSSecurityObject.
 * May be wrapped in an ICAO EF.SOD tag (0x77) which is stripped automatically.
 */
export function parseSOD(sodHex: string): SODParseResult {
  const hex = sodHex.startsWith("0x") ? sodHex.slice(2) : sodHex;
  const rawBytes = Buffer.from(hex, "hex");
  const sodBytes = stripICAOWrapper(rawBytes);

  const contentInfo = AsnConvert.parse(sodBytes, ContentInfo);
  const signedData = AsnConvert.parse(contentInfo.content, SignedData);

  // Parse encapsulated content (LDSSecurityObject)
  // OctetString from @peculiar/asn1-schema stores data in .buffer property
  const eContent = signedData.encapContentInfo.eContent;
  let ldsBytes: Buffer;
  if (eContent?.single) {
    const raw = (eContent.single as any).buffer ?? eContent.single;
    ldsBytes = Buffer.from(new Uint8Array(raw));
    if (ldsBytes.length === 0) {
      // Fallback: serialize and strip the OCTET STRING DER header
      const serialized = AsnConvert.serialize(eContent.single);
      const serBuf = Buffer.from(new Uint8Array(serialized));
      const { headerLen } = parseDERTag(serBuf, 0);
      ldsBytes = serBuf.subarray(headerLen);
    }
  } else if (eContent?.any) {
    ldsBytes = Buffer.from(new Uint8Array(eContent.any));
  } else {
    throw new Error("SOD has no encapsulated content");
  }

  const ldsSecurityObject = parseLDSSecurityObject(ldsBytes);

  // Extract embedded certificate if present
  let embeddedCertificate: Certificate | undefined;
  if (signedData.certificates && signedData.certificates.length > 0) {
    embeddedCertificate = signedData.certificates[0].certificate;
  }

  // Extract signer info
  const si = signedData.signerInfos[0];

  // OctetString/ArrayBuffer extraction helper
  const toBuffer = (val: any): Buffer => {
    if (val.buffer) return Buffer.from(new Uint8Array(val.buffer));
    if (val instanceof ArrayBuffer) return Buffer.from(new Uint8Array(val));
    return Buffer.from(val);
  };

  // Extract signedAttrs DER from the re-serialized SignerInfo.
  // The library parses signedAttrs but doesn't always preserve signedAttrsRaw,
  // so we re-serialize and walk the DER structure to extract the [0] IMPLICIT block.
  let signedAttrsRaw: Buffer | undefined;
  if (si.signedAttrs && si.signedAttrs.length > 0) {
    if (si.signedAttrsRaw) {
      signedAttrsRaw = Buffer.from(new Uint8Array(si.signedAttrsRaw));
    } else {
      signedAttrsRaw = extractSignedAttrsDER(si);
    }
  }

  const signerInfo = {
    digestAlgorithmOid: si.digestAlgorithm.algorithm,
    signatureAlgorithmOid: si.signatureAlgorithm.algorithm,
    signature: toBuffer(si.signature),
    signedAttrsRaw,
  };

  return { signedData, ldsSecurityObject, embeddedCertificate, signerInfo };
}

/**
 * Verify that the DG1 hash in the SOD matches the actual DG1 data.
 *
 * This is the core "passive authentication" check: the DG1 data read from NFC
 * must hash to the value stored in the cryptographically signed SOD.
 */
export function verifyDG1Hash(sodHex: string, dg1Hex: string): boolean {
  const { ldsSecurityObject } = parseSOD(sodHex);

  const dg1Hex_ = dg1Hex.startsWith("0x") ? dg1Hex.slice(2) : dg1Hex;
  const dg1Bytes = Buffer.from(dg1Hex_, "hex");

  const hashAlgoName = oidName(ldsSecurityObject.hashAlgorithmOid);
  const nodeHashAlgo = hashAlgoName.replace("-", "").toLowerCase(); // "SHA-256" → "sha256"

  const dg1Hash = crypto.createHash(nodeHashAlgo).update(dg1Bytes).digest();

  const dg1Entry = ldsSecurityObject.dataGroupHashes.find((dg) => dg.dataGroupNumber === 1);
  if (!dg1Entry) {
    throw new Error("SOD does not contain a DG1 hash entry");
  }

  return dg1Hash.equals(dg1Entry.dataGroupHashValue);
}

/**
 * Verify the SOD signature using the document signing certificate.
 *
 * The signer info's signedAttrs (if present) are hashed and checked against
 * the signature using the certificate's RSA public key.
 *
 * Returns true if the signature is valid.
 */
export function verifySODSignature(sodHex: string, certPem: string): boolean {
  const { signerInfo, signedData, ldsSecurityObject } = parseSOD(sodHex);

  const sigAlgoName = oidName(signerInfo.signatureAlgorithmOid);
  const digestAlgoName = oidName(signerInfo.digestAlgorithmOid);
  const nodeDigest = digestAlgoName.replace("-", "").toLowerCase();

  // Determine what data was signed
  let dataToVerify: Buffer;
  if (signerInfo.signedAttrsRaw) {
    // When signedAttrs are present, the signature is over the DER-encoded signedAttrs
    // with tag changed to SET (0x31) instead of IMPLICIT [0] (0xa0)
    dataToVerify = Buffer.from(signerInfo.signedAttrsRaw);
    if (dataToVerify[0] === 0xa0) {
      dataToVerify = Buffer.from(dataToVerify); // copy
      dataToVerify[0] = 0x31; // SET tag
    }
  } else {
    // When no signedAttrs, signature is directly over the encapsulated content
    const eContent = signedData.encapContentInfo.eContent;
    if (eContent?.single) {
      const raw = (eContent.single as any).buffer ?? eContent.single;
      dataToVerify = Buffer.from(new Uint8Array(raw));
      if (dataToVerify.length === 0) {
        const serialized = AsnConvert.serialize(eContent.single);
        const serBuf = Buffer.from(new Uint8Array(serialized));
        const { headerLen: hLen } = parseDERTag(serBuf, 0);
        dataToVerify = serBuf.subarray(hLen);
      }
    } else if (eContent?.any) {
      dataToVerify = Buffer.from(new Uint8Array(eContent.any));
    } else {
      throw new Error("No data to verify signature over");
    }
  }

  // Build the public key from PEM
  const publicKey = crypto.createPublicKey(normalizePEM(certPem));

  // Verify signature
  if (sigAlgoName === "RSASSA-PSS") {
    const verify = crypto.createVerify(nodeDigest);
    verify.update(dataToVerify);
    return verify.verify(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO,
      },
      signerInfo.signature,
    );
  } else {
    // Standard PKCS#1 v1.5 or ECDSA
    const verify = crypto.createVerify(nodeDigest);
    verify.update(dataToVerify);
    return verify.verify(publicKey, signerInfo.signature);
  }
}

/**
 * Normalize a PEM string to ensure proper formatting.
 * Some exporters omit the trailing newline before -----END.
 */
function normalizePEM(pem: string): string {
  // Ensure newline before -----END
  return pem.replace(/([^\n])(-----END)/g, "$1\n$2");
}

/**
 * Extract human-readable information from a PEM-encoded X.509 certificate.
 */
export function extractCertificateInfo(certPem: string): CertificateInfo {
  // Use Node's X509Certificate for high-level info
  const x509 = new crypto.X509Certificate(normalizePEM(certPem));

  // Parse country from issuer/subject strings like "C=US\nO=State Department"
  const parseField = (dn: string, field: string): string | undefined => {
    const match = dn.match(new RegExp(`${field}=([^\\n]+)`));
    return match ? match[1].trim() : undefined;
  };

  return {
    issuerCountry: parseField(x509.issuer, "C"),
    issuerOrg: parseField(x509.issuer, "O"),
    subjectCountry: parseField(x509.subject, "C"),
    subjectOrg: parseField(x509.subject, "O"),
    notBefore: new Date(x509.validFrom),
    notAfter: new Date(x509.validTo),
    publicKeyAlgorithmOid: x509.publicKey.asymmetricKeyType ?? "unknown",
    serialNumber: x509.serialNumber,
  };
}
