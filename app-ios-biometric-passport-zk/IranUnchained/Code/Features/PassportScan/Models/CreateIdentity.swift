//
//  CreateIdentityRequest.swift
//  IranUnchained
//
//  Created by Ivan Lele on 28.03.2024.
//

import Foundation

struct CreateIdentityRequest: Codable {
    let data: CreateIdentityRequestData
}

struct CreateIdentityRequestData: Codable {
    let id: String
    let documentSod: DocumentSod
    let zkproof: ZkProof

    enum CodingKeys: String, CodingKey {
        case id
        case documentSod = "document_sod"
        case zkproof
    }
}

struct CreateIdentityResponse: Codable {
    let data: CreateIdentityResponseData
}

struct CreateIdentityResponseData: Codable {
    let id, type: String
    let attributes: CreateIdentityResponseAttributes
}

struct CreateIdentityResponseAttributes: Codable {
    let claimID, issuerDid: String

    enum CodingKeys: String, CodingKey {
        case claimID = "claim_id"
        case issuerDid = "issuer_did"
    }
}
