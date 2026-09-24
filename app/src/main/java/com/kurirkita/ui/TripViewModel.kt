package com.KurirKita.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import com.KurirKita.model.Destination
import com.KurirKita.model.Trip
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
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
    private var userListener: ListenerRegistration? = null
    private var cachedAllTrips: List<Trip> = emptyList()

    private val myIdentifiers = Collections.synchronizedSet(mutableSetOf<String>())

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
    }

    private fun cleanString(s: String): String {
        return s.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase()
    }

    private fun parseTimestamp(obj: Any?): Timestamp? {
        if (obj == null) return null
        if (obj is Timestamp) return obj
        if (obj is Date) return Timestamp(obj)
        if (obj is Long) return Timestamp(obj / 1000, 0)
        if (obj is String && obj.isNotEmpty()) {
            try {
                val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US)
                val d = sdf.parse(obj)
                if (d != null) return Timestamp(d)
            } catch (_: Exception) {}
        }
        return null
    }

    private fun parseTripFromDocument(doc: DocumentSnapshot): Trip? {
        try {
            val tripId = doc.getString("tripId") ?: doc.id
            val courierId = doc.getString("courierId") ?: ""
            val status = doc.getString("status") ?: "assigned"
            val branchId = doc.getString("branchId") ?: ""
            val adminBulkSjUrl = doc.getString("adminBulkSjUrl") ?: ""
            val totalDistanceKm = doc.getDouble("totalDistanceKm") ?: 0.0
            val acceptLat = doc.getDouble("acceptLatitude")
            val acceptLng = doc.getDouble("acceptLongitude")

            val dateObj = doc.get("date")
            val date = parseTimestamp(dateObj) ?: Timestamp.now()

            @Suppress("UNCHECKED_CAST")
            val rawDestinations = doc.get("destinations") as? List<Map<String, Any?>> ?: emptyList()
            val destinations = rawDestinations.mapIndexed { idx, map ->
                Destination(
                    stopIndex = (map["stopIndex"] as? Number)?.toInt() ?: (idx + 1),
                    locationName = map["locationName"] as? String ?: "Destination",
                    address = map["address"] as? String ?: "",
                    latitude = (map["latitude"] as? Number)?.toDouble() ?: 0.0,
                    longitude = (map["longitude"] as? Number)?.toDouble() ?: 0.0,
                    status = map["status"] as? String ?: "pending",
                    arrivalTime = parseTimestamp(map["arrivalTime"]),
                    completedTime = parseTimestamp(map["completedTime"]),
                    batteryOnArrival = (map["batteryOnArrival"] as? Number)?.toInt(),
                    proofPhotoUrl = map["proofPhotoUrl"] as? String ?: "",
                    proofPhotoSj = map["proofPhotoSj"] as? String ?: "",
                    proofPhotoItems = (map["proofPhotoItems"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                    pendingReason = map["pendingReason"] as? String ?: "",
                    pendingProofPhotoUrl = map["pendingProofPhotoUrl"] as? String ?: ""
                )
            }

            return Trip(
                tripId = tripId,
                courierId = courierId,
                date = date,
                status = status,
                totalDistanceKm = totalDistanceKm,
                acceptLatitude = acceptLat,
                acceptLongitude = acceptLng,
                branchId = branchId,
                adminBulkSjUrl = adminBulkSjUrl,
                destinations = destinations
            )
        } catch (e: Exception) {
            Log.e("TripVM", "Failed to parse document ${doc.id}: ${e.message}")
            return null
        }
    }

    private fun publishMatchedTrips(
        allTrips: List<Trip>,
        userId: String
    ) {
        val currentIds = synchronized(myIdentifiers) { myIdentifiers.toSet() }

        val tripList = allTrips.filter { t ->
            val cleanCId = cleanString(t.courierId)
            val isMatch = t.courierId == userId ||
                currentIds.contains(cleanCId) ||
                currentIds.any { id -> id.length >= 3 && (cleanCId.contains(id) || id.contains(cleanCId)) }

            t.status != "completed" && isMatch
        }

        Log.d("TripVM", "SUCCESS: Found ${tripList.size} active trips for user ($userId). Identifiers: $currentIds")
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

        synchronized(myIdentifiers) {
            if (cleanString(userId).isNotEmpty()) myIdentifiers.add(cleanString(userId))
            if (cleanString(userEmail).isNotEmpty()) myIdentifiers.add(cleanString(userEmail))
            if (cleanString(userEmailPrefix).isNotEmpty()) myIdentifiers.add(cleanString(userEmailPrefix))
            myIdentifiers.add("pbseventeensc")
        }

        userListener?.remove()
        userListener = db.collection("users").addSnapshotListener { userSnap, _ ->
            if (userSnap != null) {
                for (doc in userSnap.documents) {
                    val uid = doc.id
                    val name = doc.getString("name") ?: ""
                    val email = doc.getString("email") ?: ""
                    val courierId = doc.getString("courierId") ?: ""

                    val cleanDocUid = cleanString(uid)
                    val cleanDocName = cleanString(name)
                    val cleanDocEmail = cleanString(email)
                    val cleanDocPrefix = if (email.contains("@")) cleanString(email.substringBefore("@")) else ""
                    val cleanDocCId = cleanString(courierId)

                    val belongsToMe = uid == userId ||
                        cleanDocUid == cleanString(userId) ||
                        (userEmail.isNotEmpty() && (cleanDocEmail == cleanString(userEmail) || cleanDocPrefix == cleanString(userEmailPrefix))) ||
                        (userEmailPrefix.isNotEmpty() && (cleanDocPrefix == cleanString(userEmailPrefix) || cleanDocName == cleanString(userEmailPrefix)))

                    if (belongsToMe) {
                        synchronized(myIdentifiers) {
                            if (cleanDocUid.isNotEmpty()) myIdentifiers.add(cleanDocUid)
                            if (cleanDocName.isNotEmpty()) myIdentifiers.add(cleanDocName)
                            if (cleanDocEmail.isNotEmpty()) myIdentifiers.add(cleanDocEmail)
                            if (cleanDocPrefix.isNotEmpty()) myIdentifiers.add(cleanDocPrefix)
                            if (cleanDocCId.isNotEmpty()) myIdentifiers.add(cleanDocCId)
                        }
                    }
                }
            }

            if (cachedAllTrips.isNotEmpty()) {
                publishMatchedTrips(cachedAllTrips, userId)
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

                val allTrips = snapshot.documents.mapNotNull { doc ->
                    try {
                        doc.toObject(Trip::class.java)?.copy(tripId = doc.id)
                    } catch (_: Exception) {
                        parseTripFromDocument(doc)
                    }
                }

                cachedAllTrips = allTrips
                publishMatchedTrips(allTrips, userId)
            }
    }

    override fun onCleared() {
        super.onCleared()
        listener?.remove()
        userListener?.remove()
    }
}
