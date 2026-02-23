package org.iranUnchained.feature.intro


import android.os.Bundle
import androidx.databinding.DataBindingUtil
import org.iranUnchained.R
import org.iranUnchained.base.ActiveConfig
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.databinding.ActivityStartBinding
import org.iranUnchained.utils.LocalizationManager
import org.iranUnchained.utils.Navigator

class StartActivity : BaseActivity() {

    private lateinit var binding: ActivityStartBinding

    override fun onCreateAllowed(savedInstanceState: Bundle?) {
        binding = DataBindingUtil.setContentView(this, R.layout.activity_start)
        binding.lifecycleOwner = this

        initButton()
    }

    private fun initButton() {
        clickHelper.addViews(binding.changeLanguage, binding.start, binding.privacyPolicy)

        clickHelper.setOnClickListener {
            when (it.id) {
                binding.changeLanguage.id -> {
                    LocalizationManager.switchLocale(context = this)
                    recreate()
                }

                binding.start.id -> {
                    finish()
                    Navigator.from(this).openIntro()
                }

                binding.privacyPolicy.id -> {
                    Navigator.from(this).openBrowser(ActiveConfig.PRIVACY_POLICY_URL)
                }

            }
        }
    }

}