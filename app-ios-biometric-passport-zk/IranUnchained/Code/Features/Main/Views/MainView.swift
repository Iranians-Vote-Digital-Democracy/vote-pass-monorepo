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
    
    @State private var chosenRegistrationStatus: RegistrationEntityStatus = .voting
    
    var filteredRegistrationEntities: [RegistrationEntity] {
        appViewModel.registrationEntities.filter { $0.status == chosenRegistrationStatus }
    }
    
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
            VStack {
                header
                RegistrationsStatusSelectorView(selectedStatus: $chosenRegistrationStatus)
                    .scenePadding()
                Spacer()
                registrationsList
                    .scenePadding()
                Spacer()
                footer
            }
        }
    }
    
    var header: some View {
        ZStack {
            Text(Bundle.main.displayName ?? "")
                .font(.customFont(font: .helvetica, style: .bold, size: 16))
        }
    }
    
    var registrationsList: some View {
        VStack {
            if filteredRegistrationEntities.isEmpty {
                emptyRegistrationsList
            } else {
                ScrollView {
                    ForEach(filteredRegistrationEntities, id: \.address) { registrationEntity in
                        NavigationLink() {
                            RegistrationEntryView(registrationEntity: registrationEntity) { registrationEntity in
                                self.chosenRegistrationEntity = registrationEntity
                                
                                if appViewModel.user == nil {
                                    self.path.append(.registration)
                                } else {
                                    self.path.append(.voting)
                                }
                            }
                        } label: {
                            RegistrationEntryItemView(registrationEntity: registrationEntity)
                        }
                    }
                    .listStyle(.plain)
                }
            }
        }
    }
    
    var emptyRegistrationsList: some View {
        VStack {
            Text("RegistrationsListEmptyTitle")
                .font(.customFont(font: .helvetica, style: .bold, size: 32))
                .foregroundStyle(.naturalMain)
                .multilineTextAlignment(.center)
                .scenePadding()
            Text("RegistrationsListEmptyDescription")
                .font(.customFont(font: .helvetica, style: .bold, size: 16))
                .foregroundStyle(.naturalMain)
                .multilineTextAlignment(.center)
                .scenePadding()
        }
    }
    
    var footer: some View {
        Rectangle()
            .foregroundStyle(.white)
            .ignoresSafeArea()
            .frame(width: .infinity, height: 50)
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
                try? await appViewModel.fetchRegistrationEntities()
            }
        }
}
