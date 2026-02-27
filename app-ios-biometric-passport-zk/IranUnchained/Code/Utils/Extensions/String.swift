//
//  String.swift
//  IranUnchained
//
//  Created by Ivan Lele on 19.03.2024.
//

import Web3
import Foundation
import CryptoKit
import KeychainAccess

extension String: Error {}

extension String {
    func parsableDateToDate() -> Date {
        let partYearStartIndex = self.startIndex
        let partYearEndIndex = self.index(self.startIndex, offsetBy: 2)
        
        let partYear = self[partYearStartIndex..<partYearEndIndex]
        
        let year = Int(partYear, radix: 10)! <= 34 ? "20" + partYear : "19" + partYear
        
        let monthStartIndex = self.index(self.startIndex, offsetBy: 2)
        let monthEndIndex = self.index(self.startIndex, offsetBy: 4)
        
        let month = self[monthStartIndex..<monthEndIndex]
        
        let dayStartIndex = self.index(self.startIndex, offsetBy: 4)
        let dayEndIndex = self.index(self.startIndex, offsetBy: 6)
        
        let day = self[dayStartIndex..<dayEndIndex]

        let dateFormatter = DateFormatter()
        dateFormatter.timeZone = .gmt
        dateFormatter.dateFormat = "yyyy-MM-dd"
         
        let rawDate = dateFormatter.date(from: "\(year)-\(month)-\(day)") ?? Date()
        
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month, .day, .hour], from: rawDate)
        
        return calendar.date(from:components) ?? Date()
    }
}

extension String {
    func reversedInt() -> Int {
        var result = ""
        for byte in self.utf8 {
            let bitsStr: String = byte.bits()
            let bitsStrReversed = String(bitsStr.reversed()).dropFirst()
            
            result = bitsStrReversed + result
        }

        return Int(result, radix: 2) ?? 0
    }
}
