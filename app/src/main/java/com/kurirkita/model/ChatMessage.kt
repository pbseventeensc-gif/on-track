package com.KurirKita.model

import com.google.firebase.Timestamp

data class ChatMessage(
    val messageId: String = "",
    val senderId: String = "",
    val text: String = "",
    val imageUrl: String? = null,
    val timestamp: Timestamp = Timestamp.now()
)
