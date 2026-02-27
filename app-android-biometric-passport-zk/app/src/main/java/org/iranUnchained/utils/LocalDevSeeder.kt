package org.iranUnchained.utils

import android.content.Context
import android.util.Log
import identity.Identity
import identity.StateProvider
import org.iranUnchained.data.models.IdentityData
import org.iranUnchained.logic.persistance.SecureSharedPrefs

/**
 * Pre-seeds identity data for local development so the voting flow
 * can be tested without a real passport NFC scan + registration.
 *
 * Uses the Go Identity library to generate cryptographically valid
 * identity keys (secretKey, nullifier derived correctly) so that
 * real ZK proof generation works on-device.
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

        Log.i(TAG, "Seeding local dev identity data via Go Identity library...")

        val identity = Identity.newIdentity(NoOpStateProvider())

        val timestamp = (System.currentTimeMillis() / 1000).toString()

        val identityData = IdentityData(
            secretHex = identity.secretHex,
            secretKeyHex = identity.secretKeyHex,
            nullifierHex = identity.nullifierHex,
            timeStamp = timestamp
        )

        SecureSharedPrefs.saveIdentityData(context, identityData.toJson())
        SecureSharedPrefs.saveIsPassportScanned(context)

        // Try to load real passport metadata from device file
        val passportData = PassportDataLoader.loadFromDevice(context)
        val personDetails = passportData?.personDetails

        if (personDetails != null) {
            val issuer = personDetails.issuerAuthority ?: "USA"
            val dob = personDetails.dateOfBirth ?: "01.01.1990"
            SecureSharedPrefs.saveDateOfBirth(context, dob)
            SecureSharedPrefs.saveIssuerAuthority(context, issuer)
            Log.i(TAG, "Seeded with REAL passport data: issuer=$issuer, dob=$dob")
        } else {
            SecureSharedPrefs.saveDateOfBirth(context, "01.01.1990")
            SecureSharedPrefs.saveIssuerAuthority(context, "USA")
            Log.i(TAG, "Seeded with HARDCODED data: issuer=USA, dob=01.01.1990 (no passport JSON found)")
        }

        Log.i(TAG, "Local dev identity seeded successfully (Go Identity library)")
        Log.d(TAG, "  nullifier: ${identity.nullifierHex}")
    }
}

/**
 * Minimal StateProvider for Identity.newIdentity() — only logging is needed.
 * Key generation is local and doesn't require network or contract access.
 */
private class NoOpStateProvider : StateProvider {
    override fun localPrinter(msg: String?) {
        Log.d("LocalDevSeeder", "Go: ${msg ?: ""}")
    }

    override fun fetch(
        url: String?, method: String?, body: ByteArray?,
        headerKey: String?, headerValue: String?
    ): ByteArray {
        throw UnsupportedOperationException("NoOpStateProvider.fetch() should not be called during key generation")
    }

    override fun getGISTProof(userId: String?, blockNumber: String?): ByteArray {
        throw UnsupportedOperationException("NoOpStateProvider.getGISTProof() should not be called during key generation")
    }

    override fun isUserRegistered(contract: String?, documentNullifier: ByteArray?): Boolean {
        throw UnsupportedOperationException("NoOpStateProvider.isUserRegistered() should not be called during key generation")
    }

    override fun proveAuthV2(inputs: ByteArray?): ByteArray {
        throw UnsupportedOperationException("NoOpStateProvider.proveAuthV2() should not be called during key generation")
    }

    override fun proveCredentialAtomicQueryMTPV2OnChainVoting(inputs: ByteArray?): ByteArray {
        throw UnsupportedOperationException("NoOpStateProvider.proveCredentialAtomicQueryMTPV2OnChainVoting() should not be called during key generation")
    }
}
