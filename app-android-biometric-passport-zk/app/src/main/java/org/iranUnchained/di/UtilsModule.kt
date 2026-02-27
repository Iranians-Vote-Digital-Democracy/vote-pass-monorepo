package org.iranUnchained.di

import android.content.Context
import dagger.Module
import dagger.Provides
import org.iranUnchained.utils.AppLocaleManager
import org.iranUnchained.utils.ClickHelper
import org.iranUnchained.utils.ClipboardHelper
import org.iranUnchained.view.util.ToastManager
import javax.inject.Singleton

@Module
class UtilsModule(private val context: Context){

    @Provides
    fun context(localeManager: AppLocaleManager): Context {
        return localeManager.getLocalizeContext(context)
    }

    @Provides
    fun toastManager(context: Context): ToastManager {
        return ToastManager(context)
    }

    @Provides
    fun getClickHelper(): ClickHelper{
        return ClickHelper(350)
    }

    @Singleton
    @Provides
    fun clipboardManager(context: Context): ClipboardHelper {
        return ClipboardHelper(context)
    }

}