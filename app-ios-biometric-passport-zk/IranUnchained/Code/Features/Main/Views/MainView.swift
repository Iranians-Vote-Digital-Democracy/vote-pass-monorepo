//
//  MainView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 19.03.2024.
//

import OSLog
import SwiftUI
import Identity
import Foundation

enum MainRoute: Hashable {
    case registration, voting
}

struct MainView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel

    @State private var path: [MainRoute] = []

    @State private var proof = ZkProof()

    @State private var chosenRegistrationEntity: RegistrationEntity?

    var body: some View {
        NavigationStack(path: $path) {
            content.navigationDestination(for: MainRoute.self) { route in
                VStack {}
                switch route {
                case .registration:
                    PassportScanView(onFinish: onScanDocument)
                case .voting:
                    ZStack {
                        if let registrationEntity = chosenRegistrationEntity {
                            VotingView(registrationEntity: registrationEntity) {
                                self.path = []
                            }
                        }
                    }
                }
            }
        }
    }

    var content: some View {
        ZStack {
            Color.lightGrey.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                    .padding(.vertical, 8)
                ProposalListView()
            }
        }
    }

    var header: some View {
        ZStack {
            Text(Bundle.main.displayName ?? "")
                .font(.customFont(font: .helvetica, style: .bold, size: 16))
        }
    }

    func onScanDocument(_ artifacts: PassportScanArtifacts) {
        do {
            try appViewModel.registerUserFromPassportScanArtifacts(artifacts)

            self.path.append(.voting)
        } catch {
            Logger.main.error("user registration: \(error)")
        }
    }
}

struct MainHeaderView: View {
    var body: some View {
        Text(Bundle.main.displayName ?? "")
            .font(.customFont(font: .helvetica, style: .bold, size: 20))
            .foregroundStyle(.darkBlue)
    }
}

#Preview {
    let appViewModel = AppView.ViewModel()

    return MainView()
        .environmentObject(appViewModel)
        .onAppear {
            Task { @MainActor in
                try? await appViewModel.fetchProposals()
            }
        }
}
