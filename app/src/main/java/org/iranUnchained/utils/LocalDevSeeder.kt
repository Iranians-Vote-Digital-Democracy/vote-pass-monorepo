package org.iranUnchained.utils

import android.content.Context
import android.util.Log
import org.iranUnchained.data.models.IdentityData
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import java.security.SecureRandom

/**
 * Pre-seeds identity data for local development so the voting flow
 * can be tested without a real passport NFC scan + registration.
 *
 * Only runs on first launch when IS_LOCAL_DEV is true.
 */
object LocalDevSeeder {
    private const val TAG = "LocalDevSeeder"

    fun seedIfNeeded(context: Context) {
        // Only seed if identity data is not already present
        if (SecureSharedPrefs.getIdentityData(context) != null) {
            Log.d(TAG, "Identity data already exists, skipping seed")
            return
        }

        Log.i(TAG, "Seeding local dev identity data...")

        // Generate random identity keys
        val random = SecureRandom()
        val nullifierBytes = ByteArray(31)
        val secretBytes = ByteArray(31)
        val secretKeyBytes = ByteArray(31)
        random.nextBytes(nullifierBytes)
        random.nextBytes(secretBytes)
        random.nextBytes(secretKeyBytes)

        val nullifierHex = nullifierBytes.joinToString("") { "%02x".format(it) }
        val secretHex = secretBytes.joinToString("") { "%02x".format(it) }
        val secretKeyHex = secretKeyBytes.joinToString("") { "%02x".format(it) }
        val timestamp = (System.currentTimeMillis() / 1000).toString()

        val identityData = IdentityData(
            secretHex = secretHex,
            secretKeyHex = secretKeyHex,
            nullifierHex = nullifierHex,
            timeStamp = timestamp
        )

        SecureSharedPrefs.saveIdentityData(context, identityData.toJson())
        SecureSharedPrefs.saveIsPassportScanned(context)
        SecureSharedPrefs.saveDateOfBirth(context, "01.01.1990")
        SecureSharedPrefs.saveIssuerAuthority(context, "USA")

        Log.i(TAG, "Local dev identity seeded successfully")
        Log.d(TAG, "  nullifier: $nullifierHex")
    }
}
