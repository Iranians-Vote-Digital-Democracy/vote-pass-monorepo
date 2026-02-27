//
//  LocalDevSeeder.swift
//  IranUnchained
//
//  Pre-seeds identity data for local development so the voting flow
//  can be tested on the simulator without a real passport NFC scan.
//
//  Port of Android's LocalDevSeeder.kt.
//

import Foundation
import Identity
import OSLog

enum LocalDevSeeder {
    /// Seeds a local dev identity if one doesn't already exist.
    ///
    /// When `loadPassportJSON` is true, attempts to load real passport metadata
    /// from a JSON file (Documents dir or bundle) to set the correct issuing authority.
    /// Falls back to hardcoded defaults if no passport JSON is found.
    static func seedIfNeeded(viewModel: AppView.ViewModel, loadPassportJSON: Bool = false) {
        // Only seed if no active user exists
        if viewModel.user != nil {
            Logger.localDev.debug("User already exists, skipping seed")
            return
        }

        Logger.localDev.info("Seeding local dev identity...")

        let secretKey = IdentityNewBJJSecretKey()

        var error: NSError? = nil
        let identity = IdentityLoad(secretKey, nil, &error)
        if let error {
            Logger.localDev.error("Failed to load identity: \(error)")
            return
        }

        guard let identity else {
            Logger.localDev.error("Identity is nil after load")
            return
        }

        // Try to load real passport metadata
        var issuingAuthority = "USA"
        if loadPassportJSON {
            if let passportData = PassportDataLoader.load() {
                if let issuer = passportData.personDetails?.issuerAuthority {
                    issuingAuthority = issuer
                    Logger.localDev.info("Seeded with REAL passport data: issuer=\(issuer)")
                } else {
                    Logger.localDev.info("Passport JSON found but no issuerAuthority, using default: USA")
                }
            } else {
                Logger.localDev.info("No passport JSON found, using default: issuer=USA")
            }
        }

        let timestamp = Int(Date().timeIntervalSince1970)

        // Use SHA256 of the identity DID as the user ID (matches how passport scan derives ID from DG1)
        let idString = identity.did()
        let userId = idString.data(using: .utf8)?.sha256().hex ?? idString

        let user = User(
            id: userId,
            claimId: "local-dev",
            issuerDid: "local-dev",
            secretKey: secretKey,
            creationTimestamp: timestamp,
            issuingAuthority: issuingAuthority,
            votingKeys: [:]
        )

        do {
            try user.save()
            SimpleStorage.setActiveUserId(user.id)
            viewModel.user = user

            Logger.localDev.info("Local dev identity seeded: id=\(userId), issuer=\(issuingAuthority)")
        } catch {
            Logger.localDev.error("Failed to save seeded identity: \(error)")
        }
    }
}
