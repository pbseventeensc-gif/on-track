package com.KurirKita.model

import com.google.firebase.Timestamp

data class Trip(
    val tripId: String = "",
    val courierId: String = "",
    val date: Timestamp = Timestamp.now(),
    val status: String = "assigned", // "assigned" | "accepted" | "in_progress" | "completed"
    val totalDistanceKm: Double = 0.0,
    val destinations: List<Destination> = emptyList()
)

data class Destination(
    val stopIndex: Int = 0,
    val locationName: String = "",
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val status: String = "pending", // "pending" | "arrived" | "done"
    val arrivalTime: Timestamp? = null,
    val completedTime: Timestamp? = null,
    val batteryOnArrival: Int? = null,
    val proofPhotoUrl: String = ""
)
