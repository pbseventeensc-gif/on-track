package com.KurirKita.ui

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.KurirKita.model.Destination
import com.KurirKita.model.Trip
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import java.io.ByteArrayOutputStream
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveTripScreen(trip: Trip, onBack: () -> Unit, onChatClick: () -> Unit) {
    val db = FirebaseFirestore.getInstance()
    var currentTrip by remember { mutableStateOf(trip) }
    val storage = FirebaseStorage.getInstance()

    // Realtime listener for this specific trip
    DisposableEffect(trip.tripId) {
        val registration = db.collection("trips").document(trip.tripId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                snapshot?.toObject(Trip::class.java)?.let { currentTrip = it }
            }
        onDispose { registration.remove() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detail Tugas", style = MaterialTheme.typography.titleMedium) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("Kembali") }
                },
                actions = {
                    IconButton(onClick = onChatClick) {
                        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chat", tint = MaterialTheme.colorScheme.primary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Status Perjalanan", style = MaterialTheme.typography.labelMedium, color = Color.Gray)
                    Text(currentTrip.status.uppercase(), style = MaterialTheme.typography.headlineSmall, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                    
                    if (currentTrip.status == "assigned") {
                        Button(
                            onClick = { db.collection("trips").document(currentTrip.tripId).update("status", "accepted") },
                            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1C40F), contentColor = Color.Black)
                        ) {
                            Text("TERIMA TUGAS SEKARANG", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                        }
                    }
                }
            }

            Text("Daftar Tujuan (${currentTrip.destinations.size})", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(vertical = 8.dp))
            
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(currentTrip.destinations.sortedBy { it.stopIndex }) { dest ->
                    DestinationItem(dest, onStatusUpdate = { newStatus, photoUri ->
                        if (photoUri != null) {
                            uploadPhotoAndUpdate(storage, db, currentTrip, dest, photoUri, newStatus)
                        } else {
                            updateDestinationStatus(db, currentTrip, dest, newStatus, null)
                        }
                    })
                }
            }
        }
    }
}

@Composable
fun DestinationItem(dest: Destination, onStatusUpdate: (String, Bitmap?) -> Unit) {
    var isUploading by remember { mutableStateOf(false) }
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) {
            isUploading = true
            onStatusUpdate("done", bitmap)
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (dest.status == "done") Color(0xFFE8F5E9) else Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Surface(
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = if (dest.status == "done") Color(0xFF2E7D32) else Color(0xFFD32F2F),
                    modifier = Modifier.size(24.dp)
                ) {
                    Box(contentAlignment = androidx.compose.ui.Alignment.Center) {
                        Text(dest.stopIndex.toString(), color = Color.White, style = MaterialTheme.typography.labelSmall)
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = dest.locationName,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                    color = if (dest.status == "done") Color(0xFF2E7D32) else Color.Black
                )
            }
            
            if (dest.address.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = dest.address,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Gray
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            
            if (dest.status == "done") {
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF2E7D32), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Selesai dikirim", color = Color(0xFF2E7D32), style = MaterialTheme.typography.labelMedium)
                }
            } else {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    if (dest.status == "pending") {
                        Button(
                            onClick = { onStatusUpdate("arrived", null) },
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
                        ) {
                            Text("Tiba di Lokasi")
                        }
                    } else if (dest.status == "arrived") {
                        Button(
                            onClick = { cameraLauncher.launch(null) },
                            enabled = !isUploading,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1C40F), contentColor = Color.Black),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
                        ) {
                            if (isUploading) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Foto & Selesai")
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun uploadPhotoAndUpdate(
    storage: FirebaseStorage,
    db: FirebaseFirestore,
    trip: Trip,
    dest: Destination,
    bitmap: Bitmap,
    newStatus: String
) {
    val fileName = "proof_${trip.tripId}_${dest.stopIndex}_${UUID.randomUUID()}.jpg"
    val ref = storage.reference.child("proofs/$fileName")
    
    val baos = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.JPEG, 70, baos)
    val data = baos.toByteArray()

    ref.putBytes(data).addOnSuccessListener {
        ref.downloadUrl.addOnSuccessListener { uri ->
            updateDestinationStatus(db, trip, dest, newStatus, uri.toString())
        }
    }.addOnFailureListener {
        updateDestinationStatus(db, trip, dest, newStatus, null)
    }
}

private fun updateDestinationStatus(
    db: FirebaseFirestore, 
    trip: Trip, 
    dest: Destination, 
    newStatus: String,
    photoUrl: String?
) {
    val updatedDestinations = trip.destinations.map {
        if (it.stopIndex == dest.stopIndex) {
            val now = Timestamp.now()
            it.copy(
                status = newStatus,
                arrivalTime = if (newStatus == "arrived") now else it.arrivalTime,
                completedTime = if (newStatus == "done") now else it.completedTime,
                proofPhotoUrl = photoUrl ?: it.proofPhotoUrl
            )
        } else it
    }
    
    val updates = mutableMapOf<String, Any>("destinations" to updatedDestinations)
    if (trip.status == "accepted" && newStatus == "arrived") updates["status"] = "in_progress"
    if (updatedDestinations.all { it.status == "done" }) updates["status"] = "completed"

    db.collection("trips").document(trip.tripId).update(updates)
}
