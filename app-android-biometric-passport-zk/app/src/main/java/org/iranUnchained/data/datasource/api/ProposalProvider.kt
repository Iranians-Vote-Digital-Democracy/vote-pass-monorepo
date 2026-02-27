package org.iranUnchained.data.datasource.api

import android.util.Log
import io.reactivex.Single
import org.iranUnchained.base.ActiveConfig
import org.iranUnchained.contracts.ProposalsState
import org.iranUnchained.data.models.OptionsData
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.ProposalStatus
import org.iranUnchained.di.providers.ApiProvider
import org.iranUnchained.utils.ProposalParser
import org.web3j.abi.FunctionEncoder
import org.web3j.abi.datatypes.Function
import org.web3j.abi.datatypes.Type
import org.web3j.abi.datatypes.generated.Uint256
import org.web3j.crypto.Credentials
import org.web3j.crypto.Keys
import org.web3j.protocol.Web3j
import org.web3j.protocol.core.DefaultBlockParameterName
import org.web3j.protocol.core.methods.request.Transaction
import org.web3j.tx.gas.DefaultGasProvider
import java.math.BigInteger
import java.util.Collections

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
                    val info = decodeProposalInfo(web3j, ActiveConfig.PROPOSAL_ADDRESS, BigInteger.valueOf(id))
                    val status = ProposalStatus.fromValue(info.status)

                    if (status == ProposalStatus.None || status == ProposalStatus.DoNotShow) {
                        continue
                    }

                    val metadata = ProposalParser.parseDescription(info.description)

                    val options = if (metadata.options.isNotEmpty()) {
                        metadata.options.mapIndexed { index, name ->
                            OptionsData(name, index)
                        }
                    } else {
                        info.acceptedOptions.mapIndexed { index, _ ->
                            OptionsData("Option ${index + 1}", index)
                        }
                    }

                    val votingContractAddress = if (info.votingWhitelist.isNotEmpty()) {
                        info.votingWhitelist[0]
                    } else {
                        ""
                    }

                    val citizenshipWhitelist = ProposalParser.parseVotingWhitelistData(info.votingWhitelistData)

                    val proposal = ProposalData(
                        proposalId = id,
                        title = metadata.title,
                        description = metadata.description,
                        options = options,
                        startTimestamp = info.startTimestamp,
                        endTimestamp = info.startTimestamp + info.duration,
                        status = status,
                        votingResults = info.votingResults,
                        multichoice = info.multichoice,
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

    /**
     * Re-fetch voting results for a single proposal from chain.
     * Used by VoteOptionsActivity to show up-to-date results after voting.
     */
    fun getVotingResults(apiProvider: ApiProvider, proposalId: Long): Single<List<List<Long>>> {
        return Single.fromCallable {
            val web3j = apiProvider.web3
            val info = decodeProposalInfo(web3j, ActiveConfig.PROPOSAL_ADDRESS, BigInteger.valueOf(proposalId))
            info.votingResults
        }
    }

    /**
     * Manually decode getProposalInfo() ABI response to avoid web3j's broken
     * DynamicStruct decoder (fails with "Array types must be wrapped in a TypeReference"
     * on nested structs containing DynamicArray fields in web3j 4.8.8).
     */
    private fun decodeProposalInfo(web3j: Web3j, contractAddress: String, proposalId: BigInteger): DecodedProposalInfo {
        val function = Function(
            "getProposalInfo",
            listOf<Type<*>>(Uint256(proposalId)),
            Collections.emptyList()
        )
        val encodedFunction = FunctionEncoder.encode(function)

        val response = web3j.ethCall(
            Transaction.createEthCallTransaction(
                "0x0000000000000000000000000000000000000000",
                contractAddress,
                encodedFunction
            ),
            DefaultBlockParameterName.LATEST
        ).send()

        val hex = response.value.removePrefix("0x")
        return parseProposalInfoHex(hex)
    }

    /**
     * Parse ABI-encoded ProposalInfo struct from raw hex.
     *
     * Layout (ProposalInfo is returned as a single tuple):
     *   word 0: offset to struct (0x20)
     *   struct:
     *     +0x00: proposalSMT (address)
     *     +0x20: status (uint8)
     *     +0x40: offset to ProposalConfig (relative to struct start)
     *     +0x60: offset to votingResults (relative to struct start)
     *   ProposalConfig (at struct + configOffset):
     *     +0x00: startTimestamp (uint64)
     *     +0x20: duration (uint64)
     *     +0x40: multichoice (uint256)
     *     +0x60: offset to acceptedOptions (relative to config start)
     *     +0x80: offset to description (relative to config start)
     *     +0xa0: offset to votingWhitelist (relative to config start)
     *     +0xc0: offset to votingWhitelistData (relative to config start)
     */
    private fun parseProposalInfoHex(hex: String): DecodedProposalInfo {
        // word 0: offset to struct data
        val structOffset = readUint(hex, 0).toInt()
        val s = structOffset * 2 // char offset

        // ProposalInfo fields
        val proposalSMT = "0x" + hex.substring(s + 24, s + 64) // address is last 20 bytes of 32-byte word
        val status = readUint(hex, s + 64).toInt()
        val configOffset = readUint(hex, s + 128).toInt()
        val votingResultsOffset = readUint(hex, s + 192).toInt()

        // ProposalConfig at struct + configOffset
        val c = s + configOffset * 2
        val startTimestamp = readUint(hex, c).toLong()
        val duration = readUint(hex, c + 64).toLong()
        val multichoice = readUint(hex, c + 128).toLong()
        val acceptedOptionsOffset = readUint(hex, c + 192).toInt()
        val descriptionOffset = readUint(hex, c + 256).toInt()
        val votingWhitelistOffset = readUint(hex, c + 320).toInt()
        val votingWhitelistDataOffset = readUint(hex, c + 384).toInt()

        // Parse acceptedOptions: uint256[]
        val aoBase = c + acceptedOptionsOffset * 2
        val aoLen = readUint(hex, aoBase).toInt()
        val acceptedOptions = (0 until aoLen).map { i ->
            readUint(hex, aoBase + 64 + i * 64)
        }

        // Parse description: string (bytes)
        val descBase = c + descriptionOffset * 2
        val descLen = readUint(hex, descBase).toInt()
        val descBytes = hexToBytes(hex.substring(descBase + 64, descBase + 64 + descLen * 2))
        val description = String(descBytes)

        // Parse votingWhitelist: address[]
        val vwBase = c + votingWhitelistOffset * 2
        val vwLen = readUint(hex, vwBase).toInt()
        val votingWhitelist = (0 until vwLen).map { i ->
            val wordStart = vwBase + 64 + i * 64
            "0x" + hex.substring(wordStart + 24, wordStart + 64)
        }

        // Parse votingWhitelistData: bytes[]
        val vwdBase = c + votingWhitelistDataOffset * 2
        val vwdLen = readUint(hex, vwdBase).toInt()
        val votingWhitelistData = (0 until vwdLen).map { i ->
            val elementOffset = readUint(hex, vwdBase + 64 + i * 64).toInt()
            val elemBase = vwdBase + 64 + elementOffset * 2
            val elemLen = readUint(hex, elemBase).toInt()
            hexToBytes(hex.substring(elemBase + 64, elemBase + 64 + elemLen * 2))
        }

        // Parse votingResults: uint256[8][] (dynamic array of static arrays of 8)
        val vrBase = s + votingResultsOffset * 2
        val vrLen = readUint(hex, vrBase).toInt()
        val votingResults = (0 until vrLen).map { i ->
            // Each element is a static array of 8 uint256s (8 * 32 = 256 bytes)
            val elemStart = vrBase + 64 + i * 8 * 64
            (0 until 8).map { j ->
                readUint(hex, elemStart + j * 64).toLong()
            }
        }

        return DecodedProposalInfo(
            proposalSMT = proposalSMT,
            status = status,
            startTimestamp = startTimestamp,
            duration = duration,
            multichoice = multichoice,
            acceptedOptions = acceptedOptions,
            description = description,
            votingWhitelist = votingWhitelist,
            votingWhitelistData = votingWhitelistData,
            votingResults = votingResults
        )
    }

    /** Read a 256-bit unsigned integer from hex at the given character offset. */
    private fun readUint(hex: String, charOffset: Int): BigInteger {
        return BigInteger(hex.substring(charOffset, charOffset + 64), 16)
    }

    /** Convert hex string to byte array. */
    private fun hexToBytes(hex: String): ByteArray {
        val len = hex.length / 2
        val bytes = ByteArray(len)
        for (i in 0 until len) {
            bytes[i] = hex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
        return bytes
    }

    /** Flattened ProposalInfo data from manual ABI decoding. */
    private data class DecodedProposalInfo(
        val proposalSMT: String,
        val status: Int,
        val startTimestamp: Long,
        val duration: Long,
        val multichoice: Long,
        val acceptedOptions: List<BigInteger>,
        val description: String,
        val votingWhitelist: List<String>,
        val votingWhitelistData: List<ByteArray>,
        val votingResults: List<List<Long>>
    )
}
