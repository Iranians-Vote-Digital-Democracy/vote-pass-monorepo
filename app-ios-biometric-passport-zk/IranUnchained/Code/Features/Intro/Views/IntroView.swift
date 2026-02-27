//
//  IntroView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 19.03.2024.
//

import SwiftUI

struct IntroView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel
    
    var body: some View {
        VStack {
            Spacer()
            IntroHeaderView()
                .padding(.bottom)
            Spacer()
            Divider()
            GreenButtonView("IntroButton") {
                SimpleStorage.setIsIntroPassed(true)
                appViewModel.isIntroPassed = true
            }
            IntroFooterView()
        }
    }
}

struct IntroHeaderView: View {
    var body: some View {
        VStack {
            Image("IranFlag")
                .resizable()
                .frame(width: 150, height: 150)
                .padding(.bottom)
            Text(Bundle.main.displayName ?? "")
                .font(.customFont(font: .helvetica, style: .bold, size: 32))
                .foregroundStyle(.darkBlue)
            ZStack {}
                .frame(height: 1)
            Text("IntroSubTitle")
                .multilineTextAlignment(.center)
                .foregroundStyle(.dullGray)
                .frame(width: 300)
        }
    }
}

struct IntroFooterView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel
    
    var body: some View {
        VStack {
            Text("IntroFooterText")
                .font(.customFont(font: .helvetica, style: .regular, size: 12))
                .foregroundStyle(.dullGray)
                .frame(width: 400)
            HStack {
                Link(destination: appViewModel.config.general.privacyPolicyURL) {
                    Text(LocalizedStringKey("IntroPrivacyPolicy"))
                        .underline()
                }
                .font(.customFont(font: .helvetica, style: .regular, size: 12))
                .foregroundStyle(.dullGray)
                Link(destination: appViewModel.config.general.termsOfUseURL) {
                    Text(LocalizedStringKey("IntroTermsOfUse"))
                        .underline()
                        .padding()
                }
                .font(.customFont(font: .helvetica, style: .regular, size: 12))
                .foregroundStyle(.dullGray)
            }
        }
    }
}

#Preview {
    IntroView()
        .environmentObject(AppView.ViewModel())
}
