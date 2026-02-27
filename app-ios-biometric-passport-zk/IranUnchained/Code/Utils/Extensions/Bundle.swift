//
//  Bundle.swift
//  IranUnchained
//
//  Created by Ivan Lele on 19.03.2024.
//

import Foundation

extension Bundle {
    var displayName: String? {
        return object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
    }
}
