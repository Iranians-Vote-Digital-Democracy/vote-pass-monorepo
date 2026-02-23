package org.iranUnchained.feature.voting

import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import androidx.core.content.ContextCompat
import androidx.databinding.DataBindingUtil
import com.google.android.material.button.MaterialButton
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.google.android.material.textview.MaterialTextView
import org.iranUnchained.R
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.VotingData
import org.iranUnchained.databinding.ActivityVoteOptionsBinding
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import org.iranUnchained.utils.Navigator
import org.iranUnchained.utils.resolveDays

class VoteOptionsActivity : BaseActivity() {

    private lateinit var binding: ActivityVoteOptionsBinding
    private lateinit var votingData: VotingData
    private var proposalData: ProposalData? = null

    private var selectedOption = -1
    private val optionButtons = mutableListOf<MaterialButton>()

    override fun onCreateAllowed(savedInstanceState: Bundle?) {
        binding = DataBindingUtil.setContentView(
            this, R.layout.activity_vote_options
        )
        binding.lifecycleOwner = this

        val selectedOptionSc = SecureSharedPrefs.getVoteResult(this)

        votingData = intent?.getParcelableExtra(VOTING_DATA)!!
        proposalData = intent?.getParcelableExtra(PROPOSAL_DATA)

        binding.dataOfVoting.text = resolveDays(this, votingData.dueDate!!, votingData.startDate!!, getLocale())
        binding.data = votingData

        // Hide hardcoded options - we'll use dynamic ones if ProposalData is available
        binding.option1.visibility = View.GONE
        binding.option2.visibility = View.GONE
        binding.option3.visibility = View.GONE
        binding.firstPercentage.visibility = View.GONE
        binding.secondPercentage.visibility = View.GONE
        binding.thirdPercentage.visibility = View.GONE

        if (proposalData != null) {
            setupDynamicOptions(proposalData!!, selectedOptionSc)
        } else {
            setupLegacyOptions(selectedOptionSc)
        }
    }

    private fun setupDynamicOptions(proposal: ProposalData, previousSelection: Int) {
        val options = proposal.options
        val totalVotes = proposal.totalVotes().toFloat()

        if (previousSelection > -1) {
            // Show results
            showDynamicResults(proposal, previousSelection, totalVotes)
            return
        }

        // Show voting buttons
        val container = binding.optionContainer
        container.removeAllViews()

        options.forEachIndexed { index, option ->
            val button = MaterialButton(this).apply {
                text = option.name
                backgroundTintList = ContextCompat.getColorStateList(this@VoteOptionsActivity, R.color.unselected_button_color)
                setTextColor(resources.getColor(R.color.white))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (12 * resources.displayMetrics.density).toInt()
                }
                tag = index + 1
                setOnClickListener { v ->
                    clearDynamicButtons()
                    v.backgroundTintList = ContextCompat.getColorStateList(this@VoteOptionsActivity, R.color.primary_button_color)
                    selectedOption = v.tag as Int
                    binding.voteBtn.backgroundTintList = ContextCompat.getColorStateList(this@VoteOptionsActivity, R.color.primary_button_color)
                    binding.voteBtn.isEnabled = true
                }
            }
            optionButtons.add(button)
            container.addView(button)
        }

