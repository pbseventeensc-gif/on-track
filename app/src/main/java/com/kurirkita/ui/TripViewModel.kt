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
        Log.d("TripVM", "Fetching trips for user: $userId ($userEmail)")

        db.collection("users").document(userId).get().addOnSuccessListener { userDoc ->
            val userName = userDoc.getString("name") ?: ""

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
                        
                        // Match trip by UID OR Courier Name OR Courier Email
                        val tripList = allTrips.filter { t ->
                            t.status != "completed" && (
                                t.courierId == userId ||
                                (userName.isNotEmpty() && t.courierId.equals(userName, ignoreCase = true)) ||
                                (userEmail.isNotEmpty() && t.courierId.equals(userEmail, ignoreCase = true))
                            )
                        }

                        Log.d("TripVM", "SUCCESS: Found ${tripList.size} active trips for user $userName ($userId)")
                        _trips.value = tripList

                        _dashboardState.value = _dashboardState.value.copy(
                            activeShipments = tripList.size.toString(),
                            courierId = userId
                        )
                    } catch (err: Exception) {
                        Log.e("TripVM", "Mapping Error: ${err.message}")
                    }
                }
        }.addOnFailureListener {
            // Fallback query by UID
            listener?.remove()
            listener = db.collection("trips")
                .whereEqualTo("courierId", userId)
                .addSnapshotListener { snapshot, e ->
                    _isRefreshing.value = false
                    if (snapshot != null) {
                        val allTrips = snapshot.toObjects(Trip::class.java)
                        val tripList = allTrips.filter { it.status != "completed" }
                        _trips.value = tripList
                    }
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
