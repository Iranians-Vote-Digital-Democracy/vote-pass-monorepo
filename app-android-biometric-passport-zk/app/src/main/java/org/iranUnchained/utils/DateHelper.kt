package org.iranUnchained.utils

import android.content.Context
import org.iranUnchained.R
import java.text.SimpleDateFormat
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Calendar
import java.util.Date
import java.util.Locale

fun getDaysAndHoursBetween(endDate: Long): Pair<Int, Int> {
    val date = Date(endDate * 1000)
    val endInstant = Instant.ofEpochMilli(date.time)
    val currentInstant = Instant.now()
    val duration = Duration.between(currentInstant, endInstant)

    val days = duration.toDays().toInt()
    val hours = (duration.toHours() % 24).toInt()
    return Pair(days, hours)
}

fun isEnded(endDate: Long): Boolean {
    val (days, hours) = getDaysAndHoursBetween(endDate)

    return days <= 0 && hours <= 0
}

fun isStarted(endDate: Long): Boolean {
    val (days, hours) = getDaysAndHoursBetween(endDate)
    return days > 0 && hours >= 0
}
fun resolveDays(context: Context, endDate: Long, startDate: Long, locale: Locale?): String {

    return if (!isEnded(startDate)) {
        context.getString(
            R.string.begins_in_x,
            DateTimeFormatter.ofPattern("yyyy.MM.dd").withZone(ZoneOffset.UTC)
                .format(Instant.ofEpochSecond(startDate))
        ).withPersianDigits(locale)
    } else if (!isEnded(endDate)) {
        context.getString(
            R.string.ends_in_x,
            DateTimeFormatter.ofPattern("yyyy.MM.dd").withZone(ZoneOffset.UTC)
                .format(Instant.ofEpochSecond(endDate)).withPersianDigits(locale)
        )
    } else {
        context.getString(R.string.completed_vote)
    }
}

fun calculateAge(birthdate: String): Int {
    val dateFormat = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())

    try {
        val birthDate = dateFormat.parse(birthdate)
        val currentDate = Calendar.getInstance().time

        val calendarBirth = Calendar.getInstance()
        calendarBirth.time = birthDate!!

        val calendarCurrent = Calendar.getInstance()
        calendarCurrent.time = currentDate

        var age = calendarCurrent.get(Calendar.YEAR) - calendarBirth.get(Calendar.YEAR)

        if (calendarBirth.get(Calendar.DAY_OF_YEAR) > calendarCurrent.get(Calendar.DAY_OF_YEAR)) {
            age--
        }

        return age
    } catch (e: Exception) {

        return -1
    }
}