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

@Composable
fun ActiveTripScreen(trip: Trip, onBack: () -> Unit, onChatClick: () -> Unit) {
    val db = FirebaseFirestore.getInstance()
    var currentTrip by remember { mutableStateOf(trip) }
    val storage = FirebaseStorage.getInstance()
    val context = LocalContext.current

    // Realtime listener for this specific trip
    DisposableEffect(trip.tripId) {
        val registration = db.collection("trips").document(trip.tripId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                snapshot?.toObject(Trip::class.java)?.let { currentTrip = it }
            }
        onDispose { registration.remove() }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                TextButton(onClick = onBack) { Text("Kembali") }
                Text("Detail Tugas", style = MaterialTheme.typography.headlineMedium)
            }
            IconButton(onClick = onChatClick) {
                Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chat")
            }
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        Text("Status: ${currentTrip.status}", style = MaterialTheme.typography.titleMedium)
        
        if (currentTrip.status == "assigned") {
            Button(
                onClick = { 
                    db.collection("trips").document(currentTrip.tripId).update("status", "accepted")
                },
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
            ) {
                Text("Terima Tugas")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        Text("Daftar Tujuan:", style = MaterialTheme.typography.titleLarge)
        
        LazyColumn(modifier = Modifier.weight(1f)) {
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

    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(dest.locationName, style = MaterialTheme.typography.titleMedium)
            Text("Urutan: ${dest.stopIndex}")
            Text("Status: ${dest.status}")
            
            if (dest.proofPhotoUrl.isNotEmpty()) {
                Text("✅ Foto bukti sudah diunggah", color = Color(0xFF2E7D32), style = MaterialTheme.typography.labelSmall)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row {
                if (dest.status == "pending") {
                    Button(onClick = { onStatusUpdate("arrived", null) }) {
                        Text("Tiba di Lokasi")
                    }
                } else if (dest.status == "arrived") {
                    Button(
                        onClick = { cameraLauncher.launch(null) },
                        enabled = !isUploading,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        if (isUploading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text("Ambil Foto & Selesai")
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
