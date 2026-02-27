//
//  Logger.swift
//  IranUnchained
//
//  Created by Ivan Lele on 27.03.2024.
//

import Foundation
import OSLog

extension Logger {
    public static var subsystem = Bundle.main.bundleIdentifier ?? "Undefined"
    
    static let passportScan = Logger(subsystem: subsystem, category: "Passport Scan")
    
    static let qrScan = Logger(subsystem: subsystem, category: "QR Scan")
    
    static let main = Logger(subsystem: subsystem, category: "Main")
}
