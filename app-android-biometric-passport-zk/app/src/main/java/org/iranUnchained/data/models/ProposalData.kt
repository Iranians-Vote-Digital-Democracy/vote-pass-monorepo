package org.iranUnchained.data.models

import android.os.Parcelable
import kotlinx.android.parcel.Parcelize
import kotlinx.serialization.Serializable

enum class ProposalStatus(val value: Int) {
    None(0),
    Waiting(1),
    Started(2),
    Ended(3),
    DoNotShow(4);

    companion object {
        fun fromValue(value: Int): ProposalStatus =
            entries.find { it.value == value } ?: None
    }
}

@Parcelize
@Serializable
data class ProposalData(
    val proposalId: Long,
    val title: String,
    val description: String,
    val options: List<OptionsData>,
    val startTimestamp: Long,
    val endTimestamp: Long,
    val status: ProposalStatus,
    val votingResults: List<List<Long>>,
    val multichoice: Long,
    val votingContractAddress: String,
    val proposalSMTAddress: String,
    val citizenshipWhitelist: List<Long>,
) : Parcelable {

    val isActive: Boolean
        get() = status == ProposalStatus.Started

    val isEnded: Boolean
        get() = status == ProposalStatus.Ended

    fun toVotingData(): VotingData {
        return VotingData(
            header = title,
            description = description,
            excerpt = description.take(200),
            isPassportRequired = true,
            dueDate = endTimestamp,
            startDate = startTimestamp,
            contractAddress = votingContractAddress,
            requirements = RequirementsForVoting(
                nationality = citizenshipWhitelist.map { java.math.BigInteger.valueOf(it) },
                age = null
            ),
            isManifest = false,
            options = options,
            votingCount = totalVotes(),
            isActive = isActive,
            metadata = null
        )
    }

    fun totalVotes(): Long {
        return votingResults.sumOf { optionResults ->
            optionResults.sum()
        }
    }

    fun isMultichoice(questionIndex: Int): Boolean {
        return multichoice and (1L shl questionIndex) != 0L
    }
}

@Parcelize
@Serializable
data class ProposalMetadata(
    val title: String = "",
    val description: String = "",
    val options: List<String> = emptyList()
) : Parcelable
