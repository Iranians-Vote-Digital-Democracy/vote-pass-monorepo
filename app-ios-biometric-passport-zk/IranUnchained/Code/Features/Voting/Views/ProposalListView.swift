//
//  ProposalListView.swift
//  IranUnchained
//
//  Main voting screen — shows active and completed proposals.
//

import SwiftUI

enum ProposalTab: String, CaseIterable {
    case active = "Active"
    case completed = "Completed"
}

struct ProposalListView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel

    @State private var selectedTab: ProposalTab = .active
    @State private var selectedProposal: ProposalData?
    @State private var showDetail = false

    var displayedProposals: [ProposalData] {
        switch selectedTab {
        case .active: return appViewModel.activeProposals
        case .completed: return appViewModel.endedProposals
        }
    }

    var body: some View {
        ZStack {
            Color.lightGrey.ignoresSafeArea()
            VStack(spacing: 0) {
                tabPicker
                    .padding(.horizontal)
                    .padding(.top, 8)

                if displayedProposals.isEmpty {
                    Spacer()
                    emptyState
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(displayedProposals) { proposal in
                                ProposalCardView(proposal: proposal)
                                    .onTapGesture {
                                        selectedProposal = proposal
                                        showDetail = true
                                    }
                            }
                        }
                        .padding()
                    }
                }
            }
        }
        .navigationDestination(isPresented: $showDetail) {
            if let proposal = selectedProposal {
                ProposalDetailView(proposal: proposal)
            }
        }
    }

    var tabPicker: some View {
        Picker("", selection: $selectedTab) {
            ForEach(ProposalTab.allCases, id: \.self) { tab in
                Text(tab.rawValue).tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .frame(width: 320)
    }

    var emptyState: some View {
        VStack(spacing: 12) {
            Text("No polls available")
                .font(.customFont(font: .helvetica, style: .bold, size: 20))
                .foregroundStyle(.naturalMain)
            Text("Check back later for new proposals")
                .font(.customFont(font: .helvetica, style: .regular, size: 14))
                .foregroundStyle(.naturalMain)
        }
        .multilineTextAlignment(.center)
        .padding()
    }
}

struct ProposalCardView: View {
    let proposal: ProposalData

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .foregroundStyle(.white)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(proposal.title)
                        .font(.customFont(font: .helvetica, style: .bold, size: 16))
                        .lineLimit(2)
                    Spacer()
                    statusBadge
                }

                Text(proposal.description)
                    .font(.customFont(font: .helvetica, style: .regular, size: 14))
                    .foregroundStyle(.naturalMain)
                    .lineLimit(2)

                HStack {
                    let previousVote = SimpleStorage.getVoteResult(proposalId: proposal.proposalId)
                    if previousVote >= 0, previousVote < proposal.options.count {
                        Text("You voted for: \(proposal.options[previousVote].name)")
                            .font(.customFont(font: .helvetica, style: .bold, size: 12))
                            .foregroundColor(.blue)
                    }
                    Spacer()
                    Text(endDateText)
                        .font(.customFont(font: .helvetica, style: .regular, size: 12))
                        .foregroundStyle(.naturalMain)
                }
            }
            .padding()
        }
        .frame(height: 120)
    }

    var statusBadge: some View {
        let (text, color): (String, Color) = {
            switch proposal.status {
            case .started: return ("Active", .blue)
            case .ended: return ("Ended", .black)
            case .waiting: return ("Waiting", .yellow)
            default: return ("", .clear)
            }
        }()

        return Text(text)
            .font(.customFont(font: .helvetica, style: .bold, size: 12))
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .foregroundStyle(color)
            )
    }

    var endDateText: String {
        let date = Date(timeIntervalSince1970: TimeInterval(proposal.endTimestamp))
        if proposal.status == .started {
            return "Ends " + date.formatted(date: .abbreviated, time: .shortened)
        } else {
            return "Ended " + date.formatted(date: .abbreviated, time: .shortened)
        }
    }
}

#Preview {
    let vm = AppView.ViewModel()
    NavigationStack {
        ProposalListView()
            .environmentObject(vm)
    }
}