        binding.voteBtn.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.unselected_button_color)
        binding.voteBtn.isEnabled = false

        initDynamicVoteButton()
    }

    private fun showDynamicResults(proposal: ProposalData, selectedIndex: Int, totalVotes: Float) {
        binding.voteContainer.visibility = View.GONE

        val container = binding.optionContainer
        container.removeAllViews()

        proposal.options.forEachIndexed { index, option ->
            val resultLayout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (12 * resources.displayMetrics.density).toInt()
                }
            }

            // Calculate percentage from actual results
            val optionVotes = if (index < proposal.votingResults.size) {
                proposal.votingResults[index].sum().toFloat()
            } else 0f
            val percentage = if (totalVotes > 0) (optionVotes / totalVotes * 100).toInt() else 0

            val label = MaterialTextView(this).apply {
                text = "${option.name} - $percentage%"
                setTextColor(resources.getColor(R.color.white))
            }

            val progress = LinearProgressIndicator(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                setProgressCompat(percentage, false)
                if (index + 1 == selectedIndex) {
                    setIndicatorColor(resources.getColor(R.color.primary_button_color))
                }
            }

            if (index + 1 == selectedIndex) {
                resultLayout.background = resources.getDrawable(R.drawable.section_done_background)
            }

            resultLayout.addView(label)
            resultLayout.addView(progress)
            container.addView(resultLayout)
        }

        initViewButtons()
    }

    private fun clearDynamicButtons() {
        optionButtons.forEach { btn ->
            btn.backgroundTintList = ContextCompat.getColorStateList(this, R.color.unselected_button_color)
        }
        selectedOption = -1
    }

    private fun initDynamicVoteButton() {
        clickHelper.addViews(binding.voteBtn, binding.backButton)

        clickHelper.setOnClickListener {
            when (it.id) {
                binding.voteBtn.id -> {
                    if (selectedOption > 0) {
                        SecureSharedPrefs.saveVoteResult(this, selectedOption)
                        finish()
                        Navigator.from(this).openVoteProcessing(votingData, proposalData = proposalData)
                    }
                }
                binding.backButton.id -> finish()
            }
        }
    }

    private fun setupLegacyOptions(selectedOptionSc: Int) {
        // Restore legacy 3-option UI
        binding.option1.visibility = View.VISIBLE
        binding.option2.visibility = View.VISIBLE
        binding.option3.visibility = View.VISIBLE

        if (selectedOptionSc > -1) {
            binding.firstPercentage.visibility = View.VISIBLE
            binding.secondPercentage.visibility = View.VISIBLE
            binding.thirdPercentage.visibility = View.VISIBLE
            binding.voteContainer.visibility = View.GONE

            when (selectedOptionSc) {
                1 -> {
                    binding.firstPercentage.background = resources.getDrawable(R.drawable.section_done_background)
                    binding.progress1.setIndicatorColor(resources.getColor(R.color.primary_button_color))
                }
                2 -> {
                    binding.secondPercentage.background = resources.getDrawable(R.drawable.section_done_background)
                    binding.progress2.setIndicatorColor(resources.getColor(R.color.primary_button_color))
                }
                3 -> {
                    binding.thirdPercentage.background = resources.getDrawable(R.drawable.section_done_background)
                    binding.progress3.setIndicatorColor(resources.getColor(R.color.primary_button_color))
                }
            }

            binding.progress1.setProgressCompat(24, false)
            binding.progress2.setProgressCompat(56, false)
            binding.progress3.setProgressCompat(20, false)

            initViewButtons()
            return
        }

        binding.voteBtn.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.unselected_button_color)
        initLegacyButtons()
    }

    private fun clearButtons() {
        binding.option1.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.unselected_button_color)
        binding.option2.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.unselected_button_color)
        binding.option3.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.unselected_button_color)
        binding.voteBtn.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.primary_button_color)
        binding.voteBtn.isEnabled = true
        selectedOption = -1
    }

    private fun initViewButtons() {
        clickHelper.addViews(binding.backButton)

        clickHelper.setOnClickListener {
            when(it.id) {
                binding.backButton.id -> finish()
            }
        }
    }

    private fun initLegacyButtons() {
        clickHelper.addViews(
            binding.voteBtn, binding.backButton, binding.option1, binding.option2, binding.option3
        )

        clickHelper.setOnClickListener {
            when (it.id) {
                binding.voteBtn.id -> {
                    SecureSharedPrefs.saveVoteResult(this, selectedOption)
                    finish()
                    Navigator.from(this).openOptionVoting(votingData)
                    Navigator.from(this).openVoteProcessing(votingData)
                }
                binding.backButton.id -> finish()
                binding.option1.id -> {
                    clearButtons()
                    binding.option1.backgroundTintList =
                        ContextCompat.getColorStateList(this, R.color.primary_button_color)
                    selectedOption = 1
                }
                binding.option2.id -> {
                    clearButtons()
                    binding.option2.backgroundTintList =
                        ContextCompat.getColorStateList(this, R.color.primary_button_color)
                    selectedOption = 2
                }
                binding.option3.id -> {
                    clearButtons()
                    binding.option3.backgroundTintList =
                        ContextCompat.getColorStateList(this, R.color.primary_button_color)
                    selectedOption = 3
                }
            }
        }
    }

    companion object {
        const val VOTING_DATA = "voting_data"
        const val PROPOSAL_DATA = "proposal_data"
    }
}
