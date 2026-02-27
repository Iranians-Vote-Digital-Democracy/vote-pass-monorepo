package org.iranUnchained.utils

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import org.iranUnchained.utils.nfc.model.EDocument
import org.iranUnchained.utils.nfc.model.PersonDetails
import java.io.File

/**
 * Loads passport data from a JSON file on the device filesystem.
 *
 * Expected path: /sdcard/Android/data/<applicationId>/files/passport-data.json
 * (accessible via context.getExternalFilesDir(null) — no runtime permissions needed)
 *
 * The JSON format matches the v1 export produced by the Android app's passport scan & export feature.
 */
object PassportDataLoader {
    private const val TAG = "PassportDataLoader"
    private const val FILENAME = "passport-data.json"

    data class PassportFilePersonDetails(
        val name: String? = null,
        val surname: String? = null,
        val nationality: String? = null,
        val issuerAuthority: String? = null,
        val dateOfBirth: String? = null,
        val dateOfExpiry: String? = null,
        val documentNumber: String? = null,
        val gender: String? = null
    )

    data class PassportFileData(
        val version: Int? = null,
        val type: String? = null,
        val exportedAt: String? = null,
        val dg1Hex: String? = null,
        val sodHex: String? = null,
        val digestAlgorithm: String? = null,
        val docSigningCertPem: String? = null,
        val personDetails: PassportFilePersonDetails? = null
    )

    /**
     * Attempts to load passport data from the device's app-specific external files directory.
     * Returns null if the file doesn't exist or can't be parsed.
     */
    fun loadFromDevice(context: Context): PassportFileData? {
        val dir = context.getExternalFilesDir(null) ?: run {
            Log.w(TAG, "External files dir not available")
            return null
        }
        val file = File(dir, FILENAME)
        if (!file.exists()) {
            Log.d(TAG, "No passport data file at ${file.absolutePath}")
            return null
        }

        return try {
            val json = file.readText()
            parseJson(json)?.also { data ->
                Log.i(TAG, "Loaded passport data: issuer=${data.personDetails?.issuerAuthority}, " +
                        "dob=${data.personDetails?.dateOfBirth}, " +
                        "name=${data.personDetails?.name} ${data.personDetails?.surname}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read passport data file", e)
            null
        }
    }

    /**
     * Parses a passport JSON string. Pure function, testable on JVM.
     */
    fun parseJson(json: String): PassportFileData? {
        return try {
            Gson().fromJson(json, PassportFileData::class.java)
        } catch (e: Exception) {
            try { Log.e(TAG, "Failed to parse passport JSON", e) } catch (_: Exception) {}
            null
        }
    }

    /**
     * Builds an EDocument from loaded passport file data.
     * Used for Layer 2: full NFC bypass → ConfirmationActivity flow.
     */
    fun buildEDocument(data: PassportFileData): EDocument {
        val personDetails = data.personDetails?.let { pd ->
            PersonDetails(
                name = pd.name,
                surname = pd.surname,
                nationality = pd.nationality,
                issuerAuthority = pd.issuerAuthority,
                birthDate = pd.dateOfBirth,
                expiryDate = pd.dateOfExpiry,
                serialNumber = pd.documentNumber,
                gender = pd.gender
            )
        }

        return EDocument(
            personDetails = personDetails,
            sod = data.sodHex,
            dg1Hex = data.dg1Hex,
            digestAlgorithm = data.digestAlgorithm,
            docSigningCertPem = data.docSigningCertPem
        )
    }
}
