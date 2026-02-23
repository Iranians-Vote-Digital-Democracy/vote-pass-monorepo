/**
 * Extract CSCA certificates from the ICAO Master List content.
 *
 * Usage: npx ts-node test/fixtures/icao/extract-csca.ts [COUNTRY_CODE]
 *
 * The ML content (master_list_content.der) is extracted from the CMS envelope via:
 *   openssl cms -inform DER -in ICAO_ml_December2025.ml -verify -noverify -nosigs -out master_list_content.der
 *
 * The MasterList ASN.1 structure:
 *   MasterList ::= SEQUENCE {
 *     version     INTEGER,
 *     certList    SET OF Certificate
 *   }
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

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

const dir = __dirname;
const contentPath = path.join(dir, "master_list_content.der");
const countryFilter = process.argv[2]?.toUpperCase() || "US";

const der = fs.readFileSync(contentPath);

// Parse outer SEQUENCE
const outerSeq = parseDERTag(der, 0);
let off = outerSeq.headerLen;

// version INTEGER
const verTag = parseDERTag(der, off);
off += verTag.headerLen + verTag.length;

// SET OF Certificate
const setTag = parseDERTag(der, off);
let certOff = off + setTag.headerLen;
const setEnd = off + setTag.headerLen + setTag.length;

console.log(`Master List version: parsed`);
console.log(`Certificate SET: ${setTag.length} bytes, offset ${certOff}-${setEnd}`);
console.log(`Filtering for country: ${countryFilter}\n`);

let certIndex = 0;
const matchingCerts: { index: number; pem: string; subject: string; issuer: string; serial: string; validFrom: string; validTo: string; keyType: string }[] = [];

while (certOff < setEnd) {
  const certTag = parseDERTag(der, certOff);
  const certDer = der.subarray(certOff, certOff + certTag.headerLen + certTag.length);

  try {
    // Convert to PEM
    const b64 = certDer.toString("base64");
    const lines = b64.match(/.{1,64}/g) || [];
    const pem = `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;

    const x509 = new crypto.X509Certificate(pem);

    // Check if country matches
    const countryMatch = x509.issuer.match(/C=([A-Z]{2})/);
    const country = countryMatch ? countryMatch[1] : "??";

    if (country === countryFilter) {
      matchingCerts.push({
        index: certIndex,
        pem,
        subject: x509.subject,
        issuer: x509.issuer,
        serial: x509.serialNumber,
        validFrom: x509.validFrom,
        validTo: x509.validTo,
        keyType: x509.publicKey.asymmetricKeyType || "unknown",
      });
    }
  } catch (e: any) {
    // Skip unparseable certs
  }

  certOff += certTag.headerLen + certTag.length;
  certIndex++;
}

console.log(`Total certificates scanned: ${certIndex}`);
console.log(`Matching ${countryFilter} certificates: ${matchingCerts.length}\n`);

for (const cert of matchingCerts) {
  console.log(`--- Certificate #${cert.index} ---`);
  console.log(`  Subject: ${cert.subject}`);
  console.log(`  Issuer:  ${cert.issuer}`);
  console.log(`  Serial:  ${cert.serial}`);
  console.log(`  Valid:   ${cert.validFrom} → ${cert.validTo}`);
  console.log(`  Key:     ${cert.keyType}`);

  // Save each matching cert
  const filename = `csca-${countryFilter.toLowerCase()}-${cert.serial.slice(0, 8)}.pem`;
  fs.writeFileSync(path.join(dir, filename), cert.pem + "\n");
  console.log(`  Saved:   ${filename}\n`);
}

// If any match, also save the first one as the default
if (matchingCerts.length > 0) {
  const defaultFile = `csca-${countryFilter.toLowerCase()}.pem`;
  // Save all matching certs concatenated
  const allPems = matchingCerts.map((c) => c.pem).join("\n\n") + "\n";
  fs.writeFileSync(path.join(dir, defaultFile), allPems);
  console.log(`All ${countryFilter} CSCAs saved to: ${defaultFile}`);
}
