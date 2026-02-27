package org.iranUnchained.feature.intro

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.databinding.DataBindingUtil
import org.iranUnchained.R
import org.iranUnchained.base.view.BaseFragment
import org.iranUnchained.databinding.FragmentThirdSlideBinding

class SlideThirdFragment: BaseFragment() {

    private lateinit var binding: FragmentThirdSlideBinding

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View{
        binding = DataBindingUtil.inflate(
            inflater, R.layout.fragment_third_slide, container, false
        )

        return binding.root
    }

    companion object {
        fun newInstance(): SlideThirdFragment {
            return SlideThirdFragment()
        }
    }

}