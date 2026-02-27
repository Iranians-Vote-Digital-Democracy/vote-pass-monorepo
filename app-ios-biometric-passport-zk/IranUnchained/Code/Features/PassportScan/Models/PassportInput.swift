//
//  PassportInput.swift
//  IranUnchained
//
//  Created by Ivan Lele on 08.04.2024.
//

import Foundation

struct PassportInput: Codable {
    let inKey: [UInt8]
    let currDateYear: Int
    let currDateMonth: Int
    let currDateDay: Int
    let credValidYear: Int
    let credValidMonth: Int
    let credValidDay: Int
    let ageLowerbound: Int
    
    private enum CodingKeys: String, CodingKey {
        case inKey = "in", currDateYear, currDateMonth, currDateDay, credValidYear, credValidMonth, credValidDay, ageLowerbound
    }
}
