package org.iranUnchained.feature.splash

import android.os.Bundle
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import org.iranUnchained.utils.Navigator


class SplashActivity : BaseActivity() {

    override fun onCreateAllowed(savedInstanceState: Bundle?) {

        if (!SecureSharedPrefs.isFirstLaunch(this)) {
            Navigator.from(this).openCheckPinCode()
            finish()
            return
        }

        Navigator.from(this).openStart()
        finish()


    }
}