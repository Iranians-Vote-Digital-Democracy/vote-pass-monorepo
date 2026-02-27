//
//  VoteOptionsView.swift
//  IranUnchained
//
//  Vote option selection + results display.
//

import OSLog
import SwiftUI

struct VoteOptionsView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel

    let proposal: ProposalData
    let showResults: Bool

    @State private var selectedOption: Int = -1
    @State private var navigateToProcessing = false
    @State private var freshResults: [[Int64]]?
    @State private var isLoadingResults = false

    var previousVote: Int {
        SimpleStorage.getVoteResult(proposalId: proposal.proposalId)
    }

    var currentResults: [[Int64]] {
        freshResults ?? proposal.votingResults
    }

    var totalVotes: Int64 {
        currentResults.reduce(0) { total, row in
            total + row.reduce(0, +)
        }
    }

    var body: some View {
        ZStack {
            Color.lightGrey.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    Text(proposal.title)
                        .font(.customFont(font: .helvetica, style: .bold, size: 20))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)

                    if showResults || previousVote >= 0 {
                        resultsView
                    } else {
                        votingView
                    }
                }
                .padding(.vertical)
            }
        }
        .navigationTitle(showResults ? "Results" : "Vote")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $navigateToProcessing) {
            VoteProcessingView(proposal: proposal, selectedOption: selectedOption)
        }
        .onAppear {
            if showResults || previousVote >= 0 {
                fetchFreshResults()
            }
        }
    }

    // MARK: - Voting Mode

    var votingView: some View {
        VStack(spacing: 12) {
            ForEach(proposal.options) { option in
                Button {
                    selectedOption = option.id
                } label: {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(selectedOption == option.id ? Color.tomato : Color.gray.opacity(0.3), lineWidth: 2)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .foregroundStyle(selectedOption == option.id ? Color.tomato.opacity(0.1) : .white)
                            )
                        HStack {
                            Text(option.name)
                                .font(.customFont(font: .helvetica, style: selectedOption == option.id ? .bold : .regular, size: 16))
                                .foregroundStyle(.primary)
                            Spacer()
                            if selectedOption == option.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.tomato)
                            }
                        }
                        .padding()
                    }
                }
                .buttonStyle(.plain)
                .frame(height: 56)
                .padding(.horizontal)
            }

            Button {
                navigateToProcessing = true
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .foregroundStyle(selectedOption >= 0 ? .tomato : .gray)
                    Text("Vote")
                        .font(.customFont(font: .helvetica, style: .bold, size: 16))
                        .foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .frame(height: 46)
            .padding(.horizontal)
            .disabled(selectedOption < 0)
        }
    }

    // MARK: - Results Mode

    var resultsView: some View {
        VStack(spacing: 12) {
            if isLoadingResults {
                ProgressView("Loading results...")
                    .padding()
            }

            ForEach(proposal.options) { option in
                let votes = votesForOption(option.id)
                let percentage = totalVotes > 0 ? Double(votes) / Double(totalVotes) : 0
                let isUserChoice = previousVote == option.id

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(option.name)
                            .font(.customFont(font: .helvetica, style: isUserChoice ? .bold : .regular, size: 16))
                        Spacer()
                        Text("\(votes) vote\(votes == 1 ? "" : "s")")
                            .font(.customFont(font: .helvetica, style: .regular, size: 14))
                            .foregroundStyle(.naturalMain)
                    }

                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .foregroundStyle(.gray.opacity(0.2))
                                .frame(height: 8)
                            RoundedRectangle(cornerRadius: 4)
                                .foregroundStyle(isUserChoice ? .tomato : .blue)
                                .frame(width: geometry.size.width * percentage, height: 8)
                        }
                    }
                    .frame(height: 8)

                    HStack {
                        Text(String(format: "%.1f%%", percentage * 100))
                            .font(.customFont(font: .helvetica, style: .regular, size: 12))
                            .foregroundStyle(.naturalMain)
                        if isUserChoice {
                            Text("Your vote")
                                .font(.customFont(font: .helvetica, style: .bold, size: 12))
                                .foregroundColor(.tomato)
                        }
                    }
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .foregroundStyle(isUserChoice ? Color.tomato.opacity(0.05) : .white)
                )
                .padding(.horizontal)
            }

            Text("Total: \(totalVotes) vote\(totalVotes == 1 ? "" : "s")")
                .font(.customFont(font: .helvetica, style: .bold, size: 14))
                .foregroundStyle(.naturalMain)
                .padding(.top, 8)
        }
    }

    func votesForOption(_ optionIndex: Int) -> Int64 {
        // votingResults[0][optionIndex] — first question group, option index
        guard !currentResults.isEmpty, optionIndex < currentResults[0].count else { return 0 }
        return currentResults[0][optionIndex]
    }

    func fetchFreshResults() {
        isLoadingResults = true
        Task {
            do {
                let results = try await ProposalProvider.getVotingResults(
                    rpcURL: appViewModel.config.rarimo.targetChainRPCURL,
                    contractAddress: appViewModel.config.freedom.proposalsStateAddress,
                    proposalId: proposal.proposalId
                )
                await MainActor.run {
                    freshResults = results
                    isLoadingResults = false
                }
            } catch {
                Logger.main.error("Failed to fetch voting results: \(error)")
                await MainActor.run {
                    isLoadingResults = false
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        VoteOptionsView(proposal: .sample, showResults: true)
            .environmentObject(AppView.ViewModel())
    }
}
