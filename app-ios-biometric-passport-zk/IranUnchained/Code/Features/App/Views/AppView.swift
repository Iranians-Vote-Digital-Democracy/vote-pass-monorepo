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

            eraceOnFirstLaunchThenSeed()
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
    
    func eraceOnFirstLaunchThenSeed() {
        Task { @MainActor in
            do {
                if !SimpleStorage.getIsFirstLaunchEraced() {
                    viewModel.user = nil
                    SimpleStorage.eraceActiveUserId()
                    try SecureStorage.eraceAll()
                    SimpleStorage.setIsFirstLaunchEraced(true)
                }
            } catch {
                print("eraceOnFirstLaunch error: \(error)")
            }

            // Seed after erase completes so the seeded identity isn't wiped
            seedLocalDevIfNeeded()
        }
    }

    func seedLocalDevIfNeeded() {
        guard viewModel.config.isLocalDev else { return }

        #if targetEnvironment(simulator)
        LocalDevSeeder.seedIfNeeded(viewModel: viewModel, loadPassportJSON: true)
        #else
        LocalDevSeeder.seedIfNeeded(viewModel: viewModel)
        #endif
    }
}

#Preview {
    AppView()
}
