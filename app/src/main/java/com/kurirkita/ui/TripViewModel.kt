package com.KurirKita.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import com.KurirKita.model.Trip
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.*

class TripViewModel : ViewModel() {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private var listener: ListenerRegistration? = null
    private var historyListener: ListenerRegistration? = null
    private var cachedAllTrips: List<Trip> = emptyList()

    private val _trips = MutableStateFlow<List<Trip>>(emptyList())
    val trips: StateFlow<List<Trip>> = _trips

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing

    private val _dashboardState = MutableStateFlow(DashboardState())
    val dashboardState = _dashboardState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _isRefreshing.value = true
        fetchAssignedTrips()
        fetchHistoryAndStats()
    }

    private fun cleanString(s: String): String {
        return s.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase()
    }

    private fun filterAndPublishTrips(
        allTrips: List<Trip>,
        userId: String,
        userEmail: String,
        userEmailPrefix: String,
        courierName: String
    ) {
        val cleanUid = cleanString(userId)
        val cleanEmail = cleanString(userEmail)
        val cleanPrefix = cleanString(userEmailPrefix)
        val cleanName = cleanString(courierName)

        val tripList = allTrips.filter { t ->
            val cleanCId = cleanString(t.courierId)
            t.status != "completed" && (
                t.courierId == userId ||
                cleanCId == cleanUid ||
                (cleanName.isNotEmpty() && (cleanCId == cleanName || cleanCId.contains(cleanName) || cleanName.contains(cleanCId))) ||
                (cleanEmail.isNotEmpty() && (cleanCId == cleanEmail || cleanCId.contains(cleanEmail))) ||
                (cleanPrefix.isNotEmpty() && (cleanCId == cleanPrefix || cleanCId.contains(cleanPrefix) || cleanPrefix.contains(cleanCId)))
            )
        }

        Log.d("TripVM", "SUCCESS: Found ${tripList.size} active trips for user ($userId / $courierName)")
        _trips.value = tripList

        val pendingStopsCount = tripList.sumOf { t ->
            if (t.destinations.isEmpty()) 1
            else t.destinations.count { d -> d.status != "done" }
        }

        _dashboardState.value = _dashboardState.value.copy(
            activeShipments = tripList.size.toString(),
            pendingShipments = pendingStopsCount.toString(),
            courierId = userId
        )
    }

    private fun fetchAssignedTrips() {
        val userId = auth.currentUser?.uid ?: return
        val userEmail = auth.currentUser?.email ?: ""
        val userEmailPrefix = if (userEmail.contains("@")) userEmail.substringBefore("@") else userEmail
        var courierName = ""

        db.collection("users").document(userId).get().addOnSuccessListener { userDoc ->
            if (userDoc != null && userDoc.exists()) {
                val nameFromDoc = userDoc.getString("name") ?: ""
                if (nameFromDoc.isNotEmpty()) {
                    courierName = nameFromDoc
                    if (cachedAllTrips.isNotEmpty()) {
                        filterAndPublishTrips(cachedAllTrips, userId, userEmail, userEmailPrefix, courierName)
                    }
                }
            }
        }

        listener?.remove()
        listener = db.collection("trips")
            .addSnapshotListener { snapshot, e ->
                _isRefreshing.value = false
                if (e != null) {
                    Log.e("TripVM", "Firestore Error: ${e.message}")
                    _dashboardState.value = _dashboardState.value.copy(activeShipments = "-1")
                    return@addSnapshotListener
                }

                if (snapshot == null) return@addSnapshotListener

                try {
                    val allTrips = snapshot.toObjects(Trip::class.java)
                    cachedAllTrips = allTrips
                    filterAndPublishTrips(allTrips, userId, userEmail, userEmailPrefix, courierName)
                } catch (err: Exception) {
                    Log.e("TripVM", "Mapping Error: ${err.message}")
                }
            }
    }

    private fun fetchHistoryAndStats() {
        _dashboardState.value = DashboardState()
    }

    override fun onCleared() {
        super.onCleared()
        listener?.remove()
        historyListener?.remove()
    }
}
