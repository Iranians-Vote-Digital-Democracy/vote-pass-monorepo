package org.iranUnchained.data.models

data class VoteSubmissionRequest(
    val data: VoteSubmissionRequestData
)

data class VoteSubmissionRequestData(
    val attributes: VoteSubmissionAttributes
)

data class VoteSubmissionAttributes(
    val tx_data: String,
    val destination: String
)

data class VoteSubmissionResponse(
    val data: VoteSubmissionResponseData
)

data class VoteSubmissionResponseData(
    val id: String,
    val type: String
)
