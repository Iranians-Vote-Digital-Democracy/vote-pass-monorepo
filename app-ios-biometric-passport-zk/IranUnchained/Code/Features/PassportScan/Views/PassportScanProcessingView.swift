//
//  PassportScanProcessingView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 27.03.2024.
//

import SwiftUI

struct PassportScanProcessingView: View {
    @Binding var status: Status
    
    let isSigning: Bool
    
    var body: some View {
        VStack {
            Spacer()
            switch status {
            case .going:
                PassportScanProcessingGoingView(isSigning: isSigning)
            case .finished:
                PassportScanProcessingFinishedView()
            case .error:
                PassportScanProcessingErrorView()
            }
            Spacer()
        }
    }
    
    enum Status: Int {
        case going
        case finished
        case error
    }
}

struct PassportScanProcessingGoingView: View {
    let isSigning: Bool
    
    var body: some View {
        VStack {
            LottieView(animationFileName: "going", loopMode: .loop)
                .frame(width: 150, height: 150)
            Text("ScanDocumentProcessingGoingTitle")
                .font(.customFont(font: .helvetica, style: .bold, size: 24))
                .foregroundStyle(.darkBlue)
            ZStack {}
                .frame(height: 1)
            Text(isSigning ? "Signing" : "ScanDocumentProcessingGoingSubTitle")
                .font(.customFont(font: .helvetica, style: .regular, size: 16))
                .multilineTextAlignment(.center)
                .foregroundStyle(.dullGray)
                .frame(width: 175)
        }
    }
}

struct PassportScanProcessingFinishedView: View {
    var body: some View {
        VStack {
            LottieView(animationFileName: "finished", loopMode: .playOnce)
                .frame(width: 150, height: 150)
            Text("ScanDocumentProcessingFinishedTitle")
                .font(.customFont(font: .helvetica, style: .bold, size: 24))
                .foregroundStyle(.darkBlue)
            ZStack {}
                .frame(height: 1)
            Text("ScanDocumentProcessingFinishedSubTitle")
                .font(.customFont(font: .helvetica, style: .regular, size: 16))
                .multilineTextAlignment(.center)
                .foregroundStyle(.dullGray)
                .frame(width: 175)
        }
    }
}

struct PassportScanProcessingErrorView: View {
    var body: some View {
        VStack {
            ZStack {
                Circle()
                    .foregroundStyle(.tomato)
                Image(systemName: "xmark")
                    .foregroundStyle(.white)
            }
            .frame(width: 96, height: 96)
            ZStack {}
                .frame(height: 1)
            Text("ScanDocumentProcessingErrorTitle")
                .font(.customFont(font: .helvetica, style: .bold, size: 24))
                .foregroundStyle(.darkBlue)
            ZStack {}
                .frame(height: 1)
            Text("ScanDocumentProcessingErrorSubTitle")
                .font(.customFont(font: .helvetica, style: .regular, size: 16))
                .multilineTextAlignment(.center)
                .foregroundStyle(.dullGray)
                .frame(width: 175)
        }
    }
}

#Preview {
    PassportScanProcessingView(status: .constant(.going), isSigning: false)
        
}
