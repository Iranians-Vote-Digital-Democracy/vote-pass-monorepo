# ICAO Master List Data

## Source

- **File**: `ICAO_ml_December2025.ml`
- **Source**: ICAO PKD / BSI German Master List (December 2025)
- **Format**: DER-encoded CMS SignedData containing MasterList ASN.1 structure
- **Contents**: 536 CSCA certificates from countries worldwide

## Extraction

The `master_list_content.der` was extracted from the CMS envelope:

```bash
openssl cms -inform DER -in ICAO_ml_December2025.ml -verify -noverify -nosigs -out master_list_content.der
```

Individual CSCA certificates were extracted using `extract-csca.ts`:

```bash
npx ts-node test/fixtures/icao/extract-csca.ts US
```

## US CSCA Certificates

7 US CSCA certificates found. The DS certificate in our test passport (serial `5DCE388B`)
is verified by two CSCAs with the same RSA key pair but different serial numbers:

- `csca-us-4E32D006.pem` — Serial 4E32D006, valid 2019-11-14 to 2040-05-14
- `csca-us-4E32D03F.pem` — Serial 4E32D03F, valid 2019-11-14 to 2040-05-14

The primary CSCA used in tests is `csca-us-4E32D006.pem`, also copied to
`test/fixtures/us-csca.pem` for convenience.

## Security Note

CSCA certificates are **public** — they are distributed by ICAO to all member states.
They are safe to commit to version control. They contain only public keys used to
verify Document Signing certificates embedded in passports.
