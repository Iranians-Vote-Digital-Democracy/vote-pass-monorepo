package org.iranUnchained.feature.security

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.databinding.DataBindingUtil
import org.iranUnchained.R
import org.iranUnchained.base.view.BaseFragment
import org.iranUnchained.databinding.FragmentEnableFingerprintBinding

class EnableFingerprintFragment : BaseFragment() {

    private lateinit var binding: FragmentEnableFingerprintBinding

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {

        binding = DataBindingUtil.inflate(
            inflater, R.layout.fragment_enable_fingerprint, container, false
        )


        return binding.root
    }

    companion object {
        @JvmStatic
        fun newInstance() =
            EnableFingerprintFragment()
    }
}