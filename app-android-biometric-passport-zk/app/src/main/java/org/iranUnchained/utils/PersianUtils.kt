package org.iranUnchained.utils

import java.util.Locale

fun Number.withPersianDigits(locale: Locale?): String {
    if (locale?.language != "fa")
        return this.toString()
    return "$this".withPersianDigits(locale)
}


fun String.withPersianDigits(locale: Locale?): String {
    if (locale?.language != "fa"){
        return this
    }
    return StringBuilder().also { builder ->
        toCharArray().forEach {
            builder.append(
                when {
                    Character.isDigit(it) -> PERSIAN_DIGITS["$it".toInt()]
                    it == '.' -> "/"
                    else -> it
                }
            )
        }
    }.toString()
}


private val PERSIAN_DIGITS = charArrayOf(
    '0' + 1728,
    '1' + 1728,
    '2' + 1728,
    '3' + 1728,
    '4' + 1728,
    '5' + 1728,
    '6' + 1728,
    '7' + 1728,
    '8' + 1728,
    '9' + 1728
)