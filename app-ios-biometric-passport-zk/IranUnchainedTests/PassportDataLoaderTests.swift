//
//  PassportDataLoaderTests.swift
//  IranUnchainedTests
//
//  Tests for PassportDataLoader.parseJson()
//

import XCTest
@testable import IranUnchained

final class PassportDataLoaderTests: XCTestCase {

    func testValidV1Json() {
        let json = """
        {
            "version": 1,
            "type": "passport-data",
            "exportedAt": "2026-01-15T10:30:00Z",
            "dg1Hex": "615B5F1F58",
            "sodHex": "7782ABCD",
            "digestAlgorithm": "sha256",
            "docSigningCertPem": "-----BEGIN CERTIFICATE-----\\nMIIBkTCC...\\n-----END CERTIFICATE-----",
            "personDetails": {
                "name": "JOHN",
                "surname": "DOE",
                "nationality": "USA",
                "issuerAuthority": "USA",
                "dateOfBirth": "01.01.1990",
                "dateOfExpiry": "01.01.2030",
                "documentNumber": "123456789",
                "gender": "M"
            }
        }
        """

        let result = PassportDataLoader.parseJson(json)

        XCTAssertNotNil(result)
        XCTAssertEqual(result?.version, 1)
        XCTAssertEqual(result?.type, "passport-data")
        XCTAssertEqual(result?.dg1Hex, "615B5F1F58")
        XCTAssertEqual(result?.sodHex, "7782ABCD")
        XCTAssertEqual(result?.digestAlgorithm, "sha256")
        XCTAssertNotNil(result?.personDetails)
        XCTAssertEqual(result?.personDetails?.name, "JOHN")
        XCTAssertEqual(result?.personDetails?.surname, "DOE")
        XCTAssertEqual(result?.personDetails?.nationality, "USA")
        XCTAssertEqual(result?.personDetails?.issuerAuthority, "USA")
        XCTAssertEqual(result?.personDetails?.dateOfBirth, "01.01.1990")
        XCTAssertEqual(result?.personDetails?.dateOfExpiry, "01.01.2030")
        XCTAssertEqual(result?.personDetails?.documentNumber, "123456789")
        XCTAssertEqual(result?.personDetails?.gender, "M")
    }

    func testMissingOptionalFields() {
        let json = """
        {
            "version": 1,
            "personDetails": {
                "issuerAuthority": "DEU"
            }
        }
        """

        let result = PassportDataLoader.parseJson(json)

        XCTAssertNotNil(result)
        XCTAssertEqual(result?.version, 1)
        XCTAssertNil(result?.type)
        XCTAssertNil(result?.dg1Hex)
        XCTAssertNil(result?.sodHex)
        XCTAssertEqual(result?.personDetails?.issuerAuthority, "DEU")
        XCTAssertNil(result?.personDetails?.name)
        XCTAssertNil(result?.personDetails?.dateOfBirth)
    }

    func testInvalidJson() {
        let json = "not valid json at all {"

        let result = PassportDataLoader.parseJson(json)

        XCTAssertNil(result)
    }

    func testEmptyString() {
        let result = PassportDataLoader.parseJson("")

        XCTAssertNil(result)
    }

    func testEmptyObject() {
        let json = "{}"

        let result = PassportDataLoader.parseJson(json)

        XCTAssertNotNil(result)
        XCTAssertNil(result?.version)
        XCTAssertNil(result?.personDetails)
    }

    func testDifferentVersion() {
        let json = """
        {
            "version": 99,
            "type": "future-format",
            "personDetails": {
                "issuerAuthority": "GBR",
                "name": "JANE"
            }
        }
        """

        let result = PassportDataLoader.parseJson(json)

        // Forward compatibility: still parses even with unknown version
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.version, 99)
        XCTAssertEqual(result?.personDetails?.issuerAuthority, "GBR")
        XCTAssertEqual(result?.personDetails?.name, "JANE")
    }

    func testNullPersonDetails() {
        let json = """
        {
            "version": 1,
            "personDetails": null
        }
        """

        let result = PassportDataLoader.parseJson(json)

        XCTAssertNotNil(result)
        XCTAssertNil(result?.personDetails)
    }
}
