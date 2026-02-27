//
//  UInt8.swift
//  IranUnchained
//
//  Created by Ivan Lele on 08.04.2024.
//

import Foundation

extension UInt8 {
    func bits() -> [UInt8] {
        var byte = self
        var bits = [UInt8](repeating: .zero, count: 8)
        for i in 0..<8 {
            let currentBit = byte & 0x01
            if currentBit != 0 {
                bits[i] = 1
            }

            byte >>= 1
        }

        return bits.reversed()
    }
}
