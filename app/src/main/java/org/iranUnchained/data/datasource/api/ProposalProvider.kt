package org.iranUnchained.data.datasource.api

import android.util.Log
import com.google.gson.Gson
import io.reactivex.Single
import org.iranUnchained.base.ActiveConfig
import org.iranUnchained.contracts.ProposalsState
import org.iranUnchained.data.models.OptionsData
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.ProposalMetadata
import org.iranUnchained.data.models.ProposalStatus
import org.iranUnchained.di.providers.ApiProvider
import org.iranUnchained.utils.ProposalParser
import org.web3j.crypto.Credentials
import org.web3j.crypto.Keys
import org.web3j.tx.gas.DefaultGasProvider
import java.math.BigInteger

object ProposalProvider {
    private const val TAG = "ProposalProvider"

    fun getProposals(apiProvider: ApiProvider): Single<Pair<List<ProposalData>, List<ProposalData>>> {
        return Single.fromCallable {
            val web3j = apiProvider.web3
            val ecKeyPair = Keys.createEcKeyPair()
            val credentials = Credentials.create(ecKeyPair)
            val gasProvider = DefaultGasProvider()

            val contract = ProposalsState.load(
                ActiveConfig.PROPOSAL_ADDRESS, web3j, credentials, gasProvider
            )

            val lastId = contract.lastProposalId().send()
            Log.d(TAG, "Last proposal ID: $lastId")

            val activeList = mutableListOf<ProposalData>()
            val endedList = mutableListOf<ProposalData>()

            for (id in 1..lastId.toLong()) {
                try {
                    val info = contract.getProposalInfo(BigInteger.valueOf(id)).send()
                    val status = ProposalStatus.fromValue(info.status.toInt())

                    if (status == ProposalStatus.None || status == ProposalStatus.DoNotShow) {
                        continue
                    }

                    val config = info.config
                    val metadata = ProposalParser.parseDescription(config.description)

                    val options = if (metadata.options.isNotEmpty()) {
                        metadata.options.mapIndexed { index, name ->
                            OptionsData(name, index)
                        }
                    } else {
                        config.acceptedOptions.mapIndexed { index, _ ->
                            OptionsData("Option ${index + 1}", index)
                        }
                    }

                    val votingContractAddress = if (config.votingWhitelist.isNotEmpty()) {
                        config.votingWhitelist[0]
                    } else {
                        ""
                    }

                    val citizenshipWhitelist = ProposalParser.parseVotingWhitelistData(config.votingWhitelistData)

                    val votingResultsRaw = info.votingResults ?: emptyList()
                    val votingResults = votingResultsRaw.map { optionResults ->
                        optionResults.map { it.toLong() }
                    }

                    val startTimestamp = config.startTimestamp.toLong()
                    val duration = config.duration.toLong()

                    val proposal = ProposalData(
                        proposalId = id,
                        title = metadata.title,
                        description = metadata.description,
                        options = options,
                        startTimestamp = startTimestamp,
                        endTimestamp = startTimestamp + duration,
                        status = status,
                        votingResults = votingResults,
                        multichoice = config.multichoice.toLong(),
                        votingContractAddress = votingContractAddress,
                        proposalSMTAddress = info.proposalSMT,
                        citizenshipWhitelist = citizenshipWhitelist
                    )

                    when (status) {
                        ProposalStatus.Started -> activeList.add(proposal)
                        ProposalStatus.Ended, ProposalStatus.Waiting -> endedList.add(proposal)
                        else -> {}
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to load proposal $id", e)
                }
            }

            activeList.sortBy { it.startTimestamp }
            endedList.sortBy { it.startTimestamp }

            Pair(activeList, endedList)
        }
    }

}
