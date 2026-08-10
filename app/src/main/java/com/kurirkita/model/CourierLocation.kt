package com.KurirKita.model

data class CourierLocation(
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val courierId: String = "Courier_01", // Default ID for simple app
    val timestamp: Long = System.currentTimeMillis()
)
