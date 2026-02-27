//
//  MRZScannerView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 21.03.2024.
//

import SwiftUI
import QKMRZScanner

struct PassportScanMRZInnerView: UIViewRepresentable {
    @EnvironmentObject private var delegator: PassportScanMRZView.ViewModel
    
    typealias UIViewType = QKMRZScannerView
    
    func makeUIView(context: Context) -> QKMRZScanner.QKMRZScannerView {
        QKMRZScannerView()
    }
    
    func updateUIView(_ uiView: QKMRZScanner.QKMRZScannerView, context: Context) {
        if self.delegator.isScanning {
            uiView.delegate = delegator
            uiView.startScanning()
            return
        }
        
        uiView.stopScanning()
    }
    
}

#Preview {
    PassportScanMRZInnerView()
        .environmentObject(PassportScanMRZView.ViewModel())
}

