package org.iranUnchained.utils.nfc.model

import android.os.Parcelable
import kotlinx.android.parcel.Parcelize

@Parcelize
data class EDocument (
    var docType: DocType? = null,
    var personDetails: PersonDetails? = null,
    var additionalPersonDetails: AdditionalPersonDetails? = null,
    var isPassiveAuth: Boolean = false,
    var isActiveAuth: Boolean = false,
    var isChipAuth: Boolean = false,
    var sod: String? = null,
    var dg1: String? = null,
    var dg1Hex: String? = null,
    var dg2Hash: String? = null,
    var digestAlgorithm: String? = null,
    var docSigningCertPem: String? = null
) : Parcelable
