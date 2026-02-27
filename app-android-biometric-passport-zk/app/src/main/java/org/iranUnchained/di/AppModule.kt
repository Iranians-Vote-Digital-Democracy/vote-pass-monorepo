package org.iranUnchained.di

import android.content.Context
import dagger.Module
import dagger.Provides
import org.iranUnchained.App
import javax.inject.Singleton

@Module
class AppModule(private val app: App) {
    @Provides
    @Singleton
    fun appContext(): Context = app.applicationContext
}