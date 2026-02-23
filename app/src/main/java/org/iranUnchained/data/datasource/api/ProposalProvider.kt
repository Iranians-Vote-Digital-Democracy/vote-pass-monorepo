package org.iranUnchained.data.datasource.api

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonParser
import io.reactivex.Single
import org.iranUnchained.base.ActiveConfig
import org.iranUnchained.contracts.ProposalsState
import org.iranUnchained.data.models.OptionsData
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.ProposalMetadata
import org.iranUnchained.data.models.ProposalStatus
import org.iranUnchained.di.providers.ApiProvider
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
                    val metadata = parseDescription(config.description)

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

                    val citizenshipWhitelist = parseVotingWhitelistData(config.votingWhitelistData)

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

    private fun parseDescription(description: String): ProposalMetadata {
        return try {
            val json = JsonParser.parseString(description).asJsonObject
            ProposalMetadata(
                title = json.get("title")?.asString ?: "",
                description = json.get("description")?.asString ?: "",
                options = json.getAsJsonArray("options")?.map { it.asString } ?: emptyList()
            )
        } catch (e: Exception) {
            ProposalMetadata(
                title = description.take(100),
                description = description,
                options = emptyList()
            )
        }
    }

    private fun parseVotingWhitelistData(whitelistData: List<ByteArray>): List<Long> {
        if (whitelistData.isEmpty()) return emptyList()

        return try {
            val data = whitelistData[0]
            if (data.isEmpty()) return emptyList()

            val result = mutableListOf<Long>()
            // votingWhitelistData is ABI-encoded ProposalRules struct
            // Parse citizenship whitelist from the encoded bytes
            // The citizenship whitelist is a uint256[] inside the ProposalRules tuple
            // For simplicity, we extract country codes from the raw ABI data
            val bi = BigInteger(1, data)
            if (bi != BigInteger.ZERO) {
                // If there's data, try to decode it as ABI-encoded ProposalRules
                // The struct has: selector, citizenshipWhitelist[], and other fields
                // Skip selector (32 bytes), then read the dynamic array offset and data
                if (data.size >= 64) {
                    // Read offset to citizenshipWhitelist (at byte 32)
                    val offsetBytes = data.copyOfRange(32, 64)
                    val offset = BigInteger(1, offsetBytes).toInt()

                    if (offset + 32 <= data.size) {
                        // Read array length
                        val lengthBytes = data.copyOfRange(offset, offset + 32)
                        val length = BigInteger(1, lengthBytes).toInt()

                        // Read each element
                        for (i in 0 until length) {
                            val elemStart = offset + 32 + (i * 32)
                            if (elemStart + 32 <= data.size) {
                                val elemBytes = data.copyOfRange(elemStart, elemStart + 32)
                                result.add(BigInteger(1, elemBytes).toLong())
                            }
                        }
                    }
                }
            }
            result
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse voting whitelist data", e)
            emptyList()
        }
    }
}
