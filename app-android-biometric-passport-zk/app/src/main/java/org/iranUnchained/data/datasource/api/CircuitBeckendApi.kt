package org.iranUnchained.data.datasource.api

import io.reactivex.Single
import okhttp3.ResponseBody
import org.iranUnchained.data.models.ClaimId
import org.iranUnchained.data.models.ClaimOfferResponse
import org.iranUnchained.data.models.GistData
import org.iranUnchained.data.models.Payload
import org.iranUnchained.data.models.RegistrationData
import org.iranUnchained.data.models.SendCalldataRequest
import org.iranUnchained.data.models.VoteSubmissionRequest
import org.iranUnchained.data.models.VoteSubmissionResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.HeaderMap
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.http.Url

interface CircuitBackendApi {
    @POST
    fun createIdentity(@Url url: String, @Body body: Payload): Single<ClaimId>

    @GET
    fun gistData(
        @Url url: String,
        @Query("user_did") user_did: String,
        @Query("block_number") block_number: String
    ): Single<GistData>

    @GET
    fun fetchForProofGet(
        @Url url: String, @HeaderMap headers: Map<String, String>
    ): Single<ResponseBody>

    @POST
    fun fetchForProofPost(
        @Url url: String, @Body body: String, @HeaderMap headers: Map<String, String>
    ): Single<ResponseBody>

    @GET
    fun claimOffer(
        @Url url: String
    ): Single<ClaimOfferResponse>

    @POST
    fun sendRegistration(@Url url: String, @Body body: SendCalldataRequest): Single<ResponseBody>

    @GET
    fun getRegistrationData(@Url url: String): Single<RegistrationData>

    @POST
    fun submitVote(@Url url: String, @Body body: VoteSubmissionRequest): Single<VoteSubmissionResponse>
}
