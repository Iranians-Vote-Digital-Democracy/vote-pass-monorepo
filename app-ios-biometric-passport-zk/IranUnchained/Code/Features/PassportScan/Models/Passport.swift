//
//  Passport.swift
//  IranUnchained
//
//  Created by Ivan Lele on 21.03.2024.
//

import Foundation

struct Passport {
    let id: String
    let firstName: String
    let lastName: String
    let documentNumber: String
    let issuingAuthority: String
    let dateOfExpiry: Date
    let dateOfBirth: Date
    let documentSod: DocumentSod
    let zkProof: ZkProof
}

struct DocumentSod: Codable {
    let signedAttributes, algorithm, signature, pemFile: String
    let encapsulatedContent: String

    enum CodingKeys: String, CodingKey {
        case signedAttributes = "signed_attributes"
        case algorithm, signature
        case pemFile = "pem_file"
        case encapsulatedContent = "encapsulated_content"
    }
}

extension Passport {
    static let sample = Self(
        id: "1",
        firstName: "Joshua",
        lastName: "Smith",
        documentNumber: "00AA00000",
        issuingAuthority: "USA",
        dateOfExpiry: Date(timeIntervalSince1970: 2848953600),
        dateOfBirth: Date(timeIntervalSince1970: 795139200),
        documentSod: DocumentSod(
            signedAttributes: "",
            algorithm: "",
            signature: "",
            pemFile: "",
            encapsulatedContent: ""
        ),
        zkProof: ZkProof(
            proof: Proof(
                piA: [],
                piB: [],
                piC: [],
                proofProtocol: ""
            ),
            pubSignals: []
        )
    )
}
