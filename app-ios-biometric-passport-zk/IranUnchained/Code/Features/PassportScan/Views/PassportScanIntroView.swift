//
//  PassportScanIntroView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 21.03.2024.
//

import SwiftUI

struct PassportScanIntroView: View {
    let onConfirm: () -> Void
    
    var body: some View {
        VStack {
            ZStack {}
                .frame(height: 50)
            ZStack {
                Circle()
                    .foregroundStyle(.dullGray)
                    .opacity(0.1)
                Image("NFCIcon")
                    .resizable()
                    .frame(width: 36, height: 36)
            }
            .frame(width: 88, height: 88)
            .padding(.bottom)
            Text("ScanDocumentTitle")
                .font(.customFont(font: .helvetica, style: .bold, size: 24))
                .foregroundStyle(.darkBlue)
            ZStack {}
                .frame(height: 1)
            Text("ScanDocumentSubTitle")
                .font(.customFont(font: .helvetica, style: .regular, size: 14))
                .foregroundStyle(.dullGray)
                .padding(.bottom)
            InfoView("ScanDocumentHint")
                .frame(width: 342, height: 110)
            Spacer()
            GreenButtonView("ScanDocumentStartButton", onClick: onConfirm)
        }
    }
}

#Preview {
    PassportScanIntroView() {}
}
