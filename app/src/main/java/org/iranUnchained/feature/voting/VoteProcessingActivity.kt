package org.iranUnchained.feature.voting

import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.core.content.res.ResourcesCompat
import androidx.databinding.DataBindingUtil
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textview.MaterialTextView
import io.reactivex.rxkotlin.addTo
import org.iranUnchained.R
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.VotingData
import org.iranUnchained.databinding.ActivityVoteProcessingBinding
import org.iranUnchained.feature.onBoarding.logic.GenerateVerifiableCredential
import org.iranUnchained.feature.voting.logic.VoteSubmissionService
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import org.iranUnchained.utils.Navigator
import org.iranUnchained.utils.ObservableTransformers


class VoteProcessingActivity : BaseActivity() {

    private lateinit var binding: ActivityVoteProcessingBinding

    private lateinit var votingData: VotingData
    private lateinit var statusList: List<MaterialTextView>
    private var proposalData: ProposalData? = null

    private lateinit var selectedContract: String
    private var isSigned = false
    override fun onCreateAllowed(savedInstanceState: Bundle?) {
        binding = DataBindingUtil.setContentView(this, R.layout.activity_vote_processing)
        binding.lifecycleOwner = this

        votingData = intent?.getParcelableExtra(VOTE_DATA)!!
        proposalData = intent?.getParcelableExtra(PROPOSAL_DATA)

        val referendumContract = intent?.getStringExtra(VOTE_REFERENDUM_CONTRACT)

        if (referendumContract != null) {
            selectedContract = referendumContract
        } else {
            selectedContract = votingData.contractAddress!!
        }


        statusList = listOf(binding.option1, binding.option2, binding.option3, binding.option4)
        initButtons()

        if (proposalData != null) {
            submitVoteV2()
        } else {
            changeStatusView()
        }
    }

    private fun submitVoteV2() {
        val proposal = proposalData ?: return
        val selectedOption = SecureSharedPrefs.getVoteResult(this, proposal.proposalId)
        if (selectedOption < 1) {
            handleUnknownError()
            return
        }

        // Convert 1-based option index to 0-based for bitmask encoding
        val selectedOptions = listOf(selectedOption - 1)

        VoteSubmissionService(this, apiProvider)
            .submitVote(proposal, selectedOptions)
            .compose(ObservableTransformers.defaultSchedulers())
            .subscribe({ progress ->
                if (progress.step < statusList.size) {
                    updateLoading(statusList[progress.step])
                }
            }, { error ->
                Log.e("VoteProcessing", "Vote submission failed", error)

                val message = error.message ?: ""
                if (message.contains("user already registered") || message.contains("already voted")) {
                    handleAlreadyRegisteredError()
                } else {
                    handleUnknownError()
                }
            }, {
                handleEndOfHandler()
            }).addTo(compositeDisposable)
    }

    private fun changeStatusView() {

        GenerateVerifiableCredential().register(this, apiProvider, selectedContract, votingData.contractAddress)
            .compose(ObservableTransformers.defaultSchedulers()).subscribe({
                updateLoading(statusList[it])
            }, {


                Log.e("Error during processing", it.message.toString(), it)

                if (it.message.isNullOrEmpty()) {
                    handleUnknownError()
                    return@subscribe
                }

                if ((it.message as String).contains("no non-revoked credentials found")) {
                    handleNoneReworkedCredError()
                    return@subscribe
                }

                if ((it.message as String).contains("user already registered")) {
                    handleAlreadyRegisteredError()
                    return@subscribe
                }

                handleUnknownError()

            }, {
                handleEndOfHandler()
            }).addTo(compositeDisposable)

    }

    private fun updateLoading(view: MaterialTextView) {

        val typeface = ResourcesCompat.getFont(this, R.font.vazirmatn_bold)
        view.background = resources.getDrawable(R.drawable.section_done_background)
        view.text = resources.getString(R.string.done)
        view.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_check, 0, 0, 0)
        view.typeface = typeface
    }

    private fun handleAlreadyRegisteredError() {
        MaterialAlertDialogBuilder(this).setTitle(getString(R.string.you_already_registered))
            .setPositiveButton(resources.getString(R.string.button_ok)) { _, _ ->
                finish()
                Navigator.from(this).openOptionVoting(votingData, proposalData)
            }.setOnDismissListener {
                finish()
                Navigator.from(this).openOptionVoting(votingData, proposalData)
            }.show()
    }

    private fun handleNoneReworkedCredError() {
        MaterialAlertDialogBuilder(this).setTitle(getString(R.string.cant_verify_multiple_device))
            .setPositiveButton(resources.getString(R.string.button_ok)) { dialog, which ->
                this.finish()
            }.setOnDismissListener {
                this.finish()
            }.show()
    }


    private fun handleUnknownError() {
        MaterialAlertDialogBuilder(this).setTitle(getString(R.string.check_back_later))
            .setPositiveButton(resources.getString(R.string.button_ok)) { dialog, which ->
                this.finish()
            }.setOnDismissListener {
                this.finish()
            }.show()
    }

    private fun handleEndOfHandler() {
        binding.header.text = resources.getString(R.string.submited_vote_header)
        binding.icon.setAnimation(R.raw.checkbox_succes)
        binding.icon.repeatCount = 0
        binding.icon.playAnimation()

        binding.separator.visibility = View.GONE
        binding.hint.visibility = View.GONE
        binding.viewPetition.visibility = View.VISIBLE
        isSigned = true

        // Auto-navigate to results after a brief delay for the animation
        binding.icon.postDelayed({
            finish()
            Navigator.from(this).openOptionVoting(votingData, proposalData)
        }, 1500)
    }

    override fun onBackPressed() {
        if (isSigned) {
            finish()
            Navigator.from(this).openOptionVoting(votingData, proposalData)
        } else {
            finish()
        }
    }


    private fun initButtons() {
        clickHelper.addViews(binding.backButton, binding.viewPetition)

        clickHelper.setOnClickListener {
            when (it.id) {
                binding.backButton.id -> {
                    if (isSigned) {
                        finish()
                        Navigator.from(this).openOptionVoting(votingData, proposalData)
                    } else {
                        finish()
                    }
                }

                binding.viewPetition.id -> {
                    finish()
                    Navigator.from(this).openOptionVoting(votingData, proposalData)
                }
            }
        }
    }

    companion object {
        const val VOTE_DATA = "VOTE_DATA"
        const val VOTE_REFERENDUM_CONTRACT = "VOTE_REFERENDUM_CONTRACT"
        const val PROPOSAL_DATA = "PROPOSAL_DATA"
    }

}
