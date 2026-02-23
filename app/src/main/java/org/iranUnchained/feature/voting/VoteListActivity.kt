package org.iranUnchained.feature.voting

import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.Window
import android.view.WindowManager
import androidx.databinding.DataBindingUtil
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import io.reactivex.rxkotlin.addTo
import org.iranUnchained.R
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.data.datasource.api.ProposalProvider
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.VotingData
import org.iranUnchained.databinding.ActivityVoteListBinding
import org.iranUnchained.feature.setings.SettingsFragment
import org.iranUnchained.feature.voting.logic.VoteAdapter
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import org.iranUnchained.utils.Navigator
import org.iranUnchained.utils.ObservableTransformers
import org.iranUnchained.BuildConfig
import org.iranUnchained.utils.LocalDevSeeder
import org.iranUnchained.utils.unSafeLazy


class VoteListActivity : BaseActivity() {

    private lateinit var binding: ActivityVoteListBinding

    private var voteList: List<VotingData> = listOf()
    private var voteListEnded: List<VotingData> = listOf()
    private var proposalList: List<ProposalData> = listOf()
    private var proposalListEnded: List<ProposalData> = listOf()


    private val voteAdapter by unSafeLazy {
        VoteAdapter(clickHelper, Navigator.from(this), SecureSharedPrefs, apiProvider, this)
    }

    override fun onCreateAllowed(savedInstanceState: Bundle?) {
        binding = DataBindingUtil.setContentView(this, R.layout.activity_vote_list)
        binding.lifecycleOwner = this

        if (savedInstanceState != null && !voteAdapter.hasData) {
            restoreFromMemory(savedInstanceState)
        } else {
            subscribeToVotes()
        }


        val window: Window = this.window
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = resources.getColor(R.color.primary_button_color)

        binding.recyclerViewVote.adapter = voteAdapter
        val manager = LinearLayoutManager(this)
        binding.recyclerViewVote.layoutManager = manager

        // Only show export button in local dev builds
        binding.scanExportButton.visibility = if (BuildConfig.IS_LOCAL_DEV) View.VISIBLE else View.GONE

        // Pre-seed identity data for local dev (so voting flow works without passport scan)
        if (BuildConfig.IS_LOCAL_DEV) {
            LocalDevSeeder.seedIfNeeded(this)
        }

        initButtons()
    }

    private fun subscribeToVotes() {

        ProposalProvider.getProposals(apiProvider)
            .compose(ObservableTransformers.defaultSchedulersSingle()).doOnSuccess {
                binding.loader.visibility = View.GONE
            }.doOnSubscribe {
                binding.loader.visibility = View.VISIBLE
            }.subscribe({ (active, ended) ->
                proposalList = active
                proposalListEnded = ended
                voteList = active.map { it.toVotingData() }
                voteListEnded = ended.map { it.toVotingData() }
                voteAdapter.proposalDataList = active
                voteAdapter.addAll(voteList)

            }, {
                Log.e("ProposalProvider", it.message, it)
                subscribeToVotes()
            }).addTo(compositeDisposable)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        val gson = Gson()
        val json = gson.toJson(voteList)
        val json_ended = gson.toJson(voteListEnded)
        outState.putString(SAVED_VOTES_LIST, json)
        outState.putString(SAVED_VOTES_LIST_ENDED, json_ended)
    }

    private fun restoreFromMemory(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        val json = savedInstanceState.getString(SAVED_VOTES_LIST)
        val jsonEnded = savedInstanceState.getString(SAVED_VOTES_LIST_ENDED)
        val type = object : TypeToken<List<VotingData>>() {}.type
        if (json!!.isNotEmpty()) {
            val gson = Gson()
            voteList = gson.fromJson(json, type)
            voteListEnded = gson.fromJson(jsonEnded, type)
            voteAdapter.clear()
            voteAdapter.addAll(voteList)
            return
        }
        subscribeToVotes()
    }

    private fun initButtons() {
        clickHelper.addViews(
            binding.settings, binding.title, binding.scanExportButton
        )
        clickHelper.setOnClickListener {
            when (it.id) {
                binding.settings.id -> {
                    val modalBottomSheet = SettingsFragment()
                    modalBottomSheet.logoutCallback = ::clearAllData
                    modalBottomSheet.show(supportFragmentManager, SettingsFragment.TAG)
                }
                binding.scanExportButton.id -> {
                    Log.i("PASSPORT_EXPORT", "Scan & Export button tapped, opening ScanActivity")
                    Navigator.from(this).openScan()
                }
            }
        }

        binding.buttonGroupRoundSelectedButton.addOnButtonCheckedListener { group, checkedId, isChecked ->

            if (isChecked) {
                if (checkedId == binding.activeBtn.id) {
                    voteAdapter.clear()
                    voteAdapter.proposalDataList = proposalList
                    voteAdapter.addAll(voteList)
                    if (voteList.isEmpty()) {
                        binding.noPollsText.visibility = View.VISIBLE
                        binding.noPollsText.text = getString(R.string.no_votes)
                    } else {
                        binding.noPollsText.visibility = View.GONE
                    }

                    binding.completedBtn
                } else if (checkedId == binding.completedBtn.id) {
                    voteAdapter.clear()
                    voteAdapter.proposalDataList = proposalListEnded
                    voteAdapter.addAll(voteListEnded)
                    if (voteListEnded.isEmpty()) {
                        binding.noPollsText.visibility = View.VISIBLE
                        binding.noPollsText.text = getString(R.string.no_completed_votes)
                    }
                }
            }
        }

    }


    private fun clearAllData() {
        MaterialAlertDialogBuilder(this).setTitle(getString(R.string.delete_all_data_header))
            .setMessage(resources.getString(R.string.delete_all_data_message))
            .setPositiveButton(resources.getString(R.string.button_ok)) { _, _ ->
                compositeDisposable.clear()
                SecureSharedPrefs.clearAllData(this)
                recreate()
            }.setNegativeButton(resources.getString(R.string.decline)) { dialog, _ ->
                dialog.dismiss()
            }.show()
    }

    private companion object {
        const val SAVED_VOTES_LIST = "saved_votes_list"
        const val SAVED_VOTES_LIST_ENDED = "saved_votes_list_ended"
    }

}
