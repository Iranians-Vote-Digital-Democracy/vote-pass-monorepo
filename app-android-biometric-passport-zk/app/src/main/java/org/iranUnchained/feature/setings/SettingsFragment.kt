package org.iranUnchained.feature.setings

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.databinding.DataBindingUtil
import org.iranUnchained.R
import org.iranUnchained.base.ActiveConfig
import org.iranUnchained.base.view.BaseBottomSheetDialog
import org.iranUnchained.databinding.FragmentSettingsBinding
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import org.iranUnchained.utils.BiometricHelper
import org.iranUnchained.utils.LocalizationManager
import org.iranUnchained.utils.Navigator

class SettingsFragment : BaseBottomSheetDialog() {

    private lateinit var binding: FragmentSettingsBinding
    lateinit var logoutCallback: () -> Unit
    private lateinit var biometricManager: BiometricManager


    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        binding = DataBindingUtil.inflate(
            inflater, R.layout.fragment_settings, container, false
        )

        biometricManager = BiometricManager.from(requireContext())
        if (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS) {
            binding.switchFingerprint.isChecked =
                SecureSharedPrefs.getIsBiometricEnabled(requireContext())
        } else {
            binding.fingerprintContainer.visibility = View.GONE
        }


        initButtons()
        subscribeToChangeBiometric()

        if (!SecureSharedPrefs.getIsPassportScanned(requireContext())) {
            binding.logout.visibility = View.GONE
        }
        return binding.root
    }

    private fun initButtons() {
        clickHelper.addViews(binding.logout, binding.closeBtn, binding.privacyPolicy)

        clickHelper.setOnClickListener {
            when (it.id) {
                binding.logout.id -> {
                    logoutCallback.invoke()
                }

                binding.closeBtn.id -> {
                    dismiss()
                }

                binding.privacyPolicy.id -> {
                    Navigator.from(this).openBrowser(ActiveConfig.PRIVACY_POLICY_URL)
                }
            }
        }

        if (LocalizationManager.getLocale(requireContext())!!.language == "fa") {
            binding.frBtn.isChecked = true
            binding.engBtn.isChecked = false
        } else {

            binding.frBtn.isChecked = false
            binding.engBtn.isChecked = true
        }

        binding.buttonGroupRoundSelectedButton.addOnButtonCheckedListener { group, checkedId, isChecked ->
            val currentLocale = LocalizationManager.getLocale(requireContext())!!.language
            if (isChecked) {
                if (checkedId == binding.frBtn.id) {
                    if (currentLocale == "fa") {
                        return@addOnButtonCheckedListener
                    }
                    LocalizationManager.saveLocale(requireContext(), "fa")
                } else {
                    if (currentLocale == "en") {
                        return@addOnButtonCheckedListener
                    }
                    LocalizationManager.saveLocale(requireContext(), "en")
                }
                requireActivity().recreate()
            }
        }
    }

    private fun subscribeToChangeBiometric() {
        binding.switchFingerprint.setOnCheckedChangeListener { compoundButton, isChecked ->
            if (isChecked) {

                instanceOfBiometricPrompt().authenticate(
                    BiometricHelper().getPromptInfo(
                        requireContext()
                    )
                )
                return@setOnCheckedChangeListener
            }

            SecureSharedPrefs.saveIsBiometricSaved(requireContext(), false)
        }
    }

    private fun instanceOfBiometricPrompt(): BiometricPrompt {
        val executor = ContextCompat.getMainExecutor(requireContext())
        val callback = object : BiometricPrompt.AuthenticationCallback() {

            override fun onAuthenticationSucceeded(
                result: BiometricPrompt.AuthenticationResult
            ) {
                SecureSharedPrefs.saveIsBiometricSaved(requireContext(), true)
            }

            override fun onAuthenticationFailed() {
                binding.switchFingerprint.isChecked = false
            }

            override fun onAuthenticationError(
                errorCode: Int, errString: CharSequence
            ) {
                binding.switchFingerprint.isChecked = false
                Log.e("Fail", "$errorCode $errString")
                if (errorCode == BiometricPrompt.ERROR_LOCKOUT) {
                    toastManager.long(getString(R.string.too_many_attempts))
                }
            }
        }
        return BiometricPrompt(this, executor, callback)
    }


    companion object {
        const val TAG = "SettingsFragment"
    }

}