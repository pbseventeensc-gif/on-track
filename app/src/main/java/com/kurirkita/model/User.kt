package com.KurirKita.model

data class User(
    val userId: String = "",
    val name: String = "",
    val role: String = "courier", // "admin" | "courier"
    val currentStatus: String = "idle" // "idle" | "on_delivery"
)
