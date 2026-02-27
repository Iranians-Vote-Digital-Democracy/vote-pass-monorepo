//
//  EntryView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 18.03.2024.
//

import OSLog
import SwiftUI

struct AppView: View {
    @StateObject private var viewModel = ViewModel()
    
    var body: some View {
        VStack {
            if viewModel.isIntroPassed {
                MainView()
            } else {
                IntroView()
            }
        }
        .environmentObject(viewModel)
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
            
            eraceOnFirstLaunch()
            fetchRegistrationEntities()
        }
        .environment(\.layoutDirection, Locale.current.identifier.starts(with: "fa") ? .rightToLeft : .leftToRight)
    }
    
    func fetchRegistrationEntities() {
        Task { @MainActor in
            do {
                try await viewModel.fetchRegistrationEntities()
            } catch {
                Logger.main.error("\(error)")
            }
        }
    }
    
    func eraceOnFirstLaunch() {
        Task { @MainActor in
            do {
                if SimpleStorage.getIsFirstLaunchEraced() {
                    return
                }
                
                viewModel.user = nil
                
                SimpleStorage.eraceActiveUserId()
                try SecureStorage.eraceAll()
                
                SimpleStorage.setIsFirstLaunchEraced(true)
            } catch {
                print("eraceOnFirstLaunch error: \(error)")
            }
        }
    }
}

#Preview {
    AppView()
}
