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

    private fun fetchAssignedTrips() {
        val userId = auth.currentUser?.uid ?: return
        val userEmail = auth.currentUser?.email ?: ""
        val userEmailPrefix = if (userEmail.contains("@")) userEmail.substringBefore("@") else userEmail
        Log.d("TripVM", "Fetching trips for user: $userId ($userEmail)")

        var courierName = ""
        db.collection("users").document(userId).get().addOnSuccessListener { userDoc ->
            if (userDoc != null && userDoc.exists()) {
                val nameFromDoc = userDoc.getString("name") ?: ""
                if (nameFromDoc.isNotEmpty() && nameFromDoc != courierName) {
                    courierName = nameFromDoc
                    // Refresh snapshot filter with updated courierName
                    _trips.value.let { currentTrips ->
                        val updatedList = currentTrips.filter { t -> t.status != "completed" }
                        _trips.value = updatedList
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
                    
                    // Match trip if courierId equals UID OR email OR courierName OR email prefix
                    val tripList = allTrips.filter { t ->
                        t.status != "completed" && (
                            t.courierId == userId ||
                            (courierName.isNotEmpty() && (
                                t.courierId.equals(courierName, ignoreCase = true) ||
                                t.courierId.contains(courierName, ignoreCase = true) ||
                                courierName.contains(t.courierId, ignoreCase = true)
                            )) ||
                            (userEmail.isNotEmpty() && t.courierId.equals(userEmail, ignoreCase = true)) ||
                            (userEmailPrefix.isNotEmpty() && (
                                t.courierId.equals(userEmailPrefix, ignoreCase = true) ||
                                t.courierId.contains(userEmailPrefix, ignoreCase = true) ||
                                userEmailPrefix.contains(t.courierId, ignoreCase = true)
                            )) ||
                            t.courierId.contains(userId, ignoreCase = true)
                        )
                    }

                    Log.d("TripVM", "SUCCESS: Found ${tripList.size} active trips out of ${allTrips.size} total trips in DB for user ($userId)")
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
                } catch (err: Exception) {
                    Log.e("TripVM", "Mapping Error: ${err.message}")
                }
            }
    }

    private fun fetchHistoryAndStats() {
        // Stop calculating real stats for now as requested
        _dashboardState.value = DashboardState()
    }

    override fun onCleared() {
        super.onCleared()
        listener?.remove()
        historyListener?.remove()
    }
}
