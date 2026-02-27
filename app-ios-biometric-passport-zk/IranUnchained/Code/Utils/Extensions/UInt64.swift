//
//  UInt64.swift
//  IranUnchained
//
//  Created by Ivan Lele on 27.03.2024.
//

import Foundation

extension UInt64 {
    var nano: UInt64 {
        return self * 1_000_000_000
    }
}
