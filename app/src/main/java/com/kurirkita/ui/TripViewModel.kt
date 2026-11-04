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
                val sjNumber = doc.getString("sjNumber") ?: doc.getString("noSJ") ?: ""
                val shortCode = doc.getString("shortCode") ?: doc.getString("uniqueCode") ?: ""
                val uniqueCode = doc.getString("uniqueCode") ?: shortCode
                val customer = doc.getString("customer") ?: doc.getString("clientName") ?: ""
                val courierId = doc.getString("courierId") ?: ""
                val status = doc.getString("status") ?: "assigned"
                val branchId = doc.getString("branchId") ?: ""
                val adminBulkSjUrl = doc.getString("adminBulkSjUrl") ?: ""
                @Suppress("UNCHECKED_CAST")
                val adminBulkSjUrls = (doc.get("adminBulkSjUrls") as? List<*>)?.mapNotNull { it as? String }
                    ?: if (adminBulkSjUrl.isNotEmpty()) adminBulkSjUrl.split(",").map { it.trim() }.filter { it.isNotEmpty() } else emptyList()
                val vehiclePlate = doc.getString("vehiclePlate") ?: ""
                val vehicleName = doc.getString("vehicleName") ?: ""
                val vehicleType = doc.getString("vehicleType") ?: ""
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
                        locationName = map["locationName"] as? String ?: (if (customer.isNotEmpty()) customer else "Destination"),
                        address = map["address"] as? String ?: "",
                        latitude = (map["latitude"] as? Number)?.toDouble() ?: 0.0,
                        longitude = (map["longitude"] as? Number)?.toDouble() ?: 0.0,
                        status = map["status"] as? String ?: "pending",
                        arrivalTime = parseTimestamp(map["arrivalTime"]),
                        completedTime = parseTimestamp(map["completedTime"]),
                        batteryOnArrival = (map["batteryOnArrival"] as? Number)?.toInt(),
                        proofPhotoUrl = map["proofPhotoUrl"] as? String ?: "",
                        proofPhotoSj = map["proofPhotoSj"] as? String ?: "",
                        proofPhotoItems = when (val items = map["proofPhotoItems"]) {
                            is List<*> -> items.mapNotNull { it as? String }
                            is String -> if (items.isNotBlank()) items.split(",").map { it.trim() }.filter { it.isNotEmpty() } else emptyList()
                            else -> emptyList()
                        },
                        pendingReason = map["pendingReason"] as? String ?: "",
                        pendingProofPhotoUrl = map["pendingProofPhotoUrl"] as? String ?: "",
                        vehiclePlate = map["vehiclePlate"] as? String ?: vehiclePlate,
                        vehicleName = map["vehicleName"] as? String ?: vehicleName,
                        sjNumber = (map["sjNumber"] as? String) ?: (map["noSJ"] as? String) ?: sjNumber,
                        shortCode = (map["shortCode"] as? String) ?: (map["uniqueCode"] as? String) ?: shortCode,
                        itemsSummary = map["itemsSummary"] as? String ?: "",
                        qty = map["qty"] as? String ?: ""
                    )
                }

                return Trip(
                    tripId = tripId,
                    sjNumber = sjNumber,
                    shortCode = shortCode,
                    uniqueCode = uniqueCode,
                    customer = customer,
                    courierId = courierId,
                    date = date,
                    status = status,
                    totalDistanceKm = totalDistanceKm,
                    acceptLatitude = acceptLat,
                    acceptLongitude = acceptLng,
                    branchId = branchId,
                    adminBulkSjUrl = adminBulkSjUrl,
                    adminBulkSjUrls = adminBulkSjUrls,
                    vehiclePlate = vehiclePlate,
                    vehicleName = vehicleName,
                    vehicleType = vehicleType,
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

        val todayCalendar = Calendar.getInstance()
        val todayYear = todayCalendar.get(Calendar.YEAR)
        val todayDayOfYear = todayCalendar.get(Calendar.DAY_OF_YEAR)

        val tripList = allTrips.filter { t ->
            val cleanCId = cleanString(t.courierId)
            val isMatch = t.courierId == userId ||
                currentIds.contains(cleanCId) ||
                currentIds.contains(t.courierId)

            // Strict date filter: Task must belong to today's shift
            val tripCalendar = Calendar.getInstance().apply {
                time = t.date.toDate()
            }
            val isToday = tripCalendar.get(Calendar.YEAR) == todayYear &&
                          tripCalendar.get(Calendar.DAY_OF_YEAR) == todayDayOfYear

            // Exclude if all destinations have been fulfilled
            val allDestsDone = t.destinations.isNotEmpty() && t.destinations.all { d ->
                d.status == "done" || d.proofPhotoUrl.isNotEmpty() || d.proofPhotoSj.isNotEmpty()
            }

            t.status != "completed" && !allDestsDone && isToday && isMatch
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
            .orderBy("date", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(100)
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

    fun findTripByCode(rawCode: String, onResult: (Trip?, String) -> Unit) {
        val trimmed = rawCode.trim()
        if (trimmed.isEmpty()) {
            onResult(null, "Kode atau QR Code tidak boleh kosong.")
            return
        }

        var targetTripId: String? = null
        var targetSj: String? = null
        var targetShortCode: String? = null

        if (trimmed.startsWith("WTRACK|SJ|", ignoreCase = true)) {
            val parts = trimmed.split("|")
            targetTripId = parts.getOrNull(2)?.trim()
            targetSj = parts.getOrNull(3)?.trim()
            targetShortCode = parts.getOrNull(4)?.trim()
        } else {
            if (trimmed.startsWith("TRIP_", ignoreCase = true)) {
                targetTripId = trimmed
            } else if (trimmed.startsWith("SJ-", ignoreCase = true) || trimmed.startsWith("SJ/", ignoreCase = true)) {
                targetSj = trimmed
            } else if (trimmed.length in 4..7) {
                targetShortCode = trimmed.uppercase()
            } else {
                targetSj = trimmed
            }
        }

        val cleanRaw = cleanString(trimmed)

        // 1. Cek memory cache trip terlebih dahulu
        val cachedMatch = cachedAllTrips.firstOrNull { t ->
            val matchId = targetTripId != null && (t.tripId.equals(targetTripId, ignoreCase = true) || t.tripId.contains(targetTripId, ignoreCase = true))
            val matchShort = targetShortCode != null && (t.shortCode.equals(targetShortCode, ignoreCase = true) || t.uniqueCode.equals(targetShortCode, ignoreCase = true))
            val matchSj = targetSj != null && (t.sjNumber.contains(targetSj, ignoreCase = true) || t.tripId.contains(targetSj, ignoreCase = true))
            val directMatch = t.tripId.contains(trimmed, ignoreCase = true) ||
                              t.shortCode.equals(trimmed, ignoreCase = true) ||
                              t.uniqueCode.equals(trimmed, ignoreCase = true) ||
                              t.sjNumber.contains(trimmed, ignoreCase = true) ||
                              cleanString(t.tripId).contains(cleanRaw) ||
                              cleanString(t.shortCode) == cleanRaw ||
                              cleanString(t.uniqueCode) == cleanRaw ||
                              cleanString(t.sjNumber).contains(cleanRaw) ||
                              cleanString(t.customer).contains(cleanRaw)

            val destMatch = t.destinations.any { d ->
                cleanString(d.locationName).contains(cleanRaw) ||
                cleanString(d.address).contains(cleanRaw) ||
                (targetSj != null && d.sjNumber.contains(targetSj, ignoreCase = true)) ||
                (targetShortCode != null && (d.shortCode.equals(targetShortCode, ignoreCase = true) || d.shortCode.contains(targetShortCode, ignoreCase = true))) ||
                d.sjNumber.contains(trimmed, ignoreCase = true) ||
                d.shortCode.equals(trimmed, ignoreCase = true)
            }

            matchId || matchShort || matchSj || directMatch || destMatch
        }

        if (cachedMatch != null) {
            onResult(cachedMatch, "")
            return
        }

        // 2. Query Firestore
        val tripsRef = db.collection("trips")
        if (targetTripId != null) {
            tripsRef.document(targetTripId).get().addOnSuccessListener { doc ->
                if (doc.exists()) {
                    val trip = parseTripFromDocument(doc)
                    if (trip != null) {
                        onResult(trip, "")
                        return@addOnSuccessListener
                    }
                }
                searchTripsInFirestore(tripsRef, trimmed, targetSj, targetShortCode, onResult)
            }.addOnFailureListener {
                searchTripsInFirestore(tripsRef, trimmed, targetSj, targetShortCode, onResult)
            }
        } else {
            searchTripsInFirestore(tripsRef, trimmed, targetSj, targetShortCode, onResult)
        }
    }

    private fun searchTripsInFirestore(
        tripsRef: com.google.firebase.firestore.CollectionReference,
        rawQuery: String,
        targetSj: String?,
        targetShortCode: String?,
        onResult: (Trip?, String) -> Unit
    ) {
        // Ambil 150 trip terbaru dari Firestore tanpa filter ketat agar surat jalan testing dapat diambil langsung
        tripsRef.limit(150).get()
            .addOnSuccessListener { snap ->
                val cleanRaw = cleanString(rawQuery)
                var foundTrip: Trip? = null

                for (doc in snap.documents) {
                    val tId = doc.getString("tripId") ?: doc.id
                    val sjNum = doc.getString("sjNumber") ?: doc.getString("noSJ") ?: ""
                    val sCode = doc.getString("shortCode") ?: doc.getString("uniqueCode") ?: ""
                    val cust = doc.getString("customer") ?: doc.getString("clientName") ?: ""

                    @Suppress("UNCHECKED_CAST")
                    val rawDestinations = doc.get("destinations") as? List<Map<String, Any?>> ?: emptyList()

                    val matchDirect = (targetShortCode != null && (sCode.equals(targetShortCode, ignoreCase = true) || sCode.contains(targetShortCode, ignoreCase = true))) ||
                                      (targetSj != null && sjNum.contains(targetSj, ignoreCase = true)) ||
                                      sCode.equals(rawQuery, ignoreCase = true) ||
                                      sjNum.contains(rawQuery, ignoreCase = true) ||
                                      tId.contains(rawQuery, ignoreCase = true) ||
                                      cust.contains(rawQuery, ignoreCase = true) ||
                                      cleanString(sCode) == cleanRaw ||
                                      cleanString(sjNum).contains(cleanRaw) ||
                                      cleanString(tId).contains(cleanRaw) ||
                                      cleanString(cust).contains(cleanRaw)

                    val matchDest = rawDestinations.any { d ->
                        val loc = (d["locationName"] as? String) ?: ""
                        val addr = (d["address"] as? String) ?: ""
                        val dSj = (d["sjNumber"] as? String) ?: (d["noSJ"] as? String) ?: ""
                        val dSc = (d["shortCode"] as? String) ?: (d["uniqueCode"] as? String) ?: ""

                        (targetShortCode != null && (dSc.equals(targetShortCode, ignoreCase = true) || dSc.contains(targetShortCode, ignoreCase = true))) ||
                        (targetSj != null && dSj.contains(targetSj, ignoreCase = true)) ||
                        loc.contains(rawQuery, ignoreCase = true) ||
                        addr.contains(rawQuery, ignoreCase = true) ||
                        dSj.contains(rawQuery, ignoreCase = true) ||
                        dSc.equals(rawQuery, ignoreCase = true) ||
                        cleanString(loc).contains(cleanRaw) ||
                        cleanString(addr).contains(cleanRaw) ||
                        cleanString(dSj).contains(cleanRaw) ||
                        cleanString(dSc) == cleanRaw
                    }

                    if (matchDirect || matchDest) {
                        foundTrip = parseTripFromDocument(doc)
                        break
                    }
                }

                if (foundTrip != null) {
                    onResult(foundTrip, "")
                } else {
                    onResult(null, "Surat Jalan '${rawQuery}' tidak ditemukan di database.")
                }
            }
            .addOnFailureListener { e ->
                onResult(null, "Gagal mencari data: ${e.message}")
            }
    }

    fun claimExistingTrip(trip: Trip, onComplete: (Boolean, String) -> Unit) {
        val currentUser = auth.currentUser
        if (currentUser == null) {
            onComplete(false, "Kurir belum login.")
            return
        }

        val myUid = currentUser.uid
        val myEmail = currentUser.email ?: ""
        val myName = if (myEmail.contains("@")) myEmail.substringBefore("@") else myUid.take(8)

        // Anggap saja SJ yang dites belum diantar (sesuai instruksi user)
        // Bebaskan klaim penugasan untuk pengujian kurir
        val updates = mutableMapOf<String, Any>(
            "courierId" to myUid,
            "courierName" to myName,
            "status" to "in_progress",
            "date" to Timestamp.now(),
            "acceptedTime" to Timestamp.now(),
            "branchWorkflowStatus" to "in_transit"
        )

        // Reset destination statuses to "pending" so courier can test the entire workflow
        if (trip.destinations.isNotEmpty()) {
            val resetDests = trip.destinations.map { d ->
                mapOf(
                    "stopIndex" to d.stopIndex,
                    "locationName" to d.locationName,
                    "address" to d.address,
                    "latitude" to d.latitude,
                    "longitude" to d.longitude,
                    "status" to "pending",
                    "sjNumber" to d.sjNumber,
                    "shortCode" to d.shortCode,
                    "itemsSummary" to d.itemsSummary,
                    "qty" to d.qty,
                    "proofPhotoUrl" to "",
                    "proofPhotoSj" to "",
                    "proofPhotoItems" to emptyList<String>()
                )
            }
            updates["destinations"] = resetDests
        }

        db.collection("trips").document(trip.tripId).update(updates)
            .addOnSuccessListener {
                onComplete(true, "Berhasil mengambil Surat Jalan ${trip.sjNumber.ifEmpty { trip.tripId }}!")
                refresh()
            }
            .addOnFailureListener { _ ->
                // Jika dokumen memerlukan set merge (misal trip dari mock/local)
                db.collection("trips").document(trip.tripId).set(updates, com.google.firebase.firestore.SetOptions.merge())
                    .addOnSuccessListener {
                        onComplete(true, "Berhasil mengambil Surat Jalan ${trip.sjNumber.ifEmpty { trip.tripId }}!")
                        refresh()
                    }
                    .addOnFailureListener { err ->
                        onComplete(false, "Gagal mengklaim tugas: ${err.message}")
                    }
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
