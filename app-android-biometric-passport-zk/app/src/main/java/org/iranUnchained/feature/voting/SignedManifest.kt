package org.iranUnchained.feature.voting

import android.os.Bundle
import androidx.databinding.DataBindingUtil
import org.iranUnchained.R
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.data.models.VotingData
import org.iranUnchained.databinding.ActivitySignedManifestBinding
import org.iranUnchained.utils.Navigator
import org.iranUnchained.utils.resolveDays
import org.iranUnchained.utils.withPersianDigits

class SignedManifest : BaseActivity() {

    private lateinit var binding: ActivitySignedManifestBinding
    private lateinit var voteData: VotingData

    override fun onCreateAllowed(savedInstanceState: Bundle?) {
        binding = DataBindingUtil.setContentView(this, R.layout.activity_signed_manifest)


        voteData = intent?.getParcelableExtra(VOTE_DATA)!!
        binding.data = voteData
        binding.signedCount.text = getString(
            R.string.you_and_x_other_people_already_signed,
            voteData.votingCount.toString()
        ).withPersianDigits(getLocale())
        binding.dataOfVoting.text = resolveDays(this, voteData.dueDate!!,voteData.startDate!!, getLocale())
        initButtons()
    }

    private fun initButtons() {
        clickHelper.addViews(binding.closeBtn)
        clickHelper.setOnClickListener {
            when (it.id) {

                binding.closeBtn.id -> {
                    finish()
                    Navigator.from(this).openVote()
                }
            }
        }
    }

    override fun onBackPressed() {
        finish()
        Navigator.from(this).openVote()
    }
    companion object {
        const val VOTE_DATA = "voteData"
    }
}