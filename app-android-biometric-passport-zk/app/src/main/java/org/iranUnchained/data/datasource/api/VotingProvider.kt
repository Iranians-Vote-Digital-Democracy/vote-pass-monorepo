package org.iranUnchained.data.datasource.api

import android.util.Log
import io.reactivex.Observable
import io.reactivex.Single
import org.iranUnchained.base.ActiveConfig
import org.iranUnchained.contracts.RegistrationVerifier
import org.iranUnchained.contracts.SRegistration
import org.iranUnchained.data.models.RequirementsForVoting
import org.iranUnchained.data.models.VotingData
import org.iranUnchained.di.providers.ApiProvider
import org.iranUnchained.utils.ObservableTransformers
import org.iranUnchained.utils.isEnded
import org.iranUnchained.utils.isStarted
import org.web3j.crypto.Credentials
import org.web3j.crypto.Keys
import org.web3j.tx.gas.DefaultGasProvider
import java.math.BigInteger

object VotingProvider {
    private const val MAX_DISPLAY_VOTES = 1L
    fun getVotes(apiProvider: ApiProvider): Single<Pair<List<VotingData>, List<VotingData>>> {
        return Single.fromCallable {

            val web3j = apiProvider.web3
            val ecKeyPair = Keys.createEcKeyPair()

            val credentials = Credentials.create(ecKeyPair)
            val gasProvider = DefaultGasProvider()

            val contract = org.iranUnchained.contracts.RegistrationVoting.load(
                ActiveConfig.REGISTRATION_ADDRESS, web3j, credentials, gasProvider
            )

            val numberOfVoting = contract.poolCountByProposerAndType(
                ActiveConfig.PROPOSAL_ADDRESS, ActiveConfig.REGISTRATION_TYPE
            ).send()

            val offset: BigInteger = if (numberOfVoting <= BigInteger.valueOf(MAX_DISPLAY_VOTES)) {
                BigInteger.ZERO
            } else {
                numberOfVoting - BigInteger.valueOf(MAX_DISPLAY_VOTES)
            }


            val resp = contract.listPoolsByProposerAndType(
                ActiveConfig.PROPOSAL_ADDRESS,
                ActiveConfig.REGISTRATION_TYPE,
                offset,//numberOfVoting.minus(BigInteger.valueOf(1L)),
                BigInteger.valueOf(MAX_DISPLAY_VOTES)
            ).send()

            val voteList = mutableListOf<VotingData>()
            val voteListEnded = mutableListOf<VotingData>()

            val registrationDataListSingle =
                Observable.fromIterable(resp).flatMapSingle { registrationAddress ->
                    Single.fromCallable {
                        val registration = SRegistration.load(
                            registrationAddress as String, web3j, credentials, gasProvider
                        )

                        val addressVerifier = registration.registerVerifier().send()
                        Log.i("Registration", addressVerifier)
                        val registrationVerifier = RegistrationVerifier.load(
                            addressVerifier, web3j, credentials, gasProvider
                        )

                        Log.i("RegistrationVerifier", addressVerifier)
                        Log.i("SRegistration", registrationAddress as String)

                        val arrayOfCountries = registrationVerifier.listIssuingAuthorityWhitelist(
                            BigInteger.ZERO, BigInteger.valueOf(100L)
                        ).send()

                        val data = registration.registrationInfo().send()
                        val (url, time, registeredCount) = data

                        Log.i("URL", url)
                        val registrationData =
                            apiProvider.circuitBackend.getRegistrationData(url).blockingGet()

                        VotingData(
                            header = registrationData.name,
                            excerpt = registrationData.excerpt,
                            description = registrationData.description,
                            contractAddress = registrationAddress,
                            dueDate = time.commitmentEndTime.toLong(),
                            startDate = time.commitmentStartTime.toLong(),
                            isPassportRequired = true,
                            requirements = RequirementsForVoting(
                                arrayOfCountries as List<BigInteger>, 16
                            ),
                            isManifest = true,
                            isActive = registrationData.isActive == true && !isEnded(time.commitmentEndTime.toLong()) && isEnded(time.commitmentStartTime.toLong()),
                            votingCount = registeredCount.totalRegistrations.toLong(),
                            metadata = registrationData.metadata
                        )
                    }.compose(ObservableTransformers.defaultSchedulersSingle())
                }.toList()

            val registrationDataList = registrationDataListSingle.blockingGet()

            registrationDataList.forEach { votingData ->
                if (isEnded(votingData.dueDate!!)) {
                    voteListEnded.add(votingData)
                } else {
                    voteList.add(votingData)
                }
            }

            voteList.sortBy { it.dueDate }
            voteListEnded.sortBy { it.dueDate }

            Pair(voteList, voteListEnded)
        }
    }


}

//            val vote1 = VotingData(
//                header = context.resources.getString(R.string.pool_1_header),
//                description = context.resources.getString(R.string.pool_1),
//                dueDate = 1710453600L,
//                isPassportRequired = true,
//                requirements = RequirementsForVoting("RUS", 21),
//                options = listOf(
//                    OptionsData(context.getString(R.string.name1), 0),
//                    OptionsData(context.getString(R.string.name2), 1),
//                    OptionsData(context.getString(R.string.name3), 2)
//                )
//            )
