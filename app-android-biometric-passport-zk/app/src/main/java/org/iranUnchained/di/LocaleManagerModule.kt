package org.iranUnchained.di

import dagger.Module
import dagger.Provides
import org.iranUnchained.utils.AppLocaleManager
import javax.inject.Singleton

@Module
class LocaleManagerModule(
    private val localeManager: AppLocaleManager
) {
    @Provides
    @Singleton
    fun localeManager() = localeManager
}