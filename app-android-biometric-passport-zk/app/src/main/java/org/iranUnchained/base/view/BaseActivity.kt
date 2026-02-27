package org.iranUnchained.base.view

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import io.reactivex.disposables.CompositeDisposable
import org.iranUnchained.App
import org.iranUnchained.di.providers.ApiProvider
import org.iranUnchained.utils.ClickHelper
import org.iranUnchained.utils.ClipboardHelper
import org.iranUnchained.utils.LocalizationManager
import org.iranUnchained.view.util.ToastManager
import java.util.Locale
import javax.inject.Inject


abstract class BaseActivity: AppCompatActivity() {

    @Inject
    lateinit var toastManager: ToastManager

    @Inject
    lateinit var clickHelper: ClickHelper

    @Inject
    lateinit var clipboardHelper: ClipboardHelper

    @Inject
    lateinit var apiProvider: ApiProvider


    val compositeDisposable: CompositeDisposable = CompositeDisposable()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        (application as App).appComponent.inject(this)
        onCreateAllowed(savedInstanceState)

    }

    abstract fun onCreateAllowed(savedInstanceState: Bundle?)

    override fun onDestroy() {
        super.onDestroy()
        compositeDisposable.dispose()
    }

    fun getLocale(): Locale? {
        return LocalizationManager.getLocale(this)
    }

    private fun setLocale(languageCode: String) {
        LocalizationManager.saveLocale(this, languageCode)
        val locale = Locale(languageCode)
        Locale.setDefault(locale)
        val config = Configuration()
        config.locale = locale
        baseContext.resources.updateConfiguration(config, baseContext.resources.displayMetrics)

    }

    override fun attachBaseContext(newBase: Context?) {
        // Apply the selected language every time the activity is created or recreated

        val locale = LocalizationManager.getLocale(newBase) // Default language
        val config = Configuration()
        config.locale = locale
        val newContext = newBase?.createConfigurationContext(config)
        super.attachBaseContext(newContext)
    }


}