package org.iranUnchained

import org.iranUnchained.data.models.IdentityData
import org.junit.Assert.*
import org.junit.Test

class IdentityDataTest {

    @Test
    fun `toJson and fromJson round-trip preserves all fields`() {
        val original = IdentityData(
            secretHex = "aabbccdd",
            secretKeyHex = "11223344",
            nullifierHex = "deadbeef",
            timeStamp = "1700000000"
        )

        val json = original.toJson()
        val restored = IdentityData.fromJson(json)

        assertEquals(original.secretHex, restored.secretHex)
        assertEquals(original.secretKeyHex, restored.secretKeyHex)
        assertEquals(original.nullifierHex, restored.nullifierHex)
        assertEquals(original.timeStamp, restored.timeStamp)
    }

    @Test
    fun `toJson produces valid JSON string`() {
        val data = IdentityData("a", "b", "c", "123")
        val json = data.toJson()

        assertTrue(json.contains("\"secretHex\""))
        assertTrue(json.contains("\"secretKeyHex\""))
        assertTrue(json.contains("\"nullifierHex\""))
        assertTrue(json.contains("\"timeStamp\""))
    }

    @Test
    fun `fromJson with empty strings`() {
        val data = IdentityData("", "", "", "")
        val restored = IdentityData.fromJson(data.toJson())

        assertEquals("", restored.secretHex)
        assertEquals("", restored.secretKeyHex)
        assertEquals("", restored.nullifierHex)
        assertEquals("", restored.timeStamp)
    }

    @Test
    fun `fromJson with long hex values`() {
        val longHex = "a".repeat(64)
        val data = IdentityData(longHex, longHex, longHex, "9999999999")
        val restored = IdentityData.fromJson(data.toJson())

        assertEquals(longHex, restored.secretHex)
        assertEquals(64, restored.secretHex.length)
    }
}
