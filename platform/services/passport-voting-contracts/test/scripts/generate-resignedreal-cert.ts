/**
 * Re-sign real NID certificate TBS with our test CA key.
 *
 * The Noir circuit's parse_asn1 function has hardcoded assertions for the
 * exact ASN.1 structure of Iranian NID certificates (16-byte serial, specific
 * RDN fields: C, OU, givenName, surname, CN). Synthetic test certs don't match
 * this structure. This script takes the real NID signing cert's TBS bytes and
 * re-signs them with our test CA key, producing a cert that:
 *   - Has real NID ASN.1 structure (passes parse_asn1)
 *   - Has a signature we can verify (test CA modulus is known)
 *
 * Usage:
 *   npx ts-node test/scripts/generate-resignedreal-cert.ts
 *
 * Output:
 *   test/fixtures/resignedreal_leaf.der
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { AsnConvert } from "@peculiar/asn1-schema";
import { Certificate } from "@peculiar/asn1-x509";

const FIXTURES_DIR = path.join(__dirname, "../fixtures");
const TESTDATA_DIR = path.join(
  __dirname,
  "../../../../../mobile-Iranians.vote/testdata"
);

function main() {
  // 1. Load real NID signing certificate
  const certJson = JSON.parse(
    fs.readFileSync(path.join(TESTDATA_DIR, "nid-signing-cert-new.json"), "utf-8")
  );
  const realCertDer = Buffer.from(certJson.hex, "hex");
  console.log(`Loaded real NID cert: ${realCertDer.length} bytes`);

  // 2. Parse to extract TBS bytes
  const cert = AsnConvert.parse(realCertDer, Certificate);
  const tbsDer = Buffer.from(AsnConvert.serialize(cert.tbsCertificate));
  console.log(`TBS length: ${tbsDer.length} bytes`);

  if (tbsDer.length < 1080 || tbsDer.length > 1143) {
    console.warn(
      `WARNING: TBS length ${tbsDer.length} may be outside circuit's valid range (1080-1143)`
    );
  } else {
    console.log(`TBS length is in valid circuit range (1080-1143)`);
  }

  // 3. Load test CA private key
  const caKeyPem = fs.readFileSync(
    path.join(FIXTURES_DIR, "test_ca.key"),
    "utf-8"
  );

  // 4. Sign the real TBS with our test CA key (RSA-PKCS1v15-SHA256)
  const signer = crypto.createSign("SHA256");
  signer.update(tbsDer);
  const signature = signer.sign(caKeyPem);
  console.log(`Signature: ${signature.length} bytes`);

  // 5. Verify the signature with test CA public key (sanity check)
  const caCertPem = fs.readFileSync(
    path.join(FIXTURES_DIR, "test_ca.pem"),
    "utf-8"
  );
  const verifier = crypto.createVerify("SHA256");
  verifier.update(tbsDer);
  const verified = verifier.verify(caCertPem, signature);
  console.log(`Signature verification: ${verified ? "PASS" : "FAIL"}`);
  if (!verified) {
    throw new Error("Signature verification failed!");
  }

  // 6. Construct new DER certificate:
  //    SEQUENCE {
  //      tbsCertificate (real TBS bytes as-is),
  //      signatureAlgorithm (SHA256WithRSA),
  //      signatureValue (BIT STRING with our signature)
  //    }

  // SHA256WithRSA AlgorithmIdentifier (DER encoded)
  // SEQUENCE { OID 1.2.840.113549.1.1.11, NULL }
  const sigAlgDer = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x0b, 0x05, 0x00,
  ]);

  // BIT STRING wrapping signature: 03 82 0101 00 [256 bytes]
  const bitStringContent = Buffer.concat([Buffer.from([0x00]), signature]); // 0x00 = no unused bits
  const bitStringDer = Buffer.concat([
    Buffer.from([0x03]),
    encodeDerLength(bitStringContent.length),
    bitStringContent,
  ]);

  // Outer SEQUENCE
  const innerContent = Buffer.concat([tbsDer, sigAlgDer, bitStringDer]);
  const outerSequence = Buffer.concat([
    Buffer.from([0x30]),
    encodeDerLength(innerContent.length),
    innerContent,
  ]);

  // 7. Write the re-signed certificate
  const outputPath = path.join(FIXTURES_DIR, "resignedreal_leaf.der");
  fs.writeFileSync(outputPath, outerSequence);
  console.log(`\nWrote re-signed certificate: ${outputPath}`);
  console.log(`Total size: ${outerSequence.length} bytes`);

  // 8. Verify the new cert can be parsed
  const newCert = AsnConvert.parse(outerSequence, Certificate);
  const newTbs = Buffer.from(AsnConvert.serialize(newCert.tbsCertificate));
  console.log(`\nVerification:`);
  console.log(`  Parsed TBS length: ${newTbs.length} bytes`);
  console.log(`  TBS matches original: ${tbsDer.equals(newTbs)}`);

  // Double-check: verify signature on the re-assembled cert
  const verifier2 = crypto.createVerify("SHA256");
  verifier2.update(newTbs);
  const sig2 = Buffer.from(newCert.signatureValue);
  const verified2 = verifier2.verify(caCertPem, sig2);
  console.log(`  Re-parsed signature verification: ${verified2 ? "PASS" : "FAIL"}`);

  if (!verified2) {
    throw new Error("Re-parsed certificate signature verification failed!");
  }

  console.log("\nDone! Re-signed certificate is ready for circuit testing.");
}

/**
 * Encode a DER length value (supports lengths up to 65535).
 */
function encodeDerLength(length: number): Buffer {
  if (length < 128) {
    return Buffer.from([length]);
  } else if (length < 256) {
    return Buffer.from([0x81, length]);
  } else {
    return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
  }
}

main();
