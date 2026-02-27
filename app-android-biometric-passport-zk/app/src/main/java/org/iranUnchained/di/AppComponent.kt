package org.iranUnchained.di

import dagger.Component
import org.iranUnchained.App
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.base.view.BaseBottomSheetDialog
import org.iranUnchained.base.view.BaseFragment
import javax.inject.Singleton

@Singleton
@Component(
    modules = [
        UtilsModule::class,
        LocaleManagerModule::class,
        RetrofitModule::class,
        ApiProviderModule::class,
    ]
)

interface AppComponent {
    fun inject (app: App)
    fun inject (baseActivity: BaseActivity)
    fun inject (baseFragment: BaseFragment)
    fun inject (baseBottomSheetDialog: BaseBottomSheetDialog)
}