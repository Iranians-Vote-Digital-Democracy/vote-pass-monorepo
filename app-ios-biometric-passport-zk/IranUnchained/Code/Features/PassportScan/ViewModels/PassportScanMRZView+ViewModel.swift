//
//  PassportScanMRZView+ViewModel.swift
//  IranUnchained
//
//  Created by Ivan Lele on 21.03.2024.
//

import SwiftUI
import QKMRZScanner

extension PassportScanMRZView {
    class ViewModel: ObservableObject, QKMRZScannerViewDelegate {
        @Published var isScanning = false
        var onScanned: (String) -> Void = { _ in }
        
        func mrzScannerView(_ mrzScannerView: QKMRZScanner.QKMRZScannerView, didFind scanResult: QKMRZScanner.QKMRZScanResult) {
            let passwordNumber = scanResult.documentNumber
            let dateOfBirth = scanResult.birthdate ?? Date(timeIntervalSince1970: 0)
            let dateOfExpiry = scanResult.expiryDate ?? Date(timeIntervalSince1970: 0)
            
            let mrzDateFormatter = DateFormatter()
            mrzDateFormatter.timeZone = .gmt
            mrzDateFormatter.dateFormat = "yyMMdd"
            
            let mrzKey = PassportUtils.getMRZKey(
                passportNumber: passwordNumber,
                dateOfBirth: mrzDateFormatter.string(from: dateOfBirth),
                dateOfExpiry: mrzDateFormatter.string(from: dateOfExpiry)
            )
            
            stopScanning()
            onScanned(mrzKey)
        }
        
        func setOnScanned(onScanned: @escaping (String) -> Void) {
            self.onScanned = onScanned
        }
        
        func startScanning() {
            isScanning = true
        }
        
        func stopScanning() {
            isScanning = false
        }
    }
}
