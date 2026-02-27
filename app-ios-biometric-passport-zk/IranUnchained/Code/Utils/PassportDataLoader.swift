//
//  PassportDataLoader.swift
//  IranUnchained
//
//  Loads passport data from a JSON file for local development testing.
//  Port of Android's PassportDataLoader.kt.
//

import Foundation
import OSLog

enum PassportDataLoader {
    static let filename = "passport-data.json"

    struct PersonDetails: Codable {
        let name: String?
        let surname: String?
        let nationality: String?
        let issuerAuthority: String?
        let dateOfBirth: String?
        let dateOfExpiry: String?
        let documentNumber: String?
        let gender: String?
    }

    struct PassportFileData: Codable {
        let version: Int?
        let type: String?
        let exportedAt: String?
        let dg1Hex: String?
        let sodHex: String?
        let digestAlgorithm: String?
        let docSigningCertPem: String?
        let personDetails: PersonDetails?
    }

    /// Loads passport data from the app's Documents directory.
    /// Users can place the file via Finder, Files app, or `xcrun simctl` push.
    static func loadFromDocuments() -> PassportFileData? {
        guard let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            Logger.localDev.warning("Documents directory not available")
            return nil
        }

        let fileURL = documentsDir.appendingPathComponent(filename)

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            Logger.localDev.debug("No passport data file at \(fileURL.path)")
            return nil
        }

        do {
            let json = try String(contentsOf: fileURL, encoding: .utf8)
            let data = parseJson(json)
            if let data {
                Logger.localDev.info("Loaded passport data from Documents: issuer=\(data.personDetails?.issuerAuthority ?? "nil"), dob=\(data.personDetails?.dateOfBirth ?? "nil")")
            }
            return data
        } catch {
            Logger.localDev.error("Failed to read passport data file: \(error)")
            return nil
        }
    }

    /// Loads passport data from the app bundle (for simulator convenience).
    /// The file must be added to the Xcode project and included in the target.
    static func loadFromBundle() -> PassportFileData? {
        guard let fileURL = Bundle.main.url(forResource: "passport-data", withExtension: "json") else {
            Logger.localDev.debug("No passport-data.json in app bundle")
            return nil
        }

        do {
            let json = try String(contentsOf: fileURL, encoding: .utf8)
            let data = parseJson(json)
            if let data {
                Logger.localDev.info("Loaded passport data from bundle: issuer=\(data.personDetails?.issuerAuthority ?? "nil"), dob=\(data.personDetails?.dateOfBirth ?? "nil")")
            }
            return data
        } catch {
            Logger.localDev.error("Failed to read passport data from bundle: \(error)")
            return nil
        }
    }

    /// Parses a passport JSON string. Pure function, testable.
    static func parseJson(_ json: String) -> PassportFileData? {
        guard let jsonData = json.data(using: .utf8) else {
            return nil
        }

        do {
            return try JSONDecoder().decode(PassportFileData.self, from: jsonData)
        } catch {
            Logger.localDev.error("Failed to parse passport JSON: \(error)")
            return nil
        }
    }

    /// Attempts to load passport data from Documents first, then falls back to bundle.
    static func load() -> PassportFileData? {
        if let data = loadFromDocuments() {
            return data
        }
        return loadFromBundle()
    }
}
