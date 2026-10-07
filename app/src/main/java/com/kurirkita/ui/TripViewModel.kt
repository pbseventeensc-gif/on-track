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

    var selectedTrip = androidx.compose.runtime.mutableStateOf<Trip?>(null)
    var showChatTripId = androidx.compose.runtime.mutableStateOf<String?>(null)
    var currentTab = androidx.compose.runtime.mutableStateOf("dashboard")

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

    companion object {
        fun isToday(timestamp: Timestamp?): Boolean {
            if (timestamp == null) return false
            val calTrip = Calendar.getInstance().apply { time = timestamp.toDate() }
            val calToday = Calendar.getInstance()
            return calTrip.get(Calendar.YEAR) == calToday.get(Calendar.YEAR) &&
                   calTrip.get(Calendar.DAY_OF_YEAR) == calToday.get(Calendar.DAY_OF_YEAR)
        }

        fun isWithinDays(timestamp: Timestamp?, days: Int = 3): Boolean {
            if (timestamp == null) return false
            val calTrip = Calendar.getInstance().apply { time = timestamp.toDate() }
            val cutoff = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, -(days - 1))
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            return !calTrip.before(cutoff)
        }

        fun parseTimestamp(obj: Any?): Timestamp? {
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

        fun parseTripFromDocument(doc: DocumentSnapshot): Trip? {
            try {
                val tripId = doc.getString("tripId") ?: doc.id
                val courierId = doc.getString("courierId") ?: ""
                val status = doc.getString("status") ?: "assigned"
                val branchId = doc.getString("branchId") ?: ""
                val adminBulkSjUrl = doc.getString("adminBulkSjUrl") ?: ""
                @Suppress("UNCHECKED_CAST")
                val adminBulkSjUrls = (doc.get("adminBulkSjUrls") as? List<*>)?.mapNotNull { it as? String }
                    ?: if (adminBulkSjUrl.isNotEmpty()) adminBulkSjUrl.split(",").map { it.trim() }.filter { it.isNotEmpty() } else emptyList()
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
                    adminBulkSjUrls = adminBulkSjUrls,
                    destinations = destinations
                )
            } catch (e: Exception) {
                Log.e("TripVM", "Failed to parse document ${doc.id}: ${e.message}")
                return null
            }
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

            t.status != "completed" && isMatch && isWithinDays(t.date, 3)
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

            val cleanPrefix = cleanString(userEmailPrefix)
            if (cleanPrefix.contains("joyen")) {
                myIdentifiers.add("joyen")
                myIdentifiers.add("joyen99")
                myIdentifiers.add("joyendriver321")
                myIdentifiers.add("4nm4m56vzemliusvn7lvh11seey1")
            }
            if (cleanPrefix.contains("ahmad") || cleanPrefix.contains("motor03")) {
                myIdentifiers.add("ahmad")
                myIdentifiers.add("ahmadmotor")
                myIdentifiers.add("ahmadmotor03")
                myIdentifiers.add("ahmadmotor03gmailcom")
            }
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

                            if (cleanDocName.contains("joyen") || cleanDocPrefix.contains("joyen")) {
                                myIdentifiers.add("joyen")
                                myIdentifiers.add("joyen99")
                                myIdentifiers.add("joyendriver321")
                                myIdentifiers.add("4nm4m56vzemliusvn7lvh11seey1")
                            }
                            if (cleanDocName.contains("ahmad") || cleanDocPrefix.contains("ahmad") || cleanDocPrefix.contains("motor03")) {
                                myIdentifiers.add("ahmad")
                                myIdentifiers.add("ahmadmotor")
                                myIdentifiers.add("ahmadmotor03")
                                myIdentifiers.add("ahmadmotor03gmailcom")
                            }
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

    fun searchMasterClients(query: String, onComplete: (List<Map<String, Any>>) -> Unit) {
        db.collection("clients")
            .get()
            .addOnSuccessListener { snapshot ->
                val list = mutableListOf<Map<String, Any>>()
                val q = query.lowercase().trim()
                for (doc in snapshot.documents) {
                    val name = doc.getString("name") ?: doc.getString("locationName") ?: ""
                    val address = doc.getString("address") ?: ""
                    val lat = doc.getDouble("latitude") ?: 0.0
                    val lng = doc.getDouble("longitude") ?: 0.0

                    if (q.isEmpty() || name.lowercase().contains(q) || address.lowercase().contains(q)) {
                        list.add(
                            mapOf(
                                "id" to doc.id,
                                "name" to name,
                                "address" to address,
                                "latitude" to lat,
                                "longitude" to lng
                            )
                        )
                    }
                }
                onComplete(list)
            }
            .addOnFailureListener {
                onComplete(emptyList())
            }
    }

    fun claimOrCreateTrip(storeName: String, address: String, latitude: Double, longitude: Double, onComplete: (Boolean, String) -> Unit) {
        val currentUser = auth.currentUser
        if (currentUser == null) {
            onComplete(false, "Kurir belum login.")
            return
        }
        val tripId = "TRIP_" + System.currentTimeMillis()
        val tripMap = mapOf(
            "tripId" to tripId,
            "courierId" to currentUser.uid,
            "status" to "in_progress",
            "date" to Timestamp.now(),
            "acceptedTime" to Timestamp.now(),
            "destinations" to listOf(
                mapOf(
                    "stopIndex" to 1,
                    "locationName" to storeName,
                    "address" to address,
                    "latitude" to latitude,
                    "longitude" to longitude,
                    "status" to "pending",
                    "proofPhotoUrl" to ""
                )
            )
        )

        db.collection("trips").document(tripId).set(tripMap)
            .addOnSuccessListener {
                onComplete(true, "Tugas berhasil diambil!")
                refresh()
            }
            .addOnFailureListener { e ->
                onComplete(false, "Gagal mengambil tugas: ${e.message}")
            }
    }

    override fun onCleared() {
        super.onCleared()
        listener?.remove()
        userListener?.remove()
    }
}
