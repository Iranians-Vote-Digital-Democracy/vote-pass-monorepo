//
//  VoteProcessingView.swift
//  IranUnchained
//
//  4-step vote submission progress view with error handling.
//

import OSLog
import SwiftUI

struct VoteProcessingView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel

    let proposal: ProposalData
    let selectedOption: Int

    @State private var currentStep = 0
    @State private var isComplete = false
    @State private var errorMessage: String?
    @State private var showResults = false

    private let steps = [
        "Building proof inputs",
        "Anonymizing vote",
        "Sending your vote",
        "Finalizing"
    ]

    var body: some View {
        ZStack {
            Color.lightGrey.ignoresSafeArea()
            VStack(spacing: 24) {
                Spacer()

                if let error = errorMessage {
                    errorView(error)
                } else if isComplete {
                    completionView
                } else {
                    progressView
                }

                Spacer()
            }
            .padding()
        }
        .navigationTitle("Submitting Vote")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(!isComplete && errorMessage == nil)
        .navigationDestination(isPresented: $showResults) {
            VoteOptionsView(proposal: proposal, showResults: true)
        }
        .onAppear {
            submitVote()
        }
    }

    var progressView: some View {
        VStack(spacing: 20) {
            LottieView(animationFileName: "going", loopMode: .loop)
                .frame(width: 120, height: 120)

            ForEach(0..<steps.count, id: \.self) { index in
                HStack(spacing: 12) {
                    if index < currentStep {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.system(size: 20))
                    } else if index == currentStep {
                        ProgressView()
                            .frame(width: 20, height: 20)
                    } else {
                        Image(systemName: "circle")
                            .foregroundColor(.gray.opacity(0.3))
                            .font(.system(size: 20))
                    }

                    Text(steps[index])
                        .font(.customFont(font: .helvetica, style: index <= currentStep ? .bold : .regular, size: 16))
                        .foregroundStyle(index <= currentStep ? .primary : .naturalMain)

                    Spacer()
                }
            }
        }
    }

    var completionView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(.green)

            Text("Vote submitted!")
                .font(.customFont(font: .helvetica, style: .bold, size: 24))

            if selectedOption < proposal.options.count {
                Text("You voted for: \(proposal.options[selectedOption].name)")
                    .font(.customFont(font: .helvetica, style: .regular, size: 16))
                    .foregroundStyle(.naturalMain)
            }

            Button {
                showResults = true
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .foregroundStyle(.tomato)
                    Text("See Results")
                        .font(.customFont(font: .helvetica, style: .bold, size: 16))
                        .foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .frame(height: 46)
            .padding(.top, 8)
        }
    }

    func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundColor(.orange)

            Text(isAlreadyVotedError(message) ? "You've already voted" : "Vote submission failed")
                .font(.customFont(font: .helvetica, style: .bold, size: 20))

            Text(isAlreadyVotedError(message)
                 ? "Your vote was already recorded for this proposal."
                 : message)
                .font(.customFont(font: .helvetica, style: .regular, size: 14))
                .foregroundStyle(.naturalMain)
                .multilineTextAlignment(.center)

            if isAlreadyVotedError(message) {
                Button {
                    // Save that we already voted (use selectedOption since we don't know the original)
                    SimpleStorage.saveVoteResult(proposalId: proposal.proposalId, selectedOption: selectedOption)
                    showResults = true
                } label: {
                    ZStack {
                        RoundedRectangle(cornerRadius: 24)
                            .foregroundStyle(.tomato)
                        Text("See Results")
                            .font(.customFont(font: .helvetica, style: .bold, size: 16))
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)
                .frame(height: 46)
            }
        }
    }

    func isAlreadyVotedError(_ message: String) -> Bool {
        let lower = message.lowercased()
        return lower.contains("already voted")
            || lower.contains("already registered")
            || lower.contains("key already exists")
            || lower.contains("duplicate")
    }

    func submitVote() {
        Task {
            do {
                let service = VoteSubmissionService(config: appViewModel.config, user: appViewModel.user)

                try await service.submitVote(
                    proposal: proposal,
                    selectedOptions: [selectedOption]
                ) { step in
                    Task { @MainActor in
                        currentStep = step
                    }
                }

                await MainActor.run {
                    SimpleStorage.saveVoteResult(proposalId: proposal.proposalId, selectedOption: selectedOption)
                    currentStep = steps.count
                    isComplete = true
                }
            } catch {
                Logger.main.error("Vote submission failed: \(error)")
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        VoteProcessingView(proposal: .sample, selectedOption: 0)
            .environmentObject(AppView.ViewModel())
    }
}
