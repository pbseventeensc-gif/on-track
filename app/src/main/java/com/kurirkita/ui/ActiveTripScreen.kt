package com.KurirKita.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.KurirKita.model.Destination
import com.KurirKita.model.Trip
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore

@Composable
fun ActiveTripScreen(trip: Trip, onBack: () -> Unit) {
    val db = FirebaseFirestore.getInstance()
    var currentTrip by remember { mutableStateOf(trip) }

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
            Text("Detail Tugas", style = MaterialTheme.typography.headlineMedium)
            TextButton(onClick = onBack) { Text("Kembali") }
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
                DestinationItem(dest, onStatusUpdate = { newStatus ->
                    updateDestinationStatus(db, currentTrip, dest, newStatus)
                })
            }
        }
    }
}

@Composable
fun DestinationItem(dest: Destination, onStatusUpdate: (String) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(dest.locationName, style = MaterialTheme.typography.titleMedium)
            Text("Urutan: ${dest.stopIndex}")
            Text("Status: ${dest.status}")
            
            Spacer(modifier = Modifier.height(8.dp))
            Row {
                if (dest.status == "pending") {
                    Button(onClick = { onStatusUpdate("arrived") }) {
                        Text("Tiba di Lokasi")
                    }
                } else if (dest.status == "arrived") {
                    Button(
                        onClick = { onStatusUpdate("done") },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("Selesai (Menuju Berikutnya)")
                    }
                }
            }
        }
    }
}

private fun updateDestinationStatus(db: FirebaseFirestore, trip: Trip, dest: Destination, newStatus: String) {
    val updatedDestinations = trip.destinations.map {
        if (it.stopIndex == dest.stopIndex) {
            val now = Timestamp.now()
            it.copy(
                status = newStatus,
                arrivalTime = if (newStatus == "arrived") now else it.arrivalTime,
                completedTime = if (newStatus == "done") now else it.completedTime
            )
        } else it
    }
    
    val updates = mutableMapOf<String, Any>("destinations" to updatedDestinations)
    
    // Auto start trip if first one arrives
    if (trip.status == "accepted" && newStatus == "arrived") {
        updates["status"] = "in_progress"
    }
    
    // Auto complete trip if all done
    if (updatedDestinations.all { it.status == "done" }) {
        updates["status"] = "completed"
    }

    db.collection("trips").document(trip.tripId).update(updates)
}
