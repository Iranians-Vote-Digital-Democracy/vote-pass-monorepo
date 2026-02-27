//
//  VoteSMTInputsBuilder.swift
//  IranUnchained
//
//  Builds circuit inputs JSON for voteSMT (Semaphore-style SMT voting) proof generation.
//  Direct port of Android's VoteSMTInputsBuilder.kt.
//

import Foundation

enum VoteSMTInputsBuilder {

    /// Build the circuit inputs JSON string.
    ///
    /// The vote_smt circuit proves knowledge of a secret + Merkle path in the registration SMT.
    /// Identity fields (citizenship, timestamps) are committed into the SMT leaf during registration.
    static func buildJSON(
        root: String,
        nullifierHash: String,
        nullifier: String,
        vote: String,
        secret: String,
        pathElements: [String],
        pathIndices: [String]
    ) -> String {
        let pathElementsStr = pathElements.map { "\"\($0)\"" }.joined(separator: ",")
        let pathIndicesStr = pathIndices.map { "\"\($0)\"" }.joined(separator: ",")

        return """
        {
            "root": "\(root)",
            "nullifierHash": "\(nullifierHash)",
            "nullifier": "\(nullifier)",
            "vote": "\(vote)",
            "secret": "\(secret)",
            "pathElements": [\(pathElementsStr)],
            "pathIndices": [\(pathIndicesStr)]
        }
        """
    }
}
