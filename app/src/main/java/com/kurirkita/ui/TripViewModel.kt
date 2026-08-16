package com.KurirKita.ui

import androidx.lifecycle.ViewModel
import com.KurirKita.model.Trip
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class TripViewModel : ViewModel() {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    private val _trips = MutableStateFlow<List<Trip>>(emptyList())
    val trips: StateFlow<List<Trip>> = _trips

    init {
        fetchAssignedTrips()
    }

    private fun fetchAssignedTrips() {
        val userId = auth.currentUser?.uid ?: return
        db.collection("trips")
            .whereEqualTo("courierId", userId)
            .whereNotEqualTo("status", "completed")
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                val tripList = snapshot?.toObjects(Trip::class.java) ?: emptyList()
                _trips.value = tripList
            }
    }
}
