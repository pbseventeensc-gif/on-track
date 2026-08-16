package com.KurirKita.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import com.KurirKita.model.Trip
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class TripViewModel : ViewModel() {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private var listener: ListenerRegistration? = null

    private val _trips = MutableStateFlow<List<Trip>>(emptyList())
    val trips: StateFlow<List<Trip>> = _trips

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing

    init {
        refresh()
    }

    fun refresh() {
        _isRefreshing.value = true
        fetchAssignedTrips()
    }

    private fun fetchAssignedTrips() {
        val userId = auth.currentUser?.uid ?: return
        Log.d("TripVM", "Fetching trips for user: $userId")
        
        listener?.remove()
        listener = db.collection("trips")
            .whereEqualTo("courierId", userId)
            .addSnapshotListener { snapshot, e ->
                _isRefreshing.value = false
                if (e != null) {
                    Log.e("TripVM", "Firestore Error: ${e.message}")
                    return@addSnapshotListener
                }
                
                // Filter "completed" in Kotlin to avoid complex index requirement for now
                val tripList = snapshot?.toObjects(Trip::class.java)
                    ?.filter { it.status != "completed" } ?: emptyList()
                
                Log.d("TripVM", "Loaded ${tripList.size} trips")
                _trips.value = tripList
            }
    }

    override fun onCleared() {
        super.onCleared()
        listener?.remove()
    }
}
