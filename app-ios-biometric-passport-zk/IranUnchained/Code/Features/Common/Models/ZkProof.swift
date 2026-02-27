//
//  ZkProof.swift
//  IranUnchained
//
//  Created by Ivan Lele on 28.03.2024.
//

import Foundation

struct ZkProof: Codable {
    let proof: Proof
    let pubSignals: [String]
    
    init() {
        self.proof = Proof(
            piA: [],
            piB: [],
            piC: [],
            proofProtocol: ""
        )
        self.pubSignals = []
    }
    
    init(proof: Proof, pubSignals: [String]) {
        self.proof = proof
        self.pubSignals = pubSignals
    }

    enum CodingKeys: String, CodingKey {
        case proof
        case pubSignals = "pub_signals"
    }
}

struct Proof: Codable {
    let piA: [String]
    let piB: [[String]]
    let piC: [String]
    let proofProtocol: String

    enum CodingKeys: String, CodingKey {
        case piA = "pi_a"
        case piB = "pi_b"
        case piC = "pi_c"
        case proofProtocol = "protocol"
    }
}
