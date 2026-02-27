//
//  Data.swift
//  IranUnchained
//
//  Created by Ivan Lele on 27.03.2024.
//

import Foundation
import CommonCrypto

extension Data {
    private static let hexAlphabet = Array("0123456789abcdef".unicodeScalars)
    
    var hex: String {
        String(reduce(into: "".unicodeScalars) { result, value in
            result.append(Self.hexAlphabet[Int(value / 0x10)])
            result.append(Self.hexAlphabet[Int(value % 0x10)])
        })
    }
}

extension Data {
    func toCircuitInput() -> [UInt8] {
        var circuitInput = Data()
        
        for byte in self {
            circuitInput.append(contentsOf: byte.bits())
        }
        
        return [UInt8](circuitInput)
    }
}

extension Data {
    func sha256() -> Data {
        var hash = [UInt8](repeating: 0,  count: Int(CC_SHA256_DIGEST_LENGTH))
        self.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(self.count), &hash)
        }
        
        return Data(hash)
    }
}
