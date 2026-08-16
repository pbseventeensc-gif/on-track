package com.KurirKita.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.KurirKita.model.ChatMessage
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun ChatScreen(tripId: String, onBack: () -> Unit) {
    val db = FirebaseFirestore.getInstance()
    val auth = FirebaseAuth.getInstance()
    val currentUserId = auth.currentUser?.uid ?: ""
    
    var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }

    // Listen to messages
    DisposableEffect(tripId) {
        val registration = db.collection("trips").document(tripId).collection("messages")
            .orderBy("timestamp", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                messages = snapshot?.toObjects(ChatMessage::class.java) ?: emptyList()
            }
        onDispose { registration.remove() }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("Kembali") }
            Spacer(modifier = Modifier.width(8.dp))
            Text("Chat Admin", style = MaterialTheme.typography.headlineSmall)
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            reverseLayout = false,
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            items(messages) { msg ->
                val isMine = msg.senderId == currentUserId
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = if (isMine) Alignment.CenterEnd else Alignment.CenterStart
                ) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (isMine) MaterialTheme.colorScheme.primaryContainer else Color.LightGray
                        ),
                        modifier = Modifier.padding(vertical = 2.dp).fillMaxWidth(0.7f)
                    ) {
                        Column(modifier = Modifier.padding(8.dp)) {
                            Text(msg.text, style = MaterialTheme.typography.bodyMedium)
                            val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
                            Text(
                                text = sdf.format(msg.timestamp.toDate()),
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.align(Alignment.End)
                            )
                        }
                    }
                }
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Ketik pesan...") }
            )
            IconButton(onClick = {
                if (inputText.isNotBlank()) {
                    val msgId = db.collection("trips").document(tripId).collection("messages").document().id
                    val newMsg = ChatMessage(
                        messageId = msgId,
                        senderId = currentUserId,
                        text = inputText,
                        timestamp = Timestamp.now()
                    )
                    db.collection("trips").document(tripId).collection("messages").document(msgId).set(newMsg)
                    inputText = ""
                }
            }) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
            }
        }
    }
}
