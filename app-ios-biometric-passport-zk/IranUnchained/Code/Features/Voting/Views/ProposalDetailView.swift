//
//  ProposalDetailView.swift
//  IranUnchained
//
//  Proposal detail — shows title, description, eligibility, and voting status.
//

import SwiftUI

struct ProposalDetailView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel

    let proposal: ProposalData

    @State private var navigateToOptions = false
    @State private var navigateToResults = false

    var previousVote: Int {
        SimpleStorage.getVoteResult(proposalId: proposal.proposalId)
    }

    var isEligible: Bool {
        guard let user = appViewModel.user else { return false }

        if !proposal.citizenshipWhitelist.isEmpty {
            let code = Int64(user.getIssuingAuthorityCode())
            if !proposal.citizenshipWhitelist.contains(code) {
                return false
            }
        }

        return proposal.isActive
    }

    var body: some View {
        ZStack {
            Color.lightGrey.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    headerCard
                    descriptionCard
                    actionArea
                }
                .padding()
            }
        }
        .navigationTitle("Proposal")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $navigateToOptions) {
            VoteOptionsView(proposal: proposal, showResults: false)
        }
        .navigationDestination(isPresented: $navigateToResults) {
            VoteOptionsView(proposal: proposal, showResults: true)
        }
    }

    var headerCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .foregroundColor(.tomato)
                .opacity(0.5)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Spacer()
                    statusBadge
                }
                Spacer()
                Text(proposal.title)
                    .font(.customFont(font: .helvetica, style: .bold, size: 24))
                    .foregroundStyle(.primary)

                Text(timeRemainingText)
                    .font(.customFont(font: .helvetica, style: .regular, size: 14))
                    .foregroundStyle(.naturalMain)
            }
            .padding()
        }
        .frame(height: 130)
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
            .font(.customFont(font: .helvetica, style: .bold, size: 14))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(RoundedRectangle(cornerRadius: 8).foregroundStyle(color))
    }

    var descriptionCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .foregroundStyle(.white)
            VStack(alignment: .leading, spacing: 8) {
                Text("Description")
                    .font(.customFont(font: .helvetica, style: .bold, size: 16))
                Text(proposal.description)
                    .font(.customFont(font: .helvetica, style: .regular, size: 14))
                    .foregroundStyle(.naturalMain)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    var actionArea: some View {
        if previousVote >= 0 {
            // Already voted
            VStack(spacing: 12) {
                if previousVote < proposal.options.count {
                    Text("You voted for: \(proposal.options[previousVote].name)")
                        .font(.customFont(font: .helvetica, style: .bold, size: 16))
                        .foregroundColor(.blue)
                }
                Button {
                    navigateToResults = true
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
        } else if isEligible {
            // Can vote
            Button {
                navigateToOptions = true
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .foregroundStyle(.tomato)
                    Text("Participate")
                        .font(.customFont(font: .helvetica, style: .bold, size: 16))
                        .foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .frame(height: 46)
        } else if appViewModel.user == nil {
            Text("Scan your passport to participate")
                .font(.customFont(font: .helvetica, style: .regular, size: 14))
                .foregroundStyle(.naturalMain)
        } else if !proposal.isActive {
            Text("This proposal is no longer active")
                .font(.customFont(font: .helvetica, style: .regular, size: 14))
                .foregroundStyle(.naturalMain)
        } else {
            Text("You are not eligible for this proposal")
                .font(.customFont(font: .helvetica, style: .regular, size: 14))
                .foregroundStyle(.naturalMain)
        }
    }

    var timeRemainingText: String {
        let now = Int64(Date().timeIntervalSince1970)
        if proposal.isActive {
            let remaining = proposal.endTimestamp - now
            if remaining <= 0 { return "Ending soon" }
            let hours = remaining / 3600
            let days = hours / 24
            if days > 0 {
                return "\(days) day\(days == 1 ? "" : "s") remaining"
            } else if hours > 0 {
                return "\(hours) hour\(hours == 1 ? "" : "s") remaining"
            } else {
                let minutes = remaining / 60
                return "\(max(minutes, 1)) min remaining"
            }
        } else {
            let endDate = Date(timeIntervalSince1970: TimeInterval(proposal.endTimestamp))
            return "Ended " + endDate.formatted(date: .abbreviated, time: .shortened)
        }
    }
}

#Preview {
    NavigationStack {
        ProposalDetailView(proposal: .sample)
            .environmentObject(AppView.ViewModel())
    }
}
