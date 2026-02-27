//
//  PassportScanNFCView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 21.03.2024.
//

import SwiftUI

struct PassportScanNFCView: View {
    @StateObject private var viewModel = ViewModel()
    
    let mrzKey: String
    
    let onCompletion: (Result<Passport, Error>) -> Void
    
    init(
        _ mrzKey: String,
        onCompletion: @escaping (Result<Passport, Error>) -> Void
    )
    {
        self.mrzKey = mrzKey
        self.onCompletion = onCompletion
    }
    
    var body: some View {
        VStack {
            ZStack {
                VStack {
                    Image("NFCIcon")
                        .resizable()
                        .renderingMode(.template)
                        .frame(width: 200, height: 200)
                    ZStack {}
                        .frame(height: 300)
                }
                VStack {
                    PassportScanNFCHeaderView()
                        .padding()
                    Spacer()
                    InfoView("ScanDocumentNFCHint")
                        .frame(width: 342, height: 72)
                    Spacer()
                }
            }
        }
        .onAppear {
            Task { @MainActor in
                try await Task.sleep(nanoseconds: UInt64(2).nano)
                
                do {
                    let passport = try await self.viewModel.read(self.mrzKey)
                    
                    self.onCompletion(.success(passport))
                } catch {
                    self.onCompletion(.failure(error))
                }
            }
        }
    }
}

struct PassportScanNFCHeaderView: View {
    var body: some View {
        HStack {
            Text("ScanDocumentNFCTitle")
                .font(.customFont(font: .helvetica, style: .bold, size: 20))
                .foregroundStyle(.darkBlue)
            Spacer()
        }
    }
}
                                    
#Preview {
    PassportScanNFCView("") { _ in }
}
