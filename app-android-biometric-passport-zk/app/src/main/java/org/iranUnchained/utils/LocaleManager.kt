package org.iranUnchained.utils

import android.content.Context
import android.content.SharedPreferences
import java.util.Locale

class AppLocaleManager(
    private val context: Context,
    private val preferences: SharedPreferences
) {
    private val defaultLocale = "fa"
        .let(::Locale)

    private fun getLocale(): Locale = loadLocale() ?: defaultLocale

    /**
     * Applies locale based on the stored or default one.
     * Call this method on app init
     */
    fun initLocale() {
        applyLocale(getLocale())
    }

    /**
     * @return [Context] set up to use current locale
     */
    fun getLocalizeContext(baseContext: Context): Context {
        return LocalizedContextWrapper.wrap(baseContext, getLocale())
    }

    private fun applyLocale(locale: Locale) {
        LocalizedContextWrapper.wrap(context, locale)
        Locale.setDefault(locale)
    }

    private fun loadLocale(): Locale? {
        return preferences
            .getString(CURRENT_LOCALE_KEY, "fa")
            ?.takeIf(String::isNotEmpty)
            ?.let { Locale(it) }
    }

    private companion object {
        private const val CURRENT_LOCALE_KEY = "current_locale"
    }
}

