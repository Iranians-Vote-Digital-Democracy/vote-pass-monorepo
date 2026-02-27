//
//  StateProvider.swift
//  IranUnchained
//
//  Created by Ivan Lele on 01.04.2024.
//

import Identity
import Alamofire
import Foundation

class StateProvider: NSObject, IdentityStateProviderProtocol {
    let config: Config
    
    var lastRetrivedData: Data
    var error: Error?
    
    init(config: Config) {
        self.config = config
        self.lastRetrivedData = Data()
        self.error = nil
    }
    
    func getGISTProof(_ userId: String?, blockNumber: String?) throws -> Data {
        guard let userId = userId else {
            throw "userId is not"
        }
        
        let blockNumber = blockNumber ?? ""
        
        var mutRequestURL = config.kyc.passportKYCURL.absoluteString
        mutRequestURL += "/integrations/identity-provider-service/v1/gist-data?user_did=\(userId)"
        if !blockNumber.isEmpty {
            mutRequestURL += "&block_number=\(blockNumber)"
        }
        
        let requestURL = mutRequestURL
        
        defer {
            lastRetrivedData = Data()
            error = nil
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        Task {
            do {
                lastRetrivedData = try await AF.request(requestURL, method: .get).serializingData().result.get()
            } catch let err {
                error = err
            }
            
            semaphore.signal()
        }
        semaphore.wait()
        
        if let error = error {
            throw error
        }
        
        let response = try JSONDecoder().decode(GISTResponse.self, from: lastRetrivedData)
        
        return try JSONEncoder().encode(response.data.attributes.gistProof)
    }
    
    func proveAuthV2(_ inputs: Data?) throws -> Data {
        guard let inputs else { throw "inputs is not valid" }
        
        let wtns = try ZKUtils.calcWtnsAuthV2(inputs)
        
        let (proofRaw, pubSignalsRaw) = try ZKUtils.groth16AuthV2(wtns: wtns)
        
        let proof = try JSONDecoder().decode(Proof.self, from: proofRaw)
        let pubSignals = try JSONDecoder().decode([String].self, from: pubSignalsRaw)
        
        let zkproof = ZkProof(proof: proof, pubSignals: pubSignals)
        
        return try JSONEncoder().encode(zkproof)
    }
    
    func proveCredentialAtomicQueryMTPV2(onChainVoting inputs: Data?) throws -> Data {
        guard let inputs = inputs else { throw "inputs is not valid" }
        
        let wtns = try ZKUtils.calcWtnsCredentialAtomicQueryMTPV2OnChainVoting(inputs)
        
        let (proofRaw, pubSignalsRaw) = try ZKUtils.groth16CredentialAtomicQueryMTPV2OnChainVoting(wtns: wtns)
        
        let proof = try JSONDecoder().decode(Proof.self, from: proofRaw)
        let pubSignals = try JSONDecoder().decode([String].self, from: pubSignalsRaw)
        
        let zkproof = ZkProof(proof: proof, pubSignals: pubSignals)
        
        return try JSONEncoder().encode(zkproof)
    }
}

struct GISTResponse: Codable {
    let data: GISTResponseData
}

struct GISTResponseData: Codable {
    let id, type: String
    let attributes: GISTResponseAttributes
}

struct GISTResponseAttributes: Codable {
    let gistProof: GistProof
    let gistRoot: String

    enum CodingKeys: String, CodingKey {
        case gistProof = "gist_proof"
        case gistRoot = "gist_root"
    }
}

struct GistProof: Codable {
    let auxExistence: Bool
    let auxIndex, auxValue: String
    let existence: Bool
    let root: String
    let siblings: [String]
    let value: String
    let index: String

    enum CodingKeys: String, CodingKey {
        case auxExistence = "aux_existence"
        case auxIndex = "aux_index"
        case auxValue = "aux_value"
        case existence, root, siblings, value, index
    }
}

struct StateInfo: Codable {
    let index: String
    let hash: String
    let createdAtTimestamp: String
    let createdAtBlock: String
    let lastUpdateOperationIndex: String
}

struct FinalizedResponse {
    let isFinalized: Bool
    let stateInfo: StateInfo?
}

struct GetStateInfoResponse: Codable {
    let state: StateInfo
}

struct OperationDetails: Codable {
    let type: String
    let contract: String
    let chain: String
    let gistHash: String
    let stateRootHash: String
    let timestamp: String
    
    enum CodingKeys: String, CodingKey {
        case type = "@type"
        case contract, chain
        case gistHash = "GISTHash"
        case stateRootHash, timestamp
    }
}

struct Operation: Codable {
    let index: String
    let operationType: String
    let details: OperationDetails
    let status: String
    let creator: String
    let timestamp: String
}

struct OperationData: Codable {
    let operation: Operation
}
