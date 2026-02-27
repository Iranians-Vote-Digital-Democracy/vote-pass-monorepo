//
//  CalldataEncoder.swift
//  IranUnchained
//
//  ABI encoding for vote submission — direct port of Android's CalldataEncoder.kt.
//  Manual encoding because web3.swift has the same struct encoding bugs as web3j.
//

import Foundation

enum CalldataEncoder {

    /// Encode vote choices as a single-element bitmask array.
    /// For single-select: [1 << selectedOptionIndex]
    static func encodeVoteBitmasks(selectedOptions: [Int], totalOptions: Int) -> [UInt64] {
        var bitmask: UInt64 = 0
        for optionIndex in selectedOptions {
            bitmask |= (1 << optionIndex)
        }
        return [bitmask]
    }

    /// Encode current date as 6 ASCII bytes (YYMMDD) packed into uint256.
    /// E.g., 2026-02-23 -> "260223" -> [0x32,0x36,0x30,0x32,0x32,0x33] -> 0x323630323233
    static func encodeDateAsAsciiBytes(year: Int, month: Int, day: Int) -> String {
        let yy = year % 100
        let dateStr = String(format: "%02d%02d%02d", yy, month, day)
        let bytes = Array(dateStr.utf8)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    /// Encode the userPayload bytes for execute().
    /// Format: abi.encode(uint256 proposalId, uint256[] vote, (uint256 nullifier, uint256 citizenship, uint256 identityCreationTimestamp))
    static func encodeUserPayload(
        proposalId: UInt64,
        votes: [UInt64],
        nullifier: String,
        citizenship: String,
        identityCreationTimestamp: String
    ) -> String {
        var sb = ""

        // Word 0: proposalId (inline)
        sb += padLeft(String(proposalId, radix: 16), 64)

        // Word 1: offset to dynamic vote array
        // Head = proposalId(32) + voteOffset(32) + userData(3*32=96) = 160 = 0xa0
        // But actually, the encoding is:
        // slot 0: proposalId (32 bytes)
        // slot 1: offset to votes array (dynamic)
        // slot 2: nullifier
        // slot 3: citizenship
        // slot 4: identityCreationTimestamp
        // slot 5+: votes array data
        sb += padLeft("a0", 64)

        // Words 2-4: userData struct (static inline)
        sb += padLeft(nullifier, 64)
        sb += padLeft(citizenship, 64)
        sb += padLeft(identityCreationTimestamp, 64)

        // Dynamic section: votes array
        sb += padLeft(String(votes.count, radix: 16), 64) // length
        for v in votes {
            sb += padLeft(String(v, radix: 16), 64)
        }

        return sb
    }

    /// Encode the full execute() calldata.
    /// Method: execute(bytes32,uint256,bytes,(uint256[2],uint256[2][2],uint256[2]))
    /// Selector: 0xe4ab0833
    ///
    /// Layout:
    ///   [selector 4B]
    ///   [bytes32 registrationRoot: 32B inline]
    ///   [uint256 currentDate: 32B inline]
    ///   [uint256 offset to bytes: 32B -> points past ProofPoints]
    ///   [ProofPoints: 8 x 32B = 256B inline (pi_a[2], pi_b[2][2], pi_c[2])]
    ///   [uint256 bytes length: 32B]
    ///   [bytes data: padded to 32B boundary]
    static func encodeExecuteCalldata(
        registrationRoot: String,
        currentDate: String,
        userPayload: String,
        proof: ZKProofPoints
    ) -> String {
        var sb = "0xe4ab0833"

        // Param 1: bytes32 registrationRoot (inline)
        sb += padLeft(registrationRoot, 64)

        // Param 2: uint256 currentDate (inline)
        sb += padLeft(currentDate, 64)

        // Param 3: offset to dynamic bytes data
        // Head = 32 (bytes32) + 32 (uint256) + 32 (offset) + 256 (ProofPoints) = 352 = 0x160
        sb += padLeft("160", 64)

        // Param 4: ProofPoints inline (8 uint256 values)
        sb += padLeft(proof.pi_a.0, 64)
        sb += padLeft(proof.pi_a.1, 64)
        sb += padLeft(proof.pi_b.0.0, 64)
        sb += padLeft(proof.pi_b.0.1, 64)
        sb += padLeft(proof.pi_b.1.0, 64)
        sb += padLeft(proof.pi_b.1.1, 64)
        sb += padLeft(proof.pi_c.0, 64)
        sb += padLeft(proof.pi_c.1, 64)

        // Dynamic section: bytes userPayload
        let payloadBytes = hexToBytes(userPayload)
        sb += padLeft(String(payloadBytes.count, radix: 16), 64) // length
        sb += userPayload
        // Pad to 32-byte boundary
        let remainder = payloadBytes.count % 32
        if remainder != 0 {
            sb += String(repeating: "0", count: (32 - remainder) * 2)
        }

        return sb
    }

    // MARK: - Helpers

    private static func padLeft(_ hex: String, _ totalChars: Int) -> String {
        let str = hex.hasPrefix("0x") ? String(hex.dropFirst(2)) : hex
        if str.count >= totalChars { return str }
        return String(repeating: "0", count: totalChars - str.count) + str
    }

    private static func hexToBytes(_ hex: String) -> [UInt8] {
        let cleaned = hex.hasPrefix("0x") ? String(hex.dropFirst(2)) : hex
        var bytes: [UInt8] = []
        var i = cleaned.startIndex
        while i < cleaned.endIndex {
            let next = cleaned.index(i, offsetBy: 2, limitedBy: cleaned.endIndex) ?? cleaned.endIndex
            if let b = UInt8(cleaned[i..<next], radix: 16) {
                bytes.append(b)
            }
            i = next
        }
        return bytes
    }
}

/// ZK proof points for the Groth16 verifier.
struct ZKProofPoints {
    /// pi_a: (x, y) as hex strings
    let pi_a: (String, String)
    /// pi_b: ((x0, x1), (y0, y1)) as hex strings
    let pi_b: ((String, String), (String, String))
    /// pi_c: (x, y) as hex strings
    let pi_c: (String, String)

    /// Create mock proof with random values (VerifierMock accepts anything).
    static func mock() -> ZKProofPoints {
        func randomHex() -> String {
            var bytes = [UInt8](repeating: 0, count: 32)
            _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            return bytes.map { String(format: "%02x", $0) }.joined()
        }

        return ZKProofPoints(
            pi_a: (randomHex(), randomHex()),
            pi_b: ((randomHex(), randomHex()), (randomHex(), randomHex())),
            pi_c: (randomHex(), randomHex())
        )
    }
}
