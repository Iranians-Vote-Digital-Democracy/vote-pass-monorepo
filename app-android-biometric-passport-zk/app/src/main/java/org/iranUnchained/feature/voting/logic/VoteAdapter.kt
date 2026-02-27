package org.iranUnchained.feature.voting.logic

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import io.noties.markwon.Markwon
import org.iranUnchained.base.view.BaseActivity
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.VotingData
import org.iranUnchained.databinding.LayoutCardManifestBinding
import org.iranUnchained.databinding.LayoutCardVotingBinding
import org.iranUnchained.di.providers.ApiProvider
import org.iranUnchained.feature.onBoarding.logic.GenerateVerifiableCredential
import org.iranUnchained.logic.persistance.SecureSharedPrefs
import org.iranUnchained.utils.BaseAdapter
import org.iranUnchained.utils.ClickHelper
import org.iranUnchained.utils.Navigator
import org.iranUnchained.utils.resolveDays

class VoteAdapter(
    val clickHelper: ClickHelper,
    val navigator: Navigator,
    val secureSharedPreferences: SecureSharedPrefs,
    val apiProvider: ApiProvider,
    val activity: BaseActivity
) : BaseAdapter<VotingData, RecyclerView.ViewHolder>() {

    /** Parallel list of ProposalData corresponding to items in the adapter */
    var proposalDataList: List<ProposalData> = emptyList()

    private val manifestType = 1
    private val voteType = 2
    private val referendum = 3
    override fun getItemViewType(position: Int): Int {
        if (getItems()[position].isManifest) {
            return manifestType
        }
        return voteType
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {

        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            manifestType -> {
                val binding = LayoutCardManifestBinding.inflate(inflater, parent, false)
                ManifestViewHolder(binding)
            }

            voteType -> {
                val binding = LayoutCardVotingBinding.inflate(inflater, parent, false)
                VoteViewHolder(binding)
            }

            referendum -> {
                val binding = LayoutCardManifestBinding.inflate(inflater, parent, false)
                ReferendumViewHolder(binding)
            }

            else -> {
                throw IllegalStateException("Unknown vote type")
            }
        }
    }

    override fun getItemCount(): Int {
        return getItems().size
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder.itemViewType) {
            manifestType -> {
                val manifestHolder = holder as ManifestViewHolder
                manifestHolder.bind(getItem(position))
            }

            voteType -> {
                val voteHolder = holder as VoteViewHolder
                voteHolder.bind(getItem(position))
            }

            referendum -> {
                val referendumViewHolder = holder as ReferendumViewHolder
                referendumViewHolder.bind(getItem(position))
            }
        }
    }

    inner class VoteViewHolder(val binding: LayoutCardVotingBinding) :
        RecyclerView.ViewHolder(binding.root) {

        private lateinit var data: VotingData
        private val context = binding.root.context

        init {
            binding.root.setOnClickListener(::onClick)
        }

        private fun onClick(view: View) {
            clickHelper.canInvokeClick(::onClickAllowed)
        }

        private fun onClickAllowed() {
            if (data.isPassportRequired) {
                if (!secureSharedPreferences.getIsPassportScanned(context)) {
                    navigator.openVerificationPage(data)
                    return
                }
            }
            // Look up the original ProposalData so VoteOptionsActivity can show dynamic options
            val pos = bindingAdapterPosition
            val proposalData = if (pos in proposalDataList.indices) proposalDataList[pos] else null
            navigator.openVotePage(data, proposalData)
        }

        fun bind(voteData: VotingData) {
            data = voteData
            val time = resolveDays(context, data.dueDate!!, data.startDate!!, activity.getLocale())
            binding.date = time
            binding.data = voteData
        }
    }

    inner class ManifestViewHolder(val binding: LayoutCardManifestBinding) :
        RecyclerView.ViewHolder(binding.root) {
        private lateinit var data: VotingData
        private val context = binding.root.context


        private fun onClick(view: View) {
            clickHelper.canInvokeClick(::onClickAllowed)
        }

        private fun onClickAllowed() {
            val identity =
                GenerateVerifiableCredential().createIdentity(context, apiProvider = apiProvider)
            if (SecureSharedPrefs.checkIsVoted(context, identity?.nullifierHex, data.contractAddress!!)) {
                navigator.openSignedManifest(data)
                return
            }
            navigator.openManifestPage(data)
        }

        fun bind(voteData: VotingData) {
            data = voteData
            binding.data = voteData


            if (data.excerpt.isNullOrEmpty()) {
                val markdown = Markwon.create(context)
                markdown.setMarkdown(binding.excertText, data.description)
            } else {
                binding.excertText.text = data.excerpt
            }

            binding.cardView.setOnClickListener(::onClick)
            binding.excertText.setOnClickListener(::onClick)

            if (!data.isActive) {
                binding.separator.visibility = View.INVISIBLE
                return
            }


            val time = resolveDays(context, data.dueDate!!, data.startDate!!, activity.getLocale())
            binding.date = time

        }
    }


    inner class ReferendumViewHolder(val binding: LayoutCardManifestBinding) :
        RecyclerView.ViewHolder(binding.root) {
        private lateinit var data: VotingData
        private val context = binding.root.context


        private fun onClick(view: View) {
            clickHelper.canInvokeClick(::onClickAllowed)
        }

        private fun onClickAllowed() {

            val identity =
                GenerateVerifiableCredential().createIdentity(context, apiProvider = apiProvider)
            if (SecureSharedPrefs.checkIsVoted(context, identity?.nullifierHex, data.contractAddress!!)) {
                navigator.openSignedManifest(data)
                return
            }
            navigator.openManifestPage(data)
        }

        fun bind(voteData: VotingData) {
            data = voteData
            binding.data = voteData


            if (data.excerpt.isNullOrEmpty()) {
                val markdown = Markwon.create(context)
                markdown.setMarkdown(binding.excertText, data.description)
            } else {
                binding.excertText.text = data.excerpt
            }

            binding.cardView.setOnClickListener(::onClick)
            binding.excertText.setOnClickListener(::onClick)

            if (!data.isActive) {
                binding.separator.visibility = View.INVISIBLE
                binding.timeText.visibility = View.INVISIBLE
                return
            }


            val time = resolveDays(context, data.dueDate!!, data.startDate!!, activity.getLocale())
            binding.date = time

        }
    }

}