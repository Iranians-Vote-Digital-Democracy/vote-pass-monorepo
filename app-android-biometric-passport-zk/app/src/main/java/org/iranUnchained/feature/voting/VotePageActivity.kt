package org.iranUnchained.feature.voting

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.databinding.DataBindingUtil
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import org.iranUnchained.R
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.VotingData
import org.iranUnchained.databinding.ActivityVotePageBinding
import org.iranUnchained.databinding.LayoutRequirementDeclineItemBinding
import org.iranUnchained.databinding.LayoutRequirementOkItemBinding
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import org.iranUnchained.utils.Navigator
import org.iranUnchained.utils.calculateAge
import org.iranUnchained.utils.nfc.PermissionUtil
import org.iranUnchained.utils.resolveDays

class VotePageActivity : BaseActivity() {

    private lateinit var binding: ActivityVotePageBinding
    private lateinit var votingData: VotingData
    private var proposalData: ProposalData? = null

    private var age: Int = 0
    private var issuerAuthority: String = ""

    override fun onCreateAllowed(savedInstanceState: Bundle?) {
        binding = DataBindingUtil.setContentView(this, R.layout.activity_vote_page)
        binding.lifecycleOwner = this

        votingData = intent?.getParcelableExtra(VOTING_DATA)!!
        proposalData = intent?.getParcelableExtra(PROPOSAL_DATA)
        binding.data = votingData

        initButtons()
        initAddData()

        binding.dataOfVoting.text = resolveDays(this, votingData.dueDate!!, votingData.startDate!!, getLocale())

        val time = resolveDays(this, votingData.dueDate!!, votingData.dueDate!!, getLocale())
        binding.dataOfVoting.text = time

        checkPermissions()
    }

    override fun onResume() {
        super.onResume()
        val voted = if (proposalData != null) {
            SecureSharedPrefs.getVoteResult(this, proposalData!!.proposalId) > -1
        } else {
            @Suppress("DEPRECATION")
            SecureSharedPrefs.getVoteResult(this) > -1
        }
        if (voted) {
            setVoted()
        }
    }

    private fun addPassedReq(text: String) {
        val binding: LayoutRequirementOkItemBinding = DataBindingUtil.inflate(
            layoutInflater, R.layout.layout_requirement_ok_item, binding.reqContainer, true
        )
        binding.textContent = text
    }

    private fun addDeclineReq(text: String) {
        val binding: LayoutRequirementDeclineItemBinding = DataBindingUtil.inflate(
            layoutInflater, R.layout.layout_requirement_decline_item, binding.reqContainer, true
        )
        binding.textContent = text
    }


    private fun checkPermissions() {
        if (votingData.requirements == null) return

        var isCanPromote = true

        votingData.requirements?.let { requirements ->
            requirements.age?.let { requiredAge ->
                val ageMessage = getString(
                    R.string.are_x_years_old_on_or_before_election_day, requiredAge.toString()
                )
                if (age < requiredAge) {
                    addDeclineReq(ageMessage)
                    isCanPromote = false
                } else {
                    addPassedReq(ageMessage)
                }
            }

            if (requirements.getNationality() != null) {
                val nationalityMessage =
                    getString(R.string.is_citizen, requirements.getNationality())
                if (requirements.isInList(issuerAuthority)) {
                    addDeclineReq(nationalityMessage)
                    isCanPromote = false
                } else {
                    addPassedReq(nationalityMessage)
                }
            }
        }

        val hasVoted = if (proposalData != null) {
            SecureSharedPrefs.getVoteResult(this, proposalData!!.proposalId) != -1
        } else {
            @Suppress("DEPRECATION")
            SecureSharedPrefs.getVoteResult(this) != -1
        }
        if (hasVoted) {
            setVoted()
        }

        if (isCanPromote) {
            allowToUser()
        } else {
            declineToUser()
        }
    }


    private fun allowToUser() {
        binding.aprovedView.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.primary_button_color);
        binding.aprovedView.icon = getDrawable(R.drawable.ic_check)
        binding.aprovedView.iconTint = ContextCompat.getColorStateList(this, R.color.black)
        binding.aprovedView.setTextColor(resources.getColor(R.color.black))
        binding.aprovedView.text = getString(R.string.you_can_vote)
    }

    private fun declineToUser() {
        binding.aprovedView.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.error_color);
        binding.aprovedView.icon = getDrawable(R.drawable.ic_close)
        binding.aprovedView.iconTint = ContextCompat.getColorStateList(this, R.color.white)
        binding.aprovedView.setTextColor(resources.getColor(R.color.white))
        binding.aprovedView.text = getString(R.string.you_can_t_vote)
        binding.mainButton.visibility = View.INVISIBLE
    }


    private fun initAddData() {
        val date = SecureSharedPrefs.getDateOfBirth(this)!!
        issuerAuthority = SecureSharedPrefs.getIssuerAuthority(this)!!
        age = calculateAge(date)


        binding.header.text = votingData.header
        binding.description.text = votingData.description
    }

    private fun initButtons() {
        clickHelper.addViews(binding.backButton, binding.mainButton)

        clickHelper.setOnClickListener {
            when (it.id) {
                binding.backButton.id -> {
                    finish()
                }

                binding.mainButton.id -> {
                    Navigator.from(this).openOptionVoting(votingData, proposalData)
                }
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<String?>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PermissionUtil.REQUEST_CODE_MULTIPLE_PERMISSIONS) {
            val result = grantResults[0]
            if (result == PackageManager.PERMISSION_DENIED) {
                if (!PermissionUtil.showRationale(this, permissions[0])) {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    val uri = Uri.fromParts("package", packageName, null)
                    intent.setData(uri)
                    startActivityForResult(
                        intent, APP_SETTINGS_ACTIVITY_REQUEST_CODE
                    )
                } else {
                    requestPermissionForCamera()
                }
            } else if (result == PackageManager.PERMISSION_GRANTED) {
                Navigator.from(this).openScan()
            }
        }
    }

    private fun requestPermissionForCamera() {
        val permissions = arrayOf(Manifest.permission.CAMERA)
        val isPermissionGranted = PermissionUtil.hasPermissions(this, *permissions)
        if (!isPermissionGranted) {

            MaterialAlertDialogBuilder(this).setTitle(getString(R.string.permission_title))
                .setMessage(resources.getString(R.string.permission_description))
                .setPositiveButton(resources.getString(R.string.button_ok)) { dialog, which ->
                    ActivityCompat.requestPermissions(
                        this, permissions, PermissionUtil.REQUEST_CODE_MULTIPLE_PERMISSIONS
                    )
                }.show()


        } else {
            Navigator.from(this).openScan()
        }
    }

    private fun setVoted() {
        binding.mainButton.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.unselected_button_color)
        binding.mainButton.icon = getDrawable(R.drawable.ic_check)
        binding.mainButton.text = resources.getText(R.string.enrolled)
        binding.mainButton.setTextColor(resources.getColor(R.color.black))
        binding.mainButton.iconTint = ContextCompat.getColorStateList(this, R.color.black)
    }

    companion object {
        const val VOTING_DATA = "voting_data"
        const val PROPOSAL_DATA = "proposal_data"
        private const val APP_SETTINGS_ACTIVITY_REQUEST_CODE = 550
    }
}