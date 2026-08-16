package com.KurirKita.model

import com.google.firebase.Timestamp

data class CourierLocation(
    val courierId: String = "Courier_01",
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val batteryLevel: Int = 0,
    val lastUpdated: Timestamp = Timestamp.now(),
    val totalDistanceKm: Double = 0.0
)
