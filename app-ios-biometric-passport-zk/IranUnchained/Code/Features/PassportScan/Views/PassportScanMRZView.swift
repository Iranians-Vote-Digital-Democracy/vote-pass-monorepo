//
//  PassportScanMRZView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 21.03.2024.
//

import SwiftUI

struct PassportScanMRZView: View {
    @StateObject private var viewModel = ViewModel()
    
    let onScanned: (String) -> Void
    
    init(_ onScanned: @escaping (String) -> Void) {
        self.onScanned = onScanned
    }
    
    var body: some View {
        VStack {
            PassportScanMRZHeaderView()
                .padding()
            ZStack {
                PassportScanMRZInnerView()
                    .mask {
                        RoundedRectangle(cornerRadius: 15)
                            .frame(width: 370, height: 270)
                    }
                LottieView(animationFileName: "passportMRZScanning", loopMode: .loop)
                    .frame(width: 360, height: 230)
            }
            .frame(height: 320)
            ZStack {}
                .frame(height: 15)
            InfoView("ScanDocumentMRZHint")
                .frame(width: 342, height: 52)
            Spacer()
        }
        .environmentObject(viewModel)
        .onAppear {
            self.viewModel.setOnScanned { mrzKey in
                self.onScanned(mrzKey)
            }
            
            self.viewModel.startScanning()
        }
    }
}

struct PassportScanMRZHeaderView: View {
    var body: some View {
        HStack {
            Text("ScanDocumentMRZTitle")
                .font(.customFont(font: .helvetica, style: .bold, size: 20))
                .foregroundStyle(.darkBlue)
            Spacer()
        }
    }
}

#Preview {
    PassportScanMRZView() { _ in }
}
