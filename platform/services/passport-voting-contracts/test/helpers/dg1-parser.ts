/**
 * DG1 MRZ Parser for TD3 (Passport) documents.
 *
 * ICAO 9303 Part 4: DG1 contains the Machine Readable Zone (MRZ).
 * TD3 format: 2 lines x 44 characters = 88 characters.
 *
 * DG1 structure (93 bytes total):
 *   Byte 0:    Tag (0x61)
 *   Byte 1:    Length of remaining (0x5B = 91)
 *   Byte 2:    Tag (0x5F1F)
 *   Byte 3:    (continuation of tag)
 *   Byte 4:    Length of MRZ data (0x58 = 88)
 *   Bytes 5-92: MRZ data (88 ASCII characters)
 *
 * MRZ layout for TD3:
 *   Line 1 (44 chars, bytes 5-48):
 *     [0]     Document type ('P')
 *     [1]     Type supplement ('<' or letter)
 *     [2-4]   Issuing state (3 chars, e.g. "USA")
 *     [5-43]  Name (39 chars: "SURNAME<<GIVENNAMES<<<...")
 *
 *   Line 2 (44 chars, bytes 49-92):
 *     [0-8]   Document number (9 chars)
 *     [9]     Check digit for document number
 *     [10-12] Nationality (3 chars)
 *     [13-18] Date of birth (YYMMDD)
 *     [19]    Check digit for DOB
 *     [20]    Sex ('M', 'F', or '<')
 *     [21-26] Date of expiry (YYMMDD)
 *     [27]    Check digit for expiry
 *     [28-41] Optional data (14 chars)
 *     [42]    Check digit for optional data
 *     [43]    Composite check digit
 */

export interface MRZFields {
  documentType: string;
  issuingState: string;
  surname: string;
  givenNames: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string; // YYMMDD
  sex: string;
  dateOfExpiry: string; // YYMMDD
  rawLine1: string;
  rawLine2: string;
}

const MRZ_OFFSET = 5; // MRZ data starts at byte 5 in DG1

/**
 * Parse DG1 hex data into structured MRZ fields.
 */
export function parseDG1Fields(dg1Hex: string): MRZFields {
  const hex = dg1Hex.startsWith("0x") ? dg1Hex.slice(2) : dg1Hex;
  const bytes = Buffer.from(hex, "hex");

  if (bytes.length < 93) {
    throw new Error(`DG1 too short: ${bytes.length} bytes (expected >= 93)`);
  }

  const mrzBytes = bytes.subarray(MRZ_OFFSET, MRZ_OFFSET + 88);
  const mrz = mrzBytes.toString("ascii");

  const line1 = mrz.substring(0, 44);
  const line2 = mrz.substring(44, 88);

  // Line 1 fields
  const documentType = line1[0];
  const issuingState = line1.substring(2, 5).replace(/</g, "");

  // Name: "SURNAME<<GIVENNAMES<<<..."
  const nameField = line1.substring(5, 44);
  const nameParts = nameField.split("<<");
  const surname = nameParts[0].replace(/</g, " ").trim();
  const givenNames = (nameParts[1] ?? "").replace(/</g, " ").trim();

  // Line 2 fields
  const documentNumber = line2.substring(0, 9).replace(/</g, "").trim();
  const nationality = line2.substring(10, 13).replace(/</g, "");
  const dateOfBirth = line2.substring(13, 19);
  const sex = line2[20];
  const dateOfExpiry = line2.substring(21, 27);

  return {
    documentType,
    issuingState,
    surname,
    givenNames,
    documentNumber,
    nationality,
    dateOfBirth,
    sex,
    dateOfExpiry,
    rawLine1: line1,
    rawLine2: line2,
  };
}

/**
 * Tamper with a specific byte in DG1 hex data.
 * Useful for testing that ZK proofs and SOD hashes detect modifications.
 */
export function tamperDG1Byte(dg1Hex: string, byteOffset: number, newByte: number): string {
  const hex = dg1Hex.startsWith("0x") ? dg1Hex.slice(2) : dg1Hex;
  const bytes = Buffer.from(hex, "hex");

  if (byteOffset >= bytes.length) {
    throw new Error(`Byte offset ${byteOffset} out of range (DG1 length: ${bytes.length})`);
  }

  bytes[byteOffset] = newByte & 0xff;
  return bytes.toString("hex");
}

/**
 * Tamper with a specific MRZ field in the DG1.
 *
 * Supported fields: "nationality", "sex", "dateOfBirth", "dateOfExpiry"
 */
export function tamperDG1Field(dg1Hex: string, field: string, newValue: string): string {
  const hex = dg1Hex.startsWith("0x") ? dg1Hex.slice(2) : dg1Hex;
  const bytes = Buffer.from(hex, "hex");

  // Field positions relative to MRZ start (byte 5 in DG1)
  // Line 2 starts at MRZ offset 44
  const line2Start = MRZ_OFFSET + 44;

  switch (field) {
    case "nationality": {
      const val = newValue.padEnd(3, "<").substring(0, 3);
      Buffer.from(val, "ascii").copy(bytes, line2Start + 10);
      break;
    }
    case "sex": {
      bytes[line2Start + 20] = newValue.charCodeAt(0);
      break;
    }
    case "dateOfBirth": {
      const val = newValue.padEnd(6, "0").substring(0, 6);
      Buffer.from(val, "ascii").copy(bytes, line2Start + 13);
      break;
    }
    case "dateOfExpiry": {
      const val = newValue.padEnd(6, "0").substring(0, 6);
      Buffer.from(val, "ascii").copy(bytes, line2Start + 21);
      break;
    }
    case "issuingState": {
      const val = newValue.padEnd(3, "<").substring(0, 3);
      Buffer.from(val, "ascii").copy(bytes, MRZ_OFFSET + 2);
      break;
    }
    default:
      throw new Error(`Unknown field: ${field}. Supported: nationality, sex, dateOfBirth, dateOfExpiry, issuingState`);
  }

  return bytes.toString("hex");
}
