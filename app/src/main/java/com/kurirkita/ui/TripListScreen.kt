package com.KurirKita.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.KurirKita.model.Trip

@Composable
fun TripListScreen(viewModel: TripViewModel, onTripClick: (Trip) -> Unit) {
    val trips by viewModel.trips.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Tugas Pengantaran", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        
        if (trips.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                Text("Tidak ada tugas saat ini.")
            }
        } else {
            LazyColumn {
                items(trips) { trip ->
                    Card(
                        onClick = { onTripClick(trip) },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Trip ID: ${trip.tripId}", style = MaterialTheme.typography.titleMedium)
                            Text("Status: ${trip.status}")
                            Text("Titik Antar: ${trip.destinations.size}")
                        }
                    }
                }
            }
        }
    }
}
