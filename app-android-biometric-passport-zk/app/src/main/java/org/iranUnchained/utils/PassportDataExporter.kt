package org.iranUnchained.utils

import android.util.Log
import org.iranUnchained.data.models.ZkProof
import org.iranUnchained.utils.nfc.model.EDocument
import java.math.BigInteger
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Exports passport scan data and ZK proof data to logcat for extraction by host scripts.
 *
 * Data is logged with tag PASSPORT_EXPORT, wrapped in start/end markers.
 * Large payloads are chunked at 3500 chars per logcat message.
 *
 * Usage:
 *   PassportDataExporter.exportPassportData(eDocument)
 *   PassportDataExporter.exportProofData(zkProof, registrationRoot, currentDate, ...)
 */
object PassportDataExporter {
    private const val TAG = "PASSPORT_EXPORT"
    private const val CHUNK_SIZE = 3500
    private const val START_MARKER = "--- PASSPORT_EXPORT_START ---"
    private const val END_MARKER = "--- PASSPORT_EXPORT_END ---"

    fun exportPassportData(eDocument: EDocument) {
        val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())
        val pd = eDocument.personDetails

        val json = buildString {
            append("{")
            append("\"version\":1,")
            append("\"type\":\"passport_data\",")
            append("\"exportedAt\":\"$timestamp\",")
            append("\"dg1Hex\":\"${eDocument.dg1Hex ?: ""}\",")
            append("\"sodHex\":\"${eDocument.sod ?: ""}\",")
            append("\"digestAlgorithm\":\"${eDocument.digestAlgorithm ?: ""}\",")
            append("\"docSigningCertPem\":\"${escapeJson(eDocument.docSigningCertPem ?: "")}\",")
            append("\"personDetails\":{")
            append("\"name\":\"${escapeJson(pd?.name ?: "")}\",")
            append("\"surname\":\"${escapeJson(pd?.surname ?: "")}\",")
            append("\"nationality\":\"${pd?.nationality ?: ""}\",")
            append("\"issuerAuthority\":\"${pd?.issuerAuthority ?: ""}\",")
            append("\"dateOfBirth\":\"${pd?.birthDate ?: ""}\",")
            append("\"dateOfExpiry\":\"${pd?.expiryDate ?: ""}\",")
            append("\"documentNumber\":\"${pd?.serialNumber ?: ""}\",")
            append("\"gender\":\"${pd?.gender ?: ""}\"")
            append("}")
            append("}")
        }

        logChunked(json)
    }

    fun exportProofData(
        zkProof: ZkProof,
        registrationRoot: ByteArray,
        currentDate: BigInteger,
        proposalEventId: BigInteger,
        nullifier: BigInteger,
        citizenship: BigInteger,
        identityCreationTimestamp: BigInteger,
        votes: List<BigInteger>
    ) {
        val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())
        val proof = zkProof.proof

        val piA = proof.pi_a.joinToString(",") { "\"$it\"" }
        val piB = proof.pi_b.joinToString(",") { row ->
            "[${row.joinToString(",") { "\"$it\"" }}]"
        }
        val piC = proof.pi_c.joinToString(",") { "\"$it\"" }
        val pubSigs = zkProof.pub_signals.joinToString(",") { "\"$it\"" }
        val votesStr = votes.joinToString(",") { "\"$it\"" }
        val rootHex = "0x" + registrationRoot.joinToString("") { "%02x".format(it) }

        val json = buildString {
            append("{")
            append("\"version\":1,")
            append("\"type\":\"proof_data\",")
            append("\"exportedAt\":\"$timestamp\",")
            append("\"proof\":{")
            append("\"pi_a\":[$piA],")
            append("\"pi_b\":[$piB],")
            append("\"pi_c\":[$piC],")
            append("\"protocol\":\"${proof.protocol}\"")
            append("},")
            append("\"pubSignals\":[$pubSigs],")
            append("\"votingInputs\":{")
            append("\"registrationRootHex\":\"$rootHex\",")
            append("\"currentDate\":\"$currentDate\",")
            append("\"proposalEventId\":\"$proposalEventId\",")
            append("\"nullifier\":\"$nullifier\",")
            append("\"citizenship\":\"$citizenship\",")
            append("\"identityCreationTimestamp\":\"$identityCreationTimestamp\",")
            append("\"votes\":[$votesStr]")
            append("}")
            append("}")
        }

        logChunked(json)
    }

    private fun logChunked(json: String) {
        Log.i(TAG, START_MARKER)
        var offset = 0
        while (offset < json.length) {
            val end = minOf(offset + CHUNK_SIZE, json.length)
            Log.i(TAG, json.substring(offset, end))
            offset = end
        }
        Log.i(TAG, END_MARKER)
    }

    private fun escapeJson(s: String): String {
        return s.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }
}
