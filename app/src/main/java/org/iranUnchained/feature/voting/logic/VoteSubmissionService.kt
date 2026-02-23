package org.iranUnchained.feature.voting.logic

import android.content.Context
import android.util.Log
import io.reactivex.Observable
import io.reactivex.ObservableEmitter
import org.iranUnchained.R
import org.iranUnchained.base.ActiveConfig
import org.iranUnchained.contracts.ProposalsState
import org.iranUnchained.data.models.IdentityData
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.VoteSubmissionAttributes
import org.iranUnchained.data.models.VoteSubmissionRequest
import org.iranUnchained.data.models.VoteSubmissionRequestData
import org.iranUnchained.di.providers.ApiProvider
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import org.iranUnchained.BuildConfig
import org.iranUnchained.utils.CalldataEncoder
import org.iranUnchained.utils.PassportDataExporter
import org.iranUnchained.utils.ZKPTools
import org.iranUnchained.utils.ZKPUseCase
import org.web3j.crypto.Credentials
import org.web3j.crypto.Keys
import org.web3j.tx.gas.DefaultGasProvider
import java.math.BigInteger
import java.util.Calendar

data class VoteProgress(val step: Int)

class VoteSubmissionService(
    private val context: Context,
    private val apiProvider: ApiProvider
) {
    companion object {
        private const val TAG = "VoteSubmissionService"
    }

    fun submitVote(
        proposalData: ProposalData,
        selectedOptions: List<Int>
    ): Observable<VoteProgress> {
        return Observable.create { emitter ->
            try {
                // Step 0: Building proof inputs
                emitter.onNext(VoteProgress(0))
                val proofInputs = buildProofInputs(proposalData, selectedOptions)

                // Step 1: Generating ZK proof
                emitter.onNext(VoteProgress(1))
                val zkProof = generateGroth16Proof(proofInputs)

                if (BuildConfig.DEBUG) {
                    PassportDataExporter.exportProofData(
                        zkProof,
                        proofInputs.registrationRoot,
                        proofInputs.currentDate,
                        proofInputs.proposalEventId,
                        proofInputs.nullifier,
                        proofInputs.citizenship,
                        proofInputs.identityCreationTimestamp,
                        proofInputs.votes
                    )
                    Log.i(TAG, "Proof data exported to logcat for test extraction")
                }

                // Step 2: Submitting vote
                emitter.onNext(VoteProgress(2))
                val txHash = submitToRelayer(
                    proposalData,
                    proofInputs,
                    zkProof,
                    selectedOptions
                )
                Log.i(TAG, "Vote submitted, tx: $txHash")

                // Save voted state
                val identityData = getIdentityData()
                if (identityData != null) {
                    SecureSharedPrefs.saveVotedAddress(
                        context,
                        identityData.nullifierHex,
                        proposalData.votingContractAddress
                    )
                }

                // Step 3: Vote confirmed
                emitter.onNext(VoteProgress(3))
                emitter.onComplete()
            } catch (e: Exception) {
                Log.e(TAG, "Vote submission failed", e)
                emitter.onError(e)
            }
        }
    }

    private data class ProofInputs(
        val registrationRoot: ByteArray,
        val currentDate: BigInteger,
        val proposalEventId: BigInteger,
        val nullifier: BigInteger,
        val citizenship: BigInteger,
        val identityCreationTimestamp: BigInteger,
        val votes: List<BigInteger>,
        val inputsJson: String
    )

    private fun buildProofInputs(
        proposalData: ProposalData,
        selectedOptions: List<Int>
    ): ProofInputs {
        val identityData = getIdentityData()
            ?: throw IllegalStateException("Identity not found. Please scan your passport first.")

        val web3j = apiProvider.web3
        val ecKeyPair = Keys.createEcKeyPair()
        val credentials = Credentials.create(ecKeyPair)
        val gasProvider = DefaultGasProvider()

        // Get proposal event ID for nullifier computation
        val proposalsState = ProposalsState.load(
            ActiveConfig.PROPOSAL_ADDRESS, web3j, credentials, gasProvider
        )
        val proposalEventId = proposalsState.getProposalEventId(
            BigInteger.valueOf(proposalData.proposalId)
        ).send()

        // Get registration SMT root
        val registrationRoot = getRegistrationRoot(credentials)

        // Encode current date as yyMMdd
        val cal = Calendar.getInstance()
        val currentDate = CalldataEncoder.encodeDateAsHex(
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )

        // Encode votes as bitmasks
        val votes = CalldataEncoder.encodeVoteBitmasks(selectedOptions)

        // Parse identity fields
        val nullifier = BigInteger(identityData.nullifierHex, 16)
        val citizenship = getCitizenshipCode()
        val identityCreationTimestamp = BigInteger(identityData.timeStamp)

        // Build circuit inputs JSON
        val inputsJson = buildVoteSMTInputsJson(
            registrationRoot = registrationRoot,
            currentDate = currentDate,
            proposalEventId = proposalEventId,
            nullifier = nullifier,
            secretKey = BigInteger(identityData.secretKeyHex, 16),
            citizenship = citizenship,
            identityCreationTimestamp = identityCreationTimestamp,
            votes = votes,
            proposalId = BigInteger.valueOf(proposalData.proposalId)
        )

        return ProofInputs(
            registrationRoot = registrationRoot,
            currentDate = currentDate,
            proposalEventId = proposalEventId,
            nullifier = nullifier,
            citizenship = citizenship,
            identityCreationTimestamp = identityCreationTimestamp,
            votes = votes,
            inputsJson = inputsJson
        )
    }

    private fun generateGroth16Proof(inputs: ProofInputs): org.iranUnchained.data.models.ZkProof {
        if (BuildConfig.IS_LOCAL_DEV) {
            Log.i(TAG, "Local dev: generating mock proof (VerifierMock accepts any proof)")
            return generateMockProof()
        }

        val zkpUseCase = ZKPUseCase(context)
        val zkpTools = ZKPTools(context)

        return zkpUseCase.generateZKP(
            R.raw.vote_smt_zkey,
            R.raw.vote_smt,
            inputs.inputsJson.toByteArray(),
            zkpTools::voteSMT
        )
    }

    private fun generateMockProof(): org.iranUnchained.data.models.ZkProof {
        // Generate random proof points — VerifierMock on localhost accepts any proof
        val rand = { java.security.SecureRandom().let { r ->
            val b = ByteArray(32); r.nextBytes(b)
            org.web3j.utils.Numeric.toHexStringNoPrefix(b)
        }}
        val proof = org.iranUnchained.data.models.Proof(
            pi_a = listOf(rand(), rand()),
            pi_b = listOf(listOf(rand(), rand()), listOf(rand(), rand())),
            pi_c = listOf(rand(), rand()),
            protocol = "groth16"
        )
        return org.iranUnchained.data.models.ZkProof(
            proof = proof,
            pub_signals = emptyList()
        )
    }

    private fun submitToRelayer(
        proposalData: ProposalData,
        proofInputs: ProofInputs,
        zkProof: org.iranUnchained.data.models.ZkProof,
        selectedOptions: List<Int>
    ): String {
        // Encode userPayload
        val userPayload = CalldataEncoder.encodeUserPayload(
            proposalId = BigInteger.valueOf(proposalData.proposalId),
            votes = proofInputs.votes,
            nullifier = proofInputs.nullifier,
            citizenship = proofInputs.citizenship,
            identityCreationTimestamp = proofInputs.identityCreationTimestamp
        )

        // Encode full execute() calldata
        val calldata = CalldataEncoder.encodeExecuteCalldata(
            registrationRoot = proofInputs.registrationRoot,
            currentDate = proofInputs.currentDate,
            userPayload = userPayload,
            proof = zkProof.proof
        )

        // Submit to relayer
        val request = VoteSubmissionRequest(
            data = VoteSubmissionRequestData(
                attributes = VoteSubmissionAttributes(
                    tx_data = calldata,
                    destination = proposalData.votingContractAddress
                )
            )
        )

        val response = apiProvider.circuitBackend
            .submitVote(ActiveConfig.VOTE_LINK, request)
            .blockingGet()

        return response.data.id
    }

    private fun getIdentityData(): IdentityData? {
        val json = SecureSharedPrefs.getIdentityData(context) ?: return null
        return IdentityData.fromJson(json)
    }

    private fun getRegistrationRoot(credentials: Credentials): ByteArray {
        val web3j = apiProvider.web3
        val gasProvider = DefaultGasProvider()

        val registration = org.iranUnchained.contracts.SRegistration.load(
            ActiveConfig.REGISTRATION_ADDRESS, web3j, credentials, gasProvider
        )
        return registration.getRoot().send()
    }

    private fun getCitizenshipCode(): BigInteger {
        val issuerAuthority = SecureSharedPrefs.getIssuerAuthority(context)
        return if (issuerAuthority != null) {
            // Convert 3-letter country code to numeric representation
            val bytes = issuerAuthority.toByteArray(Charsets.US_ASCII)
            BigInteger(1, bytes)
        } else {
            BigInteger.ZERO
        }
    }

    private fun buildVoteSMTInputsJson(
        registrationRoot: ByteArray,
        currentDate: BigInteger,
        proposalEventId: BigInteger,
        nullifier: BigInteger,
        secretKey: BigInteger,
        citizenship: BigInteger,
        identityCreationTimestamp: BigInteger,
        votes: List<BigInteger>,
        proposalId: BigInteger
    ): String {
        val rootHex = org.web3j.utils.Numeric.toHexStringNoPrefix(registrationRoot)
        val votesStr = votes.joinToString(",") { "\"$it\"" }

        return """
        {
            "root": "$rootHex",
            "currentDate": "${currentDate}",
            "proposalEventId": "${proposalEventId}",
            "nullifier": "${nullifier}",
            "secretKey": "${secretKey}",
            "citizenship": "${citizenship}",
            "identityCreationTimestamp": "${identityCreationTimestamp}",
            "vote": [${votesStr}],
            "proposalId": "${proposalId}"
        }
        """.trimIndent()
    }
}
