package org.iranUnchained

import org.iranUnchained.utils.PassportDataLoader
import org.junit.Assert.*
import org.junit.Test

class PassportDataLoaderTest {

    private val validJson = """
        {
          "version": 1,
          "type": "passport_data",
          "exportedAt": "2026-02-22T17:43:36.295Z",
          "dg1Hex": "615b5f1f5850",
          "sodHex": "77820a77",
          "digestAlgorithm": "SHA-256",
          "docSigningCertPem": "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----",
          "personDetails": {
            "name": "JOHN",
            "surname": "DOE",
            "nationality": "USA",
            "issuerAuthority": "USA",
            "dateOfBirth": "15.06.1990",
            "dateOfExpiry": "02.05.2033",
            "documentNumber": "A12345678",
            "gender": "MALE"
          }
        }
    """.trimIndent()

    @Test
    fun `parseJson - valid passport JSON returns correct fields`() {
        val result = PassportDataLoader.parseJson(validJson)

        assertNotNull(result)
        assertEquals(1, result!!.version)
        assertEquals("passport_data", result.type)
        assertEquals("615b5f1f5850", result.dg1Hex)
        assertEquals("77820a77", result.sodHex)
        assertEquals("SHA-256", result.digestAlgorithm)
        assertTrue(result.docSigningCertPem!!.contains("BEGIN CERTIFICATE"))

        val pd = result.personDetails
        assertNotNull(pd)
        assertEquals("JOHN", pd!!.name)
        assertEquals("DOE", pd.surname)
        assertEquals("USA", pd.nationality)
        assertEquals("USA", pd.issuerAuthority)
        assertEquals("15.06.1990", pd.dateOfBirth)
        assertEquals("02.05.2033", pd.dateOfExpiry)
        assertEquals("A12345678", pd.documentNumber)
        assertEquals("MALE", pd.gender)
    }

    @Test
    fun `parseJson - missing personDetails returns data with null personDetails`() {
        val json = """
            {
              "version": 1,
              "type": "passport_data",
              "dg1Hex": "aabb"
            }
        """.trimIndent()

        val result = PassportDataLoader.parseJson(json)

        assertNotNull(result)
        assertEquals(1, result!!.version)
        assertEquals("aabb", result.dg1Hex)
        assertNull(result.personDetails)
    }

    @Test
    fun `parseJson - invalid JSON returns null`() {
        val result = PassportDataLoader.parseJson("not valid json {{{")
        assertNull(result)
    }

    @Test
    fun `parseJson - empty JSON object returns data with all nulls`() {
        val result = PassportDataLoader.parseJson("{}")

        assertNotNull(result)
        assertNull(result!!.version)
        assertNull(result.dg1Hex)
        assertNull(result.personDetails)
    }

    @Test
    fun `parseJson - partial personDetails has present fields and null missing fields`() {
        val json = """
            {
              "version": 1,
              "personDetails": {
                "nationality": "GBR",
                "dateOfBirth": "01.01.2000"
              }
            }
        """.trimIndent()

        val result = PassportDataLoader.parseJson(json)

        assertNotNull(result)
        val pd = result!!.personDetails
        assertNotNull(pd)
        assertEquals("GBR", pd!!.nationality)
        assertEquals("01.01.2000", pd.dateOfBirth)
        assertNull(pd.name)
        assertNull(pd.surname)
        assertNull(pd.issuerAuthority)
        assertNull(pd.documentNumber)
    }

    @Test
    fun `buildEDocument - maps all fields correctly`() {
        val data = PassportDataLoader.parseJson(validJson)!!
        val eDoc = PassportDataLoader.buildEDocument(data)

        assertEquals("615b5f1f5850", eDoc.dg1Hex)
        assertEquals("77820a77", eDoc.sod)
        assertEquals("SHA-256", eDoc.digestAlgorithm)
        assertTrue(eDoc.docSigningCertPem!!.contains("BEGIN CERTIFICATE"))

        val pd = eDoc.personDetails
        assertNotNull(pd)
        assertEquals("JOHN", pd!!.name)
        assertEquals("DOE", pd.surname)
        assertEquals("USA", pd.nationality)
        assertEquals("USA", pd.issuerAuthority)
        assertEquals("15.06.1990", pd.birthDate)
        assertEquals("02.05.2033", pd.expiryDate)
        assertEquals("A12345678", pd.serialNumber)
        assertEquals("MALE", pd.gender)
    }

    @Test
    fun `buildEDocument - null personDetails produces EDocument with null personDetails`() {
        val data = PassportDataLoader.PassportFileData(
            version = 1,
            dg1Hex = "aabb",
            personDetails = null
        )
        val eDoc = PassportDataLoader.buildEDocument(data)

        assertEquals("aabb", eDoc.dg1Hex)
        assertNull(eDoc.personDetails)
    }
}
